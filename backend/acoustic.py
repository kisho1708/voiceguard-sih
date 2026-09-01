"""
VoiceGuard / SIH26104 - Pure NumPy CPU Acoustic Feature Extraction & Anomaly Scoring
Provides high-performance, deterministic acoustic DSP algorithms running 100% on CPU.
Zero dependency on external native C-extension DLLs.
"""

from typing import Dict, Any, List
import numpy as np

def _hz_to_mel(hz: np.ndarray) -> np.ndarray:
    return 2595.0 * np.log10(1.0 + hz / 700.0)

def _mel_to_hz(mel: np.ndarray) -> np.ndarray:
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)

def _get_mel_filterbank(sr: int = 16000, n_fft: int = 1024, n_mels: int = 13) -> np.ndarray:
    """Constructs Mel-scale triangular filterbank matrix on CPU."""
    low_freq = 0.0
    high_freq = sr / 2.0
    mel_points = np.linspace(_hz_to_mel(np.array([low_freq]))[0], _hz_to_mel(np.array([high_freq]))[0], n_mels + 2)
    hz_points = _mel_to_hz(mel_points)
    bin_points = np.floor((n_fft + 1) * hz_points / sr).astype(int)

    fbank = np.zeros((n_mels, int(n_fft / 2 + 1)))
    for m in range(1, n_mels + 1):
        f_m_minus = bin_points[m - 1]
        f_m = bin_points[m]
        f_m_plus = bin_points[m + 1]

        for k in range(f_m_minus, f_m):
            if f_m != f_m_minus:
                fbank[m - 1, k] = (k - bin_points[m - 1]) / (f_m - f_m_minus)
        for k in range(f_m, f_m_plus):
            if f_m_plus != f_m:
                fbank[m - 1, k] = (bin_points[m + 1] - k) / (f_m_plus - f_m)

    return fbank

def _compute_mfccs_numpy(audio: np.ndarray, sr: int = 16000, n_mfcc: int = 13, frame_size: int = 1024, hop_size: int = 512) -> List[float]:
    """Extracts 13 MFCCs using pure NumPy STFT and Discrete Cosine Transform (DCT)."""
    if len(audio) < frame_size:
        audio = np.pad(audio, (0, frame_size - len(audio)), mode="wrap")

    # Framing with Hann window
    num_frames = max(1, 1 + int((len(audio) - frame_size) / hop_size))
    frames = np.lib.stride_tricks.as_strided(
        audio,
        shape=(num_frames, frame_size),
        strides=(audio.strides[0] * hop_size, audio.strides[0])
    )
    window = np.hanning(frame_size)
    windowed_frames = frames * window

    # Power Spectrum
    mag_spectrum = np.abs(np.fft.rfft(windowed_frames, n=frame_size, axis=-1))
    power_spectrum = (mag_spectrum ** 2) / frame_size

    # Filterbank energies
    fbank = _get_mel_filterbank(sr=sr, n_fft=frame_size, n_mels=n_mfcc)
    mel_energies = np.dot(power_spectrum, fbank.T)
    mel_energies = np.where(mel_energies == 0, np.finfo(float).eps, mel_energies)
    log_mel = 10.0 * np.log10(mel_energies)

    # DCT-II
    N = log_mel.shape[1]
    n = np.arange(N)
    k = np.arange(n_mfcc)[:, None]
    dct_matrix = np.cos(np.pi * k * (2 * n + 1) / (2 * N))
    mfcc_frames = np.dot(log_mel, dct_matrix.T)

    mean_mfccs = np.mean(mfcc_frames, axis=0)
    return [float(round(m, 3)) for m in mean_mfccs]

