/**
 * SkyHeal AI — Environmental Quality System
 * 7-component Environmental Quality Index + measurement coaching
 */

class EnvironmentalQuality {
    constructor() {
        this.components = {
            signalQuality: 0,
            cameraNoise: 0,
            foreheadCoverage: 0,
            lightEquality: 0,
            backlight: 0,
            stability: 0,
            facePosition: 0
        };
        this.overallScore = 0;
        this.prevBrightness = 0;
        this.stabilityBuffer = [];
    }

    /**
     * Evaluate all 7 environmental quality components
     */
    evaluate(imageData, faceResult, fusionResult) {
        if (!imageData) return this.components;

        this.components.signalQuality = this._evalSignalQuality(fusionResult);
        this.components.cameraNoise = this._evalCameraNoise(imageData);
        this.components.foreheadCoverage = this._evalForeheadCoverage(faceResult);
        this.components.lightEquality = this._evalLightEquality(imageData, faceResult);
        this.components.backlight = this._evalBacklight(imageData, faceResult);
        this.components.stability = this._evalStability(faceResult);
        this.components.facePosition = this._evalFacePosition(faceResult, imageData);

        // Overall weighted score
        this.overallScore = (
            this.components.signalQuality * 0.25 +
            this.components.cameraNoise * 0.1 +
            this.components.foreheadCoverage * 0.15 +
            this.components.lightEquality * 0.15 +
            this.components.backlight * 0.1 +
            this.components.stability * 0.15 +
            this.components.facePosition * 0.1
        );

        return this.components;
    }

    _evalSignalQuality(fusionResult) {
        if (!fusionResult) return 0;
        return Math.min(100, Math.round(
            (fusionResult.combinedQuality || 0) * 100
        ));
    }

    _evalCameraNoise(imageData) {
        // Estimate noise from variance in a small uniform region
        const data = imageData.data;
        const w = imageData.width;
        const samples = [];
        const cx = Math.floor(w * 0.05);
        const cy = 5;
        
        for (let y = cy; y < cy + 10; y++) {
            for (let x = cx; x < cx + 10; x++) {
                const idx = (y * w + x) * 4;
                samples.push((data[idx] + data[idx+1] + data[idx+2]) / 3);
            }
        }

        if (samples.length === 0) return 50;
        const mean = samples.reduce((a,b) => a+b) / samples.length;
        const variance = samples.reduce((s,v) => s + (v-mean)**2, 0) / samples.length;
        
        // Lower noise = higher score
        return Math.max(0, Math.min(100, Math.round(100 - variance * 2)));
    }

    _evalForeheadCoverage(faceResult) {
        if (!faceResult || !faceResult.roi) return 0;
        const forehead = faceResult.roi.forehead;
        if (!forehead) return 0;
        
        // Check if forehead is within frame and reasonably sized
        const minSize = 30;
        if (forehead.width < minSize || forehead.height < minSize * 0.5) return 30;
        return Math.min(100, Math.round((forehead.width * forehead.height) / 2000 * 100));
    }

    _evalLightEquality(imageData, faceResult) {
        if (!faceResult?.roi) return 50;
        const data = imageData.data;
        const w = imageData.width;
        
        // Compare brightness between left and right cheek
        const leftAvg = this._regionBrightness(data, w, faceResult.roi.leftCheek);
        const rightAvg = this._regionBrightness(data, w, faceResult.roi.rightCheek);
        
        if (leftAvg === 0 || rightAvg === 0) return 50;
        
        const ratio = Math.min(leftAvg, rightAvg) / Math.max(leftAvg, rightAvg);
        return Math.round(ratio * 100);
    }

    _evalBacklight(imageData, faceResult) {
        if (!faceResult) return 50;
        const data = imageData.data;
        const w = imageData.width;
        const h = imageData.height;
        
        // Compare face brightness with background
        const faceBright = this._regionBrightness(data, w, faceResult.roi?.fullFace || faceResult);
        
        // Sample corners for background
        const cornerSize = 30;
        const bgSamples = [];
        [[0,0],[w-cornerSize,0],[0,h-cornerSize],[w-cornerSize,h-cornerSize]].forEach(([x,y]) => {
            bgSamples.push(this._regionBrightness(data, w, {x,y,width:cornerSize,height:cornerSize}));
        });
        const bgBright = bgSamples.reduce((a,b)=>a+b) / bgSamples.length;
        
        if (bgBright === 0) return 80;
        
        // If background much brighter than face = backlight problem
        const ratio = faceBright / (bgBright + 1);
        if (ratio < 0.5) return 20; // Severe backlight
        if (ratio < 0.7) return 50; // Moderate
        return Math.min(100, Math.round(ratio * 100));
    }

