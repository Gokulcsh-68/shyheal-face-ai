/**
 * SkyHeal AI — Health Indices Calculator
 * Computes 9 health indices from face scan + user input
 */

class HealthIndices {
    constructor() {}

    /**
     * Calculate all 9 health indices
     * @param {Object} vitals - Vital signs from VitalCalculator
     * @param {Object} profile - User profile data
     * @param {Array} history - Past measurements for Wellness Score 2.0
     * @returns {Object} All health indices
     */
    calculateAll(vitals, profile, history = []) {
        return {
            wellnessScore: this.wellnessScore(vitals, history),
            vascularAge: this.vascularAge(vitals, profile),
            waistToHeight: this.waistToHeightRatio(profile),
            bodyFat: this.bodyFatPercentage(profile),
            bmr: this.basalMetabolicRate(profile),
            absi: this.bodyShapeIndex(profile),
            bri: this.bodyRoundnessIndex(profile),
            conicityIndex: this.conicityIndex(profile),
            tdee: this.totalDailyEnergyExpenditure(profile)
        };
    }

    /**
     * Wellness Score 2.0
     * Aggregates HR, HRV, BR, BP, Stress, Cardiac Workload, BMI
     * over a historical window using locally stored data
     */
    wellnessScore(vitals, history = []) {
        const allMeasurements = [...history];
        if (vitals) allMeasurements.push(vitals);

        if (allMeasurements.length === 0) {
            return { value: null, name: 'Wellness Score', unit: '/100', status: 'Insufficient data', color: '#00D4FF', period: null };
        }

        // Score each metric component (0-100)
        const scores = allMeasurements.map(m => {
            let total = 0, count = 0;

            // Heart Rate score
            if (m.hr) {
                const hrOpt = 70;
                total += Math.max(0, 100 - Math.abs(m.hr.value - hrOpt) * 2);
                count++;
            }
            // HRV score (higher is generally better)
            if (m.hrv) {
                total += Math.min(100, m.hrv.value * 2);
                count++;
            }
            // Breathing Rate score
            if (m.breathingRate) {
                const brOpt = 16;
                total += Math.max(0, 100 - Math.abs(m.breathingRate.value - brOpt) * 5);
                count++;
            }
            // Blood Pressure score
            if (m.bp) {
                const sysDiff = Math.abs(m.bp.systolic - 115);
                const diaDiff = Math.abs(m.bp.diastolic - 75);
                total += Math.max(0, 100 - sysDiff - diaDiff);
                count++;
            }
            // Stress Index (lower is better)
            if (m.stressIndex) {
                total += Math.max(0, 100 - m.stressIndex.value * 0.5);
                count++;
            }
            // Cardiac Workload
            if (m.cardiacWorkload) {
                const cwOpt = 8500;
                total += Math.max(0, 100 - Math.abs(m.cardiacWorkload.value - cwOpt) * 0.01);
                count++;
            }
            // BMI
            if (m.bmi) {
                const bmiOpt = 22;
                total += Math.max(0, 100 - Math.abs(m.bmi.value - bmiOpt) * 5);
                count++;
            }

            return count > 0 ? total / count : 0;
        });

        // Average all valid measurements
        const avgScore = Math.round(scores.reduce((a, b) => a + b) / scores.length);
        const value = Math.max(0, Math.min(100, avgScore));

        let status;
        if (value >= 80) status = 'Excellent';
        else if (value >= 60) status = 'Good';
        else if (value >= 40) status = 'Fair';
        else status = 'Poor';

        const days = allMeasurements.length > 1 ? 7 : 1;

        return {
            value, name: 'Wellness Score', unit: '/100', status, color: '#00D4FF',
            period: allMeasurements.length >= 2 ? `Average of last ${days} days` : 'Single measurement',
            measurementCount: allMeasurements.length
        };
    }

    /**
     * Vascular Age — estimated arterial age vs biological age
     */
    vascularAge(vitals, profile) {
        if (!profile.age) {
            return { value: null, name: 'Vascular Age', unit: 'years', status: 'Need age input', color: '#F97316' };
        }

        let vascAge = profile.age;

        // Adjust based on BP
        if (vitals && vitals.bp) {
            if (vitals.bp.systolic > 130) vascAge += (vitals.bp.systolic - 130) * 0.3;
            if (vitals.bp.systolic < 110) vascAge -= (110 - vitals.bp.systolic) * 0.2;
        }
        // Adjust for heart rate
        if (vitals && vitals.hr) {
            if (vitals.hr.value > 80) vascAge += (vitals.hr.value - 80) * 0.15;
            if (vitals.hr.value < 65) vascAge -= (65 - vitals.hr.value) * 0.1;
        }
        // Smoking impact
        if (profile.smoking === 'current') vascAge += 5;
        else if (profile.smoking === 'former') vascAge += 2;

        vascAge = Math.round(Math.max(18, vascAge));
        const diff = vascAge - profile.age;
        let status;
        if (diff <= -3) status = 'Younger than age';
        else if (diff <= 3) status = 'Age appropriate';
        else status = 'Older than age';

        return { value: vascAge, name: 'Vascular Age', unit: 'years', status, color: '#F97316', diff };
    }

