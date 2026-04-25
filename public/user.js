const API_URL = '/api';

// DOM Elements
const themeToggleBtn = document.getElementById('theme-toggle');
const weatherContent = document.getElementById('weather-content');
const fieldsContainer = document.getElementById('fields-container');
const insightBadge = document.getElementById('insight-badge');

let systemChartInstance = null;
let historyChartInstance = null;

// Theme Toggle
themeToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  if (document.body.classList.contains('dark-mode')) {
    themeToggleBtn.innerHTML = '☀️ Light Mode';
  } else {
    themeToggleBtn.innerHTML = '🌙 Dark Mode';
  }
});



// Fetch Global Analytics
async function loadAnalytics() {
  try {
    const res = await fetch(`${API_URL}/admin/analytics`);
    const data = await res.json();

    // In a read-only community view, "Total Water Applied" might be framed positively if efficient, or just factually.
    document.getElementById('stat-total-water').textContent = data.totalWaterApplied.toFixed(1) + ' L';
    
    const effScore = Number(data.systemEfficiency);
    const effEl = document.getElementById('stat-system-efficiency');
    effEl.textContent = effScore + '%';
    
    if (effScore < 80 || effScore > 120) {
      effEl.style.color = 'var(--danger)';
      insightBadge.textContent = '⚠️ Action Needed: Water Wastage Detected';
      insightBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
      insightBadge.style.color = 'var(--danger)';
    } else {
      effEl.style.color = 'var(--success)';
      insightBadge.textContent = '🌱 Optimal: Water is being conserved';
      insightBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      insightBadge.style.color = 'var(--success)';
    }

    // Render Charts
    const cropNames = Object.keys(data.cropWaterUsage);
    const cropValues = Object.values(data.cropWaterUsage);
    renderSystemChart(cropNames, cropValues);

    if (data.history) {
      renderHistoryChart(data.history.labels, data.history.actual, data.history.optimal);
    }

  } catch (err) {
    console.error('Failed to load analytics', err);
  }
}

function renderSystemChart(labels, data) {
  const ctx = document.getElementById('userSystemChart').getContext('2d');
  if (systemChartInstance) systemChartInstance.destroy();

  systemChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels.length ? labels : ['No Data'],
      datasets: [{
        data: data.length ? data : [100],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: 'var(--text-main)' } }
      }
    }
  });
}

function renderHistoryChart(labels, actual, optimal) {
  const ctx = document.getElementById('userHistoryChart').getContext('2d');
  if (historyChartInstance) historyChartInstance.destroy();

  historyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Actual Water (L)', data: actual, borderColor: '#3b82f6', backgroundColor: '#3b82f6', fill: false, tension: 0.3 },
        { label: 'Optimal Water (L)', data: optimal, borderColor: '#10b981', backgroundColor: '#10b981', fill: false, tension: 0.3, borderDash: [5, 5] }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { color: 'var(--text-muted)' } },
        x: { ticks: { color: 'var(--text-muted)' } }
      },
      plugins: { legend: { labels: { color: 'var(--text-main)' } } }
    }
  });
}

// Fetch Read-Only Fields
async function loadFields() {
  try {
    const res = await fetch(`${API_URL}/fields`);
    const fields = await res.json();
    
    if (fields.length === 0) {
      fieldsContainer.innerHTML = '<div class="glass-card" style="grid-column: 1 / -1; text-align: center;">No fields found.</div>';
      return;
    }
    
    fieldsContainer.innerHTML = '';
    
    for (const field of fields) {
      const crop = field.cropId || {};
      
      let statusIndicator = '';
      let statusColor = '';
      
      if (field.moisture < (crop.minMoisture || 30)) {
        statusIndicator = 'Under-irrigated ⚠️';
        statusColor = 'var(--warning)';
      } else if (field.moisture > (crop.maxMoisture || 80)) {
        statusIndicator = 'Overwatered ❌';
        statusColor = 'var(--danger)';
      } else {
        statusIndicator = 'Optimal ✅';
        statusColor = 'var(--success)';
      }

      const card = document.createElement('div');
      card.className = 'glass-card';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <h3 style="margin-bottom: 0.2rem;">${field.name}</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted)">🌾 ${crop.name || 'Unknown'} | 📍 ${field.location}</span>
          </div>
          <div style="background: rgba(255,255,255,0.05); padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; color: ${statusColor};">
            ${statusIndicator}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-box">
            <div style="font-size: 0.8rem; color: var(--text-muted)">Air Humidity</div>
            <div class="stat-value" style="font-size: 1.2rem;">${field.moisture}%</div>
          </div>
          <div class="stat-box">
            <div style="font-size: 0.8rem; color: var(--text-muted)">Air Temperature</div>
            <div class="stat-value" style="font-size: 1.2rem;">${field.temperature}°C</div>
          </div>
        </div>
      `;
      fieldsContainer.appendChild(card);
    }
  } catch (err) {
    fieldsContainer.innerHTML = '<div class="alert danger">Failed to load public field data.</div>';
  }
}

// Init App
async function init() {
  await loadAnalytics();
  await loadFields();
}

init();
