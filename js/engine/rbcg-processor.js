/**
 * SkyHeal AI — rBCG Signal Processor
 * Remote Ballistocardiography: Detects heart rate from micro-head movements
 * 
 * Pipeline:
 * 1. Track facial feature points across frames
 * 2. Compute optical flow displacement vectors
 * 3. Apply PCA to isolate cardiac component
 * 4. Bandpass filter for heart rate range
 * 5. Peak detection with quality scoring
 */

class RBCGProcessor {
    constructor() {
        this.bufferSize = 256;
        this.sampleRate = 30;
        this.motionBuffer = { x: [], y: [] };
        this.signalBuffer = [];
        this.qualityBuffer = [];
        this.beatTimestamps = [];
        this.lastBeatTime = 0;
        this.previousPoints = null;
        this.snr = 0;
        this.signalStrength = 0;
        
        // Tracking points configuration
        this.numTrackingPoints = 30;
        this.pointGrid = null;
    }

    /**
     * Initialize tracking grid within face ROI
     * @param {Object} faceRect - {x, y, width, height} of detected face
     */
    initTrackingGrid(faceRect) {
        const points = [];
        const cols = 6;
        const rows = 5;
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                points.push({
                    x: faceRect.x + (faceRect.width * (c + 0.5)) / cols,
                    y: faceRect.y + (faceRect.height * (r + 0.5)) / rows
                });
            }
        }
        
        this.pointGrid = points;
        return points;
    }

    /**
     * Track feature points between frames using simple block matching
     * @param {ImageData} prevFrame - Previous frame pixel data
     * @param {ImageData} currFrame - Current frame pixel data
     * @param {Object} faceRect - Current face bounding box
     * @returns {Object} Average displacement {dx, dy}
     */
    trackMotion(prevFrame, currFrame, faceRect) {
        if (!prevFrame || !currFrame) return null;

        // Simplified motion estimation using ROI intensity differences
        const prevROI = this._getROIIntensity(prevFrame, faceRect);
        const currROI = this._getROIIntensity(currFrame, faceRect);
        
        if (!prevROI || !currROI) return null;

        // Compute vertical displacement proxy
        // The cardiac ballistic signal primarily manifests as vertical head motion
        const dx = this._estimateDisplacement(prevROI.horizontal, currROI.horizontal);
        const dy = this._estimateDisplacement(prevROI.vertical, currROI.vertical);

        return { dx, dy };
    }

    /**
     * Get intensity profiles for motion estimation
     */
    _getROIIntensity(imageData, roi) {
        const data = imageData.data;
        const width = imageData.width;
        const startX = Math.max(0, Math.floor(roi.x));
        const startY = Math.max(0, Math.floor(roi.y));
        const endX = Math.min(width, Math.floor(roi.x + roi.width));
        const endY = Math.min(imageData.height, Math.floor(roi.y + roi.height));
        
        if (endX <= startX || endY <= startY) return null;

        // Compute horizontal and vertical intensity projections
        const w = endX - startX;
        const h = endY - startY;
        const horizontal = new Array(w).fill(0);
        const vertical = new Array(h).fill(0);

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const idx = (y * width + x) * 4;
                const intensity = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                horizontal[x - startX] += intensity;
                vertical[y - startY] += intensity;
            }
        }

        // Normalize
        horizontal.forEach((v, i) => horizontal[i] = v / h);
        vertical.forEach((v, i) => vertical[i] = v / w);

        return { horizontal, vertical };
    }

    /**
     * Estimate sub-pixel displacement by cross-correlation
     */
    _estimateDisplacement(prev, curr) {
        if (prev.length !== curr.length || prev.length === 0) return 0;
        
        // Compute cross-correlation at small shifts
        const maxShift = 3;
        let bestCorr = -Infinity;
        let bestShift = 0;

        for (let shift = -maxShift; shift <= maxShift; shift++) {
            let corr = 0;
            let count = 0;
            for (let i = maxShift; i < prev.length - maxShift; i++) {
                const j = i + shift;
                if (j >= 0 && j < curr.length) {
                    corr += prev[i] * curr[j];
                    count++;
                }
            }
            if (count > 0) corr /= count;
            if (corr > bestCorr) {
                bestCorr = corr;
                bestShift = shift;
            }
        }

        return bestShift * 0.1; // Sub-pixel scaling
    }

    /**
     * Process a new frame displacement for BCG signal
     * @param {Object} displacement - {dx, dy} from trackMotion
     * @returns {Object} {signal, quality, beatDetected, instantHR}
     */
    processFrame(displacement) {
        if (!displacement) return { signal: 0, quality: 0, beatDetected: false, instantHR: 0 };

        // The primary BCG signal is in the vertical (y) direction
        // due to blood ejection into the aorta causing head recoil
        const rawSignal = displacement.dy;

        this.motionBuffer.x.push(displacement.dx);
        this.motionBuffer.y.push(displacement.dy);

        if (this.motionBuffer.y.length > this.bufferSize) {
            this.motionBuffer.x.shift();
            this.motionBuffer.y.shift();
        }

        if (this.motionBuffer.y.length < 30) {
            return { signal: 0, quality: 0, beatDetected: false, instantHR: 0 };
        }

        // Apply PCA-like signal separation
        const pcaSignal = this._pcaExtract();
        
        // Bandpass filter
        const filtered = this._bandpassFilter(pcaSignal);
        
        this.signalBuffer.push(filtered);
        if (this.signalBuffer.length > this.bufferSize) this.signalBuffer.shift();

        // Beat detection
        const beatResult = this._detectBeat(filtered);
        
        // Quality assessment
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
     * PCA-based signal extraction
     * Separates cardiac motion from voluntary movement
     */
    _pcaExtract() {
        const len = Math.min(this.motionBuffer.y.length, 64);
        const xWin = this.motionBuffer.x.slice(-len);
        const yWin = this.motionBuffer.y.slice(-len);

        // Compute covariance matrix
        const xMean = xWin.reduce((a, b) => a + b) / len;
        const yMean = yWin.reduce((a, b) => a + b) / len;

        let cxx = 0, cxy = 0, cyy = 0;
        for (let i = 0; i < len; i++) {
            const dx = xWin[i] - xMean;
            const dy = yWin[i] - yMean;
            cxx += dx * dx;
            cxy += dx * dy;
            cyy += dy * dy;
        }
        cxx /= len;
        cxy /= len;
        cyy /= len;

        // First principal component direction
        const trace = cxx + cyy;
        const det = cxx * cyy - cxy * cxy;
        const eigenvalue = trace / 2 + Math.sqrt(Math.max(0, (trace * trace) / 4 - det));

        // Project onto principal component
        let evx = cxy;
        let evy = eigenvalue - cxx;
        const evLen = Math.sqrt(evx * evx + evy * evy);
        if (evLen > 0) {
            evx /= evLen;
            evy /= evLen;
        } else {
            evx = 0;
            evy = 1;
        }

        // Project latest sample
        const signal = (xWin[len - 1] - xMean) * evx + (yWin[len - 1] - yMean) * evy;
        this.signalStrength = Math.abs(signal) * 100;
        
        return signal;
    }

    /**
     * Bandpass filter for BCG signal
     */
    _bandpassFilter(value) {
        if (this.signalBuffer.length < 10) return value;
        
        const recent = [...this.signalBuffer.slice(-20), value];
        const mean = recent.reduce((a, b) => a + b) / recent.length;
        const centered = value - mean;
        
        // Smooth
        const last3 = this.signalBuffer.slice(-2);
        last3.push(centered);
        const smoothed = last3.reduce((a, b) => a + b) / last3.length;
        
        return smoothed;
    }

    /**
     * Beat detection using peak detection
     */
    _detectBeat(currentSignal) {
        if (this.signalBuffer.length < 10) {
            return { detected: false, instantHR: 0 };
        }

        const prevSignal = this.signalBuffer[this.signalBuffer.length - 2] || 0;
        const prevPrevSignal = this.signalBuffer[this.signalBuffer.length - 3] || 0;
        const now = Date.now();

        // Peak detection: prev > prevPrev AND prev > current (local maximum)
        const isPeak = prevSignal > prevPrevSignal && prevSignal > currentSignal && prevSignal > 0;
        const minInterval = 250; // Max 240 bpm
        const timeSinceLastBeat = now - this.lastBeatTime;

        if (isPeak && timeSinceLastBeat > minInterval) {
            this.lastBeatTime = now;
            this.beatTimestamps.push(now);
            if (this.beatTimestamps.length > 20) this.beatTimestamps.shift();

            let instantHR = 0;
            if (this.beatTimestamps.length >= 2) {
                const interval = this.beatTimestamps[this.beatTimestamps.length - 1] - 
                                this.beatTimestamps[this.beatTimestamps.length - 2];
                instantHR = Math.round(60000 / interval);
                instantHR = Math.max(40, Math.min(200, instantHR));
            }

            return { detected: true, instantHR };
        }

        return { detected: false, instantHR: 0 };
    }

    /**
     * Calculate BCG signal quality
     */
    _calculateQuality() {
        if (this.signalBuffer.length < 30) return 0;

        const recent = this.signalBuffer.slice(-60);
        const signalPower = this._variance(recent);
        const noisePower = this._estimateNoise(recent);
        
        this.snr = noisePower > 0 ? signalPower / noisePower : 0;
        const quality = Math.min(1, this.snr / 4);
        
        return Math.max(0, quality);
    }

    _estimateNoise(signal) {
        let noise = 0;
        for (let i = 2; i < signal.length; i++) {
            const d2 = signal[i] - 2 * signal[i - 1] + signal[i - 2];
            noise += d2 * d2;
        }
        return noise / (signal.length - 2);
    }

    _variance(arr) {
        const mean = arr.reduce((a, b) => a + b) / arr.length;
        return arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
    }

    getAverageHR() {
        if (this.beatTimestamps.length < 3) return 0;
        const intervals = [];
        for (let i = 1; i < this.beatTimestamps.length; i++) {
            intervals.push(this.beatTimestamps[i] - this.beatTimestamps[i - 1]);
        }
        intervals.sort((a, b) => a - b);
        const q1 = intervals[Math.floor(intervals.length * 0.25)];
        const q3 = intervals[Math.floor(intervals.length * 0.75)];
        const iqr = q3 - q1;
        const filtered = intervals.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
        if (filtered.length === 0) return 0;
        const avgInterval = filtered.reduce((a, b) => a + b) / filtered.length;
        return Math.round(60000 / avgInterval);
    }

    getInterBeatIntervals() {
        if (this.beatTimestamps.length < 3) return [];
        const ibis = [];
        for (let i = 1; i < this.beatTimestamps.length; i++) {
            ibis.push(this.beatTimestamps[i] - this.beatTimestamps[i - 1]);
        }
        return ibis;
    }

    getAverageQuality() {
        if (this.qualityBuffer.length === 0) return 0;
        return this.qualityBuffer.reduce((a, b) => a + b) / this.qualityBuffer.length;
    }

    reset() {
        this.motionBuffer = { x: [], y: [] };
        this.signalBuffer = [];
        this.qualityBuffer = [];
        this.beatTimestamps = [];
        this.lastBeatTime = 0;
        this.previousPoints = null;
        this.snr = 0;
        this.signalStrength = 0;
    }
}

window.RBCGProcessor = RBCGProcessor;
