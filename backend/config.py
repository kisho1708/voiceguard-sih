"""
VoiceGuard / SIH26104 - Configuration Module
Strictly configured for CPU-only execution.
"""

import os
from pathlib import Path

# Base Directories
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# STRICT CPU-ONLY EXECUTION ENFORCEMENT
# Default is ALWAYS CPU regardless of host hardware
DEVICE = os.getenv("DEVICE", "cpu").lower()
if DEVICE != "cpu":
    # Fallback to CPU by default for stability on standard laptops
    DEVICE = "cpu"

# Torch environment flags to ensure no CUDA overhead/calls
os.environ["CUDA_VISIBLE_DEVICES"] = ""

# Model & Inference Configuration
MODEL_MODE = os.getenv("MODEL_MODE", "real").lower()  # "real" or "demo"
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")

# Audio Processing Constraints
SAMPLE_RATE = int(os.getenv("SAMPLE_RATE", "16000"))
MIN_AUDIO_DURATION = float(os.getenv("MIN_AUDIO_DURATION", "2.0"))  # seconds
MAX_AUDIO_DURATION = float(os.getenv("MAX_AUDIO_DURATION", "30.0"))  # seconds
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "15"))  # MB
ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".m4a", ".ogg"}

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'sih26104.db'}")

# Multi-Factor Risk Engine Weights (Must sum to 1.0)
VOICE_WEIGHT = float(os.getenv("VOICE_WEIGHT", "0.60"))
CONTEXT_WEIGHT = float(os.getenv("CONTEXT_WEIGHT", "0.30"))
FRAUD_WEIGHT = float(os.getenv("FRAUD_WEIGHT", "0.10"))

# Decision Policy Thresholds (Prototype Policy Heuristics)
APPROVE_THRESHOLD = int(os.getenv("APPROVE_THRESHOLD", "30"))      # 0–30: APPROVE
CHALLENGE_THRESHOLD = int(os.getenv("CHALLENGE_THRESHOLD", "65"))  # 31–65: CHALLENGE, 66–100: ESCALATE

def print_startup_banner():
    """Prints CPU hardware verification info upon backend launch."""
    print("=" * 60)
    print(" VoiceGuard / SIH26104 — Voice Integrity Verification Framework")
    print("=" * 60)
    print(f" Device: {DEVICE.upper()}")
    print(f" CUDA enabled: False (Strict CPU-Only Mode)")
    print(f" Target Audio Spec: {SAMPLE_RATE} Hz, Mono WAV")
    print(f" Model Mode: {MODEL_MODE.upper()} (Demo: {DEMO_MODE})")
    print(f" Database: {DATABASE_URL}")
    print("=" * 60)