    /**
     * Waist-to-Height Ratio
     */
    waistToHeightRatio(profile) {
        if (!profile.waist || !profile.height) {
            return { value: null, name: 'Waist-to-Height Ratio', unit: '', status: 'Need measurements', color: '#EC4899' };
        }
        const value = parseFloat((profile.waist / profile.height).toFixed(2));
        let status;
        if (value < 0.4) status = 'Underweight risk';
        else if (value <= 0.5) status = 'Healthy';
        else if (value <= 0.6) status = 'Overweight';
        else status = 'Obese';

        return { value, name: 'Waist-to-Height Ratio', unit: '', status, color: '#EC4899' };
    }

    /**
     * Body Fat Percentage (US Navy method)
     */
    bodyFatPercentage(profile) {
        if (!profile.waist || !profile.height || !profile.gender) {
            return { value: null, name: 'Body Fat %', unit: '%', status: 'Need measurements', color: '#F59E0B' };
        }

        let bf;
        if (profile.gender === 'male') {
            // Simplified formula
            bf = 86.010 * Math.log10(profile.waist) - 70.041 * Math.log10(profile.height) + 36.76;
        } else {
            bf = 163.205 * Math.log10(profile.waist) - 97.684 * Math.log10(profile.height) - 78.387;
        }

        bf = parseFloat(Math.max(3, Math.min(55, bf)).toFixed(1));
        let status;
        if (profile.gender === 'male') {
            if (bf < 6) status = 'Essential';
            else if (bf < 14) status = 'Athletic';
            else if (bf < 18) status = 'Fit';
            else if (bf < 25) status = 'Average';
            else status = 'Above average';
        } else {
            if (bf < 14) status = 'Essential';
            else if (bf < 21) status = 'Athletic';
            else if (bf < 25) status = 'Fit';
            else if (bf < 32) status = 'Average';
            else status = 'Above average';
        }

        return { value: bf, name: 'Body Fat %', unit: '%', status, color: '#F59E0B' };
    }

    /**
     * Basal Metabolic Rate (Mifflin-St Jeor equation)
     */
    basalMetabolicRate(profile) {
        if (!profile.height || !profile.weight || !profile.age || !profile.gender) {
            return { value: null, name: 'BMR', unit: 'kcal/day', status: 'Need profile data', color: '#10B981' };
        }

        let bmr;
        if (profile.gender === 'male') {
            bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
        } else {
            bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
        }

        bmr = Math.round(bmr);

        return { value: bmr, name: 'BMR', unit: 'kcal/day', status: 'Resting metabolism', color: '#10B981' };
    }

    /**
     * A Body Shape Index (ABSI)
     */
    bodyShapeIndex(profile) {
        if (!profile.waist || !profile.height || !profile.weight) {
            return { value: null, name: 'Body Shape Index', unit: '', status: 'Need measurements', color: '#8B5CF6' };
        }

        const heightM = profile.height / 100;
        const waistM = profile.waist / 100;
        const bmi = profile.weight / (heightM * heightM);
        const absi = waistM / (Math.pow(bmi, 2 / 3) * Math.pow(heightM, 1 / 2));
        const value = parseFloat(absi.toFixed(4));

        let status;
        if (value < 0.074) status = 'Low risk';
        else if (value < 0.083) status = 'Average';
        else status = 'Elevated risk';

        return { value, name: 'Body Shape Index', unit: '', status, color: '#8B5CF6' };
    }

    /**
     * Body Roundness Index (BRI)
     */
    bodyRoundnessIndex(profile) {
        if (!profile.waist || !profile.height) {
            return { value: null, name: 'Body Roundness Index', unit: '', status: 'Need measurements', color: '#06B6D4' };
        }

        const heightM = profile.height / 100;
        const waistM = profile.waist / 100;
        const eccentricity = Math.sqrt(1 - Math.pow((waistM / (2 * Math.PI)), 2) / Math.pow(heightM * 0.5, 2));
        const bri = parseFloat((364.2 - 365.5 * eccentricity).toFixed(1));
        const value = Math.max(1, Math.min(20, bri));

        let status;
        if (value < 3.4) status = 'Normal';
        else if (value < 5.0) status = 'Overweight';
        else status = 'Obese';

        return { value, name: 'Body Roundness Index', unit: '', status, color: '#06B6D4' };
    }

    /**
     * Conicity Index
     */
    conicityIndex(profile) {
        if (!profile.waist || !profile.height || !profile.weight) {
            return { value: null, name: 'Conicity Index', unit: '', status: 'Need measurements', color: '#D946EF' };
        }

        const heightM = profile.height / 100;
        const waistM = profile.waist / 100;
        const ci = waistM / (0.109 * Math.sqrt(profile.weight / heightM));
        const value = parseFloat(ci.toFixed(2));

        let status;
        if (value < 1.18) status = 'Normal';
        else if (value < 1.25) status = 'Elevated';
        else status = 'High';

        return { value, name: 'Conicity Index', unit: '', status, color: '#D946EF' };
    }

    /**
     * Total Daily Energy Expenditure
     */
    totalDailyEnergyExpenditure(profile) {
        const bmrResult = this.basalMetabolicRate(profile);
        if (!bmrResult.value) {
            return { value: null, name: 'TDEE', unit: 'kcal/day', status: 'Need profile data', color: '#EF4444' };
        }

        const activityMultipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            active: 1.725,
            very_active: 1.9
        };

        const multiplier = activityMultipliers[profile.activity] || 1.55;
        const value = Math.round(bmrResult.value * multiplier);

        return { value, name: 'TDEE', unit: 'kcal/day', status: `${profile.activity || 'Moderate'} activity`, color: '#EF4444' };
    }
}

window.HealthIndices = HealthIndices;
