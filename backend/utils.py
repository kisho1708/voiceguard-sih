"""
VoiceGuard / SIH26104 - Audio Preprocessing & Validation Utilities
CPU-only audio pipeline: loading, mono conversion, 16kHz resampling, and normalization.
Pure NumPy and standard library execution with zero native DLL policy locks.
"""

import os
import uuid
import wave
from pathlib import Path
from typing import Tuple, Optional, Dict, Any

import numpy as np
import soundfile as sf

from .config import (
    UPLOAD_DIR,
    SAMPLE_RATE,
    MIN_AUDIO_DURATION,
    MAX_AUDIO_DURATION,
    MAX_FILE_SIZE_MB,
    ALLOWED_AUDIO_EXTENSIONS
)

def validate_audio_file(file_path: Path) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Validates uploaded audio against size, extension, integrity, and duration limits.
    Returns: (is_valid, error_message, metadata_dict)
    """
    if not file_path.exists():
        return False, "Audio file does not exist on disk.", None

    # 1. File Extension Check
    suffix = file_path.suffix.lower()
    if suffix not in ALLOWED_AUDIO_EXTENSIONS:
        return False, f"Unsupported audio format '{suffix}'. Allowed: {', '.join(ALLOWED_AUDIO_EXTENSIONS)}", None

    # 2. File Size Check
    size_bytes = file_path.stat().st_size
    size_mb = size_bytes / (1024 * 1024)
    if size_bytes == 0:
        return False, "Uploaded audio file is empty (0 bytes).", None
    if size_mb > MAX_FILE_SIZE_MB:
        return False, f"File size ({size_mb:.2f} MB) exceeds maximum allowed limit of {MAX_FILE_SIZE_MB} MB.", None

    # 3. Audio Header & Duration Check
    duration = 0.0
    sr = 16000
    channels = 1
    format_name = suffix.lstrip('.').upper()

    try:
        info = sf.info(str(file_path))
        duration = info.duration
        sr = info.samplerate
        channels = info.channels
        format_name = info.format
    except Exception:
        # Fallback to standard library wave module for WAV files
        try:
            with wave.open(str(file_path), "rb") as wf:
                channels = wf.getnchannels()
                sr = wf.getframerate()
                n_frames = wf.getnframes()
                duration = n_frames / float(sr)
                format_name = "WAV"
        except Exception as w_err:
            return False, f"Corrupted or unreadable audio file: {str(w_err)}", None

    if duration < MIN_AUDIO_DURATION:
        return False, f"Audio duration ({duration:.2f}s) is too short. Minimum required is {MIN_AUDIO_DURATION} seconds.", None

    if duration > MAX_AUDIO_DURATION:
        return False, f"Audio duration ({duration:.2f}s) exceeds maximum allowed of {MAX_AUDIO_DURATION} seconds.", None

    meta = {
        "duration_seconds": round(duration, 3),
        "original_samplerate": sr,
        "channels": channels,
        "format": format_name,
        "size_kb": round(size_bytes / 1024, 2)
    }

    return True, None, meta

def convert_to_mono(audio: np.ndarray) -> np.ndarray:
    """Converts multi-channel audio to mono."""
    if audio.ndim == 1:
        return audio
    if audio.ndim == 2:
        if audio.shape[0] < audio.shape[1]:
            return np.mean(audio, axis=0)
        return np.mean(audio, axis=1)
    return audio.flatten()

def normalize_audio(audio: np.ndarray) -> np.ndarray:
    """Peak-normalizes audio between -1.0 and 1.0."""
    audio = audio.astype(np.float32)
    peak = np.max(np.abs(audio))
    if peak > 0:
        return audio / peak
    return audio

def resample_audio(audio: np.ndarray, orig_sr: int, target_sr: int = 16000) -> np.ndarray:
    """Resamples audio array to target sample rate using pure NumPy interpolation on CPU."""
    if orig_sr == target_sr:
        return audio.astype(np.float32)
    
    duration = len(audio) / float(orig_sr)
    num_target_samples = int(round(duration * target_sr))
    if num_target_samples == 0:
        return audio.astype(np.float32)
    
    orig_indices = np.linspace(0, len(audio) - 1, num_target_samples)
    resampled = np.interp(orig_indices, np.arange(len(audio)), audio)
    return resampled.astype(np.float32)

def load_audio(file_path: Path, target_sr: int = SAMPLE_RATE) -> Tuple[np.ndarray, int]:
    """
    Standardized CPU audio loader pipeline:
    Load -> Mono Conversion -> Resample to 16kHz -> Peak Normalize.
    """
    try:
        audio, sr = sf.read(str(file_path), dtype="float32")
    except Exception:
        # Fallback reading with Python wave module
        with wave.open(str(file_path), "rb") as wf:
            channels = wf.getnchannels()
            sr = wf.getframerate()
            n_frames = wf.getnframes()
            raw_bytes = wf.readframes(n_frames)
            sampwidth = wf.getsampwidth()
            if sampwidth == 2:
                audio = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            else:
                audio = np.frombuffer(raw_bytes, dtype=np.uint8).astype(np.float32) / 128.0 - 1.0
            if channels > 1:
                audio = audio.reshape(-1, channels)

    audio_mono = convert_to_mono(audio)
    audio_resampled = resample_audio(audio_mono, orig_sr=sr, target_sr=target_sr)
    audio_norm = normalize_audio(audio_resampled)

    return audio_norm, target_sr

def save_temp_upload(file_bytes: bytes, original_filename: str) -> Path:
    """Saves incoming upload bytes into a unique temporary file."""
    ext = Path(original_filename).suffix.lower() or ".wav"
    unique_name = f"upload_{uuid.uuid4().hex[:12]}{ext}"
    temp_path = UPLOAD_DIR / unique_name
    
    with open(temp_path, "wb") as f:
        f.write(file_bytes)
    
    return temp_path

def cleanup_temp_file(file_path: Optional[Path]):
    """Safely removes temporary audio file after analysis (Zero-retention privacy)."""
    if file_path and isinstance(file_path, Path) and file_path.exists():
        try:
            file_path.unlink()
        except Exception:
            pass
