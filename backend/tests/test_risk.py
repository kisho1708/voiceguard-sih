"""
Unit Tests for Multi-Factor Composite Risk Engine & Decision Policy
"""

import pytest
from backend.risk_engine import calculate_composite_risk, get_recommendation

def test_risk_policy_thresholds_approve():
    # Low voice risk (10%), low context risk (15%), no fraud history
    risk, rec, reason, breakdown = calculate_composite_risk(
        model_score=0.10,
        acoustic_score=15,
        context_risk=15,
        prior_fraud_incidents=0,
        fraud_history_flag=False
    )
    assert risk <= 30
    assert rec == "APPROVE"
    assert "nominal baseline" in reason.lower() or "authorized" in reason.lower()

def test_risk_policy_thresholds_challenge():
    # Moderate risk (model 0.45, context 45)
    risk, rec, reason, breakdown = calculate_composite_risk(
        model_score=0.45,
        acoustic_score=45,
        context_risk=45,
        prior_fraud_incidents=0,
        fraud_history_flag=False
    )
    assert 31 <= risk <= 65
    assert rec == "CHALLENGE"
    assert "verification" in reason.lower() or "anomaly" in reason.lower()

def test_risk_policy_thresholds_escalate():
    # High risk (model 0.85, acoustic 80, context 75, 2 fraud incidents)
    risk, rec, reason, breakdown = calculate_composite_risk(
        model_score=0.85,
        acoustic_score=80,
        context_risk=75,
        prior_fraud_incidents=2,
        fraud_history_flag=True
    )
    assert risk >= 66
    assert rec == "ESCALATE"
    assert "freeze" in reason.lower() or "escalate" in reason.lower()

def test_risk_score_clamping():
    # Ensure extreme inputs never exceed 0-100 bounds
    risk_min, _, _, _ = calculate_composite_risk(0.0, 0, 0, 0, False)
    assert 0 <= risk_min <= 100

    risk_max, _, _, _ = calculate_composite_risk(1.0, 100, 100, 10, True)
    assert 0 <= risk_max <= 100
