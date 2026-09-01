# CPU-Only Dockerfile for VoiceGuard (SIH26104)
# Lightweight Python Slim Base Image (No CUDA / GPU Dependencies)

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEVICE=cpu \
    CUDA_VISIBLE_DEVICES=""

WORKDIR /app

# Install system audio libraries for soundfile / librosa on CPU
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install CPU-only requirements
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy project files
COPY . /app

# Expose FastAPI backend and Streamlit frontend ports
EXPOSE 8000 8501

# Default command starts FastAPI backend
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
