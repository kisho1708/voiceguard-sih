"""
VoiceGuard / SIH26104 - Pydantic Data Models & Schemas
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str = "healthy"
    device: str = "cpu"
    model_loaded: bool = True
    database: str = "connected"
    sample_rate: int = 16000
    model_mode: str = "real"

class VoiceAnalysis(BaseModel):
    label: str = Field(..., description="Classification outcome (e.g. genuine, synthetic_suspected, inconclusive)")
    model_score: float = Field(..., description="Continuous model score (0.0 to 1.0, higher = higher synthetic probability)")
    confidence: float = Field(..., description="Estimated model prediction confidence (0.0 to 1.0)")
    model_architecture: str = "RawNet2-SincNet (CPU)"
    disclaimer: str = "Evaluation score based on CPU acoustic neural feature extraction."

class AcousticAnalysis(BaseModel):
    anomaly_score: int = Field(..., description="Normalized acoustic anomaly score (0–100)")
    pitch_mean: float = Field(..., description="Mean fundamental frequency F0 in Hz")
    pitch_std: float = Field(..., description="F0 standard deviation (pitch jitter/variation)")
    energy_mean: float = Field(..., description="Mean Root Mean Square (RMS) frame energy")
    energy_std: float = Field(..., description="RMS energy standard deviation")
    spectral_centroid: float = Field(..., description="Mean spectral brightness / centroid in Hz")
    spectral_bandwidth: float = Field(..., description="Spectral spread/bandwidth in Hz")
    spectral_rolloff: float = Field(..., description="85% spectral rolloff frequency in Hz")
    zcr: float = Field(..., description="Mean zero-crossing rate")
    mfcc_summary: List[float] = Field(default_factory=list, description="Mean values for 13 MFCC coefficients")
    disclaimer: str = "Acoustic features serve as supporting signals and do not independently prove synthetic origin."

class ContextAnalysis(BaseModel):
    caller_id: str
    caller_name: str
    known_caller: bool
    fraud_history: bool
    prior_fraud_incidents: int
    transaction_amount: float
    usual_transaction_amount: float
    transaction_anomaly_ratio: float
    call_time: str
    call_time_anomaly: bool
    context_risk: int = Field(..., description="Contextual fraud risk score (0–100)")
    reasoning: List[str] = Field(default_factory=list)

class ProcessingMetrics(BaseModel):
    preprocessing_ms: float
    acoustic_ms: float
    model_ms: float
    context_ms: float
    risk_engine_ms: float
    total_processing_time_ms: float
    device: str = "cpu"

class AnalyzeResponse(BaseModel):
    success: bool = True
    session_id: str
    risk_score: int = Field(..., description="Final composite risk score (0–100)")
    recommendation: str = Field(..., description="Decision policy recommendation (APPROVE, CHALLENGE, ESCALATE)")
    reason: str = Field(..., description="Plain-language justification of the decision")
    voice_analysis: VoiceAnalysis
    acoustic_analysis: AcousticAnalysis
    context_analysis: ContextAnalysis
    processing: ProcessingMetrics
    timestamp: str

class FraudIncident(BaseModel):
    id: int
    incident_type: str
    severity: str
    description: str
    date: str

class CallerDetailResponse(BaseModel):
    id: int
    phone_number: str
    name: str
    known_contact: bool
    usual_amount: float
    usual_call_hours: str
    fraud_history: bool
    risk_level: str
    created_at: str
    fraud_incidents: List[FraudIncident] = Field(default_factory=list)

class AnalysisHistoryItem(BaseModel):
    id: int
    session_id: str
    caller_id: str
    risk_score: int
    recommendation: str
    reason: str
    model_score: float
    acoustic_score: int
    context_score: int
    processing_time_ms: float
    audio_filename: str
    timestamp: str
