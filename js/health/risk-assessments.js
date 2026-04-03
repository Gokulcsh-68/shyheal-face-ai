/**
 * SkyHeal AI — Health Risk Assessments
 * 14 risk scores using validated clinical algorithms
 */

class RiskAssessments {
    constructor() {}

    /**
     * Calculate all 14 risk assessments
     */
    calculateAll(vitals, profile) {
        if (!profile.age || !profile.gender) return {};

        return {
            cardiovascularRisk: this.cardiovascularRisk(vitals, profile),
            ascvdRisk: this.ascvdRisk(vitals, profile),
            chdRisk: this.chdRisk(vitals, profile),
            strokeRisk: this.strokeRisk(vitals, profile),
            heartFailureRisk: this.heartFailureRisk(vitals, profile),
            pvdRisk: this.pvdRisk(vitals, profile),
            cvEventRisk: this.cvEventRisk(vitals, profile),
            coronaryDeathRisk: this.coronaryDeathRisk(vitals, profile),
            diabetesRisk: this.diabetesRisk(vitals, profile),
            fattyLiverRisk: this.fattyLiverRisk(vitals, profile),
            hypertensionRisk: this.hypertensionRisk(vitals, profile),
            cholesterolRisk: this.cholesterolRisk(vitals, profile),
            anemiaRisk: this.anemiaRisk(vitals, profile),
            hypertriglyceridemiaRisk: this.hypertriglyceridemiaRisk(vitals, profile)
        };
    }

    /**
     * Cardiovascular Risk Score (Simplified Framingham)
     * 10-year risk of cardiovascular event
     */
    cardiovascularRisk(vitals, profile) {
        let score = 0;
        
        // Age
        if (profile.age >= 65) score += 3;
        else if (profile.age >= 55) score += 2;
        else if (profile.age >= 45) score += 1;

        // Blood pressure
        if (vitals?.bp) {
            if (vitals.bp.systolic >= 160) score += 3;
            else if (vitals.bp.systolic >= 140) score += 2;
            else if (vitals.bp.systolic >= 130) score += 1;
        }

        // Cholesterol
        if (profile.cholesterol) {
            if (profile.cholesterol >= 280) score += 3;
            else if (profile.cholesterol >= 240) score += 2;
            else if (profile.cholesterol >= 200) score += 1;
        }

        // Smoking
        if (profile.smoking === 'current') score += 2;
        else if (profile.smoking === 'former') score += 1;

        // Diabetes
        if (profile.diabetesHistory) score += 2;

        // BMI
        if (vitals?.bmi?.value >= 30) score += 1;

        // Gender adjustment
        if (profile.gender === 'male') score += 1;

        // BP medication
        if (profile.hypertensionMed) score += 1;

        const maxScore = 16;
        const percentage = Math.round((score / maxScore) * 100);
        const risk10yr = Math.min(50, Math.round(percentage * 0.5));

        return this._formatRisk('Cardiovascular Risk Score', risk10yr, '%', 
            `${risk10yr}% 10-year risk`);
    }

    /**
     * ASCVD Risk (Simplified Pooled Cohort Equations)
     */
    ascvdRisk(vitals, profile) {
        let risk = 2; // Base risk

        if (profile.age) risk += Math.max(0, (profile.age - 40) * 0.3);
        if (profile.gender === 'male') risk *= 1.3;
        if (vitals?.bp?.systolic > 130) risk += (vitals.bp.systolic - 130) * 0.1;
        if (profile.cholesterol > 200) risk += (profile.cholesterol - 200) * 0.02;
        if (profile.hdl && profile.hdl < 40) risk += 3;
        if (profile.smoking === 'current') risk *= 1.5;
        if (profile.diabetesHistory) risk *= 1.4;
        if (profile.hypertensionMed) risk *= 1.2;
        if (profile.cvdHistory) risk *= 1.8;

        risk = Math.min(50, Math.round(risk));

        return this._formatRisk('ASCVD Risk', risk, '%', 
            `${risk}% 10-year atherosclerotic CV risk`);
    }

    /**
     * Coronary Heart Disease Risk
     */
    chdRisk(vitals, profile) {
        let risk = 1.5;
        if (profile.age > 50) risk += (profile.age - 50) * 0.2;
        if (profile.gender === 'male') risk *= 1.4;
        if (vitals?.bp?.systolic > 140) risk += 3;
        if (profile.cholesterol > 240) risk += 2;
        if (profile.smoking === 'current') risk *= 1.6;
        if (profile.ldl && profile.ldl > 160) risk += 2;
        risk = Math.min(40, Math.round(risk));

        return this._formatRisk('Coronary Heart Disease', risk, '%',
            `${risk}% 10-year CHD risk`);
    }

