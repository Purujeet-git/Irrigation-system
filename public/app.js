const API_URL = '/api';
const VAPID_PUBLIC_KEY = 'BD8Gv1e58G4JKegQ1c4SAKCrK_Nn1wzB_eDFPRTcJp5JKWKcNnBMbrxG9XLjW3htPUz3mVfRQ2RXGcJ7pRDT9dE';

// Auth Check
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
    window.location.href = 'login.html';
} else if (user.role === 'Admin' && !window.location.pathname.includes('admin.html') && !window.location.search.includes('userId')) {
    window.location.href = 'admin.html';
} else if (user.role === 'Farmer' && !window.location.pathname.includes('farmer.html')) {
    window.location.href = 'farmer.html';
}

// DOM Elements

const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-display');
const fieldsContainer = document.getElementById('fields-container');
const addFieldBtn = document.getElementById('add-field-btn');
const fieldModal = document.getElementById('field-modal');
const closeModal = document.getElementById('close-modal');
const addFieldForm = document.getElementById('add-field-form');

let chartInstances = {};
let timerIntervals = {};
let notifications = JSON.parse(localStorage.getItem('notifications')) || [];
let lastBroadcastMessage = localStorage.getItem('lastBroadcastMessage') || '';

// Admin "View As" detection
const urlParams = new URLSearchParams(window.location.search);
const viewAsUserId = urlParams.get('userId');

if (userDisplay) {
    if (viewAsUserId && user.role === 'Admin') {
        userDisplay.innerHTML = `<span style="color: var(--danger); font-weight: 800;">[VIEWING]</span> Farmer Profile`;
        const addBtn = document.getElementById('add-field-btn');
        if (addBtn) addBtn.style.display = 'none';
    } else {
        userDisplay.textContent = `${user.name} / ${user.role}`;
    }
}

logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'login.html';
});



// Toast Notification
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
            borderRadius: "0",
            boxShadow: "0 25px 50px rgba(0, 0, 0, 0.6)",
            fontFamily: "var(--font-sans)",
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "2px",
            padding: "1.2rem 2.5rem",
            fontWeight: "700"
        }
    }).showToast();
}

// ========== TIMER LOGIC ==========

function startTimer(fieldId, lastUpdated) {
    if (timerIntervals[fieldId]) clearInterval(timerIntervals[fieldId]);

    const timerElement = document.getElementById(`timer-${fieldId}`);
    if (!timerElement) return;

    const nextIrrigation = new Date(lastUpdated).getTime() + (24 * 60 * 60 * 1000); // 24 hours later

    const update = () => {
        const now = new Date().getTime();
        const distance = nextIrrigation - now;

        if (distance < 0) {
            timerElement.textContent = "DUE NOW 💧";
            timerElement.style.color = "#ef4444";
            
            // Add automated notification
            const fieldName = document.querySelector(`#timer-${fieldId}`).closest('.field-card').querySelector('h3').textContent;
            addNotification('⏰ Irrigation Due', `${fieldName} needs attention immediately!`, 'alert');
            return;
        }

        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        timerElement.textContent = `${hours}h ${minutes}m ${seconds}s`;
    };

    update();
    timerIntervals[fieldId] = setInterval(update, 1000);
}

// ========== CHART LOGIC ==========

async function renderFieldChart(fieldId) {
    try {
        const res = await fetch(`${API_URL}/fields/${fieldId}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const logs = data.logs || [];

        const ctx = document.getElementById(`chart-${fieldId}`).getContext('2d');
        
        if (chartInstances[fieldId]) chartInstances[fieldId].destroy();

        const chartLabels = logs.slice(-10).map(l => new Date(l.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        const chartData = logs.slice(-10).map(l => l.actual);

        // Simulation: If we have at least one irrigation, add a "Projected Now" point
        // This creates the "depleting" line effect by calculating moisture loss over time
        if (logs.length > 0) {
            const lastLog = logs[logs.length - 1];
            const now = new Date();
            const hoursPassed = (now - new Date(lastLog.date)) / (1000 * 60 * 60);
            
            // We simulate a 4% drop per hour (approx 100% to 0% in 24h)
            const depletionFactor = Math.max(0.1, 1 - (hoursPassed * 0.04));
            const currentSimulatedLevel = lastLog.actual * depletionFactor;

            chartLabels.push('Now');
            chartData.push(Math.round(currentSimulatedLevel));
        }

        chartInstances[fieldId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Moisture Level (L/m²)',
                    data: chartData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: (ctx) => ctx.dataIndex === chartData.length - 1 ? 4 : 2,
                    pointBackgroundColor: (ctx) => ctx.dataIndex === chartData.length - 1 ? '#ef4444' : '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Level: ${context.raw} L`
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.5)' }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: 'rgba(255,255,255,0.5)' }
                    }
                }
            }
        });
    } catch (err) {
        console.error("Chart Error:", err);
    }
}

// ========== LIFE CYCLE LOGIC ==========

