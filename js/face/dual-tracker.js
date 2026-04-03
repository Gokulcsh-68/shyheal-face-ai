/**
 * SkyHeal AI — Dual Tracker Architecture
 * Main tracker + Refit tracker running in parallel
 * 
 * Main tracker: Keeps measurement going continuously
 * Refit tracker: Recalculates optimal face position in background
 * When refit finds better alignment, it transitions smoothly
 */

class DualTracker {
    constructor() {
        // Main tracker state
        this.mainTracker = {
            faceRect: null,
            confidence: 0,
            framesSinceUpdate: 0,
            maxStaleFrames: 30 // 1 second at 30fps
        };

        // Refit tracker state
        this.refitTracker = {
            faceRect: null,
            confidence: 0,
            isRefitting: false,
            refitInterval: 90, // Refit every 3 seconds
            framesSinceRefit: 0
        };

        // Transition parameters
        this.transitionSpeed = 0.15; // Smooth interpolation factor
        this.isTransitioning = false;
        this.transitionProgress = 0;

        // Occlusion recovery
        this.occlusionDetected = false;
        this.occlusionFrames = 0;
        this.maxOcclusionFrames = 15; // 0.5 seconds
    }

    /**
     * Update tracking with new face detection
     * @param {Object} faceResult - Result from FaceDetector.detect()
     * @returns {Object} Tracked face position (smooth)
     */
    update(faceResult) {
        if (!faceResult) {
            return this._handleLostFace();
        }

        if (faceResult.detected) {
            this.occlusionDetected = false;
            this.occlusionFrames = 0;
            return this._updateMainTracker(faceResult);
        } else {
            return this._handleOcclusion();
        }
    }

    /**
     * Update main tracker with new detection
     */
    _updateMainTracker(faceResult) {
        this.mainTracker.framesSinceUpdate = 0;
        this.refitTracker.framesSinceRefit++;

        // If no existing track, initialize
        if (!this.mainTracker.faceRect) {
            this.mainTracker.faceRect = { ...faceResult };
            this.mainTracker.confidence = 1;
            return this.mainTracker.faceRect;
        }

        // Smooth tracking — interpolate toward detection
        this.mainTracker.faceRect = this._interpolateRect(
            this.mainTracker.faceRect,
            faceResult,
            this.transitionSpeed
        );
        this.mainTracker.confidence = Math.min(1, this.mainTracker.confidence + 0.05);

        // Check if refit should run
        if (this.refitTracker.framesSinceRefit >= this.refitTracker.refitInterval) {
            this._runRefit(faceResult);
        }

        // If refit has a better position, transition to it
        if (this.isTransitioning) {
            this._applyTransition();
        }

        return this.mainTracker.faceRect;
    }

    /**
     * Run refit tracker — recalculate optimal positioning
     */
    _runRefit(currentDetection) {
        this.refitTracker.framesSinceRefit = 0;
        this.refitTracker.isRefitting = true;

        // Compare current tracking with fresh detection
        const mainRect = this.mainTracker.faceRect;
        const freshRect = currentDetection;

        // Calculate alignment quality
        const mainCenterX = mainRect.x + mainRect.width / 2;
        const mainCenterY = mainRect.y + mainRect.height / 2;
        const freshCenterX = freshRect.centerX || (freshRect.x + freshRect.width / 2);
        const freshCenterY = freshRect.centerY || (freshRect.y + freshRect.height / 2);

        const drift = Math.sqrt(
            (mainCenterX - freshCenterX) ** 2 + 
            (mainCenterY - freshCenterY) ** 2
        );

        // If drift exceeds threshold, initiate smooth transition
        const driftThreshold = Math.max(mainRect.width * 0.1, 10);

        if (drift > driftThreshold) {
            this.refitTracker.faceRect = { ...freshRect };
            this.refitTracker.confidence = 1;
            this.isTransitioning = true;
            this.transitionProgress = 0;
        }

        this.refitTracker.isRefitting = false;
    }

    /**
     * Smoothly transition main tracker to refit position
     */
    _applyTransition() {
        if (!this.refitTracker.faceRect) return;

        this.transitionProgress += this.transitionSpeed;

        if (this.transitionProgress >= 1) {
            // Transition complete
            this.mainTracker.faceRect = { ...this.refitTracker.faceRect };
            this.isTransitioning = false;
            this.transitionProgress = 0;
            return;
        }

        // Smooth interpolation
        this.mainTracker.faceRect = this._interpolateRect(
            this.mainTracker.faceRect,
            this.refitTracker.faceRect,
            this.transitionSpeed
        );
    }

    /**
     * Handle face temporarily lost (occlusion)
     */
    _handleOcclusion() {
        this.occlusionFrames++;
        this.mainTracker.framesSinceUpdate++;
        this.mainTracker.confidence = Math.max(0, this.mainTracker.confidence - 0.03);

        if (this.occlusionFrames > this.maxOcclusionFrames) {
            this.occlusionDetected = true;
        }

        // Continue with last known position
        return this.mainTracker.faceRect;
    }

    /**
     * Handle face completely lost
     */
    _handleLostFace() {
        this.mainTracker.framesSinceUpdate++;
        this.mainTracker.confidence = Math.max(0, this.mainTracker.confidence - 0.05);

        if (this.mainTracker.framesSinceUpdate > this.mainTracker.maxStaleFrames) {
            this.mainTracker.faceRect = null;
            this.mainTracker.confidence = 0;
            return null;
        }

        return this.mainTracker.faceRect;
    }

    /**
     * Smooth rectangle interpolation
     */
    _interpolateRect(current, target, t) {
        return {
            x: current.x + (target.x - current.x) * t,
            y: current.y + (target.y - current.y) * t,
            width: current.width + (target.width - current.width) * t,
            height: current.height + (target.height - current.height) * t,
            centerX: (current.centerX || current.x + current.width / 2) + 
                     ((target.centerX || target.x + target.width / 2) - (current.centerX || current.x + current.width / 2)) * t,
            centerY: (current.centerY || current.y + current.height / 2) +
                     ((target.centerY || target.y + target.height / 2) - (current.centerY || current.y + current.height / 2)) * t,
            detected: target.detected !== undefined ? target.detected : true,
            roi: target.roi || current.roi,
            landmarks: target.landmarks || current.landmarks
        };
    }

    /**
     * Get tracking status
     */
    getStatus() {
        return {
            isTracking: this.mainTracker.faceRect !== null,
            confidence: this.mainTracker.confidence,
            isRefitting: this.refitTracker.isRefitting,
            isTransitioning: this.isTransitioning,
            occlusionDetected: this.occlusionDetected,
            framesSinceUpdate: this.mainTracker.framesSinceUpdate
        };
    }

    reset() {
        this.mainTracker.faceRect = null;
        this.mainTracker.confidence = 0;
        this.mainTracker.framesSinceUpdate = 0;
        this.refitTracker.faceRect = null;
        this.refitTracker.confidence = 0;
        this.refitTracker.framesSinceRefit = 0;
        this.isTransitioning = false;
        this.transitionProgress = 0;
        this.occlusionDetected = false;
        this.occlusionFrames = 0;
    }
}

window.DualTracker = DualTracker;
