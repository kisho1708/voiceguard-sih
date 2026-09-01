"""
Unit Tests for Caller Context & Fraud Anomaly Calculation
"""

import pytest
from backend.database import init_db
from backend.context import analyze_caller_context

@pytest.fixture(autouse=True)
def setup_test_database():
    init_db()

def test_context_trusted_caller():
    # Alice (+919122390182) - registered, no fraud, usual amount 8500
    ctx = analyze_caller_context("+919122390182", transaction_amount=8500.0)
    assert ctx["known_caller"] is True
    assert ctx["caller_name"] == "Alice Sharma"
    assert ctx["fraud_history"] is False
    assert ctx["prior_fraud_incidents"] == 0
    assert ctx["context_risk"] <= 35

def test_context_high_fraud_caller():
    # Bob (+919841028419) - 2 prior fraud reports, ₹75,000 transaction (7.5x usual)
    ctx = analyze_caller_context("+919841028419", transaction_amount=75000.0)
    assert ctx["fraud_history"] is True
    assert ctx["prior_fraud_incidents"] >= 1
    assert ctx["transaction_anomaly_ratio"] >= 5.0
    assert ctx["context_risk"] >= 65

def test_context_unknown_caller():
    # Unregistered caller
    ctx = analyze_caller_context("+919999999999", transaction_amount=20000.0)
    assert ctx["known_caller"] is False
    assert "Unrecognized" in ctx["caller_name"]
    assert ctx["context_risk"] >= 35
