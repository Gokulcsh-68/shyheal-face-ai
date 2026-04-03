/**
 * SkyHeal AI — Risk Forms Handler
 */
class RiskFormsHandler {
    static collectProfile() {
        return {
            age: parseInt(document.getElementById('input-age')?.value) || null,
            gender: document.querySelector('input[name="gender"]:checked')?.value || null,
            height: parseInt(document.getElementById('input-height')?.value) || null,
            weight: parseInt(document.getElementById('input-weight')?.value) || null,
            waist: parseInt(document.getElementById('input-waist')?.value) || null,
            smoking: document.getElementById('input-smoking')?.value || null,
            activity: document.getElementById('input-activity')?.value || null,
            alcohol: document.getElementById('input-alcohol')?.value || null,
            cholesterol: parseInt(document.getElementById('input-cholesterol')?.value) || null,
            hdl: parseInt(document.getElementById('input-hdl')?.value) || null,
            ldl: parseInt(document.getElementById('input-ldl')?.value) || null,
            triglycerides: parseInt(document.getElementById('input-triglycerides')?.value) || null,
            glucose: parseInt(document.getElementById('input-glucose')?.value) || null,
            diabetesHistory: document.getElementById('input-diabetes-history')?.checked || false,
            cvdHistory: document.getElementById('input-cvd-history')?.checked || false,
            hypertensionMed: document.getElementById('input-hypertension-med')?.checked || false
        };
    }

    static populateForm(profile) {
        if (!profile) return;
        if (profile.age) document.getElementById('input-age').value = profile.age;
        if (profile.gender) {
            const radio = document.querySelector(`input[name="gender"][value="${profile.gender}"]`);
            if (radio) radio.checked = true;
        }
        if (profile.height) document.getElementById('input-height').value = profile.height;
        if (profile.weight) document.getElementById('input-weight').value = profile.weight;
        if (profile.waist) document.getElementById('input-waist').value = profile.waist;
        if (profile.smoking) document.getElementById('input-smoking').value = profile.smoking;
        if (profile.activity) document.getElementById('input-activity').value = profile.activity;
        if (profile.alcohol) document.getElementById('input-alcohol').value = profile.alcohol;
        if (profile.cholesterol) document.getElementById('input-cholesterol').value = profile.cholesterol;
        if (profile.hdl) document.getElementById('input-hdl').value = profile.hdl;
        if (profile.ldl) document.getElementById('input-ldl').value = profile.ldl;
        if (profile.triglycerides) document.getElementById('input-triglycerides').value = profile.triglycerides;
        if (profile.glucose) document.getElementById('input-glucose').value = profile.glucose;
        if (profile.diabetesHistory) document.getElementById('input-diabetes-history').checked = true;
        if (profile.cvdHistory) document.getElementById('input-cvd-history').checked = true;
        if (profile.hypertensionMed) document.getElementById('input-hypertension-med').checked = true;
    }
}

window.RiskFormsHandler = RiskFormsHandler;
