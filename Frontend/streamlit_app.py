"""
VoiceGuard / SIH26104 — Streamlit Operations & Verification Dashboard
Consumes the FastAPI backend REST API (http://localhost:8000).
"""

import os
import io
import time
import requests
import streamlit as st
import pandas as pd

# Streamlit Page Config
st.set_page_config(
    page_title="VoiceGuard — Voice Integrity Operations Console",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Backend API Configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# Custom Styling
st.markdown("""
<style>
    /* Clean, Neat, Polished Streamlit Theme */
    .stApp {
        background-color: #f8fafc;
        color: #0f172a;
    }
    .main-title { 
        font-size: 2.2rem; 
        font-weight: 750; 
        color: #0f172a; 
        letter-spacing: -0.02em;
        margin-bottom: 0.2rem; 
    }
    .sub-title { 
        font-size: 1.05rem; 
        color: #475569; 
        margin-bottom: 1.5rem; 
    }
    .risk-box { 
        padding: 1.4rem; 
        border-radius: 8px; 
        margin-bottom: 1rem; 
        border: 1px solid #e2e8f0; 
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04);
    }
    .risk-approve { 
        background-color: #f0fdf4; 
        border-color: rgba(16, 185, 129, 0.3); 
        color: #065f46; 
    }
    .risk-challenge { 
        background-color: #fffbeb; 
        border-color: rgba(245, 158, 11, 0.3); 
        color: #92400e; 
    }
    .risk-escalate { 
        background-color: #fef2f2; 
        border-color: rgba(239, 68, 68, 0.3); 
        color: #991b1b; 
    }
    .metric-card { 
        background: #ffffff; 
        padding: 1.1rem; 
        border-radius: 8px; 
        border: 1px solid #e2e8f0; 
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
        text-align: center; 
    }
</style>
""", unsafe_allow_html=True)

# Top Header
st.markdown('<div class="main-title">🛡️ VoiceGuard — Voice Integrity Verification</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">Real-Time Acoustic Anti-Spoofing & Multi-Factor Fraud Detection Framework (SIH26104)</div>', unsafe_allow_html=True)

# Sidebar — System Telemetry & Input Configuration
with st.sidebar:
    st.header("⚙️ Telemetry & Parameters")
    
    # Check Backend Health
    try:
        health_resp = requests.get(f"{BACKEND_URL}/health", timeout=2)
        if health_resp.status_code == 200:
            health_data = health_resp.json()
            st.success(f"● Backend Connected ({health_data['device'].upper()} Mode)")
            st.caption(f"Model: {health_data.get('model_mode', 'real').upper()} | DB: {health_data.get('database')}")
        else:
            st.warning("⚠️ Backend returned non-200 status.")
    except Exception:
        st.error(f"❌ Backend Offline ({BACKEND_URL})")
        st.caption("Ensure FastAPI is running: `uvicorn backend.app:app --port 8000`")

    st.markdown("---")
    st.subheader("👤 Caller & Transaction Profile")

    caller_options = {
        "+919841028419": "Bob Verma (High Risk — 2 Prior Fraud Incidents)",
        "+919122390182": "Alice Sharma (Low Risk — Trusted Customer)",
        "+919871102931": "Charlie Patel (Medium Risk — ₹25k Baseline)",
        "+919940188320": "David Rao (High Risk — Voice Clone Attempt)",
        "custom": "Enter Custom Phone Number..."
    }

    selected_caller_key = st.selectbox(
        "Select Caller Profile:",
        options=list(caller_options.keys()),
        format_func=lambda k: caller_options[k]
    )

    if selected_caller_key == "custom":
        caller_id = st.text_input("Custom Caller Phone Number:", value="+919876543210")
    else:
        caller_id = selected_caller_key

    transaction_amount = st.number_input(
        "Requested Transaction Amount (₹ INR):",
        min_value=0.0,
        max_value=1000000.0,
        value=75000.0 if "9841028419" in caller_id else 8500.0,
        step=1000.0
    )

    st.markdown("---")
    st.subheader("🎙️ Audio Input Source")
    
    input_mode = st.radio(
        "Choose Audio Source:",
        ["Upload Audio File", "Pre-packaged Demo Samples"],
        index=1
    )

    uploaded_file = None
    if input_mode == "Upload Audio File":
        uploaded_file = st.file_uploader("Upload Voice Recording (.wav, .mp3, .flac, .m4a):", type=["wav", "mp3", "flac", "m4a"])
    else:
        sample_choice = st.selectbox(
            "Select Test Sample:",
            ["genuine_demo.wav (Natural Voice)", "synthetic_demo.wav (Synthetic Clone)"]
        )
        sample_filename = sample_choice.split(" ")[0]
        sample_path = os.path.join(os.path.dirname(__file__), "..", "backend", "samples", sample_filename)
        
        if os.path.exists(sample_path):
            with open(sample_path, "rb") as f:
                uploaded_file = io.BytesIO(f.read())
                uploaded_file.name = sample_filename
            st.audio(uploaded_file, format="audio/wav")
            uploaded_file.seek(0)
        else:
            st.info("Demo samples will be generated on backend startup.")

# Main Analysis Panel
col_btn, _ = st.columns([2, 5])
with col_btn:
    analyze_clicked = st.button("🚀 Analyze Voice Recording", type="primary", use_container_width=True)

if analyze_clicked:
    if uploaded_file is None:
        st.error("Please upload or select an audio file to analyze.")
    else:
        with st.spinner("Analyzing acoustic features, running CPU neural anti-spoof model, and evaluating context..."):
            try:
                uploaded_file.seek(0)
                files = {"file": (uploaded_file.name, uploaded_file.getvalue(), "audio/wav")}
                data = {
                    "caller_id": caller_id,
                    "transaction_amount": str(transaction_amount)
                }

                t0 = time.perf_counter()
                response = requests.post(f"{BACKEND_URL}/analyze", files=files, data=data, timeout=30)
                t_net = round((time.perf_counter() - t0) * 1000, 2)

                if response.status_code == 200:
                    res = response.json()

                    # Render Decision Policy Banner
                    risk_score = res["risk_score"]
                    rec = res["recommendation"]
                    reason = res["reason"]

                    if rec == "APPROVE":
                        banner_class = "risk-approve"
                        rec_icon = "✅"
                    elif rec == "CHALLENGE":
                        banner_class = "risk-challenge"
                        rec_icon = "⚠️"
                    else:
                        banner_class = "risk-escalate"
                        rec_icon = "🚨"

                    st.markdown(f"""
                    <div class="risk-box {banner_class}">
                        <h2 style="margin: 0; font-size: 1.4rem;">{rec_icon} DECISION: {rec} (Risk Score: {risk_score} / 100)</h2>
                        <p style="margin-top: 0.5rem; font-size: 1.05rem;">{reason}</p>
                    </div>
                    """, unsafe_allow_html=True)

                    # Top KPI Metrics
                    kpi1, kpi2, kpi3, kpi4 = st.columns(4)
                    with kpi1:
                        st.metric("Voice Anti-Spoof Score", f"{int(res['voice_analysis']['model_score'] * 100)} / 100", delta=f"{res['voice_analysis']['label']}")
                    with kpi2:
                        st.metric("Acoustic Anomaly Score", f"{res['acoustic_analysis']['anomaly_score']} / 100")
                    with kpi3:
                        st.metric("Contextual Fraud Risk", f"{res['context_analysis']['context_risk']} / 100")
                    with kpi4:
                        st.metric("Backend Processing Latency", f"{res['processing']['total_processing_time_ms']:.1f} ms", delta=f"CPU Execution")

                    # Detailed Tabs
                    tab_voice, tab_context, tab_history, tab_benchmarks = st.tabs([
                        "🔬 Acoustic & Neural Signals",
                        "👤 Context & Fraud History",
                        "📜 Session Audit History",
                        "⚡ CPU Performance Benchmarks"
                    ])

                    with tab_voice:
                        v_col1, v_col2 = st.columns(2)
                        with v_col1:
                            st.subheader("Neural Model Classification")
                            st.json(res["voice_analysis"])
                        with v_col2:
                            st.subheader("Extracted Acoustic Telemetry")
                            ac = res["acoustic_analysis"]
                            st.write(f"**Mean Pitch (F0):** `{ac['pitch_mean']} Hz` (Jitter std: `{ac['pitch_std']} Hz`)")
                            st.write(f"**Spectral Centroid:** `{ac['spectral_centroid']} Hz`")
                            st.write(f"**Spectral Bandwidth:** `{ac['spectral_bandwidth']} Hz`")
                            st.write(f"**Spectral Rolloff (85%):** `{ac['spectral_rolloff']} Hz`")
                            st.write(f"**Zero-Crossing Rate (ZCR):** `{ac['zcr']}`")
                            st.write(f"**RMS Energy Mean:** `{ac['energy_mean']}`")
                            st.caption(ac.get("disclaimer", ""))

                    with tab_context:
                        ctx = res["context_analysis"]
                        st.subheader(f"Caller Profile: {ctx['caller_name']} ({ctx['caller_id']})")
                        st.write(f"**Known Contact:** {'Yes ✅' if ctx['known_caller'] else 'No (Unrecognized Device) ❌'}")
                        st.write(f"**Prior Fraud Reports:** {ctx['prior_fraud_incidents']}")
                        st.write(f"**Transaction Value:** ₹{ctx['transaction_amount']:,.0f} (Usual: ₹{ctx['usual_transaction_amount']:,.0f} — {ctx['transaction_anomaly_ratio']}x multiple)")
                        st.write(f"**Call Time Telemetry:** {ctx['call_time']} ({'Off-peak Midnight Window ⚠️' if ctx['call_time_anomaly'] else 'Normal Operating Hours'})")
                        st.write("**Contextual Reasoning Log:**")
                        for r in ctx.get("reasoning", []):
                            st.write(f"- {r}")

                    with tab_history:
                        try:
                            hist_resp = requests.get(f"{BACKEND_URL}/history?limit=10")
                            if hist_resp.status_code == 200:
                                df = pd.DataFrame(hist_resp.json())
                                if not df.empty:
                                    st.dataframe(df[["session_id", "timestamp", "caller_id", "risk_score", "recommendation", "processing_time_ms"]], use_container_width=True)
                        except Exception as e:
                            st.warning(f"Could not load history: {e}")

                    with tab_benchmarks:
                        p = res["processing"]
                        st.subheader("CPU Execution Latency Breakdown")
                        latency_df = pd.DataFrame({
                            "Stage": ["Audio Preprocessing", "Acoustic Extraction", "PyTorch Neural Inference", "Context Analysis", "Composite Risk Engine", "Total Pipeline"],
                            "Duration (ms)": [p["preprocessing_ms"], p["acoustic_ms"], p["model_ms"], p["context_ms"], p["risk_engine_ms"], p["total_processing_time_ms"]]
                        })
                        st.table(latency_df)
                        st.info(f"Verified execution on {p['device'].upper()} architecture. Zero CUDA/GPU hardware required.")

                else:
                    err_detail = response.json().get("detail", "Unknown server error")
                    st.error(f"Analysis failed (HTTP {response.status_code}): {err_detail}")

            except Exception as ex:
                st.error(f"Failed to connect to backend: {ex}")

# Footer
st.markdown("---")
st.caption("VoiceGuard / SIH26104 — Strict CPU-Compatible Architecture. Engineered for Intel i5 / 16GB RAM Standard Hardware.")
