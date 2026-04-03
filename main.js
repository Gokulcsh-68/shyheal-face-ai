/**
 * SkyHeal AI — Main Application Controller
 * v3.0.0 • Signal Fusion Engine • rPPG + rBCG
 * 
 * Orchestrates: Navigation, Camera, Scan Flow, Results, Data Storage
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════
    // APP STATE
    // ═══════════════════════════════════════════════════════
    const App = {
        currentScreen: 'splash',
        store: new LocalStore(),
        fusionEngine: new SignalFusion(),
        faceDetector: new FaceDetector(),
        dualTracker: new DualTracker(),
        vitalCalc: new VitalCalculator(),
        healthIndices: new HealthIndices(),
        riskAssessments: new RiskAssessments(),
        envQuality: new EnvironmentalQuality(),
        coach: new MeasurementCoach(),
        
        // Scan state
        isScanning: false,
        scanStartTime: 0,
        scanDuration: 30000,
        scanAnimFrame: null,
        cameraStream: null,
        
        // Data
        userProfile: {},
        settings: {},
        measurements: [],
        lastVitals: null,
        lastIndices: null,
        lastRisks: null,
        lastQuality: null
    };

    // ═══════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════
    async function init() {
        try {
            await App.store.init();
            App.userProfile = (await App.store.getProfile()) || {};
            App.settings = await App.store.getSettings();
            App.measurements = await App.store.getMeasurements(50);
            
            applySettings();
            setupNavigation();
            setupEventListeners();
            spawnParticles();
            updateDashboard();
            
            // Splash → Dashboard transition
            setTimeout(() => {
                document.getElementById('splash-screen').classList.add('hidden');
                document.getElementById('app-layout').style.display = 'flex';
                navigateTo('home');
            }, 2800);
        } catch (err) {
            console.error('Init error:', err);
            setTimeout(() => {
                document.getElementById('splash-screen').classList.add('hidden');
                document.getElementById('app-layout').style.display = 'flex';
                navigateTo('home');
            }, 2800);
        }
    }

    // ═══════════════════════════════════════════════════════
    // SPLASH PARTICLES
    // ═══════════════════════════════════════════════════════
    function spawnParticles() {
        const container = document.getElementById('splash-particles');
        if (!container) return;
        for (let i = 0; i < 40; i++) {
            const p = document.createElement('div');
            p.style.cssText = `
                position:absolute;
                width:${2 + Math.random() * 3}px;
                height:${2 + Math.random() * 3}px;
                border-radius:50%;
                background:rgba(0,212,255,${0.1 + Math.random() * 0.2});
                top:${Math.random() * 100}%;
                left:${Math.random() * 100}%;
                animation: particle-float ${6 + Math.random() * 10}s ease-in-out infinite;
                animation-delay:${Math.random() * 5}s;
            `;
            container.appendChild(p);
        }
        // Add the animation via stylesheet
        if (!document.getElementById('particle-style')) {
            const style = document.createElement('style');
            style.id = 'particle-style';
            style.textContent = `
                @keyframes particle-float {
                    0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
                    25% { transform: translateY(-30px) translateX(10px); opacity: 0.8; }
                    50% { transform: translateY(-15px) translateX(-15px); opacity: 0.5; }
                    75% { transform: translateY(-40px) translateX(5px); opacity: 0.7; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ═══════════════════════════════════════════════════════
    // NAVIGATION — Sidebar-based
    // ═══════════════════════════════════════════════════════
    function navigateTo(screenId) {
        // Hide all screens inside main-content
        document.querySelectorAll('.main-content .screen').forEach(s => s.classList.remove('active'));
        
        // Show target
        const target = document.getElementById(screenId + '-screen');
        if (target) {
            target.classList.add('active');
            App.currentScreen = screenId;
        }
        
        // Update sidebar nav
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.screen === screenId);
        });

        // Screen-specific init
        if (screenId === 'scan') initCamera();
        if (screenId === 'home') updateDashboard();
        if (screenId === 'history') renderHistory();
        if (screenId === 'profile') updateProfileScreen();
        if (screenId === 'risk-form') loadProfileForm();
    }

    function setupNavigation() {
        // Sidebar nav buttons
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.screen === 'scan' && App.currentScreen === 'scan') return;
                navigateTo(btn.dataset.screen);
            });
        });

        // Back buttons
        document.getElementById('btn-scan-back')?.addEventListener('click', () => {
            stopCamera();
            navigateTo('home');
        });
        document.getElementById('btn-results-back')?.addEventListener('click', () => navigateTo('home'));
        document.getElementById('btn-form-back')?.addEventListener('click', () => navigateTo('results'));
    }

    function setupEventListeners() {
        // Start scan from home
        document.getElementById('btn-start-scan')?.addEventListener('click', () => navigateTo('scan'));
        
        // Begin measurement
        document.getElementById('btn-begin-scan')?.addEventListener('click', startScan);
        document.getElementById('btn-cancel-scan')?.addEventListener('click', cancelScan);
        
        // Risk form
        document.getElementById('btn-fill-risk-form')?.addEventListener('click', () => navigateTo('risk-form'));
        document.getElementById('btn-edit-profile')?.addEventListener('click', () => navigateTo('risk-form'));
        document.getElementById('btn-form-save')?.addEventListener('click', saveProfile);

        // Results tabs
        document.querySelectorAll('.results-tabs .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.results-tabs .tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab)?.classList.add('active');
            });
        });

        // BP toggle
        document.getElementById('bp-detailed')?.addEventListener('click', () => toggleBPView('detailed'));
        document.getElementById('bp-simplified')?.addEventListener('click', () => toggleBPView('simplified'));

        // Settings
        document.getElementById('setting-strict-mode')?.addEventListener('change', saveSettingsFromUI);
        document.getElementById('setting-coaching')?.addEventListener('change', saveSettingsFromUI);
        document.getElementById('setting-eqi')?.addEventListener('change', saveSettingsFromUI);
        document.getElementById('setting-bp-mode')?.addEventListener('change', saveSettingsFromUI);
        document.getElementById('setting-wellness-window')?.addEventListener('change', saveSettingsFromUI);

        // Clear data
        document.getElementById('btn-clear-data')?.addEventListener('click', async () => {
            if (confirm('Clear all measurement data and profile? This cannot be undone.')) {
                await App.store.clearAll();
                App.measurements = [];
                App.userProfile = {};
                updateDashboard();
                navigateTo('home');
            }
        });

        // Export
        document.getElementById('btn-export')?.addEventListener('click', async () => {
            const data = await App.store.exportData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `skyheal-export-${Date.now()}.json`; a.click();
            URL.revokeObjectURL(url);
        });

        // History
        document.getElementById('btn-view-all')?.addEventListener('click', () => navigateTo('history'));

        // Feature cards
        document.getElementById('btn-vitals')?.addEventListener('click', () => {
            if (App.lastVitals) navigateTo('results');
            else navigateTo('scan');
        });
        document.getElementById('btn-indices')?.addEventListener('click', () => {
            if (App.lastVitals) navigateTo('results');
            else navigateTo('scan');
        });
        document.getElementById('btn-risks')?.addEventListener('click', () => {
            if (App.lastVitals) { 
                navigateTo('results');
                setTimeout(() => document.querySelector('.tab[data-tab="risks"]')?.click(), 100);
            } else navigateTo('scan');
        });

        // Share
        document.getElementById('btn-share-results')?.addEventListener('click', shareResults);
    }

    // ═══════════════════════════════════════════════════════
    // CAMERA
    // ═══════════════════════════════════════════════════════
    async function initCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            
            App.cameraStream = stream;
            const video = document.getElementById('camera-feed');
            video.srcObject = stream;
            await video.play();

            const overlay = document.getElementById('face-overlay');
            App.faceDetector.init(overlay);

            startPreScanLoop();
        } catch (err) {
            console.error('Camera error:', err);
            updateCoachingMessage('Camera access denied. Please allow camera permissions.', 'error');
        }
    }

    function stopCamera() {
        if (App.cameraStream) {
            App.cameraStream.getTracks().forEach(t => t.stop());
            App.cameraStream = null;
        }
        if (App.scanAnimFrame) {
            cancelAnimationFrame(App.scanAnimFrame);
            App.scanAnimFrame = null;
        }
        App.isScanning = false;
    }

    // ═══════════════════════════════════════════════════════
    // PRE-SCAN LOOP
    // ═══════════════════════════════════════════════════════
    function startPreScanLoop() {
        const video = document.getElementById('camera-feed');
        
        function loop() {
            if (App.currentScreen !== 'scan' || App.isScanning) return;
            
            const faceResult = App.faceDetector.detect(video);
            const trackedFace = App.dualTracker.update(faceResult);
            App.faceDetector.drawOverlay(trackedFace);
            
            const imageData = App.faceDetector.getImageData();
            if (imageData && trackedFace) {
                App.envQuality.evaluate(imageData, trackedFace, null);
            }

            if (App.settings.eqiDisplay) {
                updateEQIPanel(App.envQuality.components);
                document.getElementById('eqi-panel').style.display = 'block';
            }

            if (App.settings.coaching !== false) {
                const checks = App.coach.evaluatePreScan(trackedFace, App.envQuality.components);
                if (checks.length > 0) {
                    updateCoachingMessage(checks[0].message, checks[0].type);
                }
            }

            updateQualityBadge(trackedFace?.detected);
            App.scanAnimFrame = requestAnimationFrame(loop);
        }
        
        App.scanAnimFrame = requestAnimationFrame(loop);
    }

    // ═══════════════════════════════════════════════════════
    // SCAN FLOW
    // ═══════════════════════════════════════════════════════
    function startScan() {
        App.isScanning = true;
        App.scanStartTime = Date.now();
        
        App.fusionEngine.reset();
        App.faceDetector.reset();
        App.dualTracker.reset();
        App.envQuality.reset();
        App.coach.reset();
        
        // UI State
        document.getElementById('scan-screen').classList.add('scanning-active');
        document.getElementById('btn-begin-scan').style.display = 'none';
        document.getElementById('btn-cancel-scan').style.display = 'block';
        document.getElementById('scan-progress').style.display = 'block';
        document.getElementById('cam-float-metrics').style.display = 'flex';
        document.getElementById('ai-data-stream').style.display = 'block';
        document.getElementById('ai-status-pill').classList.add('scanning');
        document.getElementById('ai-status-text').textContent = 'AI SCANNING';
        
        if (App.settings.eqiDisplay) {
            document.getElementById('eqi-panel').style.display = 'block';
        }

        // Initialize Waveform
        initWaveform();

        scanLoop();
    }

    function scanLoop() {
        if (!App.isScanning) return;
        
        const video = document.getElementById('camera-feed');
        const elapsed = Date.now() - App.scanStartTime;
        const progress = Math.min(1, elapsed / App.scanDuration);

        updateScanProgress(progress, elapsed);

        const faceResult = App.faceDetector.detect(video);
        const trackedFace = App.dualTracker.update(faceResult);
        App.faceDetector.drawOverlay(trackedFace);

        const imageData = App.faceDetector.getImageData();
        
        if (imageData && trackedFace && trackedFace.roi) {
            const roi = App.faceDetector.getBestROI();
            const fusionResult = App.fusionEngine.processFrame(imageData, roi);
            
            App.envQuality.evaluate(imageData, trackedFace, fusionResult);
            updateLiveMetrics(fusionResult);
            updateWaveform(fusionResult);
            updateDataStream();
            
            if (App.settings.eqiDisplay) {
                updateEQIPanel(App.envQuality.components);
            }

            if (App.settings.coaching !== false) {
                const feedback = App.coach.getLiveFeedback(trackedFace, App.envQuality.components, progress);
                if (feedback.message) {
                    updateCoachingMessage(feedback.message, feedback.type);
                }
            }
        }

        if (elapsed >= App.scanDuration) {
            completeScan();
            return;
        }

        App.scanAnimFrame = requestAnimationFrame(scanLoop);
    }

    function cancelScan() {
        App.isScanning = false;
        if (App.scanAnimFrame) cancelAnimationFrame(App.scanAnimFrame);
        
        document.getElementById('scan-screen').classList.remove('scanning-active');
        document.getElementById('btn-begin-scan').style.display = 'flex';
        document.getElementById('btn-cancel-scan').style.display = 'none';
        document.getElementById('scan-progress').style.display = 'none';
        document.getElementById('cam-float-metrics').style.display = 'none';
        document.getElementById('ai-data-stream').style.display = 'none';
        document.getElementById('ai-status-pill').classList.remove('scanning');
        document.getElementById('ai-status-text').textContent = 'AI Ready';
        
        startPreScanLoop();
    }

    async function completeScan() {
        App.isScanning = false;
        if (App.scanAnimFrame) cancelAnimationFrame(App.scanAnimFrame);

        App.lastVitals = App.vitalCalc.calculateAll(App.fusionEngine, App.userProfile);
        
        const recentMeasurements = await App.store.getRecentMeasurements(
            parseInt(App.settings.wellnessWindow) || 7
        );
        App.lastIndices = App.healthIndices.calculateAll(App.lastVitals, App.userProfile, recentMeasurements);
        
        if (App.userProfile.age && App.userProfile.gender) {
            App.lastRisks = App.riskAssessments.calculateAll(App.lastVitals, App.userProfile);
        }

        const overallQ = App.envQuality.overallScore;
        App.lastQuality = App.coach.getPostScanSummary(overallQ, App.envQuality.components);

        if (App.coach.shouldSuppressBP(overallQ, App.settings.strictMode)) {
            App.lastVitals.bp = { 
                ...App.lastVitals.bp, 
                suppressed: true, 
                status: 'Suppressed (low quality)',
                category: 'Suppressed'
            };
        }

        const measurement = {
            ...App.lastVitals,
            indices: App.lastIndices,
            risks: App.lastRisks,
            quality: App.lastQuality,
            fusionStats: App.fusionEngine.getFusionStats()
        };
        await App.store.saveMeasurement(measurement);
        App.measurements = await App.store.getMeasurements(50);

        stopCamera();
        navigateTo('results');
        renderResults();
    }

    // ═══════════════════════════════════════════════════════
    // RENDER RESULTS
    // ═══════════════════════════════════════════════════════
    function renderResults() {
        ResultsRenderer.render(App.lastVitals, App.lastIndices, App.lastQuality);
        if (App.lastRisks) ResultsRenderer.renderRisks(App.lastRisks);
    }

    // ═══════════════════════════════════════════════════════
    // UI UPDATE HELPERS
    // ═══════════════════════════════════════════════════════
    function updateScanProgress(progress, elapsed) {
        const remaining = Math.max(0, Math.ceil((App.scanDuration - elapsed) / 1000));
        document.getElementById('progress-seconds').textContent = remaining;
        
        const ring = document.getElementById('progress-ring-circle');
        if (ring) {
            // Circumference for r=60 is 377
            ring.style.strokeDashoffset = 377 - (377 * progress);
        }

        // Phase Indicators
        const dots = document.querySelectorAll('.phase-dot');
        const label = document.getElementById('scan-phase-label');
        if (progress < 0.2) {
            dots[0].classList.add('active');
            label.textContent = 'Calibrating';
        } else if (progress < 0.8) {
            dots[1].classList.add('active');
            label.textContent = 'Extracting Vitals';
        } else {
            dots[2].classList.add('active');
            label.textContent = 'Finalizing Model';
        }
    }

    function updateLiveMetrics(fusionResult) {
        if (!fusionResult) return;
        
        const hrVal = fusionResult.fusedHR || 0;
        const q = Math.round((fusionResult.combinedQuality || 0) * 100);
        
        // Main Gauges
        document.getElementById('live-hr').textContent = hrVal || '--';
        document.getElementById('live-signal').textContent = q + '%';
        
        // Floating metrics
        document.getElementById('float-hr-val').textContent = hrVal || '--';
        document.getElementById('float-signal-val').textContent = q + '%';

        // Gauge Rings (circumference for r=34 is 214)
        const hrRing = document.getElementById('gauge-hr-ring');
        const sigRing = document.getElementById('gauge-signal-ring');
        if (hrRing) hrRing.style.strokeDashoffset = 214 - (214 * (hrVal / 200));
        if (sigRing) sigRing.style.strokeDashoffset = 214 - (214 * (q / 100));
        
        const sourceMap = { rppg: 'rPPG', rbcg: 'rBCG', fused: 'AI Fusion', initializing: '...' };
        document.getElementById('live-source').textContent = sourceMap[fusionResult.source] || fusionResult.source;
        
        // Dashboard bars (sync)
        const rppgQ = Math.round((fusionResult.rppgQuality || 0) * 100);
        const rbcgQ = Math.round((fusionResult.rbcgQuality || 0) * 100);
        document.querySelector('.rppg-fill')?.style && (document.querySelector('.rppg-fill').style.width = rppgQ + '%');
        document.querySelector('.rbcg-fill')?.style && (document.querySelector('.rbcg-fill').style.width = rbcgQ + '%');
        document.querySelector('.fusion-fill')?.style && (document.querySelector('.fusion-fill').style.width = q + '%');
    }

    // IMMERSIVE FX HELPERS
    let waveformData = [];
    function initWaveform() {
        waveformData = [];
        const canvas = document.getElementById('waveform-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    function updateWaveform(fusionResult) {
        if (!fusionResult) return;
        const canvas = document.getElementById('waveform-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        waveformData.push({
            rppg: fusionResult.rppgSignal || 0,
            rbcg: fusionResult.rbcgSignal || 0,
            fused: fusionResult.fusedSignal || 0
        });
        if (waveformData.length > 50) waveformData.shift();
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const drawPath = (key, color) => {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            const step = canvas.width / 50;
            waveformData.forEach((pt, i) => {
                const x = i * step;
                const y = (canvas.height / 2) - (pt[key] * (canvas.height / 3));
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        };

        drawPath('rppg', 'rgba(123,47,255,0.4)');
        drawPath('rbcg', 'rgba(255,159,67,0.4)');
        drawPath('fused', '#00D4FF');
    }

    function updateDataStream() {
        const stream = document.getElementById('stream-content');
        if (!stream) return;
        const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
        const addr = '0x' + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
        const line = document.createElement('div');
        line.textContent = `[AI-CORE] ${addr} RAW_SIG:${hex} FUSION_LAYER_SYNC...`;
        stream.appendChild(line);
        if (stream.children.length > 15) stream.removeChild(stream.firstChild);
        stream.scrollTop = stream.scrollHeight;
    }

    function updateCoachingMessage(message, type) {
        const textEl = document.getElementById('coaching-text');
        const iconEl = document.querySelector('.coaching-icon');
        if (textEl) textEl.textContent = message;
        
        const colors = { error: '#E74C3C', warning: '#F1C40F', info: '#00D4FF', success: '#2ECC71' };
        if (iconEl) iconEl.style.color = colors[type] || colors.info;
    }

    function updateQualityBadge(faceDetected) {
        const dot = document.querySelector('#scan-screen .quality-dot');
        const label = document.getElementById('quality-label');
        if (!dot || !label) return;
        
        if (faceDetected) {
            dot.className = 'quality-dot good';
            label.textContent = 'Face Detected';
        } else {
            dot.className = 'quality-dot poor';
            label.textContent = 'No Face';
        }
    }

    function updateEQIPanel(components) {
        Object.entries(components).forEach(([key, value]) => {
            const keyMap = {
                signalQuality: 'signal', cameraNoise: 'noise', foreheadCoverage: 'coverage',
                lightEquality: 'light', backlight: 'backlight', stability: 'stability', facePosition: 'position'
            };
            const el = document.getElementById('eqi-' + keyMap[key]);
            if (el) {
                el.style.width = value + '%';
                if (value > 70) el.style.background = '#2ECC71';
                else if (value > 40) el.style.background = '#F1C40F';
                else el.style.background = '#E74C3C';
            }
        });
    }

    function toggleBPView(mode) {
        const detailed = document.getElementById('bp-detailed-view');
        const simplified = document.getElementById('bp-simplified-view');
        const btnDetailed = document.getElementById('bp-detailed');
        const btnSimplified = document.getElementById('bp-simplified');
        
        if (mode === 'detailed') {
            detailed.style.display = 'block';
            simplified.style.display = 'none';
            btnDetailed.classList.add('active');
            btnSimplified.classList.remove('active');
        } else {
            detailed.style.display = 'none';
            simplified.style.display = 'block';
            btnSimplified.classList.add('active');
            btnDetailed.classList.remove('active');
        }
    }

    // ═══════════════════════════════════════════════════════
    // DASHBOARD & PROFILE
    // ═══════════════════════════════════════════════════════
    function updateDashboard() {
        let wellnessScore = null;
        if (App.measurements.length > 0) {
            wellnessScore = App.healthIndices.wellnessScore(
                App.measurements[0], 
                App.measurements.slice(0, 14)
            );
        }
        WellnessDashboard.update(wellnessScore, App.measurements);
        WellnessDashboard.renderHistory(App.measurements);
    }

    function renderHistory() {
        WellnessDashboard.renderHistory(App.measurements);
    }

    function updateProfileScreen() {
        const scans = document.getElementById('profile-scans');
        if (scans) scans.textContent = App.measurements.length + ' scans completed';
    }

    function loadProfileForm() {
        RiskFormsHandler.populateForm(App.userProfile);
    }

    async function saveProfile() {
        App.userProfile = RiskFormsHandler.collectProfile();
        await App.store.saveProfile(App.userProfile);
        
        if (App.lastVitals && App.userProfile.age && App.userProfile.gender) {
            App.lastRisks = App.riskAssessments.calculateAll(App.lastVitals, App.userProfile);
            App.lastIndices = App.healthIndices.calculateAll(App.lastVitals, App.userProfile, App.measurements);
        }
        
        navigateTo('results');
        renderResults();
        if (App.lastRisks) ResultsRenderer.renderRisks(App.lastRisks);
    }

    // ═══════════════════════════════════════════════════════
    // SETTINGS
    // ═══════════════════════════════════════════════════════
    function applySettings() {
        const s = App.settings;
        const strictEl = document.getElementById('setting-strict-mode');
        const coachEl = document.getElementById('setting-coaching');
        const eqiEl = document.getElementById('setting-eqi');
        const bpModeEl = document.getElementById('setting-bp-mode');
        const wellnessEl = document.getElementById('setting-wellness-window');

        if (strictEl) strictEl.checked = !!s.strictMode;
        if (coachEl) coachEl.checked = s.coaching !== false;
        if (eqiEl) eqiEl.checked = !!s.eqiDisplay;
        if (bpModeEl) bpModeEl.value = s.bpMode || 'detailed';
        if (wellnessEl) wellnessEl.value = s.wellnessWindow || 7;
    }

    async function saveSettingsFromUI() {
        App.settings = {
            strictMode: document.getElementById('setting-strict-mode')?.checked || false,
            coaching: document.getElementById('setting-coaching')?.checked !== false,
            eqiDisplay: document.getElementById('setting-eqi')?.checked || false,
            bpMode: document.getElementById('setting-bp-mode')?.value || 'detailed',
            wellnessWindow: parseInt(document.getElementById('setting-wellness-window')?.value) || 7
        };
        await App.store.saveSettings(App.settings);
    }

    // ═══════════════════════════════════════════════════════
    // SHARE
    // ═══════════════════════════════════════════════════════
    function shareResults() {
        if (!App.lastVitals) return;
        
        const v = App.lastVitals;
        const text = `SkyHeal AI Scan Results\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `❤️ Heart Rate: ${v.hr.value} bpm\n` +
            `💓 HRV: ${v.hrv.value} ms\n` +
            `🩸 Blood Pressure: ${v.bp.systolic}/${v.bp.diastolic} mmHg (${v.bp.category})\n` +
            `🫁 Breathing: ${v.breathingRate.value} brpm\n` +
            `😰 Stress: ${v.stressIndex.value}\n` +
            `🫀 Cardiac Workload: ${v.cardiacWorkload.value}\n` +
            `🧘 Parasympathetic: ${v.parasympathetic.value}%\n` +
            `🫧 SpO₂: ${v.spo2.value}%\n` +
            `🍬 HbA1c: ${v.hba1c.value}%\n` +
            `⚖️ BMI: ${v.bmi.value}\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `Powered by SkyHeal AI SDK 3.0`;

        if (navigator.share) {
            navigator.share({ title: 'SkyHeal AI Results', text });
        } else {
            navigator.clipboard.writeText(text).then(() => {
                alert('Results copied to clipboard!');
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // BOOT
    // ═══════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', init);

})();
