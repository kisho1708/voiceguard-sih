"""
VoiceGuard / SIH26104 - Multi-Factor Risk & Decision Engine Module
Synthesizes voice anti-spoof model scores, acoustic anomaly metrics, context, and fraud history.
"""

from typing import Tuple, Dict, Any
import numpy as np

from .config import (
    VOICE_WEIGHT,
    CONTEXT_WEIGHT,
    FRAUD_WEIGHT,
    APPROVE_THRESHOLD,
    CHALLENGE_THRESHOLD
)

def calculate_composite_risk(
    model_score: float,
    acoustic_score: int,
    context_risk: int,
    prior_fraud_incidents: int = 0,
    fraud_history_flag: bool = False
) -> Tuple[int, str, str, Dict[str, Any]]:
    """
    Synthesizes multiple risk factors into a unified 0–100 Risk Score & Policy Recommendation.

    Weights:
    - Voice / Acoustic Signal : 60%
    - Contextual Anomaly Risk  : 30%
    - Fraud Incident History   : 10%

    Recommendation Thresholds (Demo Policy Heuristics):
    - 0–30   : APPROVE
    - 31–65  : CHALLENGE
    - 66–100 : ESCALATE
    """
    # 1. Voice Integrity Component (0–100)
    # Blend raw neural model probability (70%) with acoustic anomaly indicators (30%)
    model_risk_scaled = float(np.clip(model_score * 100.0, 0.0, 100.0))
    voice_risk = (model_risk_scaled * 0.70) + (float(acoustic_score) * 0.30)
    voice_risk = float(np.clip(voice_risk, 0.0, 100.0))

    # 2. Fraud History Component (0–100)
    if prior_fraud_incidents > 0 or fraud_history_flag:
        fraud_risk = float(np.clip(prior_fraud_incidents * 35.0 + (25.0 if fraud_history_flag else 0.0), 20.0, 100.0))
    else:
        fraud_risk = 5.0

    # 3. Composite Weighted Synthesis
    raw_final = (voice_risk * VOICE_WEIGHT) + (float(context_risk) * CONTEXT_WEIGHT) + (fraud_risk * FRAUD_WEIGHT)
    final_risk = int(np.clip(round(raw_final), 0, 100))

    # 4. Decision Policy & Recommendation
    recommendation, reason = get_recommendation(final_risk, voice_risk, context_risk, prior_fraud_incidents)

    breakdown = {
        "voice_component_score": round(voice_risk, 1),
        "context_component_score": round(float(context_risk), 1),
        "fraud_component_score": round(fraud_risk, 1),
        "weights": {
            "voice": VOICE_WEIGHT,
            "context": CONTEXT_WEIGHT,
            "fraud": FRAUD_WEIGHT
        }
    }

    return final_risk, recommendation, reason, breakdown

def get_recommendation(risk_score: int, voice_risk: float, context_risk: float, prior_fraud_incidents: int) -> Tuple[str, str]:
    """
    Maps composite risk score to actionable decision policy:
    0–30   -> APPROVE
    31–65  -> CHALLENGE
    66–100 -> ESCALATE
    """
    if risk_score <= APPROVE_THRESHOLD:
        recommendation = "APPROVE"
        reason = "Acoustic parameters and caller profile fall within nominal baseline. Transaction authorized."
    elif risk_score <= CHALLENGE_THRESHOLD:
        recommendation = "CHALLENGE"
        if voice_risk > 50.0:
            reason = "Elevated acoustic discontinuity detected. Perform secondary caller verification (SMS/Push OTP)."
        elif context_risk > 50.0:
            reason = "Transaction amount or caller velocity anomaly detected. Step-up authorization required."
        else:
            reason = "Moderate composite voice and contextual risk. Perform secondary out-of-band verification."
    else:
        recommendation = "ESCALATE"
        if voice_risk > 65.0 and prior_fraud_incidents > 0:
            reason = "Critical synthetic speech indicators detected on a caller with prior fraud incident history. Immediate freeze."
        elif voice_risk > 65.0:
            reason = "High synthetic/manipulated voice clone indicators detected exceeding security threshold. Escalate case."
        else:
            reason = "Critical transaction and caller profile anomaly. Escalate immediately to Fraud Security Operations."

    return recommendation, reason
