/**
 * VoiceGuard — Real-Time Voice Integrity & Anti-Spoofing Operations Console
 * Core Application Engine & Web Audio DSP Pipeline
 */

// ============================================================================
// 1. CENTRAL REACTIVE STATE STORE
// ============================================================================
const analysisState = {
  sessionId: 'VG-LIVE-10482',
  status: 'ready', // 'ready' | 'monitoring' | 'paused' | 'complete'
  startTime: null,
  elapsedSeconds: 0,
  timerInterval: null,
  
  // Real-time Audio DSP & Metrics
  audioLevel: -60, // dB
  peakAmplitude: 0.0,
  zeroCrossingRate: 0,
  audioQuality: 'Good',
  sampleRate: 16000,
  activeBuffersCount: 0,

  // Risk Scoring & Predictions
  riskScore: 14,
  smoothedRiskScore: 14,
  spoofProbability: 14,
  genuineProbability: 86,
  confidence: 94,
  analysisWindow: 2.0, // seconds
  totalWindows: 0,
  peakRisk: 14,
  riskSum: 14,
  highRiskEventCount: 0,

  // Diagnostic Matrix
  acousticSignals: {
    pitchStability: { value: 'Normal', score: 18, status: 'normal', text: 'F0 Jitter: 0.38% (Expected)' },
    energyPattern: { value: 'Normal', score: 22, status: 'normal', text: 'Dynamics: Natural Contour' },
    spectralConsistency: { value: 'Normal', score: 26, status: 'normal', text: 'Formant Distribution: Normal' },
    temporalConsistency: { value: 'Normal', score: 15, status: 'normal', text: 'Frame Transitions: Continuous' },
    syntheticArtifactSignal: { value: 'Normal', score: 12, status: 'normal', text: 'Vocoder Phase Artifacts: None' },
    phaseCoherence: { value: 'Normal', score: 14, status: 'normal', text: 'Spectral Coherence: Optimal' }
  },

  // Contextual Risk Data
  contextData: {
    callerId: '+91 •••• 2841',
    knownContact: 'No (Unrecognized Device)',
    fraudHistory: '2 Prior Incident Reports',
    transactionAmount: '₹75,000',
    typicalAmount: '₹10,000',
    sessionTime: '02:14 AM IST',
    geoVelocity: 'Mumbai IP ↔ Delhi SIM',
    score: 72
  },

  // Composite Risk Engine
  compositeWeights: {
    voice: 0.60,
    context: 0.30,
    fraud: 0.10
  },
  overallRisk: 31,
  recommendedAction: 'MONITOR', // 'MONITOR' | 'CHALLENGE' | 'ESCALATE'

  // Evidence Stream (Latest 20)
  events: [],

  // Risk Trend Timeline History (60-second rolling window)
  trendHistory: [],

  // Configuration Settings
  config: {
    mediumThreshold: 40,
    highThreshold: 65,
    smoothingAlpha: 0.35,
    wsEndpoint: 'ws://localhost:8000/ws/analyze',
    chunkWindowSeconds: 2.0,
    threatProfile: 'natural', // 'natural' | 'tts_clone' | 'voice_conversion' | 'replay_attack'
    backendMode: 'simulation' // 'simulation' | 'connected'
  },

  // Alert State
  highRiskAlertDismissed: false
};

// Seeded Historical Sessions
const sessionHistoryStore = [
  { id: 'VG-10482', date: 'Today, 02:14 AM', duration: '06:42', source: 'Browser Microphone', windows: 201, peakRisk: 78, category: 'High', action: 'Escalated', caller: '+91 98410 28419', amount: '₹75,000', notes: 'High vocoder phase artifacts & unusual transaction velocity.' },
  { id: 'VG-10481', date: 'Yesterday, 22:30', duration: '03:21', source: 'WebRTC Telephony', windows: 100, peakRisk: 24, category: 'Low', action: 'Monitored', caller: '+91 91223 90182', amount: '₹8,500', notes: 'Verified account holder voice biometrics matched.' },
  { id: 'VG-10480', date: 'Yesterday, 19:45', duration: '08:12', source: 'SIP Trunk G.711', windows: 246, peakRisk: 57, category: 'Medium', action: 'Challenged', caller: '+91 98711 02931', amount: '₹35,000', notes: 'Elevated pitch jitter triggered SMS OTP verification.' },
  { id: 'VG-10479', date: 'Yesterday, 17:10', duration: '04:15', source: 'Opus HD Voice', windows: 127, peakRisk: 84, category: 'High', action: 'Escalated', caller: '+91 99401 88320', amount: '₹120,000', notes: 'Cloned neural TTS synthetic speech detected.' },
  { id: 'VG-10478', date: 'Aug 29, 14:02', duration: '02:50', source: 'WebRTC Telephony', windows: 85, peakRisk: 19, category: 'Low', action: 'Monitored', caller: '+91 93810 11902', amount: '₹4,000', notes: 'Clear natural vocal tract characteristics.' }
];

// Seeded Investigations
const investigationsStore = [
  { caseId: 'VG-CASE-10482', linkedSession: 'VG-10482', created: 'Today, 02:22 AM', risk: 78, priority: 'High', reason: 'Vocoder synthetic phase artifacts & high-risk contextual profile', assignee: 'Fraud Security Team', status: 'Open', notes: 'Immediate secondary verification requested for ₹75,000 transaction.' },
  { caseId: 'VG-CASE-10479', linkedSession: 'VG-10479', created: 'Yesterday, 17:18', risk: 84, priority: 'Critical', reason: 'Cloned TTS model spectral footprint identified', assignee: 'Tier-2 Forensic Response', status: 'In Review', notes: 'Synthetic speech matching commercial voice cloning API footprint.' },
  { caseId: 'VG-CASE-10475', linkedSession: 'VG-10475', created: 'Aug 28, 11:40', risk: 72, priority: 'High', reason: 'Acoustic replay attack with room impulse reverberation', assignee: 'Fraud Security Team', status: 'Resolved', notes: 'Confirmed replay of previously recorded customer confirmation prompt.' }
];

// ============================================================================
// 2. WEB AUDIO API & DSP ENGINE
// ============================================================================
let audioContext = null;
let mediaStream = null;
let sourceNode = null;
let analyserNode = null;
let animationFrameId = null;
let analysisIntervalId = null;
let mediaRecorder = null;
let webSocket = null;

// FFT & Visualization Buffers
let timeDomainBuffer = null;
let frequencyBuffer = null;

/**
 * Initialize Web Audio Context and Analyser Node
 */
function initializeAudioAnalyser(stream) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioCtx({ sampleRate: 16000 });
  
  sourceNode = audioContext.createMediaStreamSource(stream);
  analyserNode = audioContext.createAnalyser();
  
  analyserNode.fftSize = 2048;
  analyserNode.smoothingTimeConstant = 0.75;
  analyserNode.minDecibels = -90;
  analyserNode.maxDecibels = -10;

  sourceNode.connect(analyserNode);

  timeDomainBuffer = new Uint8Array(analyserNode.frequencyBinCount);
  frequencyBuffer = new Uint8Array(analyserNode.frequencyBinCount);

  analysisState.sampleRate = audioContext.sampleRate;
  const sampleRateEl = document.getElementById('sampleRateVal');
  if (sampleRateEl) sampleRateEl.textContent = (audioContext.sampleRate / 1000).toFixed(1) + ' kHz';
}

/**
 * Request real microphone access and start stream
 */
async function startMicrophone() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
    
    mediaStream = stream;
    initializeAudioAnalyser(stream);

    // Prepare audio chunking recorder (for future WebSocket streaming)
    setupAudioChunkRecorder(stream);

    // Hide overlay guides
    const waveOverlay = document.getElementById('waveformStandbyOverlay');
    const specOverlay = document.getElementById('spectrogramStandbyOverlay');
    if (waveOverlay) waveOverlay.classList.add('hidden');
    if (specOverlay) specOverlay.classList.add('hidden');

    return true;
  } catch (err) {
    console.error('Microphone access denied or error:', err);
    showMicPermissionModal();
    return false;
  }
}

/**
 * Stop microphone streams and release audio hardware
 */
function stopMicrophone() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
    audioContext = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder = null;
  }

  // Restore standby overlays
  const waveOverlay = document.getElementById('waveformStandbyOverlay');
  const specOverlay = document.getElementById('spectrogramStandbyOverlay');
  if (waveOverlay) waveOverlay.classList.remove('hidden');
  if (specOverlay) specOverlay.classList.remove('hidden');
}

/**
 * Setup MediaRecorder chunking for continuous streaming
 */
function setupAudioChunkRecorder(stream) {
  try {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' : '');

    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0 && analysisState.status === 'monitoring') {
        analysisState.activeBuffersCount++;
        const bufCountEl = document.getElementById('bufferCountVal');
        if (bufCountEl) bufCountEl.textContent = `${analysisState.activeBuffersCount} chunks`;
        
        // If WebSocket is connected, send chunk binary to backend
        if (webSocket && webSocket.readyState === WebSocket.OPEN) {
          webSocket.send(event.data);
        }
      }
    };

    // Slice audio every 2000ms (2.0s rolling window)
    const sliceMs = analysisState.config.chunkWindowSeconds * 1000;
    mediaRecorder.start(sliceMs);
  } catch (e) {
    console.warn('MediaRecorder streaming init warning:', e);
  }
}