    _evalStability(faceResult) {
        if (!faceResult?.centerX) return 50;
        
        this.stabilityBuffer.push({ x: faceResult.centerX, y: faceResult.centerY });
        if (this.stabilityBuffer.length > 30) this.stabilityBuffer.shift();
        if (this.stabilityBuffer.length < 5) return 50;

        // Calculate jitter over recent frames
        let totalMovement = 0;
        for (let i = 1; i < this.stabilityBuffer.length; i++) {
            const dx = this.stabilityBuffer[i].x - this.stabilityBuffer[i-1].x;
            const dy = this.stabilityBuffer[i].y - this.stabilityBuffer[i-1].y;
            totalMovement += Math.sqrt(dx*dx + dy*dy);
        }
        const avgMovement = totalMovement / (this.stabilityBuffer.length - 1);
        
        return Math.max(0, Math.min(100, Math.round(100 - avgMovement * 5)));
    }

    _evalFacePosition(faceResult, imageData) {
        if (!faceResult || !imageData) return 0;
        
        const frameCenterX = imageData.width / 2;
        const frameCenterY = imageData.height * 0.4;
        const faceCenterX = faceResult.centerX || (faceResult.x + faceResult.width / 2);
        const faceCenterY = faceResult.centerY || (faceResult.y + faceResult.height / 2);
        
        const distX = Math.abs(faceCenterX - frameCenterX) / imageData.width;
        const distY = Math.abs(faceCenterY - frameCenterY) / imageData.height;
        
        return Math.max(0, Math.min(100, Math.round((1 - distX - distY) * 100)));
    }

    _regionBrightness(data, w, region) {
        if (!region) return 0;
        let sum = 0, count = 0;
        const sx = Math.max(0, Math.floor(region.x));
        const sy = Math.max(0, Math.floor(region.y));
        const ex = Math.floor(region.x + region.width);
        const ey = Math.floor(region.y + region.height);
        
        for (let y = sy; y < ey; y += 3) {
            for (let x = sx; x < ex; x += 3) {
                const idx = (y * w + x) * 4;
                if (idx >= 0 && idx < data.length) {
                    sum += (data[idx] + data[idx+1] + data[idx+2]) / 3;
                    count++;
                }
            }
        }
        return count > 0 ? sum / count : 0;
    }

    /**
     * Get quality rating (Excellent > Good > Fair > Poor)
     */
    getRating() {
        if (this.overallScore >= 80) return { label: 'Excellent', color: '#2ECC71', emoji: '✓' };
        if (this.overallScore >= 60) return { label: 'Good', color: '#3B82F6', emoji: '✓' };
        if (this.overallScore >= 40) return { label: 'Fair', color: '#F1C40F', emoji: '!' };
        return { label: 'Poor', color: '#E74C3C', emoji: '✗' };
    }

    /**
     * Get improvement tip based on weakest component
     */
    getImprovementTip() {
        const sorted = Object.entries(this.components)
            .sort(([,a], [,b]) => a - b);
        
        const worst = sorted[0];
        const tips = {
            signalQuality: 'Hold still and ensure your face is fully visible',
            cameraNoise: 'Clean your camera lens for clearer signal',
            foreheadCoverage: 'Uncover your forehead and remove any hair',
            lightEquality: 'Illuminate your face more evenly — avoid side lighting',
            backlight: 'Turn toward a light source — avoid windows behind you',
            stability: 'Keep your head still during the measurement',
            facePosition: 'Center your face within the guide oval'
        };

        return tips[worst[0]] || 'Ensure good lighting and keep still';
    }

    reset() {
        Object.keys(this.components).forEach(k => this.components[k] = 0);
        this.overallScore = 0;
        this.stabilityBuffer = [];
    }
}

window.EnvironmentalQuality = EnvironmentalQuality;
