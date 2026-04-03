/**
 * SkyHeal AI — Face Detector
 * Face detection and ROI extraction for signal processing
 * Uses canvas-based pixel analysis with simulated face mesh overlay
 */

class FaceDetector {
    constructor() {
        this.isDetecting = false;
        this.lastFaceRect = null;
        this.detectionInterval = 200; // ms between detections
        this.lastDetectionTime = 0;
        this.canvas = null;
        this.ctx = null;
        this.faceDetected = false;
        
        // Face mesh landmarks (forehead, cheeks, nose)
        this.landmarks = null;
        this.roiRegions = {};
    }

    /**
     * Initialize the face detector
     * @param {HTMLCanvasElement} overlayCanvas - Canvas for drawing overlays
     */
    init(overlayCanvas) {
        this.canvas = overlayCanvas;
        this.ctx = overlayCanvas.getContext('2d', { willReadFrequently: true });
    }

    /**
     * Detect face in current video frame
     * @param {HTMLVideoElement} video - Video element with camera feed
     * @returns {Object|null} Face rectangle and ROI regions
     */
    detect(video) {
        if (!video || !video.videoWidth) return null;

        const now = Date.now();
        
        // Throttle detection to reduce CPU usage
        if (now - this.lastDetectionTime < this.detectionInterval && this.lastFaceRect) {
            return this.lastFaceRect;
        }
        this.lastDetectionTime = now;

        // Set canvas size to match video
        if (this.canvas.width !== video.videoWidth || this.canvas.height !== video.videoHeight) {
            this.canvas.width = video.videoWidth;
            this.canvas.height = video.videoHeight;
        }

        // Draw current frame to canvas
        this.ctx.drawImage(video, 0, 0);
        
        // Simple skin detection for face region estimation
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const faceRect = this._detectSkinRegion(imageData);

        if (faceRect) {
            this.faceDetected = true;
            this.lastFaceRect = faceRect;
            
            // Calculate ROI sub-regions
            this.roiRegions = this._calculateROIs(faceRect);
            this.landmarks = this._estimateLandmarks(faceRect);

            return {
                ...faceRect,
                roi: this.roiRegions,
                landmarks: this.landmarks,
                detected: true
            };
        } else {
            this.faceDetected = false;
            return this.lastFaceRect ? { ...this.lastFaceRect, detected: false } : null;
        }
    }

    /**
     * Detect skin-colored region (simplified face detection)
     * Uses YCbCr color space skin detection
     */
    _detectSkinRegion(imageData) {
        const data = imageData.data;
        const w = imageData.width;
        const h = imageData.height;
        
        // Scan center region of frame for skin pixels
        const scanMargin = 0.15;
        const startX = Math.floor(w * scanMargin);
        const endX = Math.floor(w * (1 - scanMargin));
        const startY = Math.floor(h * 0.05);
        const endY = Math.floor(h * 0.85);
        
        let skinPixels = [];
        const step = 4; // Sample every 4th pixel for speed

        for (let y = startY; y < endY; y += step) {
            for (let x = startX; x < endX; x += step) {
                const idx = (y * w + x) * 4;
                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                
                if (this._isSkinPixel(r, g, b)) {
                    skinPixels.push({ x, y });
                }
            }
        }

        if (skinPixels.length < 50) return null;

        // Find bounding box of skin region
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        skinPixels.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });

        // Approximate face rectangle (~centered, aspect ratio ~0.75)
        const width = maxX - minX;
        const height = maxY - minY;
        
        if (width < 50 || height < 50) return null;

        // Apply typical face aspect ratio constraints
        const faceWidth = Math.min(width, height * 0.75);
        const faceHeight = height;
        const centerX = (minX + maxX) / 2;
        const faceX = centerX - faceWidth / 2;

        return {
            x: faceX,
            y: minY,
            width: faceWidth,
            height: faceHeight,
            centerX: centerX,
            centerY: minY + faceHeight / 2
        };
    }

    /**
     * Skin detection using RGB rules
     */
    _isSkinPixel(r, g, b) {
        // RGB skin detection rules
        return r > 80 && g > 40 && b > 20 &&
               r > g && r > b &&
               (r - g) > 15 &&
               Math.abs(r - g) < 100 &&
               r - b > 15;
    }

    /**
     * Calculate sub-ROI regions for signal extraction
     */
    _calculateROIs(faceRect) {
        const { x, y, width, height } = faceRect;

        return {
            // Forehead: top 25% of face, center 60%
            forehead: {
                x: x + width * 0.2,
                y: y + height * 0.05,
                width: width * 0.6,
                height: height * 0.2
            },
            // Left cheek
            leftCheek: {
                x: x + width * 0.1,
                y: y + height * 0.45,
                width: width * 0.25,
                height: height * 0.2
            },
            // Right cheek
            rightCheek: {
                x: x + width * 0.65,
                y: y + height * 0.45,
                width: width * 0.25,
                height: height * 0.2
            },
            // Nose
            nose: {
                x: x + width * 0.35,
                y: y + height * 0.35,
                width: width * 0.3,
                height: height * 0.25
            },
            // Full face (combined ROI for rPPG)
            fullFace: {
                x: x + width * 0.1,
                y: y + height * 0.1,
                width: width * 0.8,
                height: height * 0.7
            }
        };
    }

    /**
     * Estimate facial landmarks positions
     */
    _estimateLandmarks(faceRect) {
        const { x, y, width, height } = faceRect;

        return {
            foreheadCenter: { x: x + width * 0.5, y: y + height * 0.15 },
            leftEye: { x: x + width * 0.3, y: y + height * 0.35 },
            rightEye: { x: x + width * 0.7, y: y + height * 0.35 },
            noseTip: { x: x + width * 0.5, y: y + height * 0.55 },
            leftCheek: { x: x + width * 0.2, y: y + height * 0.55 },
            rightCheek: { x: x + width * 0.8, y: y + height * 0.55 },
            chin: { x: x + width * 0.5, y: y + height * 0.85 }
        };
    }

    /**
     * Draw face mask overlay
     */
    drawOverlay(faceResult) {
        if (!this.ctx || !faceResult) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (!faceResult.detected) return;

        const { x, y, width, height, roi, landmarks } = faceResult;

        // Draw face mesh (ellipse)
        this.ctx.beginPath();
        this.ctx.ellipse(
            x + width / 2, y + height * 0.45,
            width * 0.48, height * 0.48,
            0, 0, Math.PI * 2
        );
        this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw ROI regions
        this.ctx.strokeStyle = 'rgba(123, 47, 255, 0.3)';
        this.ctx.lineWidth = 1;
        
        if (roi) {
            ['forehead', 'leftCheek', 'rightCheek'].forEach(region => {
                const r = roi[region];
                this.ctx.strokeRect(r.x, r.y, r.width, r.height);
            });
        }

        // Draw landmark points
        if (landmarks) {
            this.ctx.fillStyle = 'rgba(0, 212, 255, 0.6)';
            Object.values(landmarks).forEach(pt => {
                this.ctx.beginPath();
                this.ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }
    }

    /**
     * Get the best ROI for rPPG extraction
     */
    getBestROI() {
        if (!this.roiRegions.forehead) return this.lastFaceRect;
        
        // Forehead is the most reliable for rPPG (less movement, good vasculature)
        return this.roiRegions.forehead;
    }

    /**
     * Get image data from canvas
     */
    getImageData() {
        if (!this.ctx || !this.canvas.width) return null;
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    reset() {
        this.lastFaceRect = null;
        this.faceDetected = false;
        this.landmarks = null;
        this.roiRegions = {};
    }
}

window.FaceDetector = FaceDetector;
