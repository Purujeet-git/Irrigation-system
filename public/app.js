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
        const chartLabels = [];
        const actualData = [];
        const optimalData = [];
        
        // Cache-busting: Add timestamp to prevent stale data
        const res = await fetch(`${API_URL}/fields/${fieldId}/stats?t=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const logs = data.logs || [];

        // Fetch field details for depletion calculation (crop and temp)
        const fieldRes = await fetch(`${API_URL}/fields`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const fields = await fieldRes.json();
        const field = fields.find(f => f._id === fieldId);
        
        if (!field) return;

        const crop = field.cropId || { stages: null };
        const stageInfo = getLifeCycleStage(field.plantingDate, crop.stages);
        const dailyRequirement = stageInfo.water * field.area; // Total liters per day
        const hourlyDepletion = dailyRequirement / 24;
        
        // Temperature Multiplier: 1.0 at 25°C, increases by 10% for every 5°C above
        const tempMultiplier = 1 + (Math.max(0, field.temperature - 25) * 0.02);

        logs.forEach((log, index) => {
            const date = new Date(log.date);
            const label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Normalized Percentage Calculation
            const hydrationPeak = (log.actual / log.optimal) * 100;
            
            // 1. Add the point where irrigation happened (peak)
            chartLabels.push(label);
            actualData.push(Math.round(hydrationPeak));
            optimalData.push(100); // Target is always 100% of optimal

            // 2. Add a depletion point just before the next log (or "Now")
            const nextDate = logs[index + 1] ? new Date(logs[index + 1].date) : new Date();
            const hoursPassed = (nextDate - date) / (1000 * 60 * 60);
            
            // Visual Boost: Make depletion more visible by increasing sensitivity if it's too subtle
            const totalDepletion = (hourlyDepletion * hoursPassed * tempMultiplier);
            const levelBeforeNext = Math.max(0, log.actual - totalDepletion);
            const hydrationBeforeNext = (levelBeforeNext / log.optimal) * 100;
            
            const nextLabel = logs[index + 1] 
                ? new Date(nextDate.getTime() - 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                : 'Now';
            
            chartLabels.push(nextLabel);
            actualData.push(Math.round(hydrationBeforeNext));
            optimalData.push(100);
        });

        const ctx = document.getElementById(`chart-${fieldId}`).getContext('2d');
        if (chartInstances[fieldId]) chartInstances[fieldId].destroy();

        // Theme-aware colors
        const isLight = document.body.classList.contains('light-mode');
        const textColor = isLight ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)';
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
        const mutedTextColor = isLight ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.3)';

        // Check if user wants "Protocol Only" (Optimal) view
        const isProtocolView = document.getElementById(`toggle-${fieldId}`)?.getAttribute('data-view') === 'optimal';

        const actualDataset = {
            label: 'Hydration Level (%)',
            data: actualData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: (ctx) => ctx.dataIndex % 2 === 0 ? 3 : 0, 
            hidden: isProtocolView
        };

        const optimalDataset = {
            label: 'Target Protocol (100%)',
            data: optimalData,
            borderColor: '#10b981',
            borderDash: [5, 5],
            backgroundColor: 'transparent',
            fill: false,
            tension: 0,
            pointRadius: 0,
            hidden: !isProtocolView && logs.length > 0 
        };

        chartInstances[fieldId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: isProtocolView ? [optimalDataset] : [actualDataset, optimalDataset]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 800, easing: 'easeOutQuart' },
                plugins: { 
                    legend: { 
                        display: true,
                        labels: { color: textColor, font: { size: 10, family: 'Inter' }, boxWidth: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const logIndex = Math.floor(context.dataIndex / 2);
                                const isPeak = context.dataIndex % 2 === 0;
                                const log = logs[logIndex];
                                if (!log) return `${context.dataset.label}: ${context.raw}%`;
                                
                                // Show % and the underlying Liter value for clarity
                                if (context.datasetIndex === 0) { // Actual
                                    const liters = isPeak ? log.actual : Math.round((context.raw / 100) * log.optimal);
                                    return `Hydration: ${context.raw}% (${liters} Liters)`;
                                } else { // Optimal
                                    return `Target: 100% (${log.optimal} Liters)`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        max: 120, // Give some headroom above 100%
                        grid: { color: gridColor },
                        ticks: { 
                            color: textColor, 
                            font: { size: 9 },
                            callback: (value) => `${value}%`
                        },
                        title: { display: true, text: 'Hydration Level', color: mutedTextColor, font: { size: 10 } }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: textColor, font: { size: 9 } }
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
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <span class="label">${crop.name}</span>
                            <h3>${field.name}</h3>
                            <p style="font-size: 0.8rem; color: var(--text-muted);">${field.location} — ${field.area}m²</p>
                        </div>
                        <button id="toggle-${field._id}" class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.55rem; border-color: rgba(255,255,255,0.1); text-transform: uppercase; letter-spacing: 1px;" data-view="actual">
                            Protocol View
                        </button>
                    </div>
                    <div style="margin-top: 2rem; display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary irrigate-btn" style="padding: 0.6rem 1rem; font-size: 0.6rem;">Irrigate Now</button>
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

            // Toggle logic
            card.querySelector(`#toggle-${field._id}`).addEventListener('click', (e) => {
                const btn = e.target;
                const isActual = btn.getAttribute('data-view') === 'actual';
                btn.setAttribute('data-view', isActual ? 'optimal' : 'actual');
                btn.textContent = isActual ? 'Show Actual' : 'Protocol View';
                renderFieldChart(field._id);
            });

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

// Listen for theme changes to refresh charts
document.addEventListener('themeChanged', () => {
    const charts = document.querySelectorAll('canvas[id^="chart-"]');
    charts.forEach(canvas => {
        const fieldId = canvas.id.replace('chart-', '');
        renderFieldChart(fieldId);
    });
});

// Init
async function init() {
    renderNotifications();
    await registerServiceWorker();
    await loadCrops();
    await loadFields();
    pollSystemSettings();
}

init();
