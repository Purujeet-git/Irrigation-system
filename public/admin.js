const API_URL = '/api';

// Auth Check
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
  window.location.href = 'login.html';
}

if (user && user.role !== 'Admin') {
  // Farmers cannot access admin page
  alert('Unauthorized access. Redirecting to your dashboard.');
  window.location.href = 'farmer.html';
}



const statusMessage = document.getElementById('status-message');
const alertsPanel = document.getElementById('alerts-panel');

const cropModal = document.getElementById('crop-modal');
const closeCropModal = document.getElementById('close-crop-modal');
const editCropForm = document.getElementById('edit-crop-form');
const addCropBtn = document.getElementById('add-crop-btn');
const cropModalTitle = document.getElementById('crop-modal-title');

const farmerModal = document.getElementById('farmer-modal');
const closeFarmerModal = document.getElementById('close-farmer-modal');
const haltToggle = document.getElementById('halt-irrigation-toggle');

let systemChartInstance = null;
let historyChartInstance = null;

// DOM Elements
const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-display');

if (userDisplay) userDisplay.textContent = `🛡️ ${user.name}`;

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'login.html';
  });
}



// Sidebar Navigation Logic
const navLinks = document.querySelectorAll('.sidebar-link');
const sections = document.querySelectorAll('.dashboard-section');

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    // If it's an internal link
    if (link.getAttribute('href').startsWith('#')) {
      e.preventDefault();
      const targetId = link.getAttribute('href').slice(1);
      
      // Update active state
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      const section = document.getElementById(targetId);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
});

function showMessage(text, isError = false) {
  Toastify({
    text: text,
    duration: 4000,
    gravity: "top",
    position: "right",
    style: {
      background: "#111111",
      color: "#fcfcfc",
      border: isError ? "1px solid var(--danger)" : "1px solid var(--text-main)",
      borderRadius: "0", // Sharp studio edges
      boxShadow: "0 25px 50px rgba(0, 0, 0, 0.6)",
      fontFamily: "var(--font-sans)",
      fontSize: "0.7rem",
      textTransform: "uppercase",
      letterSpacing: "2px",
      padding: "1.2rem 2.5rem",
      fontWeight: "700"
    }
  }).showToast();
}

// Global Settings Toggle
async function loadSettings() {
  try {
    const res = await fetch(`${API_URL}/admin/settings`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const settings = await res.json();
    haltToggle.checked = settings.isIrrigationHalted;
  } catch (err) {
    console.error('Failed to load settings', err);
  }
}

if (haltToggle) {
  haltToggle.addEventListener('change', async (e) => {
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isIrrigationHalted: e.target.checked })
      });
      if (res.ok) showMessage('Irrigation status updated globally.');
    } catch (err) {
      showMessage('Failed to update settings', true);
    }
  });
}

const sendBroadcastBtn = document.getElementById('send-broadcast-btn');
const broadcastInput = document.getElementById('broadcast-input');

if (sendBroadcastBtn && broadcastInput) {
  sendBroadcastBtn.addEventListener('click', async () => {
    const message = broadcastInput.value.trim();
    if (!message) return showMessage('Please enter a message.', true);

    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ broadcastMessage: message })
      });
      if (res.ok) {
        const originalText = sendBroadcastBtn.innerHTML;
        sendBroadcastBtn.innerHTML = 'PROTOCOLED ✓';
        sendBroadcastBtn.style.background = 'var(--success)';
        
        setTimeout(() => {
          sendBroadcastBtn.innerHTML = originalText;
          sendBroadcastBtn.style.background = '';
          broadcastInput.value = '';
        }, 2000);
        
        showMessage('Broadcast message sent successfully!');
      }
    } catch (err) {
      showMessage('Failed to send broadcast.', true);
    }
  });
}

