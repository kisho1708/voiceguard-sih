"""
Unit Tests for Acoustic Feature Extraction & Anomaly Scoring (CPU-Only)
"""

import numpy as np
import pytest
from backend.acoustic import extract_acoustic_features, calculate_acoustic_anomaly_score

def test_extract_acoustic_features_shape_and_types():
    # 3 seconds of 16kHz sine wave audio (48,000 samples)
    t = np.linspace(0, 3.0, 48000, dtype=np.float32)
    audio = 0.5 * np.sin(2 * np.pi * 150.0 * t)

    features = extract_acoustic_features(audio, sr=16000)

    assert "pitch_mean" in features
    assert "pitch_std" in features
    assert "energy_mean" in features
    assert "spectral_centroid" in features
    assert "spectral_bandwidth" in features
    assert "spectral_rolloff" in features
    assert "zcr" in features
    assert "mfcc_summary" in features
    assert "anomaly_score" in features

    assert isinstance(features["anomaly_score"], int)
    assert 0 <= features["anomaly_score"] <= 100
    assert len(features["mfcc_summary"]) == 13

def test_calculate_acoustic_anomaly_score_flat_vs_dynamic():
    # Test flat synthetic-like features
    synthetic_features = {
        "pitch_mean": 180.0,
        "pitch_std": 0.5,  # Unnaturally flat
        "energy_mean": 0.05,
        "energy_std": 0.005,  # Continuous unbroken tone
        "spectral_centroid": 3600.0,  # High frequency vocoder artifacts
        "zcr": 0.19
    }
    score_synth = calculate_acoustic_anomaly_score(synthetic_features)
    assert score_synth >= 60

    # Test natural speech features
    natural_features = {
        "pitch_mean": 145.0,
        "pitch_std": 24.0,  # Natural human pitch jitter
        "energy_mean": 0.035,
        "energy_std": 0.022,  # Natural syllabic pauses
        "spectral_centroid": 1850.0,  # Typical vocal tract formant region
        "zcr": 0.065
    }
    score_nat = calculate_acoustic_anomaly_score(natural_features)
    assert score_nat <= 35