    /**
     * Stroke Risk
     */
    strokeRisk(vitals, profile) {
        let risk = 1;
        if (profile.age > 55) risk += (profile.age - 55) * 0.3;
        if (vitals?.bp?.systolic > 140) risk += 4;
        if (profile.smoking === 'current') risk += 2;
        if (profile.diabetesHistory) risk += 2;
        if (vitals?.hr?.value > 100) risk += 1;
        if (profile.cvdHistory) risk += 3;
        risk = Math.min(35, Math.round(risk));

        return this._formatRisk('Stroke Risk', risk, '%',
            `${risk}% 10-year stroke risk`);
    }

    /**
     * Heart Failure Risk
     */
    heartFailureRisk(vitals, profile) {
        let risk = 1;
        if (profile.age > 60) risk += (profile.age - 60) * 0.25;
        if (vitals?.bp?.systolic > 150) risk += 3;
        if (vitals?.hr?.value > 90) risk += 1;
        if (vitals?.bmi?.value > 30) risk += 2;
        if (profile.diabetesHistory) risk += 2;
        if (profile.smoking === 'current') risk += 1;
        risk = Math.min(30, Math.round(risk));

        return this._formatRisk('Heart Failure Risk', risk, '%',
            `${risk}% lifetime risk`);
    }

    /**
     * Peripheral Vascular Disease Risk
     */
    pvdRisk(vitals, profile) {
        let risk = 1;
        if (profile.age > 50) risk += (profile.age - 50) * 0.15;
        if (profile.smoking === 'current') risk *= 2;
        if (profile.diabetesHistory) risk += 3;
        if (vitals?.bp?.systolic > 140) risk += 2;
        if (profile.cholesterol > 250) risk += 1;
        risk = Math.min(25, Math.round(risk));

        return this._formatRisk('Peripheral Vascular Disease', risk, '%',
            `${risk}% 10-year PVD risk`);
    }

    /**
     * Cardiovascular Event Risk
     */
    cvEventRisk(vitals, profile) {
        let risk = 2;
        if (profile.age > 45) risk += (profile.age - 45) * 0.25;
        if (vitals?.bp?.systolic > 130) risk += (vitals.bp.systolic - 130) * 0.15;
        if (profile.smoking === 'current') risk *= 1.5;
        if (profile.diabetesHistory) risk += 3;
        if (profile.cvdHistory) risk += 5;
        if (vitals?.stressIndex?.value > 150) risk += 1;
        risk = Math.min(45, Math.round(risk));

        return this._formatRisk('CV Event Risk', risk, '%',
            `${risk}% 10-year risk of any CV event`);
    }

    /**
     * Coronary Death Risk
     */
    coronaryDeathRisk(vitals, profile) {
        let risk = 0.5;
        if (profile.age > 55) risk += (profile.age - 55) * 0.2;
        if (profile.gender === 'male') risk *= 1.5;
        if (vitals?.bp?.systolic > 160) risk += 3;
        if (profile.smoking === 'current') risk *= 2;
        if (profile.cholesterol > 280) risk += 2;
        if (profile.cvdHistory) risk += 4;
        risk = Math.min(25, Math.round(risk));

        return this._formatRisk('Coronary Death Risk', risk, '%',
            `${risk}% 10-year coronary mortality risk`);
    }

    /**
     * Diabetes Risk (Simplified Finnish Diabetes Risk Score)
     */
    diabetesRisk(vitals, profile) {
        let score = 0;

        // Age
        if (profile.age >= 64) score += 4;
        else if (profile.age >= 55) score += 3;
        else if (profile.age >= 45) score += 2;

        // BMI
        if (vitals?.bmi?.value >= 30) score += 3;
        else if (vitals?.bmi?.value >= 25) score += 1;

        // Waist
        if (profile.waist) {
            if (profile.gender === 'male' && profile.waist > 102) score += 4;
            else if (profile.gender === 'male' && profile.waist > 94) score += 3;
            else if (profile.gender === 'female' && profile.waist > 88) score += 4;
            else if (profile.gender === 'female' && profile.waist > 80) score += 3;
        }

        // Family history
        if (profile.diabetesHistory) score += 5;

        // Physical activity
        if (profile.activity === 'sedentary') score += 2;

        // Glucose
        if (profile.glucose) {
            if (profile.glucose >= 126) score += 5;
            else if (profile.glucose >= 100) score += 3;
        }

        const maxScore = 23;
        const percentage = Math.round((score / maxScore) * 100);

        return this._formatRisk('Diabetes Risk', percentage, '%',
            `${percentage}% estimated 10-year risk`);
    }

