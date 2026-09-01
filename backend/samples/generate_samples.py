"""
Script to generate valid test audio WAV files (16kHz, Mono, 3.5s) for testing and demo purposes.
"""

import math
import struct
import wave
from pathlib import Path

SAMPLES_DIR = Path(__file__).parent
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)

def generate_wave(filename: str, f0_base: float, is_synthetic: bool = False, duration: float = 3.5, sr: int = 16000):
    num_samples = int(duration * sr)
    filepath = SAMPLES_DIR / filename
    
    with wave.open(str(filepath), 'w') as wav:
        wav.setnchannels(1)        # Mono
        wav.setsampwidth(2)        # 16-bit PCM
        wav.setframerate(sr)       # 16 kHz

        frames = bytearray()
        for i in range(num_samples):
            t = i / sr
            
            if not is_synthetic:
                # Natural human vocal modulation: smooth F0 drift, harmonics (F0, 2*F0, 3*F0)
                # Formants around 800Hz, 1200Hz, 2500Hz
                f0_mod = f0_base + 18.0 * math.sin(2 * math.pi * 3.2 * t) + 8.0 * math.sin(2 * math.pi * 7.5 * t)
                vocal = (
                    0.50 * math.sin(2 * math.pi * f0_mod * t) +
                    0.25 * math.sin(2 * math.pi * 2 * f0_mod * t) +
                    0.15 * math.sin(2 * math.pi * 3 * f0_mod * t) +
                    0.10 * math.sin(2 * math.pi * 4 * f0_mod * t)
                )
                # Syllabic envelope
                envelope = 0.4 + 0.6 * math.sin(2 * math.pi * 1.5 * t) ** 2
            else:
                # Synthetic speech characteristics: ultra-flat F0 (std ~ 0.2 Hz), sharp harmonic overtones
                f0_mod = f0_base + 0.15 * math.sin(2 * math.pi * 0.5 * t)
                vocal = (
                    0.40 * math.sin(2 * math.pi * f0_mod * t) +
                    0.25 * math.sin(2 * math.pi * 2 * f0_mod * t) +
                    0.20 * math.sin(2 * math.pi * 3 * f0_mod * t) +
                    0.15 * math.sin(2 * math.pi * 5 * f0_mod * t)
                )
                # Mechanical continuous envelope
                envelope = 0.85

            sample_val = int(vocal * envelope * 24000)
            sample_val = max(-32767, min(32767, sample_val))
            frames.extend(struct.pack('<h', sample_val))

        wav.writeframes(frames)
    print(f"Generated sample: {filepath} ({duration}s, {sr}Hz, mono)")

if __name__ == "__main__":
    generate_wave("genuine_demo.wav", f0_base=150.0, is_synthetic=False)
    generate_wave("synthetic_demo.wav", f0_base=180.0, is_synthetic=True)
