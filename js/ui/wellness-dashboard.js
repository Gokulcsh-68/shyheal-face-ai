/**
 * SkyHeal AI — Wellness Dashboard
 */
class WellnessDashboard {
    static update(wellnessScore, measurements) {
        // Update score ring
        const ring = document.getElementById('wellness-ring');
        const scoreNum = document.getElementById('wellness-score-num');
        const period = document.getElementById('wellness-period');
        const status = document.getElementById('wellness-status');

        if (!wellnessScore || wellnessScore.value === null) {
            scoreNum.textContent = '--';
            period.textContent = 'No data yet';
            status.textContent = 'Complete your first scan to activate';
            return;
        }

        const score = wellnessScore.value;
        scoreNum.textContent = score;
        UIComponents.animateNumber(scoreNum, score, 1200);

        // Animate ring (circumference = 2π × 52 ≈ 327)
        const dashOffset = 327 - (327 * score) / 100;
        ring.style.strokeDashoffset = dashOffset;

        period.textContent = wellnessScore.period || 'Single measurement';
        status.textContent = wellnessScore.status || '';

        // Update quick stats from latest measurement
        if (measurements && measurements.length > 0) {
            const latest = measurements[0];
            if (latest.hr) document.getElementById('stat-hr').textContent = latest.hr.value + ' bpm';
            if (latest.bp) document.getElementById('stat-bp').textContent = `${latest.bp.systolic}/${latest.bp.diastolic}`;
            if (latest.spo2) document.getElementById('stat-spo2').textContent = latest.spo2.value + '%';
            if (latest.stressIndex) document.getElementById('stat-stress').textContent = latest.stressIndex.value;
        }
    }

    static renderHistory(measurements) {
        const list = document.getElementById('recent-measurements');
        const historyContent = document.getElementById('history-content');
        
        if (!measurements || measurements.length === 0) return;

        // Recent on home screen (last 5)
        if (list) {
            list.innerHTML = measurements.slice(0, 5).map(m => UIComponents.historyItem(m)).join('');
        }

        // Full history screen
        if (historyContent) {
            // Group by day
            const groups = {};
            measurements.forEach(m => {
                const day = new Date(m.timestamp).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
                if (!groups[day]) groups[day] = [];
                groups[day].push(m);
            });

            let html = '';
            Object.entries(groups).forEach(([day, items]) => {
                html += `<h4 class="history-day-header">${day}</h4>`;
                html += items.map(m => UIComponents.historyItem(m)).join('');
            });

            historyContent.innerHTML = html;
        }
    }
}

window.WellnessDashboard = WellnessDashboard;