// Fetch and Render Global Analytics
async function loadAnalytics() {
  try {
    // Also load weather for admin atmosphere
    loadAdminWeather();
    const res = await fetch(`${API_URL}/admin/analytics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    document.getElementById('stat-total-fields').textContent = data.totalFields;
    document.getElementById('stat-total-water').textContent = data.totalWaterApplied.toFixed(1);
    
    const effEl = document.getElementById('stat-system-efficiency');
    effEl.textContent = data.systemEfficiency + '%';
    if (data.systemEfficiency < 80 || data.systemEfficiency > 120) {
      effEl.style.color = 'var(--danger)';
    } else {
      effEl.style.color = 'var(--success)';
    }

    // Render Alerts
    if (data.alerts && data.alerts.length > 0) {
      alertsPanel.innerHTML = data.alerts.map(a => `<div class="alert danger" style="margin-bottom: 1rem;">${a}</div>`).join('');
    } else {
      alertsPanel.innerHTML = `<div class="alert info" style="margin-bottom: 1rem;">✅ System running smoothly. No critical alerts.</div>`;
    }

    // Render Chart
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

function renderHistoryChart(labels, actual, optimal) {
  setTimeout(() => {
    const canvas = document.getElementById('historyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (historyChartInstance) historyChartInstance.destroy();

    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    historyChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Actual Hydration', data: actual, borderColor: '#fcfcfc', backgroundColor: 'rgba(252, 252, 252, 0.05)', fill: true, tension: 0.2, borderWidth: 1.5, pointRadius: 0 },
          { label: 'Target', data: optimal, borderColor: '#808080', backgroundColor: 'transparent', fill: false, tension: 0.2, borderDash: [4, 4], borderWidth: 1, pointRadius: 0 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: 'var(--text-muted)', font: { size: 9 } } },
          x: { border: { display: false }, grid: { display: false }, ticks: { color: 'var(--text-muted)', font: { size: 9 } } }
        },
        plugins: { 
          legend: { position: 'top', align: 'end', labels: { color: 'var(--text-muted)', boxWidth: 10, font: { size: 10, family: 'Inter' } } }
        }
      }
    });
  }, 100);
}

function renderSystemChart(labels, data) {
  setTimeout(() => {
    const canvas = document.getElementById('systemChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (systemChartInstance) systemChartInstance.destroy();

    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    systemChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [{
          data: data.length ? data : [1],
          backgroundColor: ['#fcfcfc', '#808080', '#404040', '#202020', '#111111'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false }
        }
      }
    });
  }, 100);
}

// Fetch and Render Crops Configuration
async function loadCrops() {
  try {
    const res = await fetch(`${API_URL}/crops`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const crops = await res.json();
    
    const container = document.getElementById('crops-container');
    container.innerHTML = '';

    crops.forEach(crop => {
      const el = document.createElement('div');
      el.className = 'data-row';
      el.innerHTML = `
        <div class="data-cell" style="grid-column: span 6;">
          <div class="serif" style="font-size: 1.8rem;">${crop.name}</div>
          <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-top: 0.5rem;">
            Protocol Lifecycle: ${crop.stages.initial.days + crop.stages.growth.days + crop.stages.mid.days + crop.stages.late.days} Cycles Total
          </div>
        </div>
        <div class="data-cell" style="grid-column: span 6; display: flex; justify-content: flex-end; align-items: center; gap: 1.5rem;">
          <div style="text-align: right;">
            <div style="font-size: 0.6rem; color: var(--text-muted);">Threshold</div>
            <div class="serif" style="font-size: 1.2rem;">${crop.minMoisture}% - ${crop.maxMoisture}%</div>
          </div>
          <button class="btn edit-crop-btn" style="padding: 0.5rem 1rem; font-size: 0.6rem;">Edit</button>
          <button class="btn delete-crop-btn" style="padding: 0.5rem; font-size: 0.6rem; border-color: rgba(239,68,68,0.2); color: #ef4444;">Remove</button>
        </div>
      `;
      
      el.querySelector('.edit-crop-btn').addEventListener('click', () => openCropModal(crop));
      el.querySelector('.delete-crop-btn').addEventListener('click', () => deleteCrop(crop._id));
      container.appendChild(el);
    });
  } catch (err) {
    console.error('Failed to load crops', err);
  }
}

function openCropModal(crop = null) {
  if (crop) {
    cropModalTitle.textContent = 'Edit Crop Settings';
    document.getElementById('edit-crop-id').value = crop._id;
    document.getElementById('edit-crop-name').value = crop.name;
    document.getElementById('edit-crop-name').disabled = true;

    // Populate Stages
    document.getElementById('crop-init-days').value = crop.stages.initial.days;
    document.getElementById('crop-init-water').value = crop.stages.initial.water;
    document.getElementById('crop-growth-days').value = crop.stages.growth.days;
    document.getElementById('crop-growth-water').value = crop.stages.growth.water;
    document.getElementById('crop-mid-days').value = crop.stages.mid.days;
    document.getElementById('crop-mid-water').value = crop.stages.mid.water;
    document.getElementById('crop-late-days').value = crop.stages.late.days;
    document.getElementById('crop-late-water').value = crop.stages.late.water;

    document.getElementById('edit-crop-minM').value = crop.minMoisture;
    document.getElementById('edit-crop-maxM').value = crop.maxMoisture;
  } else {
    cropModalTitle.textContent = 'Add New Crop';
    document.getElementById('edit-crop-id').value = '';
    document.getElementById('edit-crop-name').value = '';
    document.getElementById('edit-crop-name').disabled = false;
    
    // Defaults
    document.getElementById('crop-init-days').value = 20;
    document.getElementById('crop-init-water').value = 5;
    document.getElementById('crop-growth-days').value = 30;
    document.getElementById('crop-growth-water').value = 8;
    document.getElementById('crop-mid-days').value = 40;
    document.getElementById('crop-mid-water').value = 12;
    document.getElementById('crop-late-days').value = 20;
    document.getElementById('crop-late-water').value = 6;

    document.getElementById('edit-crop-minM').value = 30;
    document.getElementById('edit-crop-maxM').value = 70;
  }
  
  cropModal.classList.remove('hidden');
}

addCropBtn.addEventListener('click', () => openCropModal(null));

closeCropModal.addEventListener('click', () => cropModal.classList.add('hidden'));

editCropForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-crop-id').value;
  const isNew = !id;
  
  const body = {
    name: document.getElementById('edit-crop-name').value,
    stages: {
      initial: { 
        days: Number(document.getElementById('crop-init-days').value), 
        water: Number(document.getElementById('crop-init-water').value) 
      },
      growth: { 
        days: Number(document.getElementById('crop-growth-days').value), 
        water: Number(document.getElementById('crop-growth-water').value) 
      },
      mid: { 
        days: Number(document.getElementById('crop-mid-days').value), 
        water: Number(document.getElementById('crop-mid-water').value) 
      },
      late: { 
        days: Number(document.getElementById('crop-late-days').value), 
        water: Number(document.getElementById('crop-late-water').value) 
      }
    },
    minMoisture: Number(document.getElementById('edit-crop-minM').value),
    maxMoisture: Number(document.getElementById('edit-crop-maxM').value),
  };

  try {
    const url = isNew ? `${API_URL}/crops` : `${API_URL}/crops/${id}`;
    const method = isNew ? 'POST' : 'PUT';
    
    const res = await fetch(url, {
      method,
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    
    if (res.ok) {
      showMessage(isNew ? 'Crop added successfully' : 'Crop updated successfully');
      cropModal.classList.add('hidden');
      loadCrops();
    } else {
      throw new Error('Failed to save crop');
    }
  } catch (err) {
    showMessage(err.message, true);
  }
});

async function deleteCrop(id) {
  if (!confirm('Are you sure you want to delete this crop? This might affect existing fields.')) return;
  try {
    const res = await fetch(`${API_URL}/crops/${id}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      showMessage('Crop deleted successfully');
      loadCrops();
    }
  } catch (err) {
    showMessage('Failed to delete crop', true);
  }
}

