/**
 * SkyHeal AI — Results Screen Renderer
 */
class ResultsRenderer {
    static render(vitals, indices, quality) {
        // Vitals grid
        const vitalsGrid = document.getElementById('vitals-grid');
        if (vitalsGrid && vitals) {
            const vitalMetrics = [
                vitals.hr, vitals.hrv, vitals.breathingRate, vitals.stressIndex,
                vitals.cardiacWorkload, vitals.parasympathetic, vitals.spo2, vitals.hba1c, vitals.bmi
            ];
            vitalsGrid.innerHTML = vitalMetrics.map(m => UIComponents.metricCard(m)).join('');
        }

        // Indices grid
        const indicesGrid = document.getElementById('indices-grid');
        if (indicesGrid && indices) {
            const indexMetrics = Object.values(indices).filter(m => m && m.value !== null);
            indicesGrid.innerHTML = indexMetrics.map(m => UIComponents.metricCard(m)).join('');
        }

        // Blood pressure section
        ResultsRenderer.renderBP(vitals?.bp);

        // Quality summary
        ResultsRenderer.renderQuality(quality);
    }

    static renderBP(bp) {
        const bpSection = document.getElementById('bp-section');
        if (!bpSection || !bp) return;
        bpSection.style.display = 'block';

        document.getElementById('bp-sys-val').textContent = bp.systolic;
        document.getElementById('bp-dia-val').textContent = bp.diastolic;

        // Position marker on scale
        const markerPos = Math.min(100, Math.max(0, ((bp.systolic - 80) / (200 - 80)) * 100));
        document.getElementById('bp-marker').style.left = markerPos + '%';

        // Simplified tile
        document.getElementById('bp-tile-range').textContent = bp.category;
        const tileLabel = document.getElementById('bp-tile-label');
        tileLabel.textContent = `${bp.systolic}/${bp.diastolic} mmHg`;
        
        const tile = document.getElementById('bp-tile');
        const colors = {
            'Normal': { bg: 'rgba(46,204,113,0.1)', border: 'rgba(46,204,113,0.2)', text: '#2ECC71' },
            'Elevated': { bg: 'rgba(241,196,15,0.1)', border: 'rgba(241,196,15,0.2)', text: '#F1C40F' },
            'High Stage 1': { bg: 'rgba(230,126,34,0.1)', border: 'rgba(230,126,34,0.2)', text: '#E67E22' },
            'High Stage 2': { bg: 'rgba(231,76,60,0.1)', border: 'rgba(231,76,60,0.2)', text: '#E74C3C' },
            'Crisis': { bg: 'rgba(142,68,173,0.1)', border: 'rgba(142,68,173,0.2)', text: '#8E44AD' }
        };
        const c = colors[bp.category] || colors['Normal'];
        tile.style.background = c.bg;
        tile.style.borderColor = c.border;
        document.getElementById('bp-tile-range').style.color = c.text;
    }

    static renderQuality(quality) {
        if (!quality) return;
        document.getElementById('quality-score-val').textContent = quality.score || '--';
        document.getElementById('quality-description').textContent = quality.description || '';
        
        const tip = document.getElementById('quality-tip');
        if (quality.tip) { tip.textContent = '💡 ' + quality.tip; tip.style.display = 'block'; }
        else { tip.style.display = 'none'; }

        // Animate ring
        const ring = document.getElementById('quality-ring');
        if (ring) {
            const dashOffset = 220 - (220 * (quality.score || 0)) / 100;
            ring.style.strokeDashoffset = dashOffset;
        }
    }

    static renderRisks(risks) {
        const grid = document.getElementById('risks-grid');
        if (!grid || !risks) return;
        
        const riskEntries = Object.values(risks).filter(r => r && r.value !== null);
        if (riskEntries.length > 0) {
            document.getElementById('risk-input-prompt').style.display = 'none';
            grid.innerHTML = riskEntries.map(r => UIComponents.riskCard(r)).join('');
        }
    }
}

window.ResultsRenderer = ResultsRenderer;
