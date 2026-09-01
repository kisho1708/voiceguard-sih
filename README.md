# SIH26104 — VoiceGuard: Real-Time Voice Integrity & Anti-Spoofing Framework

**Production-Quality CPU-Only Voice Integrity Verification & Anti-Spoofing Backend**

VoiceGuard is a multi-factor voice fraud prevention and acoustic anti-spoofing framework designed for enterprise fraud-monitoring and security operations centers (SOC). It continuously analyzes incoming voice recordings, extracts CPU-based acoustic features, executes lightweight neural feature representations, enriches caller context, and outputs an actionable decision recommendation.

---

## ⚡ Strict CPU Hardware Requirement

> **CRITICAL HARDWARE SPECIFICATION:**
> VoiceGuard is engineered to run **100% on CPU**.
> 
> * **No Dedicated GPU / CUDA required**
> * Tested and verified on standard laptop hardware (Intel Core i5, 16 GB RAM, Intel Iris/UHD graphics)
> * Zero `torch.cuda` calls; all tensors execute on `device="cpu"`

Startup verification confirms:
```text
Device: CPU
CUDA enabled: False
```

---

## 🏗️ System Architecture & End-to-End Pipeline

```text
Incoming Audio (.wav, .mp3, .flac, .m4a)
                    ↓
         [ Audio Validation ]
  (Format, Size, Duration 2s–30s)
                    ↓
        [ Audio Preprocessing ]
   (Mono, 16 kHz Resample, Peak Norm)
                    ↓
  ┌─────────────────┴─────────────────┐
  ↓                                   ↓
[ Acoustic Feature Engine ]   [ PyTorch Neural Model ]
(F0 Jitter, Energy,           (SincConv1d + RawNet2
 Spectral Centroid, MFCCs)     Waveform Representation)
  ↓                                   ↓
[ Acoustic Anomaly Score ]    [ Neural Spoof Score ]
  └─────────────────┬─────────────────┘
                    ↓
        [ Caller Context Engine ]
 (Device Check, Fraud History, ₹ Velocity)
                    ↓
        [ Composite Risk Engine ]
  (60% Voice + 30% Context + 10% Fraud)
                    ↓
       [ Decision Policy Engine ]
   0–30: APPROVE | 31–65: CHALLENGE | 66–100: ESCALATE
                    ↓
        [ SQLite Audit Logging ]
                    ↓
      [ REST / Streamlit JSON Response ]
```

---

## 📦 Directory Structure

```text
sih26104/
├── backend/
│   ├── app.py              # FastAPI REST API & timing instrumentation
│   ├── detector.py         # PyTorch CPU VoiceDetector (RawNet2 / SincNet architecture)
│   ├── acoustic.py         # Librosa/SciPy CPU acoustic feature extraction
│   ├── context.py          # Banking context analysis & caller profile lookup
│   ├── risk_engine.py      # Multi-factor composite risk engine
│   ├── database.py         # SQLite schema, callers table & fraud incident history
│   ├── schemas.py          # Pydantic v2 data models
│   ├── utils.py            # Audio validation, 16kHz resampling, mono conversion
│   ├── config.py           # Configuration & CPU enforcement
│   ├── requirements.txt    # Minimal CPU-only dependencies
│   ├── samples/            # Pre-generated safe demo audio samples
│   │   ├── genuine_demo.wav
│   │   └── synthetic_demo.wav
│   └── tests/              # Pytest automated test suite
│       ├── test_api.py
│       ├── test_acoustic.py
│       ├── test_risk.py
│       └── test_context.py
│
├── frontend/
│   ├── index.html          # Enterprise SOC operations console
│   ├── style.css           # Enterprise design system
│   ├── script.js           # Live Web Audio API DSP visualizers
│   └── streamlit_app.py    # Streamlit dashboard consuming FastAPI backend
│
├── Dockerfile              # Lightweight CPU-only Docker image
├── docker-compose.yml      # Multi-container orchestration
├── .env.example
├── .gitignore
└── README.md
```

---

## 🚀 Quickstart & Installation

### 1. Prerequisites
* Python 3.10+ (Tested on Python 3.11 / 3.12 / 3.14)
* Standard CPU (Intel / AMD / Apple Silicon)