// Fetch and Render Farmers
async function loadFarmers() {
  try {
    const res = await fetch(`${API_URL}/admin/farmers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const farmers = await res.json();
    
    const container = document.getElementById('farmers-container');
    
    if (farmers.length === 0) {
      container.innerHTML = '<p>No farmers found.</p>';
      return;
    }

    container.innerHTML = '';
    farmers.forEach(farmer => {
      const scoreColor = farmer.efficiencyScore > 120 ? 'var(--danger)' : (farmer.efficiencyScore < 80 ? 'var(--warning)' : 'var(--success)');
      
      const el = document.createElement('div');
      el.className = 'data-row';
      el.innerHTML = `
        <div class="data-cell" style="grid-column: span 6;">
          <div class="serif" style="font-size: 1.8rem;">${farmer.name}</div>
          <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Resident Farmer / ID: ${farmer._id.slice(-6)}</div>
        </div>
        <div class="data-cell" style="grid-column: span 2;">
          <div style="font-size: 0.6rem; color: var(--text-muted);">Estates Managed</div>
          <div class="serif" style="font-size: 1.4rem;">${farmer.totalFields} <span style="font-size: 0.8rem; font-family: var(--font-sans); color: var(--text-muted);">Fields</span></div>
        </div>
        <div class="data-cell" style="grid-column: span 2;">
          <div style="font-size: 0.6rem; color: var(--text-muted);">Efficiency</div>
          <div class="serif" style="font-size: 1.4rem; color: ${scoreColor}">${farmer.efficiencyScore}%</div>
        </div>
        <div class="data-cell" style="grid-column: span 2; display: flex; justify-content: flex-end; align-items: center; gap: 1rem;">
          <button class="btn view-btn" style="padding: 0.5rem 1rem; font-size: 0.6rem;">Explore</button>
          <button class="btn delete-farmer-btn" style="padding: 0.5rem; font-size: 0.6rem; border-color: rgba(239,68,68,0.2); color: #ef4444;">Erase</button>
        </div>
      `;
      
      el.querySelector('.view-btn').addEventListener('click', () => {
        window.location.href = `farmer.html?userId=${farmer._id}`;
      });
      
      el.querySelector('.delete-farmer-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFarmer(farmer._id);
      });
      
      container.appendChild(el);
    });
  } catch (err) {
    console.error('Failed to load farmers', err);
  }
}

async function deleteFarmer(id) {
  if (!confirm('Are you sure you want to completely delete this farmer and ALL their associated fields and data? This action cannot be undone.')) return;
  try {
    const res = await fetch(`${API_URL}/admin/farmers/${id}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      showMessage('Farmer and associated data deleted.');
      loadFarmers();
      loadAnalytics(); // update global stats
    }
  } catch (err) {
    showMessage('Failed to delete farmer', true);
  }
}