// ============================================================================
// 3. REAL-TIME CANVAS VISUALIZERS (Waveform & Spectrogram at 60 FPS)
// ============================================================================
const waveformCanvas = document.getElementById('waveformCanvas');
const spectrogramCanvas = document.getElementById('spectrogramCanvas');
let waveCtx = waveformCanvas ? waveformCanvas.getContext('2d') : null;
let specCtx = spectrogramCanvas ? spectrogramCanvas.getContext('2d') : null;

// Offscreen buffer for continuous waterfall spectrogram
let specOffscreenCanvas = document.createElement('canvas');
let specOffscreenCtx = specOffscreenCanvas.getContext('2d');

function setupCanvasSizes() {
  if (waveformCanvas) {
    const rect = waveformCanvas.parentElement.getBoundingClientRect();
    waveformCanvas.width = rect.width * window.devicePixelRatio;
    waveformCanvas.height = rect.height * window.devicePixelRatio;
  }
  if (spectrogramCanvas) {
    const rect = spectrogramCanvas.parentElement.getBoundingClientRect();
    spectrogramCanvas.width = rect.width * window.devicePixelRatio;
    spectrogramCanvas.height = rect.height * window.devicePixelRatio;
    specOffscreenCanvas.width = spectrogramCanvas.width;
    specOffscreenCanvas.height = spectrogramCanvas.height;
  }
}
window.addEventListener('resize', setupCanvasSizes);

/**
 * Draw Real-Time Live Oscillogram Waveform
 */
