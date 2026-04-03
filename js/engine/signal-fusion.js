/**
 * SkyHeal AI — Signal Fusion Engine
 * Beat-by-beat fusion of rPPG and rBCG signals (SDK 3.0 key innovation)
 * 
 * Instead of picking one signal source at the end, this engine:
 * 1. Evaluates quality of each beat from both rPPG and rBCG
 * 2. Selects the best beats from whichever source is strongest
 * 3. Creates a composite signal with optimal quality throughout
 */

class SignalFusion {
    constructor() {
        this.rppg = new RPPGProcessor();
        this.rbcg = new RBCGProcessor();
        
        // Fusion state
        this.fusedBeats = [];
        this.fusedHR = 0;
        this.currentSource = 'initializing'; // 'rppg', 'rbcg', 'fused'
        this.fusionHistory = [];
        
        // Per-beat quality tracking
        this.beatLog = [];
        
        // Accumulated signal quality
        this.rppgQualityAccum = 0;
        this.rbcgQualityAccum = 0;
        this.frameCount = 0;
        
        // Previous frame data for rBCG
        this.prevImageData = null;
    }

    /**
     * Process a single video frame through both signal paths
     * @param {ImageData} imageData - Current frame from camera
     * @param {Object} faceROI - Face region {x, y, width, height}
     * @returns {Object} Fused result with metrics
     */
    processFrame(imageData, faceROI) {
        this.frameCount++;

        // ── rPPG Path: Extract color signal ──
        const rgbMean = this.rppg.extractROI(imageData, faceROI);
        const rppgResult = this.rppg.processFrame(rgbMean);

        // ── rBCG Path: Extract motion signal ──
        let rbcgResult = { signal: 0, quality: 0, beatDetected: false, instantHR: 0 };
        
        if (this.prevImageData) {
            const displacement = this.rbcg.trackMotion(this.prevImageData, imageData, faceROI);
            rbcgResult = this.rbcg.processFrame(displacement);
        }
        
        // Store current frame for next iteration
        this.prevImageData = imageData;

        // ── Beat-by-beat fusion ──
        const fusionResult = this._fuseBeats(rppgResult, rbcgResult);
        
        // Update accumulated quality
        this.rppgQualityAccum += rppgResult.quality;
        this.rbcgQualityAccum += rbcgResult.quality;
        
        return {
            ...fusionResult,
            rppg: rppgResult,
            rbcg: rbcgResult,
            source: this.currentSource,
            fusedHR: this.fusedHR,
            frameCount: this.frameCount,
            rppgAvgQuality: this.frameCount > 0 ? this.rppgQualityAccum / this.frameCount : 0,
            rbcgAvgQuality: this.frameCount > 0 ? this.rbcgQualityAccum / this.frameCount : 0
        };
    }

    /**
     * Core fusion algorithm: Select best beats from each source
     */
    _fuseBeats(rppgResult, rbcgResult) {
        const now = Date.now();
        let beatDetected = false;
        let instantHR = 0;
        let beatQuality = 0;
        let beatSource = 'none';

        // Check if either source detected a beat
        if (rppgResult.beatDetected || rbcgResult.beatDetected) {
            if (rppgResult.beatDetected && rbcgResult.beatDetected) {
                // Both detected a beat — pick higher quality
                if (rppgResult.quality >= rbcgResult.quality) {
                    instantHR = rppgResult.instantHR;
                    beatQuality = rppgResult.quality;
                    beatSource = 'rppg';
                } else {
                    instantHR = rbcgResult.instantHR;
                    beatQuality = rbcgResult.quality;
                    beatSource = 'rbcg';
                }
                beatDetected = true;
            } else if (rppgResult.beatDetected) {
                instantHR = rppgResult.instantHR;
                beatQuality = rppgResult.quality;
                beatSource = 'rppg';
                beatDetected = true;
            } else {
                instantHR = rbcgResult.instantHR;
                beatQuality = rbcgResult.quality;
                beatSource = 'rbcg';
                beatDetected = true;
            }

            // Record fused beat
            if (beatDetected && instantHR > 0) {
                this.fusedBeats.push({
                    timestamp: now,
                    hr: instantHR,
                    quality: beatQuality,
                    source: beatSource
                });

                // Keep last 30 fused beats
                if (this.fusedBeats.length > 30) this.fusedBeats.shift();
                
                // Log beat source for analytics
                this.beatLog.push(beatSource);
                if (this.beatLog.length > 100) this.beatLog.shift();
            }
        }

        // Update current dominant source
        this._updateDominantSource();
        
        // Calculate fused heart rate
        this._updateFusedHR();

        // Combined quality (weighted by source performance)
        const combinedQuality = Math.max(rppgResult.quality, rbcgResult.quality) * 0.7 +
                                Math.min(rppgResult.quality, rbcgResult.quality) * 0.3;

        return {
            beatDetected,
            instantHR,
            beatQuality,
            beatSource,
            combinedQuality,
            fusedSignal: rppgResult.quality >= rbcgResult.quality ? rppgResult.signal : rbcgResult.signal
        };
    }

