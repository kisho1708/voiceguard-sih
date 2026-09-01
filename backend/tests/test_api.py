"""
Integration Tests for FastAPI REST Endpoints (CPU-Only Execution)
"""

import io
import math
import struct
import wave
import pytest
from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)

def create_in_memory_wav(duration: float = 3.0, sr: int = 16000) -> bytes:
    """Generates a valid 16kHz mono WAV file in memory."""
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sr)
        num_samples = int(duration * sr)
        frames = bytearray()
        for i in range(num_samples):
            t = i / sr
            sample = int(math.sin(2 * math.pi * 200.0 * t) * 16000)
            frames.extend(struct.pack('<h', sample))
        wav.writeframes(frames)
    buf.seek(0)
    return buf.read()

def test_get_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["device"] == "cpu"
    assert data["model_loaded"] is True
    assert data["database"] == "connected"

def test_post_analyze_valid_audio():
    wav_bytes = create_in_memory_wav(duration=3.0)
    files = {"file": ("test_sample.wav", wav_bytes, "audio/wav")}
    data = {
        "caller_id": "+919841028419",
        "transaction_amount": "75000"
    }

    response = client.post("/analyze", files=files, data=data)
    assert response.status_code == 200
    res = response.json()

    assert res["success"] is True
    assert "risk_score" in res
    assert 0 <= res["risk_score"] <= 100
    assert res["recommendation"] in ["APPROVE", "CHALLENGE", "ESCALATE"]
    assert "voice_analysis" in res
    assert "acoustic_analysis" in res
    assert "context_analysis" in res
    assert "processing" in res
    assert res["processing"]["device"] == "cpu"
    assert res["processing"]["total_processing_time_ms"] > 0

def test_post_analyze_too_short_audio_error():
    # 0.5s audio is under the 2.0s limit
    short_wav_bytes = create_in_memory_wav(duration=0.5)
    files = {"file": ("short.wav", short_wav_bytes, "audio/wav")}
    data = {"caller_id": "+919122390182", "transaction_amount": "5000"}

    response = client.post("/analyze", files=files, data=data)
    assert response.status_code == 400
    assert "too short" in response.json()["detail"].lower()

def test_post_analyze_empty_file_error():
    files = {"file": ("empty.wav", b"", "audio/wav")}
    data = {"caller_id": "+919122390182", "transaction_amount": "5000"}

    response = client.post("/analyze", files=files, data=data)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()

def test_get_history():
    response = client.get("/history")
    assert response.status_code == 200
    history = response.json()
    assert isinstance(history, list)

def test_get_caller_detail_existing():
    response = client.get("/caller/+919122390182")
    assert response.status_code == 200
    caller = response.json()
    assert caller["name"] == "Alice Sharma"
    assert caller["phone_number"] == "+919122390182"

def test_get_caller_detail_not_found():
    response = client.get("/caller/+910000000000")
    assert response.status_code == 404