function getLifeCycleStage(plantingDate, cropStages) {
    if (!cropStages) return { name: 'Unknown', water: 0 };
    
    // Default to today if plantingDate is missing (for legacy data)
    const pDate = plantingDate ? new Date(plantingDate) : new Date();
    const daysSincePlanting = Math.max(0, Math.floor((new Date() - pDate) / (1000 * 60 * 60 * 24)));
    const s = cropStages;
    
    if (daysSincePlanting <= s.initial.days) {
        return { name: 'Initial Stage', water: s.initial.water, day: daysSincePlanting };
    } else if (daysSincePlanting <= (s.initial.days + s.growth.days)) {
        return { name: 'Growth Stage', water: s.growth.water, day: daysSincePlanting };
    } else if (daysSincePlanting <= (s.initial.days + s.growth.days + s.mid.days)) {
        return { name: 'Mid Stage', water: s.mid.water, day: daysSincePlanting };
    } else if (daysSincePlanting <= (s.initial.days + s.growth.days + s.mid.days + s.late.days)) {
        return { name: 'Late Stage', water: s.late.water, day: daysSincePlanting };
    } else {
        return { name: 'Harvest Ready', water: 0, day: daysSincePlanting };
    }
}

// ========== LOAD & RENDER ==========

// ========== NOTIFICATION LOGIC ==========

function renderNotifications() {
    const list = document.getElementById('notification-list');
    if (!list) return;

    if (notifications.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center;">No new alerts.</p>';
        return;
    }

    list.innerHTML = '';
    notifications.slice().reverse().forEach((note, index) => {
        const item = document.createElement('div');
        item.style.cssText = `
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid ${note.type === 'alert' ? 'var(--danger)' : 'var(--card-border)'};
            padding: 1rem;
            border-radius: 0;
            position: relative;
            animation: slideIn 0.3s ease;
            margin-bottom: 0.8rem;
        `;
        
        item.innerHTML = `
            <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 0.2rem;">${note.title}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${note.message}</div>
            <button onclick="dismissNotification(${notifications.length - 1 - index})" style="position: absolute; top: 5px; right: 5px; background: none; border: none; color: var(--text-muted); cursor: pointer;">&times;</button>
        `;
        list.appendChild(item);
    });
}

function addNotification(title, message, type = 'info') {
    // Prevent duplicate automated alerts for the same field
    if (notifications.some(n => n.message === message)) return;

    notifications.push({ title, message, type, date: new Date() });
    localStorage.setItem('notifications', JSON.stringify(notifications));
    renderNotifications();
}

window.dismissNotification = (index) => {
    notifications.splice(index, 1);
    localStorage.setItem('notifications', JSON.stringify(notifications));
    renderNotifications();
};

const clearBtn = document.getElementById('clear-notifications');
if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        notifications = [];
        localStorage.setItem('notifications', JSON.stringify(notifications));
        renderNotifications();
    });
}