function drawWaveform() {
  if (!waveCtx || !waveformCanvas) return;

  const width = waveformCanvas.width;
  const height = waveformCanvas.height;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  // Clear canvas
  waveCtx.fillStyle = isDark ? '#05080f' : '#f8fafc';
  waveCtx.fillRect(0, 0, width, height);

  // Draw center reference grid lines
  waveCtx.strokeStyle = isDark ? 'rgba(30, 45, 74, 0.4)' : 'rgba(203, 213, 225, 0.6)';
  waveCtx.lineWidth = 1;
  waveCtx.beginPath();
  waveCtx.moveTo(0, height / 2);
  waveCtx.lineTo(width, height / 2);
  waveCtx.moveTo(0, height * 0.25);
  waveCtx.lineTo(width, height * 0.25);
  waveCtx.moveTo(0, height * 0.75);
  waveCtx.lineTo(width, height * 0.75);
  waveCtx.stroke();

  if (analyserNode && analysisState.status === 'monitoring' && timeDomainBuffer) {
    analyserNode.getByteTimeDomainData(timeDomainBuffer);

    // Compute RMS Energy, Peak Amplitude, and Zero-Crossing Rate
    let sumSquares = 0;
    let peak = 0;
    let zeroCrossings = 0;
    const bufferLength = timeDomainBuffer.length;

    for (let i = 0; i < bufferLength; i++) {
      const normalized = (timeDomainBuffer[i] - 128) / 128;
      sumSquares += normalized * normalized;
      const absVal = Math.abs(normalized);
      if (absVal > peak) peak = absVal;

      if (i > 0) {
        const prevNormalized = (timeDomainBuffer[i - 1] - 128) / 128;
        if ((normalized >= 0 && prevNormalized < 0) || (normalized < 0 && prevNormalized >= 0)) {
          zeroCrossings++;
        }
      }
    }

    const rms = Math.sqrt(sumSquares / bufferLength);
    const db = rms > 0.0001 ? Math.max(-60, 20 * Math.log10(rms)) : -60;

    analysisState.audioLevel = db;
    analysisState.peakAmplitude = peak;
    analysisState.zeroCrossingRate = Math.round((zeroCrossings * (analysisState.sampleRate / bufferLength)) / 2);

    // Update Signal UI elements
    updateSignalTelemetryUI(db, peak, analysisState.zeroCrossingRate);

    // Draw Smooth Waveform Path
    waveCtx.lineWidth = 2 * window.devicePixelRatio;
    
    // Create gradient based on risk level
    const gradient = waveCtx.createLinearGradient(0, 0, width, 0);
    if (analysisState.smoothedRiskScore > analysisState.config.highThreshold) {
      gradient.addColorStop(0, '#dc2626');
      gradient.addColorStop(1, '#ef4444');
    } else if (analysisState.smoothedRiskScore > analysisState.config.mediumThreshold) {
      gradient.addColorStop(0, '#d97706');
      gradient.addColorStop(1, '#f59e0b');
    } else {
      gradient.addColorStop(0, '#2563eb');
      gradient.addColorStop(0.5, '#059669');
      gradient.addColorStop(1, '#0284c7');
    }

    waveCtx.strokeStyle = gradient;
    waveCtx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = timeDomainBuffer[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        waveCtx.moveTo(x, y);
      } else {
        waveCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    waveCtx.stroke();

    // Draw subtle glow
    waveCtx.shadowBlur = 6;
    waveCtx.shadowColor = analysisState.smoothedRiskScore > 65 ? 'rgba(220, 38, 38, 0.3)' : 'rgba(37, 99, 235, 0.2)';
  } else {
    // Idle flatline
    waveCtx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
    waveCtx.lineWidth = 2;
    waveCtx.beginPath();
    waveCtx.moveTo(0, height / 2);
    waveCtx.lineTo(width, height / 2);
    waveCtx.stroke();
  }
}

/**
 * Draw Real-Time Live Spectrogram & Harmonic Analysis
 */
function drawSpectrogram() {
  if (!specCtx || !spectrogramCanvas) return;

  const width = spectrogramCanvas.width;
  const height = spectrogramCanvas.height;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  if (analyserNode && analysisState.status === 'monitoring' && frequencyBuffer) {
    analyserNode.getByteFrequencyData(frequencyBuffer);

    // Shift offscreen canvas left by 2 pixels for continuous waterfall scroll
    const scrollSpeed = 2 * window.devicePixelRatio;
    specOffscreenCtx.drawImage(
      specOffscreenCanvas,
      scrollSpeed, 0, width - scrollSpeed, height,
      0, 0, width - scrollSpeed, height
    );

    // Render new column slice on the right edge
    const binCount = 180; // Focus on 0 to 8kHz bins
    const binHeight = height / binCount;

    for (let i = 0; i < binCount; i++) {
      const freqValue = frequencyBuffer[i]; // 0 - 255
      const normalized = freqValue / 255;

      // Color mapping: low energy -> soft blue/slate; mid -> cyan/green; high -> amber/rose
      let r, g, b;
      if (normalized < 0.25) {
        r = Math.floor(normalized * 4 * (isDark ? 10 : 200) + (isDark ? 0 : 40));
        g = Math.floor(normalized * 4 * (isDark ? 40 : 210) + (isDark ? 0 : 40));
        b = Math.floor(normalized * 4 * (isDark ? 120 : 230) + (isDark ? 20 : 20));
      } else if (normalized < 0.6) {
        const t = (normalized - 0.25) / 0.35;
        r = Math.floor(t * 16);
        g = Math.floor(t * 185 + 40);
        b = Math.floor((1 - t) * 120 + 100);
      } else if (normalized < 0.85) {
        const t = (normalized - 0.6) / 0.25;
        r = Math.floor(t * 245 + 16);
        g = Math.floor((1 - t) * 185 + 158);
        b = 20;
      } else {
        const t = (normalized - 0.85) / 0.15;
        r = 239;
        g = Math.floor((1 - t) * 158 + 68);
        b = 68;
      }

      specOffscreenCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      const y = height - (i + 1) * binHeight;
      specOffscreenCtx.fillRect(width - scrollSpeed, y, scrollSpeed, binHeight + 1);
    }

    // Blit offscreen buffer to visible canvas
    specCtx.clearRect(0, 0, width, height);
    specCtx.drawImage(specOffscreenCanvas, 0, 0);

    // Draw overlay frequency guide grid lines
    specCtx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(100, 116, 139, 0.2)';
    specCtx.lineWidth = 1;
    [0.2, 0.4, 0.6, 0.8].forEach(ratio => {
      const lineY = height * ratio;
      specCtx.beginPath();
      specCtx.moveTo(0, lineY);
      specCtx.lineTo(width, lineY);
      specCtx.stroke();
    });
  } else if (analysisState.status !== 'monitoring') {
    // Clear canvas when idle
    specCtx.fillStyle = isDark ? '#05080f' : '#f8fafc';
    specCtx.fillRect(0, 0, width, height);
  }
}

/**
 * Main 60 FPS requestAnimationFrame Loop
 */
function renderVisualizersLoop() {
  drawWaveform();
  drawSpectrogram();
  animationFrameId = requestAnimationFrame(renderVisualizersLoop);
}

/**
 * Update signal UI status and level indicators
 */
function updateSignalTelemetryUI(db, peak, zcr) {
  const rmsEl = document.getElementById('rmsDecibelVal');
  const peakEl = document.getElementById('peakAmplitudeVal');
  const zcrEl = document.getElementById('zcrVal');
  const signalDot = document.getElementById('signalDot');
  const signalText = document.getElementById('signalText');
  const audioQualityVal = document.getElementById('audioQualityVal');

  if (rmsEl) rmsEl.textContent = `${db.toFixed(1)} dB`;
  if (peakEl) peakEl.textContent = peak.toFixed(3);
  if (zcrEl) zcrEl.textContent = `${zcr} Hz`;

  if (db > -35) {
    analysisState.audioQuality = 'Good';
    if (signalDot) { signalDot.className = 'signal-dot good'; }
    if (signalText) { signalText.textContent = 'Signal: Good'; }
    if (audioQualityVal) {
      audioQualityVal.textContent = 'Good';
      audioQualityVal.className = 'telemetry-val quality-good';
    }
  } else if (db > -52) {
    analysisState.audioQuality = 'Weak';
    if (signalDot) { signalDot.className = 'signal-dot weak'; }
    if (signalText) { signalText.textContent = 'Signal: Weak'; }
    if (audioQualityVal) {
      audioQualityVal.textContent = 'Weak';
      audioQualityVal.className = 'telemetry-val';
    }
  } else {
    analysisState.audioQuality = 'Silent';
    if (signalDot) { signalDot.className = 'signal-dot silent'; }
    if (signalText) { signalText.textContent = 'Signal: Silent'; }
    if (audioQualityVal) {
      audioQualityVal.textContent = 'Silent (No Voice)';
      audioQualityVal.className = 'telemetry-val';
    }
  }
}

// ============================================================================
// 4. ROLLING WINDOW INFERENCE & LOCAL DSP SIMULATION ENGINE
// ============================================================================

/**
 * Start periodic continuous analysis (every 2.0s window)
 */
function startContinuousAnalysis() {
  if (analysisIntervalId) clearInterval(analysisIntervalId);
  const intervalMs = analysisState.config.chunkWindowSeconds * 1000;
  analysisIntervalId = setInterval(runAnalysisWindow, intervalMs);
}

function stopContinuousAnalysis() {
  if (analysisIntervalId) {
    clearInterval(analysisIntervalId);
    analysisIntervalId = null;
  }
}

/**
 * Execute one rolling audio analysis window
 */
function runAnalysisWindow() {
  if (analysisState.status !== 'monitoring') return;

  analysisState.totalWindows++;
  const winCountEl = document.getElementById('windowCounterBadge');
  if (winCountEl) {
    winCountEl.textContent = `${analysisState.totalWindows} Windows Evaluated`;
  }

  // Trigger window highlight animation cursor
  triggerTimelineWindowPulse();

  // If local simulation engine (or standalone testing)
  if (analysisState.config.backendMode === 'simulation') {
    startDemoAnalysis();
  }

  // Update UI and Chart
  updateRiskUI();
  updateAcousticSignals();
  appendRiskTrendPoint();
}

/**
 * Animate the analysis window timeline track cursor
 */
function triggerTimelineWindowPulse() {
  const cursor = document.getElementById('timelineWindowCursor');
  if (cursor) {
    cursor.style.opacity = '1';
    cursor.style.transform = 'scale(1.04)';
    setTimeout(() => {
      cursor.style.transform = 'scale(1)';
    }, 200);
  }
}

/**
 * Local DSP & Statistical Anomaly Simulation Engine
 * Synthesizes real microphone properties with selected threat profile
 */
function startDemoAnalysis() {
  const profile = analysisState.config.threatProfile;
  const isSpeaking = analysisState.audioLevel > -50;
  
  let targetRisk = 15;
  let targetSpoof = 12;
  let targetConf = 93;

  if (isSpeaking) {
    switch (profile) {
      case 'natural':
        // Natural human speech: low risk, high pitch stability, no vocoder artifacts
        targetRisk = Math.floor(10 + Math.random() * 12);
        targetSpoof = Math.floor(8 + Math.random() * 14);
        targetConf = Math.floor(92 + Math.random() * 6);
        
        analysisState.acousticSignals.pitchStability = { value: 'Normal', score: 14 + Math.random() * 8, status: 'normal', text: 'F0 Jitter: 0.32% (Natural)' };
        analysisState.acousticSignals.energyPattern = { value: 'Normal', score: 18 + Math.random() * 10, status: 'normal', text: 'Dynamics: Natural Syllabic Contour' };
        analysisState.acousticSignals.spectralConsistency = { value: 'Normal', score: 20 + Math.random() * 8, status: 'normal', text: 'Formant Distribution: Normal' };
        analysisState.acousticSignals.temporalConsistency = { value: 'Normal', score: 12 + Math.random() * 6, status: 'normal', text: 'Frame Transitions: Continuous' };
        analysisState.acousticSignals.syntheticArtifactSignal = { value: 'Normal', score: 8 + Math.random() * 6, status: 'normal', text: 'Vocoder Phase Artifacts: None' };
        analysisState.acousticSignals.phaseCoherence = { value: 'Normal', score: 10 + Math.random() * 6, status: 'normal', text: 'Spectral Coherence: Optimal' };
        break;

      case 'tts_clone':
        // Neural TTS voice clone: high risk, synthetic phase artifacts, flattened pitch
        targetRisk = Math.floor(75 + Math.random() * 16);
        targetSpoof = Math.floor(78 + Math.random() * 18);
        targetConf = Math.floor(94 + Math.random() * 5);

        analysisState.acousticSignals.pitchStability = { value: 'Elevated', score: 62 + Math.random() * 12, status: 'elevated', text: 'F0 Jitter: 0.04% (Unnatural Flatness)' };
        analysisState.acousticSignals.energyPattern = { value: 'Elevated', score: 58 + Math.random() * 14, status: 'elevated', text: 'Dynamics: Abrupt Synthesis Boundaries' };
        analysisState.acousticSignals.spectralConsistency = { value: 'Anomalous', score: 82 + Math.random() * 12, status: 'anomalous', text: 'High-Freq Spectral Attenuation Discontinuity' };
        analysisState.acousticSignals.temporalConsistency = { value: 'Elevated', score: 65 + Math.random() * 10, status: 'elevated', text: 'Milli-Second Framing Periodicity Detected' };
        analysisState.acousticSignals.syntheticArtifactSignal = { value: 'Anomalous', score: 88 + Math.random() * 9, status: 'anomalous', text: 'HiFi-GAN / Vocoder Phase Incoherence' };
        analysisState.acousticSignals.phaseCoherence = { value: 'Anomalous', score: 84 + Math.random() * 10, status: 'anomalous', text: 'Phase Disruption at Harmonic Overtones' };

        // Randomly emit detection evidence event
        if (Math.random() > 0.4) {
          const events = [
            { type: 'Spectral Anomaly', text: 'Vocoder phase discontinuity detected in 4–8 kHz band', conf: 86 },
            { type: 'Synthetic Artifact', text: 'Neural acoustic footprint matched (ElevenLabs-style VITS)', conf: 92 },
            { type: 'Temporal Inconsistency', text: 'Unnatural robotic pitch periodicity F0 jitter < 0.05%', conf: 88 }
          ];
          const ev = events[Math.floor(Math.random() * events.length)];
          addDetectionEvent(ev.type, ev.text, ev.conf, 'danger');
        }
        break;

      case 'voice_conversion':
        // RVC Real-Time Conversion: elevated risk, formant shifts, conversion lag
        targetRisk = Math.floor(58 + Math.random() * 18);
        targetSpoof = Math.floor(62 + Math.random() * 16);
        targetConf = Math.floor(89 + Math.random() * 7);

        analysisState.acousticSignals.pitchStability = { value: 'Elevated', score: 54 + Math.random() * 15, status: 'elevated', text: 'Pitch Tracking Lag / Conversion Jitter' };
        analysisState.acousticSignals.energyPattern = { value: 'Normal', score: 32 + Math.random() * 10, status: 'normal', text: 'Energy Dynamics: Partially Preserved' };
        analysisState.acousticSignals.spectralConsistency = { value: 'Anomalous', score: 76 + Math.random() * 14, status: 'anomalous', text: 'Formant Shift Trajectory Mismatch' };
        analysisState.acousticSignals.temporalConsistency = { value: 'Normal', score: 30 + Math.random() * 10, status: 'normal', text: 'Temporal Cadence: Human Baseline' };
        analysisState.acousticSignals.syntheticArtifactSignal = { value: 'Elevated', score: 68 + Math.random() * 12, status: 'elevated', text: 'Real-Time Pitch Shifter Harmonic Distortion' };
        analysisState.acousticSignals.phaseCoherence = { value: 'Elevated', score: 60 + Math.random() * 14, status: 'elevated', text: 'Spectral Smeared Overtones' };

        if (Math.random() > 0.5) {
          addDetectionEvent('Formant Anomaly', 'Real-time voice conversion formant shifting anomaly detected', 81, 'warn');
        }
        break;

      case 'replay_attack':
        // Replay Attack: loudspeaker room impulse response, channel distortion
        targetRisk = Math.floor(50 + Math.random() * 18);
        targetSpoof = Math.floor(52 + Math.random() * 16);
        targetConf = Math.floor(88 + Math.random() * 6);

        analysisState.acousticSignals.pitchStability = { value: 'Normal', score: 28 + Math.random() * 10, status: 'normal', text: 'F0 Contour: Human Characteristic' };
        analysisState.acousticSignals.energyPattern = { value: 'Elevated', score: 60 + Math.random() * 12, status: 'elevated', text: 'Loudspeaker Dynamic Compression Artifacts' };
        analysisState.acousticSignals.spectralConsistency = { value: 'Elevated', score: 64 + Math.random() * 14, status: 'elevated', text: 'Room Impulse Response / Low-Pass Cutoff' };
        analysisState.acousticSignals.temporalConsistency = { value: 'Normal', score: 25 + Math.random() * 8, status: 'normal', text: 'Natural Flow Pattern' };
        analysisState.acousticSignals.syntheticArtifactSignal = { value: 'Normal', score: 22 + Math.random() * 8, status: 'normal', text: 'No Vocoder Footprint' };
        analysisState.acousticSignals.phaseCoherence = { value: 'Elevated', score: 66 + Math.random() * 12, status: 'elevated', text: 'Acoustic Reverberation Channel Distortion' };

        if (Math.random() > 0.5) {
          addDetectionEvent('Channel Distortion', 'Acoustic replay reverberation signature detected', 76, 'warn');
        }
        break;
    }
  } else {
    // Silence/Ambience
    targetRisk = Math.max(5, Math.floor(analysisState.riskScore * 0.85));
    targetSpoof = Math.max(5, Math.floor(analysisState.spoofProbability * 0.85));
    targetConf = 91;
  }

  // Apply Exponential Moving Average (EMA) Smoothing
  const alpha = analysisState.config.smoothingAlpha;
  analysisState.riskScore = targetRisk;
  analysisState.smoothedRiskScore = Math.round(alpha * targetRisk + (1 - alpha) * analysisState.smoothedRiskScore);
  analysisState.spoofProbability = Math.round(alpha * targetSpoof + (1 - alpha) * analysisState.spoofProbability);
  analysisState.genuineProbability = 100 - analysisState.spoofProbability;
  analysisState.confidence = targetConf;

  // Track Peak and Average
  if (analysisState.smoothedRiskScore > analysisState.peakRisk) {
    analysisState.peakRisk = analysisState.smoothedRiskScore;
  }
  analysisState.riskSum += analysisState.smoothedRiskScore;

  if (analysisState.smoothedRiskScore > analysisState.config.highThreshold) {
    analysisState.highRiskEventCount++;
  }

  // Compute Composite Overall Risk Score
  // Composite = (VoiceRisk * 0.60) + (ContextRisk * 0.30) + (FraudHistory * 0.10)
  const voicePart = analysisState.smoothedRiskScore * analysisState.compositeWeights.voice;
  const contextPart = analysisState.contextData.score * analysisState.compositeWeights.context;
  const fraudPart = 80 * analysisState.compositeWeights.fraud; // 80/100 history severity
  analysisState.overallRisk = Math.round(voicePart + contextPart + fraudPart);

  // Determine Recommended Action
  if (analysisState.overallRisk > analysisState.config.highThreshold || analysisState.smoothedRiskScore > analysisState.config.highThreshold) {
    analysisState.recommendedAction = 'ESCALATE';
  } else if (analysisState.overallRisk > analysisState.config.mediumThreshold || analysisState.smoothedRiskScore > analysisState.config.mediumThreshold) {
    analysisState.recommendedAction = 'CHALLENGE';
  } else {
    analysisState.recommendedAction = 'MONITOR';
  }
}

// ============================================================================
// 5. RISK UI & DECISION CONSOLE UPDATES
// ============================================================================

/**
 * Update Voice Integrity Risk Gauge, Spoof Bars, and Decision Console
 */
function updateRiskUI() {
  const risk = analysisState.smoothedRiskScore;
  const overall = analysisState.overallRisk;

  // 1. Voice Integrity Risk Gauge Arc
  const gaugeScoreNum = document.getElementById('gaugeScoreNum');
  const gaugeValArc = document.getElementById('gaugeValArc');
  const gaugeCategory = document.getElementById('gaugeCategoryLabel');
  const confidenceBadge = document.getElementById('modelConfidenceBadge');

  if (gaugeScoreNum) gaugeScoreNum.textContent = risk;
  if (confidenceBadge) confidenceBadge.textContent = `Confidence: ${analysisState.confidence}%`;

  if (gaugeValArc) {
    // Arc circumference for r=80 is PI * 80 ≈ 251.32
    const totalArc = 251.32;
    const offset = totalArc - (risk / 100) * totalArc;
    gaugeValArc.style.strokeDashoffset = offset;

    gaugeValArc.classList.remove('low', 'med', 'high');
    if (gaugeCategory) gaugeCategory.classList.remove('low', 'med', 'high');

    if (risk > analysisState.config.highThreshold) {
      gaugeValArc.classList.add('high');
      if (gaugeCategory) {
        gaugeCategory.classList.add('high');
        gaugeCategory.textContent = 'HIGH RISK';
      }
    } else if (risk > analysisState.config.mediumThreshold) {
      gaugeValArc.classList.add('med');
      if (gaugeCategory) {
        gaugeCategory.classList.add('med');
        gaugeCategory.textContent = 'MEDIUM RISK';
      }
    } else {
      gaugeValArc.classList.add('low');
      if (gaugeCategory) {
        gaugeCategory.classList.add('low');
        gaugeCategory.textContent = 'LOW RISK';
      }
    }
  }

  // 2. Spoof vs Genuine Probability Bars
  const spoofProbVal = document.getElementById('spoofProbVal');
  const genuineProbVal = document.getElementById('genuineProbVal');
  const probBarSpoof = document.getElementById('probBarSpoof');
  const probBarGenuine = document.getElementById('probBarGenuine');

  if (spoofProbVal) spoofProbVal.textContent = `${analysisState.spoofProbability}%`;
  if (genuineProbVal) genuineProbVal.textContent = `${analysisState.genuineProbability}%`;
  if (probBarSpoof) probBarSpoof.style.width = `${analysisState.spoofProbability}%`;
  if (probBarGenuine) probBarGenuine.style.width = `${analysisState.genuineProbability}%`;

  // 3. Composite Risk Engine Section
  const weightVoiceScore = document.getElementById('weightVoiceScore');
  const overallRiskNum = document.getElementById('overallRiskNum');
  const overallRiskBadge = document.getElementById('overallRiskBadge');

  if (weightVoiceScore) weightVoiceScore.textContent = `${risk} / 100`;
  if (overallRiskNum) overallRiskNum.textContent = overall;
  if (overallRiskBadge) {
    overallRiskBadge.classList.remove('low', 'med', 'high');
    if (overall > analysisState.config.highThreshold) {
      overallRiskBadge.classList.add('high');
      overallRiskBadge.textContent = 'HIGH';
    } else if (overall > analysisState.config.mediumThreshold) {
      overallRiskBadge.classList.add('med');
      overallRiskBadge.textContent = 'MEDIUM';
    } else {
      overallRiskBadge.classList.add('low');
      overallRiskBadge.textContent = 'LOW';
    }
  }

  // 4. Decision & Recommended Action Console
  const decisionCard = document.getElementById('decisionCard');
  const actionStateTag = document.getElementById('actionStateTag');
  const guidanceTitle = document.getElementById('guidanceTitle');
  const guidanceDesc = document.getElementById('guidanceDesc');
  const topThreatPill = document.getElementById('topThreatPill');
  const topThreatPillText = document.getElementById('topThreatPillText');

  if (decisionCard && actionStateTag && guidanceTitle && guidanceDesc) {
    decisionCard.classList.remove('high-risk', 'med-risk');
    actionStateTag.classList.remove('monitor', 'challenge', 'escalate');

    if (topThreatPill && topThreatPillText) {
      topThreatPill.classList.remove('low', 'med', 'high');
    }

    if (analysisState.recommendedAction === 'ESCALATE') {
      decisionCard.classList.add('high-risk');
      actionStateTag.classList.add('escalate');
      actionStateTag.textContent = 'ESCALATE';
      guidanceTitle.textContent = 'High-Risk Synthetic Indicators Detected';
      guidanceDesc.textContent = 'Potential synthetic/manipulated speech artifacts have exceeded critical thresholds. Immediately freeze transaction and escalate to Fraud Security Team.';

      if (topThreatPill && topThreatPillText) {
        topThreatPill.classList.add('high');
        topThreatPillText.textContent = 'Threat Level: Critical (Synthetic)';
      }

      // Check if security alert banner should be shown
      triggerSecurityAlert(risk);

    } else if (analysisState.recommendedAction === 'CHALLENGE') {
      decisionCard.classList.add('med-risk');
      actionStateTag.classList.add('challenge');
      actionStateTag.textContent = 'CHALLENGE';
      guidanceTitle.textContent = 'Elevated Acoustic Discontinuity';
      guidanceDesc.textContent = 'Acoustic parameters deviate from baseline. Request secondary out-of-band caller verification (Push OTP or biometric prompt).';

      if (topThreatPill && topThreatPillText) {
        topThreatPill.classList.add('med');
        topThreatPillText.textContent = 'Threat Level: Elevated';
      }
    } else {
      actionStateTag.classList.add('monitor');
      actionStateTag.textContent = 'MONITOR';
      guidanceTitle.textContent = 'Acoustic Signal Within Baseline Parameters';
      guidanceDesc.textContent = 'No synthetic speech artifacts or voice conversion anomalies detected. Continue standard monitoring.';

      if (topThreatPill && topThreatPillText) {
        topThreatPill.classList.add('low');
        topThreatPillText.textContent = 'Threat Level: Normal';
      }
    }
  }
}

/**
 * Update Acoustic Diagnostic Matrix Cells
 */
function updateAcousticSignals() {
  const sigs = analysisState.acousticSignals;
  
  updateAcousticCell('pitch', sigs.pitchStability);
  updateAcousticCell('energy', sigs.energyPattern);
  updateAcousticCell('spectral', sigs.spectralConsistency);
  updateAcousticCell('temporal', sigs.temporalConsistency);
  updateAcousticCell('artifact', sigs.syntheticArtifactSignal);
  updateAcousticCell('phase', sigs.phaseCoherence);
}

function updateAcousticCell(name, data) {
  const badge = document.getElementById(`${name}StatusBadge`);
  const bar = document.getElementById(`${name}BarFill`);
  const reading = document.getElementById(`${name}ReadingText`);

  if (badge) {
    badge.className = `status-badge ${data.status}`;
    badge.textContent = data.value;
  }
  if (bar) {
    bar.className = `acoustic-bar-fill ${data.status}`;
    bar.style.width = `${Math.min(100, Math.max(10, data.score))}%`;
  }
  if (reading) {
    reading.textContent = data.text;
  }
}

/**
 * Add a new detection event to the evidence stream (max 20 rolling items)
 */
function addDetectionEvent(title, description, confidence, severity = 'info') {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const newEvent = {
    id: `EV-${Date.now()}`,
    time: timeStr,
    title,
    description,
    confidence,
    severity
  };

  analysisState.events.unshift(newEvent);
  if (analysisState.events.length > 20) {
    analysisState.events.pop();
  }

  renderEvidenceStream();
}

/**
 * Render the evidence stream list
 */
function renderEvidenceStream() {
  const listEl = document.getElementById('evidenceStreamList');
  const countBadge = document.getElementById('evidenceCountBadge');
  if (!listEl) return;

  if (countBadge) {
    countBadge.textContent = `${analysisState.events.length} events`;
  }

  if (analysisState.events.length === 0) {
    listEl.innerHTML = `
      <div class="empty-evidence-placeholder">
        <i data-lucide="radio" class="empty-icon"></i>
        <span>Real-time anomaly markers and confidence telemetry will appear here</span>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  listEl.innerHTML = analysisState.events.map(ev => {
    let badgeClass = 'status-badge info';
    if (ev.severity === 'danger') badgeClass = 'status-badge danger';
    if (ev.severity === 'warn') badgeClass = 'status-badge warn';

    return `
      <div class="evidence-event-item">
        <span class="evidence-time">${ev.time}</span>
        <span class="${badgeClass}">${ev.title}</span>
        <span class="evidence-desc">${ev.description}</span>
        <span class="evidence-conf">${ev.confidence}%</span>
      </div>
    `;
  }).join('');
}

/**
 * Trigger Non-Blocking Security Alert Banner
 */
function triggerSecurityAlert(riskScore) {
  if (analysisState.highRiskAlertDismissed) return;

  const banner = document.getElementById('securityAlertBanner');
  const bannerScore = document.getElementById('alertBannerScore');
  if (banner) {
    if (bannerScore) bannerScore.textContent = `${riskScore} / 100`;
    banner.classList.remove('hidden');
  }
}

// ============================================================================
// 6. RISK TREND CHART (CHART.JS TIMELINE)
// ============================================================================
let riskTrendChart = null;

function initializeRiskTrendChart() {
  const ctx = document.getElementById('riskTrendChart');
  if (!ctx) return;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(30, 45, 74, 0.4)' : 'rgba(226, 232, 240, 0.8)';
  const textColor = isDark ? '#94a3b8' : '#475569';

  // Seed initial 30 seconds of flat timeline
  const initialLabels = [];
  const initialData = [];
  for (let i = 15; i >= 0; i--) {
    initialLabels.push(`-${i * 2}s`);
    initialData.push(14);
  }
  analysisState.trendHistory = [...initialData];

  riskTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: initialLabels,
      datasets: [{
        label: 'Voice Integrity Risk',
        data: initialData,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      scales: {
        x: {
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 8 }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: textColor,
            font: { family: 'JetBrains Mono', size: 10 },
            stepSize: 20
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#0f1728' : '#ffffff',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#94a3b8' : '#475569',
          borderColor: isDark ? '#1e2d4a' : '#cbd5e1',
          borderWidth: 1,
          padding: 8,
          bodyFont: { family: 'JetBrains Mono' }
        }
      }
    }
  });
}

function appendRiskTrendPoint() {
  if (!riskTrendChart) return;

  const currentRisk = analysisState.smoothedRiskScore;
  analysisState.trendHistory.push(currentRisk);
  if (analysisState.trendHistory.length > 30) {
    analysisState.trendHistory.shift();
  }

  // Update dynamic line color according to risk
  let chartColor = '#10b981';
  if (currentRisk > analysisState.config.highThreshold) {
    chartColor = '#ef4444';
  } else if (currentRisk > analysisState.config.mediumThreshold) {
    chartColor = '#f59e0b';
  }

  riskTrendChart.data.datasets[0].borderColor = chartColor;
  riskTrendChart.data.datasets[0].data = analysisState.trendHistory;
  riskTrendChart.update('none');
}

// ============================================================================
// 7. SESSION CONTROLS & LIFECYCLE
// ============================================================================

/**
 * Start Monitoring Flow
 */
async function startMonitoring() {
  const success = await startMicrophone();
  if (!success) return;

  analysisState.status = 'monitoring';
  analysisState.startTime = Date.now();
  analysisState.highRiskAlertDismissed = false;

  // Start Elapsed Timer
  if (analysisState.timerInterval) clearInterval(analysisState.timerInterval);
  analysisState.timerInterval = setInterval(updateSessionTimer, 1000);

  // Start continuous rolling window analysis
  startContinuousAnalysis();

  // Update UI Elements
  updateSessionStateUI('monitoring');

  // Attempt WebSocket connection if endpoint is configured
  connectWebSocket();

  showToast('Monitoring session started. Analyzing live microphone stream.', 'info');
  addDetectionEvent('Session Started', 'Audio stream initialized. Calibration baseline established.', 99, 'info');
}

/**
 * Pause Monitoring Flow
 */
function pauseMonitoring() {
  if (analysisState.status !== 'monitoring') return;

  analysisState.status = 'paused';
  stopContinuousAnalysis();
  updateSessionStateUI('paused');
  showToast('Monitoring paused.', 'info');
}

/**
 * Resume Monitoring Flow
 */
function resumeMonitoring() {
  if (analysisState.status !== 'paused') return;

  analysisState.status = 'monitoring';
  startContinuousAnalysis();
  updateSessionStateUI('monitoring');
  showToast('Monitoring resumed.', 'info');
}

/**
 * Prompt End Session Confirmation Modal
 */
function promptEndSession() {
  const modal = document.getElementById('confirmEndSessionModal');
  const promptId = document.getElementById('endSessionPromptId');
  if (promptId) promptId.textContent = analysisState.sessionId;
  if (modal) modal.classList.remove('hidden');
}

/**
 * Confirm and finalize monitoring session
 */
function finalizeEndSession() {
  analysisState.status = 'complete';
  
  if (analysisState.timerInterval) {
    clearInterval(analysisState.timerInterval);
    analysisState.timerInterval = null;
  }
  stopContinuousAnalysis();
  stopMicrophone();

  // Close WebSocket if open
  if (webSocket) {
    webSocket.close();
    webSocket = null;
  }

  updateSessionStateUI('complete');

  // Close confirmation modal
  const confirmModal = document.getElementById('confirmEndSessionModal');
  if (confirmModal) confirmModal.classList.add('hidden');

  // Open Session Complete Summary Modal
  openSessionSummaryModal();
}

/**
 * Update UI for session states (Ready, Monitoring, Paused, Complete)
 */
function updateSessionStateUI(state) {
  const dot = document.getElementById('sessionStateDot');
  const text = document.getElementById('sessionStateText');
  const headerChip = document.getElementById('liveHeaderChip');
  const headerChipText = document.getElementById('liveHeaderChipText');
  const sidebarLivePill = document.getElementById('sidebarLivePill');
  const streamStatusBadge = document.getElementById('streamStatusBadge');
  const streamStatusText = document.getElementById('streamStatusText');

  const btnStart = document.getElementById('btnStartMonitoring');
  const btnPause = document.getElementById('btnPauseMonitoring');
  const btnEnd = document.getElementById('btnEndSession');

  if (dot) dot.className = `status-indicator-dot ${state}`;
  if (headerChip) headerChip.className = `live-status-chip ${state}`;

  switch (state) {
    case 'monitoring':
      if (text) text.textContent = 'Monitoring';
      if (headerChipText) headerChipText.textContent = 'LIVE MONITORING';
      if (sidebarLivePill) sidebarLivePill.className = 'nav-pill live-pill';
      if (streamStatusBadge) streamStatusBadge.style.display = 'flex';
      if (streamStatusText) streamStatusText.textContent = 'Live Audio Stream Active';

      if (btnStart) {
        btnStart.disabled = true;
        btnStart.innerHTML = '<i data-lucide="activity"></i><span>Monitoring</span>';
      }
      if (btnPause) {
        btnPause.disabled = false;
        btnPause.innerHTML = '<i data-lucide="pause"></i><span>Pause</span>';
      }
      if (btnEnd) btnEnd.disabled = false;
      break;

    case 'paused':
      if (text) text.textContent = 'Paused';
      if (headerChipText) headerChipText.textContent = 'PAUSED';
      if (streamStatusText) streamStatusText.textContent = 'Audio Stream Paused';

      if (btnStart) btnStart.disabled = true;
      if (btnPause) {
        btnPause.disabled = false;
        btnPause.innerHTML = '<i data-lucide="play"></i><span>Resume</span>';
      }
      if (btnEnd) btnEnd.disabled = false;
      break;

    case 'complete':
      if (text) text.textContent = 'Session Complete';
      if (headerChipText) headerChipText.textContent = 'COMPLETE';
      if (streamStatusText) streamStatusText.textContent = 'Session Finalized';

      if (btnStart) {
        btnStart.disabled = false;
        btnStart.innerHTML = '<i data-lucide="rotate-cw"></i><span>New Session</span>';
      }
      if (btnPause) btnPause.disabled = true;
      if (btnEnd) btnEnd.disabled = true;
      break;

    case 'ready':
    default:
      if (text) text.textContent = 'Ready';
      if (headerChipText) headerChipText.textContent = 'READY';
      if (streamStatusText) streamStatusText.textContent = 'Audio Engine Ready';

      if (btnStart) {
        btnStart.disabled = false;
        btnStart.innerHTML = '<i data-lucide="mic"></i><span>Start Monitoring</span>';
      }
      if (btnPause) btnPause.disabled = true;
      if (btnEnd) btnEnd.disabled = true;
      break;
  }

  lucide.createIcons();
}

/**
 * Format and increment session elapsed timer
 */
function updateSessionTimer() {
  analysisState.elapsedSeconds++;
  const mins = Math.floor(analysisState.elapsedSeconds / 60).toString().padStart(2, '0');
  const secs = (analysisState.elapsedSeconds % 60).toString().padStart(2, '0');
  const formatted = `${mins}:${secs}`;

  const durEl = document.getElementById('sessionDurationVal');
  if (durEl) durEl.textContent = formatted;
}

// ============================================================================
// 8. SESSION SUMMARY & INVESTIGATION CREATION WORKFLOWS
// ============================================================================

/**
 * Open Session Summary Modal with Complete Metrics
 */
function openSessionSummaryModal() {
  const modal = document.getElementById('sessionSummaryModal');
  if (!modal) return;

  const mins = Math.floor(analysisState.elapsedSeconds / 60).toString().padStart(2, '0');
  const secs = (analysisState.elapsedSeconds % 60).toString().padStart(2, '0');
  const durationStr = `${mins}:${secs}`;
  const avgRisk = analysisState.totalWindows > 0 ? Math.round(analysisState.riskSum / analysisState.totalWindows) : analysisState.smoothedRiskScore;
  const isHighRisk = analysisState.peakRisk > analysisState.config.highThreshold;

  // Populate Summary Elements
  const subTitle = document.getElementById('summarySessionIdSubtitle');
  const durVal = document.getElementById('summaryDurationVal');
  const peakVal = document.getElementById('summaryPeakRiskVal');
  const avgVal = document.getElementById('summaryAvgRiskVal');
  const highEvVal = document.getElementById('summaryHighEventsVal');
  const totalWinVal = document.getElementById('summaryTotalWindowsVal');
  const badge = document.getElementById('summaryAssessmentBadge');
  const actionVal = document.getElementById('summaryAssessmentAction');
  const eventsList = document.getElementById('summaryEventsList');

  if (subTitle) subTitle.textContent = `Session ${analysisState.sessionId} Summary`;
  if (durVal) durVal.textContent = durationStr;
  if (peakVal) peakVal.textContent = `${analysisState.peakRisk} / 100`;
  if (avgVal) avgVal.textContent = `${avgRisk} / 100`;
  if (highEvVal) highEvVal.textContent = analysisState.highRiskEventCount.toString();
  if (totalWinVal) totalWinVal.textContent = analysisState.totalWindows.toString();

  if (badge) {
    badge.className = isHighRisk ? 'assessment-badge high' : 'assessment-badge low';
    badge.textContent = isHighRisk ? 'HIGH RISK' : 'LOW RISK';
  }

  if (actionVal) {
    actionVal.textContent = isHighRisk
      ? 'Secondary Caller Verification & Forensic Case Escalation'
      : 'Standard Call Authorization Approved (No Synthetic Voice)';
  }

  if (eventsList) {
    if (analysisState.events.length === 0) {
      eventsList.innerHTML = '<span class="text-muted">No critical acoustic anomalies recorded during this session.</span>';
    } else {
      eventsList.innerHTML = analysisState.events.slice(0, 5).map(ev => `
        <div class="evidence-event-item">
          <span class="evidence-time">${ev.time}</span>
          <span class="status-badge ${ev.severity}">${ev.title}</span>
          <span class="evidence-desc">${ev.description}</span>
        </div>
      `).join('');
    }
  }

  // Add completed session to history store
  sessionHistoryStore.unshift({
    id: analysisState.sessionId,
    date: 'Just Now',
    duration: durationStr,
    source: 'Browser Microphone',
    windows: analysisState.totalWindows,
    peakRisk: analysisState.peakRisk,
    category: isHighRisk ? 'High' : (analysisState.peakRisk > 40 ? 'Medium' : 'Low'),
    action: isHighRisk ? 'Escalated' : (analysisState.peakRisk > 40 ? 'Challenged' : 'Monitored'),
    caller: '+91 98410 28419',
    amount: '₹75,000',
    notes: isHighRisk ? 'Potential synthetic voice clone indicators recorded.' : 'Clean human speech acoustics.'
  });

  renderHistoryTable();

  modal.classList.remove('hidden');
}

/**
 * Open Investigation Creation Dialog
 */
function openCreateInvestigationModal(prefillReason) {
  const modal = document.getElementById('createInvestigationModal');
  if (!modal) return;

  const caseIdInput = document.getElementById('caseIdInput');
  const linkedSessionInput = document.getElementById('caseLinkedSessionInput');
  const riskInput = document.getElementById('caseRiskInput');
  const reasonInput = document.getElementById('caseReasonInput');

  const randomCaseNum = Math.floor(10480 + Math.random() * 500);
  if (caseIdInput) caseIdInput.value = `VG-CASE-${randomCaseNum}`;
  if (linkedSessionInput) linkedSessionInput.value = analysisState.sessionId;
  if (riskInput) riskInput.value = `${analysisState.peakRisk || analysisState.smoothedRiskScore} — ${analysisState.peakRisk > 65 ? 'HIGH RISK' : 'ELEVATED RISK'}`;
  
  if (reasonInput && prefillReason) {
    reasonInput.value = prefillReason;
  }

  modal.classList.remove('hidden');
}

/**
 * Submit New Investigation
 */
function submitInvestigation() {
  const caseId = document.getElementById('caseIdInput')?.value || `VG-CASE-${Date.now()}`;
  const linkedSession = document.getElementById('caseLinkedSessionInput')?.value || analysisState.sessionId;
  const riskStr = document.getElementById('caseRiskInput')?.value || '75';
  const riskNum = parseInt(riskStr, 10) || 75;
  const priority = document.getElementById('casePrioritySelect')?.value || 'High';
  const reason = document.getElementById('caseReasonInput')?.value || 'Potential synthetic voice indicators';
  const assignee = document.getElementById('caseAssigneeSelect')?.value || 'Fraud Security Team';
  const notes = document.getElementById('caseNotesInput')?.value || '';

  const newCase = {
    caseId,
    linkedSession,
    created: 'Just Now',
    risk: riskNum,
    priority,
    reason,
    assignee,
    status: 'Open',
    notes
  };

  investigationsStore.unshift(newCase);
  renderInvestigationsTable();

  // Update Investigations Badge in Sidebar
  const badge = document.getElementById('investigationsBadge');
  if (badge) badge.textContent = investigationsStore.length.toString();

  // Close modal
  const modal = document.getElementById('createInvestigationModal');
  if (modal) modal.classList.add('hidden');

  showToast(`Investigation ${caseId} created and dispatched to ${assignee}.`, 'success');
  addDetectionEvent('Case Escalated', `Incident ${caseId} opened and assigned to ${assignee}`, 99, 'danger');
}

/**
 * Reset and Start Fresh Session
 */
function resetSession() {
  analysisState.sessionId = `VG-LIVE-${Math.floor(10483 + Math.random() * 500)}`;
  analysisState.status = 'ready';
  analysisState.elapsedSeconds = 0;
  analysisState.totalWindows = 0;
  analysisState.peakRisk = 0;
  analysisState.riskSum = 0;
  analysisState.riskScore = 10;
  analysisState.smoothedRiskScore = 10;
  analysisState.spoofProbability = 10;
  analysisState.genuineProbability = 90;
  analysisState.highRiskEventCount = 0;
  analysisState.events = [];
  analysisState.highRiskAlertDismissed = false;

  const sessionTelId = document.getElementById('sessionTelemetryId');
  const durVal = document.getElementById('sessionDurationVal');
  const alertBanner = document.getElementById('securityAlertBanner');

  if (sessionTelId) sessionTelId.textContent = analysisState.sessionId;
  if (durVal) durVal.textContent = '00:00';
  if (alertBanner) alertBanner.classList.add('hidden');

  updateSessionStateUI('ready');
  updateRiskUI();
  updateAcousticSignals();
  renderEvidenceStream();

  // Close any open summary modal
  const summaryModal = document.getElementById('sessionSummaryModal');
  if (summaryModal) summaryModal.classList.add('hidden');
}

// ============================================================================
// 9. WEBSOCKET LAYER (PREPARED FOR FASTAPI STREAMING BACKEND)
// ============================================================================

/**
 * Connect to FastAPI WebSocket streaming endpoint (ws://localhost:8000/ws/analyze)
 */
function connectWebSocket() {
  const endpoint = analysisState.config.wsEndpoint;
  if (!endpoint) return;

  try {
    webSocket = new WebSocket(endpoint);

    webSocket.onopen = () => {
      console.log('VoiceGuard WebSocket Backend Connected:', endpoint);
      analysisState.config.backendMode = 'connected';
      updateBackendStatusIndicator('Connected (FastAPI)');
      showToast('Connected to live FastAPI streaming ML backend.', 'success');
    };

    webSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleBackendAnalysisResult(data);
      } catch (e) {
        console.warn('Non-JSON WebSocket message received');
      }
    };

    webSocket.onerror = (err) => {
      console.log('WebSocket backend offline (using high-fidelity local DSP simulation):', err);
      fallbackToSimulation();
    };

    webSocket.onclose = () => {
      fallbackToSimulation();
    };
  } catch (e) {
    fallbackToSimulation();
  }
}

function fallbackToSimulation() {
  analysisState.config.backendMode = 'simulation';
  updateBackendStatusIndicator('Simulation');
}

function updateBackendStatusIndicator(text) {
  const backendLabel = document.getElementById('backendStatusLabel');
  const backendModeVal = document.getElementById('backendModeVal');
  if (backendLabel) backendLabel.textContent = text;
  if (backendModeVal) backendModeVal.textContent = text;
}

function handleBackendAnalysisResult(data) {
  if (data.risk_score !== undefined) {
    analysisState.riskScore = data.risk_score;
    analysisState.smoothedRiskScore = data.smoothed_risk_score || data.risk_score;
  }
  if (data.spoof_probability !== undefined) {
    analysisState.spoofProbability = Math.round(data.spoof_probability * 100);
    analysisState.genuineProbability = 100 - analysisState.spoofProbability;
  }
  if (data.confidence !== undefined) {
    analysisState.confidence = Math.round(data.confidence * 100);
  }
  if (data.acoustic_signals) {
    analysisState.acousticSignals = data.acoustic_signals;
  }
  if (data.events && Array.isArray(data.events)) {
    data.events.forEach(ev => addDetectionEvent(ev.title, ev.description, ev.confidence, ev.severity));
  }

  updateRiskUI();
  updateAcousticSignals();
  appendRiskTrendPoint();
}

// ============================================================================
// 10. SECONDARY VIEWS RENDERING (Tables & Charts)
// ============================================================================

/**
 * Render Investigations Table
 */
function renderInvestigationsTable() {
  const tbody = document.getElementById('investigationsTableBody');
  if (!tbody) return;

  tbody.innerHTML = investigationsStore.map(item => {
    let priorityClass = 'status-badge info';
    if (item.priority === 'Critical') priorityClass = 'status-badge danger';
    if (item.priority === 'High') priorityClass = 'status-badge warn';

    let statusClass = 'status-badge success';
    if (item.status === 'Open') statusClass = 'status-badge danger';
    if (item.status === 'In Review') statusClass = 'status-badge warn';

    return `
      <tr>
        <td class="mono font-bold">${item.caseId}</td>
        <td class="mono">${item.linkedSession}</td>
        <td>${item.created}</td>
        <td><span class="mono font-bold">${item.risk} / 100</span></td>
        <td><span class="${priorityClass}">${item.priority}</span></td>
        <td>${item.reason}</td>
        <td>${item.assignee}</td>
        <td><span class="${statusClass}">${item.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="showToast('Case ${item.caseId} loaded for forensic inspection.', 'info')">
            <i data-lucide="eye"></i>
            <span>View</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

/**
 * Render Historical Sessions Audit Table
 */
function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  tbody.innerHTML = sessionHistoryStore.map(item => {
    let catClass = 'status-badge success';
    if (item.category === 'High') catClass = 'status-badge danger';
    if (item.category === 'Medium') catClass = 'status-badge warn';

    let actionClass = 'status-badge success';
    if (item.action === 'Escalated') actionClass = 'status-badge danger';
    if (item.action === 'Challenged') actionClass = 'status-badge warn';

    return `
      <tr>
        <td class="mono font-bold">${item.id}</td>
        <td>${item.date}</td>
        <td class="mono">${item.duration}</td>
        <td>${item.source}</td>
        <td class="mono">${item.windows}</td>
        <td><span class="mono font-bold">${item.peakRisk} / 100</span></td>
        <td><span class="${catClass}">${item.category}</span></td>
        <td><span class="${actionClass}">${item.action}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="exportHistoricalSessionJSON('${item.id}')">
            <i data-lucide="file-text"></i>
            <span>Report</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

function exportHistoricalSessionJSON(sessionId) {
  const session = sessionHistoryStore.find(s => s.id === sessionId) || sessionHistoryStore[0];
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${sessionId}_audit_report.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast(`Exported forensic report for ${sessionId}.`, 'success');
}

/**
 * Initialize Analytics Weekly Chart
 */
let analyticsWeeklyChart = null;
function initializeAnalyticsWeeklyChart() {
  const ctx = document.getElementById('analyticsWeeklyChart');
  if (!ctx) return;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(30, 45, 74, 0.4)' : 'rgba(226, 232, 240, 0.8)';
  const textColor = isDark ? '#94a3b8' : '#475569';

  analyticsWeeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Genuine Calls Monitored',
          data: [320, 410, 390, 450, 520, 280, 210],
          backgroundColor: 'rgba(16, 185, 129, 0.65)',
          borderRadius: 4
        },
        {
          label: 'Challenged / Elevated',
          data: [14, 18, 12, 22, 19, 9, 7],
          backgroundColor: 'rgba(245, 158, 11, 0.75)',
          borderRadius: 4
        },
        {
          label: 'High-Risk Spoof Blocked',
          data: [3, 5, 2, 8, 4, 1, 2],
          backgroundColor: 'rgba(239, 68, 68, 0.85)',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: textColor, font: { family: 'Inter', size: 11 } }
        },
        y: {
          stacked: true,
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: isDark ? '#f8fafc' : '#0f172a', font: { size: 11, family: 'Inter' } }
        }
      }
    }
  });
}

// ============================================================================
// 11. MODAL & PERMISSION HANDLING
// ============================================================================

function showMicPermissionModal() {
  const modal = document.getElementById('micPermissionModal');
  if (modal) modal.classList.remove('hidden');
}

function hideMicPermissionModal() {
  const modal = document.getElementById('micPermissionModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Toast Notification Utility
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle-2';
  if (type === 'danger') iconName = 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 200ms ease';
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

// ============================================================================
// 12. EVENT LISTENERS & INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Icons
  lucide.createIcons();

  // 2. Setup Canvas Dimensions & Chart
  setupCanvasSizes();
  initializeRiskTrendChart();
  initializeAnalyticsWeeklyChart();

  // 3. Render Seed Data
  renderInvestigationsTable();
  renderHistoryTable();
  renderEvidenceStream();
  updateRiskUI();

  // 4. Start 60 FPS Visualizer Loop
  renderVisualizersLoop();

  // --- Session Control Buttons ---
  const btnStart = document.getElementById('btnStartMonitoring');
  const btnPause = document.getElementById('btnPauseMonitoring');
  const btnEnd = document.getElementById('btnEndSession');

  if (btnStart) {
    btnStart.addEventListener('click', () => {
      if (analysisState.status === 'ready' || analysisState.status === 'complete') {
        startMonitoring();
      }
    });
  }

  if (btnPause) {
    btnPause.addEventListener('click', () => {
      if (analysisState.status === 'monitoring') {
        pauseMonitoring();
      } else if (analysisState.status === 'paused') {
        resumeMonitoring();
      }
    });
  }

  if (btnEnd) {
    btnEnd.addEventListener('click', promptEndSession);
  }

  // --- Microphone Permission Modal ---
  const btnRetryMic = document.getElementById('btnRetryMicPermission');
  const btnCancelMic = document.getElementById('btnCancelMicPermission');
  if (btnRetryMic) {
    btnRetryMic.addEventListener('click', () => {
      hideMicPermissionModal();
      startMonitoring();
    });
  }
  if (btnCancelMic) {
    btnCancelMic.addEventListener('click', hideMicPermissionModal);
  }

  // --- End Session Confirmation Modal ---
  const btnConfirmEnd = document.getElementById('btnConfirmEndSession');
  const btnCancelEnd = document.getElementById('btnCancelEndSession');
  if (btnConfirmEnd) {
    btnConfirmEnd.addEventListener('click', finalizeEndSession);
  }
  if (btnCancelEnd) {
    btnCancelEnd.addEventListener('click', () => {
      const modal = document.getElementById('confirmEndSessionModal');
      if (modal) modal.classList.add('hidden');
    });
  }

  // --- Session Summary Modal ---
  const btnCloseSummary = document.getElementById('btnCloseSummaryModal');
  const btnStartNewSession = document.getElementById('btnStartNewSessionFromSummary');
  const btnOpenInvestigationFromSummary = document.getElementById('btnOpenInvestigationFromSummary');
  const btnExportSessionReport = document.getElementById('btnExportSessionReport');

  if (btnCloseSummary) {
    btnCloseSummary.addEventListener('click', () => {
      document.getElementById('sessionSummaryModal')?.classList.add('hidden');
    });
  }
  if (btnStartNewSession) {
    btnStartNewSession.addEventListener('click', resetSession);
  }
  if (btnOpenInvestigationFromSummary) {
    btnOpenInvestigationFromSummary.addEventListener('click', () => {
      document.getElementById('sessionSummaryModal')?.classList.add('hidden');
      openCreateInvestigationModal('Session final risk assessment exceeded high-risk threshold.');
    });
  }
  if (btnExportSessionReport) {
    btnExportSessionReport.addEventListener('click', () => {
      exportHistoricalSessionJSON(analysisState.sessionId);
    });
  }

  // --- Decision & Action Buttons ---
  const btnEscalateCase = document.getElementById('btnEscalateCase');
  const btnRequestVerification = document.getElementById('btnRequestVerification');

  if (btnEscalateCase) {
    btnEscalateCase.addEventListener('click', () => {
      openCreateInvestigationModal('Potential synthetic voice indicators & high-risk contextual profile.');
    });
  }

  if (btnRequestVerification) {
    btnRequestVerification.addEventListener('click', () => {
      document.getElementById('challengeModal')?.classList.remove('hidden');
    });
  }

  // --- Challenge Modal ---
  const btnCloseChallenge = document.getElementById('btnCloseChallengeModal');
  const btnCancelChallenge = document.getElementById('btnCancelChallenge');
  const btnSendChallenge = document.getElementById('btnSendChallenge');

  if (btnCloseChallenge) btnCloseChallenge.addEventListener('click', () => document.getElementById('challengeModal')?.classList.add('hidden'));
  if (btnCancelChallenge) btnCancelChallenge.addEventListener('click', () => document.getElementById('challengeModal')?.classList.add('hidden'));
  if (btnSendChallenge) {
    btnSendChallenge.addEventListener('click', () => {
      document.getElementById('challengeModal')?.classList.add('hidden');
      showToast('Secondary biometric push verification challenge dispatched to caller device.', 'success');
      addDetectionEvent('Challenge Sent', 'Out-of-band biometric push verification dispatched to caller.', 99, 'info');
    });
  }

  // --- Security Alert Banner Actions ---
  const alertBannerCloseBtn = document.getElementById('alertBannerCloseBtn');
  const alertBannerChallengeBtn = document.getElementById('alertBannerChallengeBtn');
  const alertBannerEscalateBtn = document.getElementById('alertBannerEscalateBtn');

  if (alertBannerCloseBtn) {
    alertBannerCloseBtn.addEventListener('click', () => {
      document.getElementById('securityAlertBanner')?.classList.add('hidden');
      analysisState.highRiskAlertDismissed = true;
    });
  }
  if (alertBannerChallengeBtn) {
    alertBannerChallengeBtn.addEventListener('click', () => {
      document.getElementById('challengeModal')?.classList.remove('hidden');
    });
  }
  if (alertBannerEscalateBtn) {
    alertBannerEscalateBtn.addEventListener('click', () => {
      openCreateInvestigationModal('Critical security alert trigger: synthetic speech indicators exceeded 65 threshold.');
    });
  }

  // --- Investigation Modal Submission ---
  const btnCloseInvestigation = document.getElementById('btnCloseInvestigationModal');
  const btnCancelInvestigation = document.getElementById('btnCancelInvestigation');
  const btnSubmitInvestigation = document.getElementById('btnSubmitInvestigation');
  const btnNewInvestigationFromNav = document.getElementById('btnNewInvestigationFromNav');

  if (btnCloseInvestigation) btnCloseInvestigation.addEventListener('click', () => document.getElementById('createInvestigationModal')?.classList.add('hidden'));
  if (btnCancelInvestigation) btnCancelInvestigation.addEventListener('click', () => document.getElementById('createInvestigationModal')?.classList.add('hidden'));
  if (btnSubmitInvestigation) btnSubmitInvestigation.addEventListener('click', submitInvestigation);
  if (btnNewInvestigationFromNav) btnNewInvestigationFromNav.addEventListener('click', () => openCreateInvestigationModal('Manual case escalation from SOC operator.'));

  // --- Copy Session ID ---
  const copyBtn = document.getElementById('copySessionIdBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(analysisState.sessionId);
      showToast(`Copied ${analysisState.sessionId} to clipboard`, 'info');
    });
  }

  // --- Navigation Switching ---
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.getAttribute('data-view');
      if (!targetView) return;

      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      viewPanels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === `view-${targetView}`) {
          panel.classList.add('active');
        }
      });

      // Resize charts if becoming visible
      if (targetView === 'live-monitor') {
        setupCanvasSizes();
        if (riskTrendChart) riskTrendChart.resize();
      } else if (targetView === 'analytics') {
        if (analyticsWeeklyChart) analyticsWeeklyChart.resize();
      }
    });
  });

  // --- Theme Toggle (Dark / Light) ---
  const themeBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);

      if (themeIcon) {
        themeIcon.setAttribute('data-lucide', nextTheme === 'dark' ? 'moon' : 'sun');
        lucide.createIcons();
      }

      // Re-render chart theme colors
      if (riskTrendChart) {
        riskTrendChart.destroy();
        initializeRiskTrendChart();
      }
      if (analyticsWeeklyChart) {
        analyticsWeeklyChart.destroy();
        initializeAnalyticsWeeklyChart();
      }
    });
  }

  // --- Settings Form Listeners ---
  const rangeMed = document.getElementById('settingMediumThreshold');
  const lblMed = document.getElementById('lblMediumThreshold');
  if (rangeMed && lblMed) {
    rangeMed.addEventListener('input', (e) => {
      analysisState.config.mediumThreshold = parseInt(e.target.value, 10);
      lblMed.textContent = `${e.target.value} / 100`;
    });
  }

  const rangeHigh = document.getElementById('settingHighThreshold');
  const lblHigh = document.getElementById('lblHighThreshold');
  if (rangeHigh && lblHigh) {
    rangeHigh.addEventListener('input', (e) => {
      analysisState.config.highThreshold = parseInt(e.target.value, 10);
      lblHigh.textContent = `${e.target.value} / 100`;
    });
  }

  const rangeAlpha = document.getElementById('settingSmoothingFactor');
  const lblAlpha = document.getElementById('lblSmoothingFactor');
  if (rangeAlpha && lblAlpha) {
    rangeAlpha.addEventListener('input', (e) => {
      analysisState.config.smoothingAlpha = parseFloat(e.target.value);
      lblAlpha.textContent = e.target.value;
    });
  }

  // Threat Profile Radio Switchers
  const simRadios = document.querySelectorAll('input[name="simProfile"]');
  simRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      analysisState.config.threatProfile = e.target.value;
      showToast(`Acoustic simulation profile set to: ${e.target.value}`, 'info');
      addDetectionEvent('Profile Switch', `DSP simulation threat profile changed to ${e.target.value}`, 99, 'info');
    });
  });

  const btnSaveSettings = document.getElementById('btnSaveSettings');
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      showToast('System configuration saved successfully.', 'success');
    });
  }

  const btnTestWs = document.getElementById('btnTestWsConnection');
  if (btnTestWs) {
    btnTestWs.addEventListener('click', () => {
      showToast('Testing WebSocket connection...', 'info');
      connectWebSocket();
    });
  }

  // Global search input shortcut '/'
  const searchInput = document.getElementById('globalSearch');
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput?.focus();
    }
  });

  // Table Filters
  const filterHistory = document.getElementById('historySearchInput');
  if (filterHistory) {
    filterHistory.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#historyTableBody tr');
      rows.forEach(r => {
        r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }

  const filterInvestigations = document.getElementById('investigationFilterInput');
  if (filterInvestigations) {
    filterInvestigations.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#investigationsTableBody tr');
      rows.forEach(r => {
        r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }
});
