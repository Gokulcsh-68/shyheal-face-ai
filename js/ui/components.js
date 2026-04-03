/**
 * SkyHeal AI — UI Components
 * Reusable UI building blocks
 */

class UIComponents {
    /**
     * Create a metric card with visual scale
     */
    static metricCard(metric) {
        if (!metric || metric.value === null || metric.value === undefined) return '';

        const scalePosition = UIComponents.getScalePosition(metric);
        const statusClass = UIComponents.getStatusClass(metric.status);
        const displayValue = typeof metric.value === 'number' && metric.value % 1 !== 0 
            ? metric.value.toFixed(1) : metric.value;

        return `
            <div class="metric-card" data-metric="${metric.name}">
                <div class="metric-header">
                    <div class="metric-dot" style="background:${metric.color}"></div>
                    <span class="metric-name">${metric.name}</span>
                </div>
                <div class="metric-value" style="color:${metric.color}">
                    ${displayValue}<span class="metric-unit"> ${metric.unit || ''}</span>
                </div>
                <span class="metric-status ${statusClass}">${metric.status || ''}</span>
                <div class="metric-scale">
                    <div class="metric-scale-fill" style="width:${scalePosition}%;background:${metric.color}"></div>
                    <div class="metric-scale-marker" style="left:${scalePosition}%;background:${metric.color}"></div>
                </div>
            </div>
        `;
    }

    /**
     * Create a risk assessment card
     */
    static riskCard(risk) {
        if (!risk || risk.value === null) return '';

        const categoryClass = UIComponents.getRiskClass(risk.category);
        const gaugeWidth = Math.min(100, risk.value);

        return `
            <div class="risk-card">
                <div class="risk-header">
                    <span class="risk-name">${risk.name}</span>
                    <span class="risk-badge ${categoryClass}">${risk.category}</span>
                </div>
                <div class="risk-gauge">
                    <div class="risk-gauge-fill" style="width:${gaugeWidth}%;background:${risk.color}"></div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="risk-value" style="color:${risk.color}">${risk.value}${risk.unit}</span>
                </div>
                <p class="risk-description">${risk.description || ''}</p>
            </div>
        `;
    }

    /**
     * Create measurement history item
     */
    static historyItem(measurement) {
        const date = new Date(measurement.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const hr = measurement.hr?.value || '--';
        const bp = measurement.bp ? `${measurement.bp.systolic}/${measurement.bp.diastolic}` : '--/--';

        return `
            <div class="measurement-item" data-id="${measurement.id || measurement.timestamp}">
                <div class="measurement-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" stroke-width="2">
                        <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
                    </svg>
                </div>
                <div class="measurement-info">
                    <h4>${timeStr}</h4>
                    <p>HR: ${hr} bpm • BP: ${bp} mmHg</p>
                </div>
                <span class="measurement-hr">${hr} bpm</span>
            </div>
        `;
    }

    /**
     * Calculate scale position (0-100%) for visual bar
     */
    static getScalePosition(metric) {
        const name = (metric.name || '').toLowerCase();
        const val = metric.value;

        if (name.includes('heart rate') && !name.includes('variability')) {
            return Math.min(100, Math.max(0, ((val - 40) / (200 - 40)) * 100));
        }
        if (name.includes('hrv') || name.includes('variability')) {
            return Math.min(100, Math.max(0, (val / 100) * 100));
        }
        if (name.includes('blood pressure') || name.includes('systolic')) {
            return Math.min(100, Math.max(0, ((val - 80) / (180 - 80)) * 100));
        }
        if (name.includes('breathing')) {
            return Math.min(100, Math.max(0, ((val - 6) / (30 - 6)) * 100));
        }
        if (name.includes('stress')) {
            return Math.min(100, Math.max(0, (val / 300) * 100));
        }
        if (name.includes('cardiac workload')) {
            return Math.min(100, Math.max(0, ((val - 4000) / (16000 - 4000)) * 100));
        }
        if (name.includes('parasympathetic')) {
            return val;
        }
        if (name.includes('spo') || name.includes('o₂')) {
            return Math.min(100, Math.max(0, ((val - 85) / (100 - 85)) * 100));
        }
        if (name.includes('hba1c')) {
            return Math.min(100, Math.max(0, ((val - 3.5) / (10 - 3.5)) * 100));
        }
        if (name.includes('bmi')) {
            return Math.min(100, Math.max(0, ((val - 15) / (40 - 15)) * 100));
        }
        if (name.includes('wellness')) {
            return val;
        }
        // Generic
        return Math.min(100, Math.max(0, val));
    }

    static getStatusClass(status) {
        if (!status) return '';
        const s = status.toLowerCase();
        if (s.includes('normal') || s.includes('athletic') || s.includes('excellent') || s.includes('healthy') || s.includes('good') || s.includes('fit')) return 'status-normal';
        if (s.includes('elevated') || s.includes('pre-diabetic') || s.includes('overweight') || s.includes('average') || s.includes('fair')) return 'status-elevated';
        if (s.includes('high') || s.includes('obese') || s.includes('diabetic') || s.includes('crisis') || s.includes('poor') || s.includes('critical')) return 'status-high';
        if (s.includes('low') || s.includes('underweight')) return 'status-low';
        return 'status-normal';
    }

    static getRiskClass(category) {
        if (!category) return '';
        const c = category.toLowerCase();
        if (c.includes('very high')) return 'risk-very-high';
        if (c.includes('high')) return 'risk-high';
        if (c.includes('moderate')) return 'risk-moderate';
        return 'risk-low';
    }

    /**
     * Animate number counting up
     */
    static animateNumber(element, target, duration = 1000) {
        const start = 0;
        const startTime = performance.now();
        
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const current = Math.round(start + (target - start) * eased);
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = target;
            }
        }
        
        requestAnimationFrame(update);
    }
}

window.UIComponents = UIComponents;
