/**
 * SkyHeal AI — Measurement Coach
 * Real-time guided positioning and quality feedback
 */

class MeasurementCoach {
    constructor() {
        this.messages = [];
        this.currentMessage = '';
        this.lastMessageTime = 0;
        this.messageMinInterval = 2000; // Min 2s between messages
        this.preScanChecks = [];
        this.isBlocking = false;
        this.blockReason = '';
    }

    /**
     * Evaluate pre-scan conditions and generate coaching messages
     */
    evaluatePreScan(faceResult, eqComponents) {
        this.preScanChecks = [];
        this.isBlocking = false;

        // Check face detection
        if (!faceResult || !faceResult.detected) {
            this.preScanChecks.push({ type: 'error', message: 'No face detected — position your face within the guide' });
            this.isBlocking = true;
            this.blockReason = 'No face detected';
            return this.preScanChecks;
        }

        // Check forehead coverage
        if (eqComponents.foreheadCoverage < 40) {
            this.preScanChecks.push({ type: 'warning', message: 'Uncover your forehead for better accuracy' });
        }

        // Check lighting
        if (eqComponents.lightEquality < 50) {
            this.preScanChecks.push({ type: 'warning', message: 'Illuminate your face more evenly' });
        }

        // Check backlight
        if (eqComponents.backlight < 40) {
            this.preScanChecks.push({ type: 'warning', message: 'Turn toward a light source — avoid windows behind you' });
        }

        // Check stability
        if (eqComponents.stability < 40) {
            this.preScanChecks.push({ type: 'info', message: 'Hold still for the measurement' });
        }

        // Check face position
        if (eqComponents.facePosition < 40) {
            this.preScanChecks.push({ type: 'warning', message: 'Center your face within the guide' });
            this.isBlocking = true;
            this.blockReason = 'Face not centered';
        }

        // Check camera noise
        if (eqComponents.cameraNoise < 30) {
            this.preScanChecks.push({ type: 'info', message: 'Clean your camera lens for better results' });
        }

        // Good to go
        if (this.preScanChecks.length === 0) {
            this.preScanChecks.push({ type: 'success', message: 'Looking great! Ready to begin measurement' });
        }

        return this.preScanChecks;
    }

    /**
     * Get real-time coaching message during scan
     */
    getLiveFeedback(faceResult, eqComponents, scanProgress) {
        const now = Date.now();
        if (now - this.lastMessageTime < this.messageMinInterval) {
            return this.currentMessage;
        }

        let message = '';
        let type = 'info';

        if (!faceResult?.detected) {
            message = 'Face lost — please look at the camera';
            type = 'error';
        } else if (eqComponents.stability < 30) {
            message = 'Too much movement — try to hold still';
            type = 'warning';
        } else if (eqComponents.foreheadCoverage < 30) {
            message = 'Uncover your forehead';
            type = 'warning';
        } else if (eqComponents.lightEquality < 40) {
            message = 'Uneven lighting — turn toward light';
            type = 'warning';
        } else if (eqComponents.backlight < 30) {
            message = 'Backlight detected — face a light source';
            type = 'warning';
        } else if (scanProgress < 0.3) {
            message = 'Analyzing facial signals...';
            type = 'info';
        } else if (scanProgress < 0.6) {
            message = 'Signal acquired — keep holding still';
            type = 'success';
        } else if (scanProgress < 0.9) {
            message = 'Almost done — great signal quality';
            type = 'success';
        } else {
            message = 'Finalizing measurements...';
            type = 'success';
        }

        if (message !== this.currentMessage) {
            this.currentMessage = message;
            this.lastMessageTime = now;
            this.messages.push({ message, type, timestamp: now });
        }

        return { message, type };
    }

    /**
     * Generate post-scan quality summary
     */
    getPostScanSummary(overallQuality, eqComponents) {
        const rating = overallQuality >= 80 ? 'Excellent' : 
                      overallQuality >= 60 ? 'Good' :
                      overallQuality >= 40 ? 'Fair' : 'Poor';

        let description = '';
        let tip = '';

        if (overallQuality >= 80) {
            description = 'Optimal measurement conditions. Results are highly reliable.';
        } else if (overallQuality >= 60) {
            description = 'Good measurement conditions. Results are reliable.';
            tip = this._getImprovementTip(eqComponents);
        } else if (overallQuality >= 40) {
            description = 'Measurement conditions could be improved. Results may have reduced accuracy.';
            tip = this._getImprovementTip(eqComponents);
        } else {
            description = 'Poor measurement conditions. Consider retaking the scan with better lighting and positioning.';
            tip = this._getImprovementTip(eqComponents);
        }

        return { rating, description, tip, score: Math.round(overallQuality) };
    }

    _getImprovementTip(eqComponents) {
        if (!eqComponents) return 'Ensure good lighting and stay still';
        
        const issues = Object.entries(eqComponents)
            .filter(([,v]) => v < 50)
            .sort(([,a],[,b]) => a - b);

        if (issues.length === 0) return '';

        const tipMap = {
            signalQuality: 'Try holding still for a longer period',
            cameraNoise: 'Use a device with a better camera sensor',
            foreheadCoverage: 'Next time, make sure your forehead is fully visible',
            lightEquality: 'Try facing a window or lamp directly for even illumination',
            backlight: 'Avoid having bright light sources behind you',
            stability: 'Rest your arms and keep your device steady',
            facePosition: 'Position your face in the center of the frame'
        };

        return tipMap[issues[0][0]] || 'Ensure good lighting and stay still';
    }

    /**
     * Check if BP should be suppressed (strict precision mode)
     */
    shouldSuppressBP(qualityScore, strictMode) {
        if (!strictMode) return false;
        return qualityScore < 50; // Suppress if quality below 50%
    }

    reset() {
        this.messages = [];
        this.currentMessage = '';
        this.lastMessageTime = 0;
        this.preScanChecks = [];
        this.isBlocking = false;
        this.blockReason = '';
    }
}

window.MeasurementCoach = MeasurementCoach;