### 2. Install Dependencies
```bash
# Optional: Create and activate a virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install CPU-compatible requirements
pip install -r backend/requirements.txt
```

### 3. Generate Test Audio Samples
```bash
python backend/samples/generate_samples.py
```

### 4. Run Automated CPU Tests
```bash
pytest backend/tests/ -v
```

### 5. Launch FastAPI Backend
```bash
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```
Interactive API Swagger Docs: `http://localhost:8000/docs`

### 6. Launch Streamlit Operations Console
```bash
streamlit run frontend/streamlit_app.py --server.port 8501
```
Access Streamlit Dashboard: `http://localhost:8501`

---

## 🐳 Docker Deployment (CPU-Only)

Run the full stack with a single command:
```bash
docker compose up --build
```
* **FastAPI Backend:** `http://localhost:8000`
* **Streamlit Frontend:** `http://localhost:8501`

---

## 📡 REST API Documentation

### 1. `GET /health`
Returns system health and CPU hardware verification.
```json
{
  "status": "healthy",
  "device": "cpu",
  "model_loaded": true,
  "database": "connected",
  "sample_rate": 16000,
  "model_mode": "real"
}
```

### 2. `POST /analyze`
Analyzes uploaded voice recording and computes multi-factor composite risk.

**Parameters:**
* `file`: Multipart audio file (`.wav`, `.mp3`, `.flac`, `.m4a`, duration 2–30s)
* `caller_id`: Phone number string (e.g. `+919841028419`)
* `transaction_amount`: Float (e.g. `75000.0`)

**Response:**
```json
{
  "success": true,
  "session_id": "VG-SESSION-A1B2C3D4",
  "risk_score": 74,
  "recommendation": "ESCALATE",
  "reason": "High synthetic/manipulated voice clone indicators detected. Escalate case.",
  "voice_analysis": {
    "label": "synthetic_suspected",
    "model_score": 0.82,
    "confidence": 0.91,
    "model_architecture": "RawNet2-SincNet (CPU PyTorch)",
    "disclaimer": "Inference executed on CPU."
  },
  "acoustic_analysis": {
    "anomaly_score": 76,
    "pitch_mean": 180.2,
    "pitch_std": 0.45,
    "energy_mean": 0.045,
    "energy_std": 0.008,
    "spectral_centroid": 3420.5,
    "spectral_bandwidth": 2180.3,
    "spectral_rolloff": 5820.0,
    "zcr": 0.082,
    "mfcc_summary": [-120.4, 45.2, ...]
  },
  "context_analysis": {
    "caller_id": "+919841028419",
    "caller_name": "Bob Verma",
    "known_caller": false,
    "fraud_history": true,
    "prior_fraud_incidents": 2,
    "transaction_amount": 75000.0,
    "usual_transaction_amount": 10000.0,
    "transaction_anomaly_ratio": 7.5,
    "call_time": "02:14 AM IST",
    "call_time_anomaly": true,
    "context_risk": 82,
    "reasoning": [
      "Call originates from an unregistered alternate device/SIM.",
      "Customer profile has 2 prior logged fraud incident reports.",
      "Requested transaction (₹75,000) is 7.5x higher than typical volume (₹10,000)."
    ]
  },
  "processing": {
    "preprocessing_ms": 14.2,
    "acoustic_ms": 42.1,
    "model_ms": 68.5,
    "context_ms": 3.8,
    "risk_engine_ms": 0.6,
    "total_processing_time_ms": 129.2,
    "device": "cpu"
  },
  "timestamp": "2026-08-31 10:14:00"
}
```

### 3. `GET /history`
Retrieves past analysis audit records from SQLite.

### 4. `GET /caller/{caller_id}`
Retrieves caller verification details and logged fraud history.

---

## ⚖️ Model Disclaimer & Limitations

* **RawNet2 / SincNet Architecture**: The neural model extracts acoustic representations from raw waveform audio. It is a reference feature extractor and classifier executing on CPU.
* **Prototype Policy Thresholds**: The decision policy thresholds (`0–30 APPROVE`, `31–65 CHALLENGE`, `66–100 ESCALATE`) are configurable operational heuristics, not medically or mathematically absolute thresholds.
* **Acoustic Signals**: Extracted features (F0 jitter, spectral centroid, energy variance) are supporting indicators and must be evaluated alongside contextual fraud telemetry.