async function openFarmerModal(farmerId, farmerName) {
  document.getElementById('farmer-modal-title').textContent = `Fields Managed by ${farmerName}`;
  const container = document.getElementById('farmer-fields-container');
  container.innerHTML = '<p>Loading fields...</p>';
  farmerModal.classList.remove('hidden');

  try {
    const res = await fetch(`${API_URL}/admin/farmers/${farmerId}/fields`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const fields = await res.json();
    
    if (fields.length === 0) {
      container.innerHTML = '<p>No fields found for this farmer.</p>';
      return;
    }
    
    container.innerHTML = '';
    fields.forEach(f => {
      const scoreColor = f.efficiencyScore > 120 ? 'var(--danger)' : (f.efficiencyScore < 80 ? 'var(--warning)' : 'var(--success)');
      
      const el = document.createElement('div');
      el.style = 'background: rgba(255,255,255,0.05); border: 1px solid var(--card-border); padding: 0.8rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
      el.innerHTML = `
        <div>
          <div style="font-weight: 600">${f.name}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted)">Crop: ${f.crop} | Soil Moisture: ${f.soilMoisture || 60}%</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.7rem; color: var(--text-muted)">Field Efficiency</div>
          <div style="font-weight: 800; color: ${scoreColor}">${f.efficiencyScore}%</div>
        </div>
        <button class="btn delete-field-btn" data-id="${f._id}" style="padding: 0.4rem 0.6rem; font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); color: var(--danger); margin-left: 1rem;">
          <span style="color:var(--danger)">🗑️</span>
        </button>
      `;
      
      el.querySelector('.delete-field-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteField(f._id, farmerId, farmerName);
      });

      container.appendChild(el);
    });
    
  } catch (err) {
    container.innerHTML = '<p class="alert danger">Failed to load fields.</p>';
  }
}