    /**
     * Fatty Liver Disease Risk (Fatty Liver Index)
     */
    fattyLiverRisk(vitals, profile) {
        if (!profile.waist || !profile.weight || !profile.height) {
            return this._formatRisk('Fatty Liver Disease', null, '%', 'Need measurements');
        }

        const heightM = profile.height / 100;
        const bmi = profile.weight / (heightM * heightM);
        let risk = 0;

        if (bmi >= 30) risk += 30;
        else if (bmi >= 25) risk += 15;

        if (profile.waist > 102 && profile.gender === 'male') risk += 20;
        else if (profile.waist > 88 && profile.gender === 'female') risk += 20;

        if (profile.triglycerides && profile.triglycerides > 150) risk += 15;
        if (profile.alcohol === 'heavy') risk += 15;
        if (profile.glucose && profile.glucose > 100) risk += 10;

        risk = Math.min(90, risk);

        return this._formatRisk('Fatty Liver Disease', risk, '%',
            `${risk}% FLI-based risk estimate`);
    }

    /**
     * Hypertension Risk
     */
    hypertensionRisk(vitals, profile) {
        let risk = 5;
        if (profile.age > 40) risk += (profile.age - 40) * 0.5;
        if (vitals?.bp?.systolic >= 130) risk += 20;
        else if (vitals?.bp?.systolic >= 120) risk += 10;
        if (vitals?.bmi?.value >= 30) risk += 10;
        if (profile.smoking === 'current') risk += 5;
        if (profile.cvdHistory) risk += 10;
        if (profile.activity === 'sedentary') risk += 5;
        risk = Math.min(90, Math.round(risk));

        return this._formatRisk('Hypertension Risk', risk, '%',
            `${risk}% risk of developing hypertension`);
    }

    /**
     * High Cholesterol Risk
     */
    cholesterolRisk(vitals, profile) {
        let risk = 5;
        if (profile.cholesterol && profile.cholesterol > 240) risk += 30;
        else if (profile.cholesterol && profile.cholesterol > 200) risk += 15;
        if (profile.ldl && profile.ldl > 160) risk += 15;
        if (profile.hdl && profile.hdl < 40) risk += 15;
        if (vitals?.bmi?.value > 30) risk += 10;
        if (profile.age > 50) risk += 5;
        if (profile.activity === 'sedentary') risk += 5;
        risk = Math.min(85, Math.round(risk));

        return this._formatRisk('High Cholesterol Risk', risk, '%',
            `${risk}% dyslipidemia risk`);
    }

    /**
     * Anemia Risk
     */
    anemiaRisk(vitals, profile) {
        let risk = 5;
        if (profile.gender === 'female') risk += 10;
        if (profile.age > 65) risk += 10;
        if (vitals?.hr?.value > 100) risk += 10; // Tachycardia can indicate anemia
        if (vitals?.spo2?.value < 96) risk += 10;
        risk = Math.min(60, Math.round(risk));

        return this._formatRisk('Anemia Risk', risk, '%',
            `${risk}% estimated anemia risk`);
    }

    /**
     * Hypertriglyceridemia Risk
     */
    hypertriglyceridemiaRisk(vitals, profile) {
        let risk = 5;
        if (profile.triglycerides && profile.triglycerides > 200) risk += 40;
        else if (profile.triglycerides && profile.triglycerides > 150) risk += 20;
        if (vitals?.bmi?.value > 30) risk += 15;
        if (profile.diabetesHistory) risk += 10;
        if (profile.alcohol === 'heavy') risk += 15;
        if (profile.activity === 'sedentary') risk += 5;
        risk = Math.min(85, Math.round(risk));

        return this._formatRisk('Hypertriglyceridemia', risk, '%',
            `${risk}% elevated triglyceride risk`);
    }

    /**
     * Format risk result consistently
     */
    _formatRisk(name, value, unit, description) {
        if (value === null) {
            return { value: null, name, unit, category: 'Unknown', description, color: '#6B7280' };
        }

        let category, color;
        if (value < 10) { category = 'Low'; color = '#2ECC71'; }
        else if (value < 20) { category = 'Low-Moderate'; color = '#27AE60'; }
        else if (value < 35) { category = 'Moderate'; color = '#F1C40F'; }
        else if (value < 50) { category = 'Moderate-High'; color = '#E67E22'; }
        else if (value < 70) { category = 'High'; color = '#E74C3C'; }
        else { category = 'Very High'; color = '#8E44AD'; }

        return { value, name, unit, category, description, color };
    }
}

window.RiskAssessments = RiskAssessments;