async function checkSystemBroadcast() {
    try {
        const res = await fetch(`${API_URL}/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const settings = await res.json();
        
        if (settings && settings.broadcastMessage && settings.broadcastMessage !== lastBroadcastMessage) {
            addNotification('📢 Admin Announcement', settings.broadcastMessage, 'info');
            lastBroadcastMessage = settings.broadcastMessage;
            localStorage.setItem('lastBroadcastMessage', lastBroadcastMessage);
        }
    } catch (err) {
        console.error("Broadcast Check Error:", err);
    }
}

// ========== PUSH NOTIFICATIONS ==========

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);
            return registration;
        } catch (err) {
            console.error('Service Worker registration failed:', err);
        }
    }
}

async function subscribeUser() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
        const registration = await navigator.serviceWorker.ready;
        
        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
            
            // Send subscription to backend
            await fetch(`${API_URL}/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(subscription)
            });
            console.log('User subscribed to push notifications');
        }
    } catch (err) {
        console.error('Push subscription failed:', err);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function loadCrops() {
    const select = document.getElementById('field-crop');
    try {
        const res = await fetch(`${API_URL}/crops`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const crops = await res.json();
        select.innerHTML = '<option value="" style=color:black;>Select a crop</option>';
        crops.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c._id;
            // Show total life cycle length as a hint
            const totalDays = c.stages ? (c.stages.initial.days + c.stages.growth.days + c.stages.mid.days + c.stages.late.days) : 0;
            opt.textContent = `${c.name} (~${totalDays} Days Cycle)`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error(err);
    }
}

async function loadFields() {
    try {
        let url = `${API_URL}/fields`;
        if (viewAsUserId && user.role === 'Admin') {
            url += `?userId=${viewAsUserId}`;
        }

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const fields = await res.json();
        
        fieldsContainer.innerHTML = '';
        
        if (fields.length === 0) {
            fieldsContainer.innerHTML = '<div class="glass-card">No fields found. Add one to get started!</div>';
            return;
        }

        fields.forEach(field => {
            const crop = field.cropId || { name: 'Unknown', stages: null };
            const stageInfo = getLifeCycleStage(field.plantingDate, crop.stages);
            const suggestedWater = (stageInfo.water * field.area).toFixed(1);

            const card = document.createElement('div');
            card.className = 'glass-card field-card';
            card.className = 'field-card fade-in';
            card.innerHTML = `
                <div class="field-meta">
                    <span class="label">${crop.name}</span>
                    <h3>${field.name}</h3>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">${field.location} — ${field.area}m²</p>
                    <div style="margin-top: 2rem; display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary irrigate-btn" style="padding: 0.6rem 1rem; font-size: 0.6rem;">Irrigated Now</button>
                        <button class="btn delete-btn" style="padding: 0.6rem; font-size: 0.6rem; border-color: rgba(239,68,68,0.2); color: #ef4444;">Remove</button>
                    </div>
                </div>

                <div class="field-stats">
                    <div class="stat-box">
                        <div class="stat-label">Soil Moisture</div>
                        <div class="stat-value">${Math.round(field.soilMoisture)}%</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Next Irrigation</div>
                        <div id="timer-${field._id}" class="stat-value" style="font-size: 1.2rem; font-family: var(--font-sans); font-weight: 600;">--:--:--</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Current Stage</div>
                        <div class="stat-value" style="font-size: 1rem;">${stageInfo.name} (Day ${stageInfo.day})</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Target Volume</div>
                        <div class="stat-value" style="font-size: 1.2rem;">${suggestedWater} Liters</div>
                    </div>
                </div>

                <div class="field-graph">
                    <canvas id="chart-${field._id}"></canvas>
                </div>
            `;

            fieldsContainer.appendChild(card);

            // Initialize Timer & Chart
            startTimer(field._id, field.lastUpdated);
            renderFieldChart(field._id);

            // Irrigation logic
            card.querySelector('.irrigate-btn').addEventListener('click', async (e) => {
                const btn = e.target;
                btn.disabled = true;
                btn.textContent = 'Irrigating...';
                
                try {
                    const iRes = await fetch(`${API_URL}/fields/${field._id}/irrigate`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (iRes.ok) {
                        showMessage('Irrigation logged successfully!');
                        loadFields(); // Refresh all
                    }
                } catch (err) {
                    showMessage('Failed to log irrigation', true);
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Irrigated Now';
                }
            });

            // Delete logic
            card.querySelector('.delete-btn').addEventListener('click', async () => {
                if (!confirm('Delete this field?')) return;
                try {
                    await fetch(`${API_URL}/fields/${field._id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    showMessage('Field deleted');
                    loadFields();
                } catch (err) {
                    showMessage('Delete failed', true);
                }
            });
        });
    } catch (err) {
        console.error(err);
        fieldsContainer.innerHTML = '<div class="alert danger">Failed to load fields.</div>';
    }
}

// ========== ADD FIELD MODAL ==========

addFieldBtn.addEventListener('click', (e) => {
    e.preventDefault();
    fieldModal.classList.remove('hidden');
    loadCropsSelect();
});
closeModal.addEventListener('click', () => fieldModal.classList.add('hidden'));

addFieldForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('field-name').value;
    const location = document.getElementById('field-location').value;
    const area = document.getElementById('field-area').value;
    const cropId = document.getElementById('field-crop').value;
    const plantingDateEl = document.getElementById('field-planting-date');
    const plantingDate = plantingDateEl ? plantingDateEl.value : new Date().toISOString().split('T')[0];

    try {
        const res = await fetch(`${API_URL}/fields`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, location, area: Number(area), cropId, plantingDate })
        });

        if (res.ok) {
            showMessage('Field added successfully!');
            fieldModal.classList.add('hidden');
            addFieldForm.reset();
            loadFields();
        } else {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to save field');
        }
    } catch (err) {
        console.error("Save Field Error:", err);
        showMessage(err.message, true);
    }
});

// ========== INIT ==========

// ========== POLLING LOGIC (REAL-TIME BROADCAST) ==========

async function pollSystemSettings() {
    try {
        const res = await fetch(`${API_URL}/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const settings = await res.json();
        
        if (settings.broadcastMessage && settings.broadcastMessage !== lastBroadcastMessage) {
            lastBroadcastMessage = settings.broadcastMessage;
            localStorage.setItem('lastBroadcastMessage', lastBroadcastMessage);
            
            // Show high-impact studio notification
            addNotification('SYSTEM PROTOCOL', lastBroadcastMessage, 'alert');
            showMessage('New System Protocol Received');
        }
    } catch (err) {
        console.error('Polling error:', err);
    }
}

// Start polling every 5 seconds
setInterval(pollSystemSettings, 5000);

// Init
async function init() {
    renderNotifications();
    await registerServiceWorker();
    await loadCrops();
    await loadFields();
    pollSystemSettings();
}

init();
