"""
VoiceGuard / SIH26104 - Context & Banking Fraud Engine Module
Enriches voice session with caller verification history, transaction anomaly score, and temporal risk.
"""

from datetime import datetime
from typing import Dict, Any, List
import numpy as np

from .database import get_caller_by_phone

def analyze_caller_context(caller_id: str, transaction_amount: float = 0.0) -> Dict[str, Any]:
    """
    Evaluates contextual risk parameters for a given phone number and transaction:
    - Known vs unrecognized device/number
    - Transaction velocity & multiple anomaly ratio
    - Prior fraud incident reports
    - Calling hour velocity anomaly
    """
    caller = get_caller_by_phone(caller_id)
    reasoning: List[str] = []
    base_risk = 10.0

    if not caller:
        # Unknown caller / Unrecognized device
        known_caller = False
        caller_name = "Unrecognized Device / New Caller"
        usual_amount = 5000.0
        fraud_history_flag = False
        prior_incidents = 0
        base_risk += 35.0
        reasoning.append("Caller ID is not associated with an existing registered customer profile.")
    else:
        known_caller = bool(caller["known_contact"])
        caller_name = caller["name"]
        usual_amount = float(caller["usual_amount"])
        fraud_history_flag = bool(caller["fraud_history"])
        prior_incidents = len(caller.get("fraud_incidents", []))

        if not known_caller:
            base_risk += 25.0
            reasoning.append("Call originates from an unregistered alternate device/SIM.")

        if fraud_history_flag or prior_incidents > 0:
            penalty = min(50.0, prior_incidents * 25.0 + (15.0 if fraud_history_flag else 0))
            base_risk += penalty
            reasoning.append(f"Customer profile has {prior_incidents} prior logged fraud incident reports.")

    # Transaction Anomaly Ratio Check
    if transaction_amount > 0 and usual_amount > 0:
        ratio = transaction_amount / usual_amount
        if ratio >= 5.0:
            base_risk += 35.0
            reasoning.append(f"Requested transaction (₹{transaction_amount:,.0f}) is {ratio:.1f}x higher than typical volume (₹{usual_amount:,.0f}).")
        elif ratio >= 2.0:
            base_risk += 18.0
            reasoning.append(f"Transaction value (₹{transaction_amount:,.0f}) is significantly above average baseline (₹{usual_amount:,.0f}).")
        else:
            ratio = 1.0
    else:
        ratio = 1.0

    # Temporal Anomaly Check (e.g. High-risk midnight calling window 00:00 - 05:00)
    current_hour = datetime.now().hour
    current_time_str = datetime.now().strftime("%I:%M %p IST")
    is_night_call = (current_hour >= 0 and current_hour < 6)

    if is_night_call:
        base_risk += 14.0
        reasoning.append(f"Session initiated during off-peak hours ({current_time_str}).")

    if not reasoning:
        reasoning.append("All caller telemetry and transaction volume fall within established customer baselines.")

    context_risk = int(np.clip(round(base_risk), 5, 95))

    return {
        "caller_id": caller_id,
        "caller_name": caller_name,
        "known_caller": known_caller,
        "fraud_history": fraud_history_flag,
        "prior_fraud_incidents": prior_incidents,
        "transaction_amount": float(transaction_amount),
        "usual_transaction_amount": float(usual_amount),
        "transaction_anomaly_ratio": round(ratio, 2),
        "call_time": current_time_str,
        "call_time_anomaly": is_night_call,
        "context_risk": context_risk,
        "reasoning": reasoning
    }
