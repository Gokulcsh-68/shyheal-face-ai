/**
 * SkyHeal AI — rPPG Signal Processor
 * Remote Photoplethysmography: Detects heart rate from facial skin color changes
 * 
 * Pipeline:
 * 1. Extract RGB channels from facial ROI
 * 2. Apply bandpass filter (0.75-3 Hz for HR range 45-180 bpm)
 * 3. Use chrominance-based method (CHROM) for robust signal extraction
 * 4. Peak detection for beat-by-beat analysis
 * 5. Quality scoring per beat
 */

class RPPGProcessor {
    constructor() {
        this.bufferSize = 256; // ~8.5 seconds at 30fps
        this.sampleRate = 30; // camera FPS
        this.rgbBuffer = { r: [], g: [], b: [] };
        this.signalBuffer = [];
        this.qualityBuffer = [];
        this.beatTimestamps = [];
        this.lastBeatTime = 0;
        this.isProcessing = false;
        
        // Bandpass filter coefficients (0.75 Hz - 3.0 Hz at 30 fps)
        this.lowCutoff = 0.75;  // 45 bpm
        this.highCutoff = 3.0;  // 180 bpm
        
        // Signal quality tracking
        this.snr = 0;
        this.signalStrength = 0;
    }

    /**
     * Extract average RGB values from facial Region of Interest
     * @param {ImageData} imageData - Pixel data from canvas
     * @param {Object} roi - Region of interest {x, y, width, height}
     * @returns {Object} Average {r, g, b} values
     */
    extractROI(imageData, roi) {
        const data = imageData.data;
        const width = imageData.width;
        let rSum = 0, gSum = 0, bSum = 0, count = 0;

        const startX = Math.max(0, Math.floor(roi.x));
        const startY = Math.max(0, Math.floor(roi.y));
        const endX = Math.min(width, Math.floor(roi.x + roi.width));
        const endY = Math.min(imageData.height, Math.floor(roi.y + roi.height));

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const idx = (y * width + x) * 4;
                rSum += data[idx];
                gSum += data[idx + 1];
                bSum += data[idx + 2];
                count++;
            }
        }

        if (count === 0) return null;

        return {
            r: rSum / count,
            g: gSum / count,
            b: bSum / count,
            pixelCount: count
        };
    }

    /**
     * Process a new frame and extract rPPG signal
     * Uses CHROM (Chrominance-based) method for motion-robust extraction
     * @param {Object} rgbMean - Average {r, g, b} from ROI
     * @returns {Object} {signal, quality, beatDetected, instantHR}
     */
    processFrame(rgbMean) {
        if (!rgbMean) return { signal: 0, quality: 0, beatDetected: false, instantHR: 0 };

        // Add to RGB buffers
        this.rgbBuffer.r.push(rgbMean.r);
        this.rgbBuffer.g.push(rgbMean.g);
        this.rgbBuffer.b.push(rgbMean.b);

        // Maintain buffer size
        if (this.rgbBuffer.r.length > this.bufferSize) {
            this.rgbBuffer.r.shift();
            this.rgbBuffer.g.shift();
            this.rgbBuffer.b.shift();
        }

        // Need minimum samples for processing
        if (this.rgbBuffer.r.length < 64) {
            return { signal: 0, quality: 0, beatDetected: false, instantHR: 0 };
        }

        // Apply CHROM method
        const chromSignal = this._chromMethod();
        
        // Bandpass filter the signal
        const filtered = this._bandpassFilter(chromSignal);
        
        // Store filtered signal
        this.signalBuffer.push(filtered);
        if (this.signalBuffer.length > this.bufferSize) {
            this.signalBuffer.shift();
        }

        // Beat detection
        const beatResult = this._detectBeat(filtered);
        
        // Calculate signal quality
        const quality = this._calculateQuality();
        this.qualityBuffer.push(quality);
        if (this.qualityBuffer.length > 90) this.qualityBuffer.shift();

        return {
            signal: filtered,
            quality: quality,
            beatDetected: beatResult.detected,
            instantHR: beatResult.instantHR,
            snr: this.snr,
            signalStrength: this.signalStrength
        };
    }

    /**
     * CHROM (Chrominance-based) rPPG extraction
     * Projects RGB signals onto chrominance plane to separate pulse from noise
     */
    _chromMethod() {
        const len = this.rgbBuffer.r.length;
        const windowSize = Math.min(len, 64);
        
        // Get recent window
        const rWin = this.rgbBuffer.r.slice(-windowSize);
        const gWin = this.rgbBuffer.g.slice(-windowSize);
        const bWin = this.rgbBuffer.b.slice(-windowSize);

        // Normalize by mean
        const rMean = rWin.reduce((a, b) => a + b) / windowSize;
        const gMean = gWin.reduce((a, b) => a + b) / windowSize;
        const bMean = bWin.reduce((a, b) => a + b) / windowSize;

        if (rMean === 0 || gMean === 0 || bMean === 0) return 0;

        const rNorm = rWin.map(v => v / rMean);
        const gNorm = gWin.map(v => v / gMean);
        const bNorm = bWin.map(v => v / bMean);

        // CHROM projection: Xs = 3R - 2G, Ys = 1.5R + G - 1.5B
        const xs = rNorm.map((r, i) => 3 * r - 2 * gNorm[i]);
        const ys = rNorm.map((r, i) => 1.5 * r + gNorm[i] - 1.5 * bNorm[i]);

        // Standard deviations
        const xsStd = this._std(xs);
        const ysStd = this._std(ys);

        if (ysStd === 0) return xs[xs.length - 1];

        // Alpha ratio
        const alpha = xsStd / ysStd;

        // Final signal: S = Xs - alpha * Ys
        const signal = xs[xs.length - 1] - alpha * ys[ys.length - 1];
        
        this.signalStrength = Math.abs(signal) * 1000;
        
        return signal;
    }

    /**
     * Simple bandpass filter using moving average approach
     */
    _bandpassFilter(value) {
        if (this.signalBuffer.length < 10) return value;
        
        const recentSignals = [...this.signalBuffer.slice(-30), value];
        
        // Remove DC component (high-pass)
        const mean = recentSignals.reduce((a, b) => a + b) / recentSignals.length;
        const centered = value - mean;
        
        // Smooth (low-pass) — simple moving average over 3 samples
        const last3 = this.signalBuffer.slice(-2);
        last3.push(centered);
        const smoothed = last3.reduce((a, b) => a + b) / last3.length;
        
        return smoothed;
    }

    /**
     * Beat detection using zero-crossing and peak detection
     */
    _detectBeat(currentSignal) {
        if (this.signalBuffer.length < 10) {
            return { detected: false, instantHR: 0 };
        }

        const prevSignal = this.signalBuffer[this.signalBuffer.length - 2] || 0;
        const now = Date.now();
        
        // Detect positive zero crossing (rising edge)
        const zeroCrossing = prevSignal <= 0 && currentSignal > 0;
        
        // Minimum interval between beats (200ms = 300 bpm max)
        const minInterval = 200;
        const timeSinceLastBeat = now - this.lastBeatTime;
        
        if (zeroCrossing && timeSinceLastBeat > minInterval) {
            this.lastBeatTime = now;
            this.beatTimestamps.push(now);
            
            // Keep last 20 beats
            if (this.beatTimestamps.length > 20) {
                this.beatTimestamps.shift();
            }

            // Calculate instantaneous HR from last interval
            let instantHR = 0;
            if (this.beatTimestamps.length >= 2) {
                const interval = this.beatTimestamps[this.beatTimestamps.length - 1] - 
                                this.beatTimestamps[this.beatTimestamps.length - 2];
                instantHR = Math.round(60000 / interval);
                // Clamp to physiological range
                instantHR = Math.max(40, Math.min(200, instantHR));
            }

            return { detected: true, instantHR };
        }

        return { detected: false, instantHR: 0 };
    }

    /**
     * Calculate signal quality (0-1)
     */
    _calculateQuality() {
        if (this.signalBuffer.length < 30) return 0;

        const recent = this.signalBuffer.slice(-60);
        
        // Signal-to-noise estimation
        const signalPower = this._variance(recent);
        const noisePower = this._estimateNoise(recent);
        
        this.snr = noisePower > 0 ? signalPower / noisePower : 0;
        
        // Normalize quality to 0-1
        const quality = Math.min(1, this.snr / 5);
        
        return Math.max(0, quality);
    }

    _estimateNoise(signal) {
        // High-frequency noise estimation via second derivative
        let noise = 0;
        for (let i = 2; i < signal.length; i++) {
            const d2 = signal[i] - 2 * signal[i - 1] + signal[i - 2];
            noise += d2 * d2;
        }
        return noise / (signal.length - 2);
    }

    /**
     * Get average heart rate from accumulated beats
     */
    getAverageHR() {
        if (this.beatTimestamps.length < 3) return 0;
        
        const intervals = [];
        for (let i = 1; i < this.beatTimestamps.length; i++) {
            intervals.push(this.beatTimestamps[i] - this.beatTimestamps[i - 1]);
        }
        
        // Remove outliers (outside 1.5 IQR)
        intervals.sort((a, b) => a - b);
        const q1 = intervals[Math.floor(intervals.length * 0.25)];
        const q3 = intervals[Math.floor(intervals.length * 0.75)];
        const iqr = q3 - q1;
        const filtered = intervals.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
        
        if (filtered.length === 0) return 0;
        
        const avgInterval = filtered.reduce((a, b) => a + b) / filtered.length;
        return Math.round(60000 / avgInterval);
    }

    /**
     * Get inter-beat intervals for HRV calculation
     */
    getInterBeatIntervals() {
        if (this.beatTimestamps.length < 3) return [];
        
        const ibis = [];
        for (let i = 1; i < this.beatTimestamps.length; i++) {
            ibis.push(this.beatTimestamps[i] - this.beatTimestamps[i - 1]);
        }
        return ibis;
    }

    /**
     * Get average signal quality
     */
    getAverageQuality() {
        if (this.qualityBuffer.length === 0) return 0;
        return this.qualityBuffer.reduce((a, b) => a + b) / this.qualityBuffer.length;
    }

    // Utility functions
    _std(arr) {
        const mean = arr.reduce((a, b) => a + b) / arr.length;
        const sqDiffs = arr.map(v => (v - mean) ** 2);
        return Math.sqrt(sqDiffs.reduce((a, b) => a + b) / arr.length);
    }

    _variance(arr) {
        const mean = arr.reduce((a, b) => a + b) / arr.length;
        return arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
    }

    reset() {
        this.rgbBuffer = { r: [], g: [], b: [] };
        this.signalBuffer = [];
        this.qualityBuffer = [];
        this.beatTimestamps = [];
        this.lastBeatTime = 0;
        this.snr = 0;
        this.signalStrength = 0;
    }
}

window.RPPGProcessor = RPPGProcessor;