async function deleteField(fieldId, farmerId, farmerName) {
  if (!confirm('Are you sure you want to delete this specific field? This will remove all its irrigation history.')) return;
  try {
    const res = await fetch(`${API_URL}/admin/fields/${fieldId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      showMessage('Field deleted successfully.');
      openFarmerModal(farmerId, farmerName); // Refresh modal
      loadAnalytics(); // Refresh global stats
    }
  } catch (err) {
    showMessage('Failed to delete field', true);
  }
}

closeFarmerModal.addEventListener('click', () => farmerModal.classList.add('hidden'));

// Fetch and Render Activity Feed
async function loadActivity() {
  try {
    const res = await fetch(`${API_URL}/admin/activity`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    const container = document.getElementById('activity-container');
    const summaryEl = document.getElementById('activity-summary');

    // Render summary badges
    const s = data.summary;
    summaryEl.innerHTML = `
      <span style="background: rgba(16, 185, 129, 0.15); color: var(--success); padding: 0.3rem 0.6rem; border-radius: 6px; font-weight: 700;">✅ ${s.efficientCount} Efficient</span>
      <span style="background: rgba(239, 68, 68, 0.15); color: var(--danger); padding: 0.3rem 0.6rem; border-radius: 6px; font-weight: 700;">🚨 ${s.wastefulCount} Wasteful</span>
      <span style="background: rgba(245, 158, 11, 0.15); color: var(--warning); padding: 0.3rem 0.6rem; border-radius: 6px; font-weight: 700;">💧 ${s.totalWasted}L Wasted</span>
    `;

    if (data.activity.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted);">No irrigation activity recorded yet.</p>';
      return;
    }

    container.innerHTML = '';
    data.activity.forEach(event => {
      const timeAgo = getTimeAgo(new Date(event.date));
      const diffColor = event.waterDiff > 0 ? 'var(--danger)' : (event.waterDiff < 0 ? 'var(--success)' : 'var(--text-muted)');
      const diffSign = event.waterDiff > 0 ? '+' : '';
      const statusColor = event.status === 'wasteful' ? 'var(--danger)' : (event.status === 'under' ? 'var(--warning)' : 'var(--success)');

      const el = document.createElement('div');
      el.className = 'data-row';
      el.innerHTML = `
        <div class="data-cell" style="grid-column: span 5;">
          <div class="serif" style="font-size: 1.5rem;">${event.fieldName}</div>
          <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">${event.cropName} / ${timeAgo}</div>
        </div>
        <div class="data-cell" style="grid-column: span 2;">
          <div style="font-size: 0.6rem; color: var(--text-muted);">Applied</div>
          <div class="serif" style="font-size: 1.2rem;">${event.amountApplied}L</div>
        </div>
        <div class="data-cell" style="grid-column: span 2;">
          <div style="font-size: 0.6rem; color: var(--text-muted);">Optimal</div>
          <div class="serif" style="font-size: 1.2rem;">${event.optimalAmount}L</div>
        </div>
        <div class="data-cell" style="grid-column: span 2;">
          <div style="font-size: 0.6rem; color: var(--text-muted);">Variance</div>
          <div class="serif" style="font-size: 1.2rem; color: ${diffColor};">${diffSign}${event.waterDiff}L</div>
        </div>
        <div class="data-cell" style="grid-column: span 1; display: flex; justify-content: flex-end; align-items: center;">
          <button class="btn delete-log-btn" style="padding: 0.5rem; font-size: 0.6rem; border-color: rgba(239,68,68,0.2); color: #ef4444;">Erase</button>
        </div>
      `;

      el.querySelector('.delete-log-btn').addEventListener('click', () => deleteLog(event._id));
      container.appendChild(el);
    });

    // Fire admin alert toast if there are wasteful events
    if (s.wastefulCount > 0) {
      Toastify({
        text: `⚠️ ${s.wastefulCount} wasteful irrigation event(s) detected! ${s.totalWasted}L wasted.`,
        duration: 5000,
        gravity: "top",
        position: "center",
        style: {
          background: "linear-gradient(135deg, #ef4444, #dc2626)",
          borderRadius: "12px",
          boxShadow: "0 15px 35px rgba(0, 0, 0, 0.4)",
          fontWeight: "700",
          padding: "1rem 1.5rem"
        }
      }).showToast();
    }

  } catch (err) {
    console.error('Failed to load activity', err);
  }
}

async function deleteLog(logId) {
  if (!confirm('Are you sure you want to delete this irrigation record? This will affect the analytics data.')) return;
  try {
    const res = await fetch(`${API_URL}/admin/logs/${logId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      showMessage('Irrigation log removed.');
      loadActivity(); // Refresh list
      loadAnalytics(); // Refresh charts
    }
  } catch (err) {
    showMessage('Failed to delete log', true);
  }
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Init App
async function init() {
  await loadSettings();
  await loadAnalytics();
  await loadActivity();
  await loadCrops();
  await loadFarmers();
}

async function loadAdminWeather() {
  try {
    const res = await fetch(`${API_URL}/weather?location=London`); // Default or dynamic
    const data = await res.json();
    if (data.current) {
      document.getElementById('weather-temp').textContent = `${Math.round(data.current.temp)}°`;
      document.getElementById('weather-desc').textContent = data.current.condition;
      document.getElementById('weather-city').textContent = 'Global Station Alpha';
    }
  } catch (err) {
    console.error('Weather load failed', err);
  }
}

init();