    /**
     * Determine which source is currently dominant
     */
    _updateDominantSource() {
        if (this.beatLog.length < 5) {
            this.currentSource = 'initializing';
            return;
        }

        const recent = this.beatLog.slice(-10);
        const rppgCount = recent.filter(s => s === 'rppg').length;
        const rbcgCount = recent.filter(s => s === 'rbcg').length;

        if (rppgCount > rbcgCount * 2) {
            this.currentSource = 'rppg';
        } else if (rbcgCount > rppgCount * 2) {
            this.currentSource = 'rbcg';
        } else {
            this.currentSource = 'fused';
        }
    }

    /**
     * Calculate stable fused heart rate from recent beats
     */
    _updateFusedHR() {
        if (this.fusedBeats.length < 3) {
            this.fusedHR = 0;
            return;
        }

        // Use quality-weighted average of recent beat HRs
        const recentBeats = this.fusedBeats.slice(-10);
        let weightedSum = 0;
        let weightSum = 0;

        recentBeats.forEach(beat => {
            const weight = beat.quality + 0.1; // Small bias to prevent zero weight
            weightedSum += beat.hr * weight;
            weightSum += weight;
        });

        this.fusedHR = weightSum > 0 ? Math.round(weightedSum / weightSum) : 0;
    }

    /**
     * Get all inter-beat intervals from fused beats
     */
    getFusedIBIs() {
        if (this.fusedBeats.length < 3) return [];
        
        const ibis = [];
        for (let i = 1; i < this.fusedBeats.length; i++) {
            const interval = this.fusedBeats[i].timestamp - this.fusedBeats[i - 1].timestamp;
            if (interval > 200 && interval < 2000) { // Physiological range
                ibis.push(interval);
            }
        }
        return ibis;
    }

    /**
     * Get fusion statistics
     */
    getFusionStats() {
        const total = this.beatLog.length;
        if (total === 0) return { rppgPct: 0, rbcgPct: 0, total: 0 };

        const rppgCount = this.beatLog.filter(s => s === 'rppg').length;
        const rbcgCount = this.beatLog.filter(s => s === 'rbcg').length;

        return {
            rppgPct: Math.round((rppgCount / total) * 100),
            rbcgPct: Math.round((rbcgCount / total) * 100),
            total,
            dominantSource: this.currentSource
        };
    }

    /**
     * Get overall measurement quality
     */
    getOverallQuality() {
        const rppgQ = this.rppg.getAverageQuality();
        const rbcgQ = this.rbcg.getAverageQuality();
        
        // Fusion benefit: quality is better than either source alone
        return Math.min(1, Math.max(rppgQ, rbcgQ) * 1.1 + Math.min(rppgQ, rbcgQ) * 0.2);
    }

    reset() {
        this.rppg.reset();
        this.rbcg.reset();
        this.fusedBeats = [];
        this.fusedHR = 0;
        this.currentSource = 'initializing';
        this.fusionHistory = [];
        this.beatLog = [];
        this.rppgQualityAccum = 0;
        this.rbcgQualityAccum = 0;
        this.frameCount = 0;
        this.prevImageData = null;
    }
}

window.SignalFusion = SignalFusion;