def _estimate_pitch_numpy(audio: np.ndarray, sr: int = 16000, frame_size: int = 1024, hop_size: int = 512) -> Dict[str, float]:
    """
    Estimates fundamental frequency (F0) using normalized autocorrelation on CPU.
    Valid human speech range: 65 Hz to 450 Hz.
    """
    min_lag = int(sr / 450)  # ~35 samples
    max_lag = int(sr / 65)   # ~246 samples

    if len(audio) < frame_size:
        return {"pitch_mean": 140.0, "pitch_std": 15.0, "pitch_min": 90.0, "pitch_max": 220.0}

    num_frames = max(1, 1 + int((len(audio) - frame_size) / hop_size))
    f0_values = []

    for i in range(num_frames):
        start = i * hop_size
        frame = audio[start:start + frame_size]
        if np.max(np.abs(frame)) < 0.01:
            continue  # Silence frame

        # Autocorrelation via correlate
        frame_norm = frame - np.mean(frame)
        autocorr = np.correlate(frame_norm, frame_norm, mode="full")
        autocorr = autocorr[len(autocorr) // 2:]

        # Find peak within human vocal lag limits
        if max_lag < len(autocorr):
            search_region = autocorr[min_lag:max_lag]
            if len(search_region) > 0 and np.max(search_region) > 0:
                peak_lag = min_lag + int(np.argmax(search_region))
                if autocorr[0] > 0 and (autocorr[peak_lag] / autocorr[0]) > 0.3:
                    f0 = sr / peak_lag
                    if 65.0 <= f0 <= 450.0:
                        f0_values.append(f0)

    if len(f0_values) > 0:
        return {
            "pitch_mean": float(round(np.mean(f0_values), 2)),
            "pitch_std": float(round(np.std(f0_values), 2)),
            "pitch_min": float(round(np.min(f0_values), 2)),
            "pitch_max": float(round(np.max(f0_values), 2))
        }
    return {"pitch_mean": 140.0, "pitch_std": 15.0, "pitch_min": 90.0, "pitch_max": 220.0}

def extract_acoustic_features(audio: np.ndarray, sr: int = 16000) -> Dict[str, Any]:
    """
    Extracts core acoustic and spectral features on CPU using pure NumPy:
    - Fundamental frequency (F0/Pitch) statistics via autocorrelation
    - RMS Energy dynamics
    - Spectral Centroid, Spectral Bandwidth, and 85% Spectral Rolloff
    - Zero-Crossing Rate (ZCR)
    - 13 MFCC coefficients via Mel filterbank and DCT
    """
    # 1. Pitch / F0 Estimation
    pitch_stats = _estimate_pitch_numpy(audio, sr=sr)

    # 2. RMS Energy Dynamics (frame size 1024, hop 512)
    frame_size = 1024
    hop_size = 512
    num_frames = max(1, 1 + int((len(audio) - frame_size) / hop_size))
    rms_values = []
    for i in range(num_frames):
        frame = audio[i * hop_size : i * hop_size + frame_size]
        rms_values.append(float(np.sqrt(np.mean(frame ** 2))))
    
    energy_mean = float(np.mean(rms_values)) if rms_values else 0.03
    energy_std = float(np.std(rms_values)) if rms_values else 0.01

    # 3. Spectral Features via Pure NumPy FFT
    freqs = np.fft.rfftfreq(frame_size, d=1.0 / sr)
    centroids = []
    bandwidths = []
    rolloffs = []

    for i in range(num_frames):
        frame = audio[i * hop_size : i * hop_size + frame_size]
        if len(frame) < frame_size:
            frame = np.pad(frame, (0, frame_size - len(frame)))
        
        window = np.hanning(len(frame))
        mag_spec = np.abs(np.fft.rfft(frame * window))
        total_mag = np.sum(mag_spec)

        if total_mag > 1e-6:
            # Centroid
            cent = np.sum(freqs * mag_spec) / total_mag
            centroids.append(cent)
            
            # Bandwidth
            bw = np.sqrt(np.sum(((freqs - cent) ** 2) * mag_spec) / total_mag)
            bandwidths.append(bw)

            # 85% Rolloff
            cum_energy = np.cumsum(mag_spec)
            thresh = 0.85 * total_mag
            idx = np.where(cum_energy >= thresh)[0]
            roll = freqs[idx[0]] if len(idx) > 0 else freqs[-1]
            rolloffs.append(roll)
        else:
            centroids.append(1500.0)
            bandwidths.append(1200.0)
            rolloffs.append(3000.0)

    spectral_centroid = float(round(np.mean(centroids), 2))
    spectral_bandwidth = float(round(np.mean(bandwidths), 2))
    spectral_rolloff = float(round(np.mean(rolloffs), 2))

    # 4. Zero-Crossing Rate
    zcr = float(round(np.mean(np.abs(np.diff(np.sign(audio)))) / 2.0, 4))

    # 5. MFCC Extraction (13 Coefficients)
    mfcc_summary = _compute_mfccs_numpy(audio, sr=sr, n_mfcc=13)

    features = {
        "pitch_mean": pitch_stats["pitch_mean"],
        "pitch_std": pitch_stats["pitch_std"],
        "pitch_min": pitch_stats["pitch_min"],
        "pitch_max": pitch_stats["pitch_max"],
        "energy_mean": round(energy_mean, 4),
        "energy_std": round(energy_std, 4),
        "spectral_centroid": spectral_centroid,
        "spectral_bandwidth": spectral_bandwidth,
        "spectral_rolloff": spectral_rolloff,
        "zcr": zcr,
        "mfcc_summary": mfcc_summary
    }

    # Compute secondary Acoustic Anomaly Score
    anomaly_score = calculate_acoustic_anomaly_score(features)
    features["anomaly_score"] = anomaly_score
    return features

def calculate_acoustic_anomaly_score(features: Dict[str, Any]) -> int:
    """
    Calculates a heuristic Acoustic Anomaly Score (0–100).
    Evaluates acoustic indicators that often correlate with synthetic or manipulated audio:
    - Unnatural pitch flatness / F0 monotony (very low F0 jitter)
    - Abrupt spectral distribution deviations (abnormal high-frequency tilt)
    - Discontinuous energy variance
    """
    anomaly_points = 0.0

    # 1. Pitch Flatness / Robotic Monotony check
    pitch_std = features.get("pitch_std", 20.0)
    if pitch_std < 6.0:
        anomaly_points += 32.0  # Highly robotic flatness
    elif pitch_std < 10.0:
        anomaly_points += 18.0
    elif pitch_std > 55.0:
        anomaly_points += 15.0  # Abrupt pitch jumps (conversion glitch)

    # 2. Spectral Centroid Deviation
    centroid = features.get("spectral_centroid", 2000.0)
    if centroid > 3400.0 or centroid < 800.0:
        anomaly_points += 24.0
    elif centroid > 2900.0 or centroid < 1000.0:
        anomaly_points += 12.0

    # 3. Energy Dynamic Consistency
    energy_mean = features.get("energy_mean", 0.03)
    energy_std = features.get("energy_std", 0.01)
    if energy_mean > 0:
        cv = energy_std / energy_mean
        if cv < 0.25:
            anomaly_points += 22.0
        elif cv > 1.4:
            anomaly_points += 14.0

    # 4. Zero-Crossing Rate Outliers
    zcr = features.get("zcr", 0.07)
    if zcr > 0.18 or zcr < 0.015:
        anomaly_points += 15.0

    # Clamp between 5 and 95
    return int(np.clip(round(anomaly_points), 5, 95))
