"""
VoiceGuard / SIH26104 - FastAPI Application & REST API Endpoints
Production-quality CPU-only backend for real-time voice integrity and anti-spoofing analysis.
"""

import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import (
    DEVICE,
    MODEL_MODE,
    SAMPLE_RATE,
    print_startup_banner
)
from .schemas import (
    HealthResponse,
    AnalyzeResponse,
    VoiceAnalysis,
    AcousticAnalysis,
    ContextAnalysis,
    ProcessingMetrics,
    CallerDetailResponse,
    AnalysisHistoryItem
)
from .database import (
    init_db,
    add_analysis_record,
    get_analysis_history,
    get_caller_by_phone,
    get_all_callers
)
from .utils import (
    validate_audio_file,
    load_audio,
    save_temp_upload,
    cleanup_temp_file
)
from .acoustic import extract_acoustic_features
from .detector import VoiceDetector
from .context import analyze_caller_context
from .risk_engine import calculate_composite_risk

# Print CPU Startup Banner
print_startup_banner()

# Initialize FastAPI App
app = FastAPI(
    title="VoiceGuard — Real-Time Voice Integrity & Anti-Spoofing API",
    description="CPU-only REST API backend for continuous voice integrity, acoustic feature extraction, and multi-factor fraud detection.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS Middleware (Permits Frontend / Streamlit integration)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global CPU Model Instance (Loaded ONCE on CPU)
voice_detector: VoiceDetector = VoiceDetector(device="cpu")

@app.on_event("startup")
def on_startup():
    """Initializes SQLite database and logs startup."""
    init_db()
    print(f"[FastAPI Startup] VoiceGuard Backend running strictly on {DEVICE.upper()} (CUDA: False).")

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/", tags=["Root"])
def root():
    return {
        "service": "VoiceGuard — Voice Integrity Verification Framework (SIH26104)",
        "status": "operational",
        "device": "CPU",
        "documentation": "/docs",
        "health_check": "/health"
    }

@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """Returns system health, strict CPU device verification, and database connectivity."""
    is_model_ready = voice_detector is not None and (
        getattr(voice_detector, "torch_model", None) is not None or 
        getattr(voice_detector, "numpy_model", None) is not None
    )
    return HealthResponse(
        status="healthy",
        device="cpu",
        model_loaded=is_model_ready,
        database="connected",
        sample_rate=SAMPLE_RATE,
        model_mode=MODEL_MODE
    )

@app.post("/analyze", response_model=AnalyzeResponse, tags=["Analysis"])
async def analyze_voice(
    file: UploadFile = File(..., description="Audio recording (.wav, .mp3, .flac, .m4a)"),
    caller_id: str = Form("+919841028419", description="Caller phone number / identifier"),
    transaction_amount: float = Form(0.0, description="Requested transaction value in INR (e.g. 75000)")
):
    """
    Main Voice Integrity & Multi-Factor Anti-Spoofing Analysis Endpoint:
    1. Validates audio integrity, duration (2–30s), and format.
    2. Performs CPU audio preprocessing (mono conversion, 16kHz resampling, normalization).
    3. Extracts acoustic features (F0 pitch jitter, spectral centroid, energy envelope, MFCCs).
    4. Executes CPU neural anti-spoof model inference.
    5. Evaluates caller context, transaction velocity, and fraud incident history.
    6. Synthesizes multi-factor composite risk and actionable decision recommendation.
    7. Logs session telemetry to SQLite database.
    """
    t_start = time.perf_counter()
    temp_path: Optional[Path] = None
    session_id = f"VG-SESSION-{uuid.uuid4().hex[:8].upper()}"

    try:
        # Read uploaded bytes and save temporarily
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded audio file is empty (0 bytes)."
            )

        temp_path = save_temp_upload(file_bytes, file.filename or "audio.wav")

        # 1. Validation Stage
        is_valid, err_msg, meta = validate_audio_file(temp_path)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Audio validation failed: {err_msg}"
            )

        # 2. Preprocessing Stage (16kHz Mono Float32)
        t_prep_start = time.perf_counter()
        audio_array, sr = load_audio(temp_path, target_sr=SAMPLE_RATE)
        t_prep_end = time.perf_counter()
        preprocessing_ms = round((t_prep_end - t_prep_start) * 1000, 2)

        # 3. Acoustic Feature Extraction Stage
        t_ac_start = time.perf_counter()
        acoustic_dict = extract_acoustic_features(audio_array, sr=sr)
        t_ac_end = time.perf_counter()
        acoustic_ms = round((t_ac_end - t_ac_start) * 1000, 2)

        # 4. Neural Model Inference Stage (CPU PyTorch)
        t_mod_start = time.perf_counter()
        if voice_detector is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="VoiceDetector is not initialized."
            )
        model_result = voice_detector.predict(audio_array, sample_rate=sr)
        t_mod_end = time.perf_counter()
        model_ms = round((t_mod_end - t_mod_start) * 1000, 2)

        # 5. Caller Context & Fraud Engine Stage
        t_ctx_start = time.perf_counter()
        context_dict = analyze_caller_context(caller_id, transaction_amount=transaction_amount)
        t_ctx_end = time.perf_counter()
        context_ms = round((t_ctx_end - t_ctx_start) * 1000, 2)

        # 6. Composite Risk Engine Stage
        t_risk_start = time.perf_counter()
        final_risk, recommendation, reason, breakdown = calculate_composite_risk(
            model_score=model_result["model_score"],
            acoustic_score=acoustic_dict["anomaly_score"],
            context_risk=context_dict["context_risk"],
            prior_fraud_incidents=context_dict["prior_fraud_incidents"],
            fraud_history_flag=context_dict["fraud_history"]
        )
        t_risk_end = time.perf_counter()
        risk_engine_ms = round((t_risk_end - t_risk_start) * 1000, 2)

        total_ms = round((time.perf_counter() - t_start) * 1000, 2)

        # 7. Database Logging
        add_analysis_record(
            session_id=session_id,
            caller_id=caller_id,
            risk_score=final_risk,
            recommendation=recommendation,
            reason=reason,
            model_score=model_result["model_score"],
            acoustic_score=acoustic_dict["anomaly_score"],
            context_score=context_dict["context_risk"],
            processing_time_ms=total_ms,
            audio_filename=file.filename or "unknown.wav"
        )

        now_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        return AnalyzeResponse(
            success=True,
            session_id=session_id,
            risk_score=final_risk,
            recommendation=recommendation,
            reason=reason,
            voice_analysis=VoiceAnalysis(
                label=model_result["label"],
                model_score=model_result["model_score"],
                confidence=model_result["confidence"],
                model_architecture=model_result.get("model_architecture", "RawNet2-SincNet (CPU)"),
                disclaimer=model_result.get("disclaimer", "Inference executed on CPU.")
            ),
            acoustic_analysis=AcousticAnalysis(
                anomaly_score=acoustic_dict["anomaly_score"],
                pitch_mean=acoustic_dict["pitch_mean"],
                pitch_std=acoustic_dict["pitch_std"],
                energy_mean=acoustic_dict["energy_mean"],
                energy_std=acoustic_dict["energy_std"],
                spectral_centroid=acoustic_dict["spectral_centroid"],
                spectral_bandwidth=acoustic_dict["spectral_bandwidth"],
                spectral_rolloff=acoustic_dict["spectral_rolloff"],
                zcr=acoustic_dict["zcr"],
                mfcc_summary=acoustic_dict["mfcc_summary"]
            ),
            context_analysis=ContextAnalysis(
                caller_id=context_dict["caller_id"],
                caller_name=context_dict["caller_name"],
                known_caller=context_dict["known_caller"],
                fraud_history=context_dict["fraud_history"],
                prior_fraud_incidents=context_dict["prior_fraud_incidents"],
                transaction_amount=context_dict["transaction_amount"],
                usual_transaction_amount=context_dict["usual_transaction_amount"],
                transaction_anomaly_ratio=context_dict["transaction_anomaly_ratio"],
                call_time=context_dict["call_time"],
                call_time_anomaly=context_dict["call_time_anomaly"],
                context_risk=context_dict["context_risk"],
                reasoning=context_dict["reasoning"]
            ),
            processing=ProcessingMetrics(
                preprocessing_ms=preprocessing_ms,
                acoustic_ms=acoustic_ms,
                model_ms=model_ms,
                context_ms=context_ms,
                risk_engine_ms=risk_engine_ms,
                total_processing_time_ms=total_ms,
                device="cpu"
            ),
            timestamp=now_timestamp
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Backend Error] Internal error during /analyze: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the voice recording."
        )
    finally:
        # Zero-retention privacy cleanup of temporary audio
        cleanup_temp_file(temp_path)

@app.get("/history", response_model=List[AnalysisHistoryItem], tags=["History"])
def get_history(limit: int = 50):
    """Retrieves session analysis audit logs from SQLite."""
    records = get_analysis_history(limit=limit)
    return [AnalysisHistoryItem(**r) for r in records]

@app.get("/caller/{caller_id}", response_model=CallerDetailResponse, tags=["Context"])
def get_caller_info(caller_id: str):
    """Retrieves caller verification profile and historical fraud incidents."""
    caller = get_caller_by_phone(caller_id)
    if not caller:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Caller profile for '{caller_id}' was not found."
        )
    return CallerDetailResponse(**caller)

@app.get("/callers", tags=["Context"])
def list_callers():
    """Lists all registered demo caller profiles."""
    return get_all_callers()
