/**
 * Geyser Settings Module
 * Controls geyser automation settings and inverter configuration
 */

import { loadModal } from './template-loader.js';
import { state } from './state.js';

// ============================================
// MODAL FUNCTIONS
// ============================================

/**
 * Open the geyser settings modal
 */
export async function openGeyserSettingsModal() {
    // Ensure modal is loaded
    await loadModal('geyserSettings');

    const modal = document.getElementById('geyserSettingsModal');
    if (!modal) {
        console.error('Geyser settings modal not found');
        return;
    }

    // Populate current values
    await populateModalData();

    // Setup event listeners
    setupEventListeners();

    // Show modal
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
}

/**
 * Close the geyser settings modal
 */
export function closeGeyserSettingsModal() {
    const modal = document.getElementById('geyserSettingsModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }
}

// ============================================
// DATA POPULATION
// ============================================

/**
 * Populate modal with current data from HA states
 */
async function populateModalData() {
    // Geyser temperature
    const geyserTemp = parseFloat(state.getEntityState('input_number.geyser_last_temp')) || 45;
    const geyserTempEl = document.getElementById('geyserModalTemp');
    if (geyserTempEl) {
        geyserTempEl.textContent = geyserTemp.toFixed(0);
    }

    // Temperature status
    const tempStatusEl = document.getElementById('geyserTempStatus');
    if (tempStatusEl) {
        if (geyserTemp >= 55) {
            tempStatusEl.textContent = 'Ready - hot water available';
            tempStatusEl.classList.add('text-emerald-400');
        } else if (geyserTemp >= 40) {
            tempStatusEl.textContent = 'Warm - suitable for showering';
            tempStatusEl.classList.add('text-amber-400');
        } else {
            tempStatusEl.textContent = 'Cold - needs heating';
            tempStatusEl.classList.add('text-red-400');
        }
    }

    // Geyser runtime
    const geyserRuntime = parseFloat(state.getEntityState('input_number.geyser_runtime_minutes_today')) || 0;
    const runtimeEl = document.getElementById('geyserModalRuntime');
    if (runtimeEl) {
        runtimeEl.textContent = (geyserRuntime / 60).toFixed(1);
    }

    // Battery
    const battery = parseFloat(state.getEntityState('sensor.inverter_battery')) || 0;
    const batteryEl = document.getElementById('geyserModalBattery');
    if (batteryEl) {
        batteryEl.textContent = battery.toFixed(0);
    }

    // Battery status
    const batteryStatusEl = document.getElementById('geyserBatteryStatus');
    if (batteryStatusEl) {
        if (battery >= 70) {
            batteryStatusEl.textContent = 'Healthy - good for solar loads';
            batteryStatusEl.classList.remove('text-red-400', 'text-amber-400');
            batteryStatusEl.classList.add('text-emerald-400');
        } else if (battery >= 40) {
            batteryStatusEl.textContent = 'Moderate - conserve if cloudy';
            batteryStatusEl.classList.remove('text-red-400', 'text-emerald-400');
            batteryStatusEl.classList.add('text-amber-400');
        } else {
            batteryStatusEl.textContent = 'Low - avoid heavy loads';
            batteryStatusEl.classList.remove('text-emerald-400', 'text-amber-400');
            batteryStatusEl.classList.add('text-red-400');
        }
    }

    // Inverter connection status
    updateInverterConnectionStatus();

    // Grid charging status
    const gridCharging = state.getEntityState('switch.inverter_battery_grid_charging');
    const gridToggle = document.getElementById('gridChargingToggle');
    if (gridToggle) {
        const isOn = gridCharging === 'on';
        gridToggle.dataset.state = isOn ? 'on' : 'off';
        updateToggleVisual(gridToggle, isOn);
    }

    // Battery floor value
    const batteryLowSoc = parseFloat(state.getEntityState('number.inverter_battery_low_soc')) || 30;
    const floorSlider = document.getElementById('batteryFloorSlider');
    const floorValue = document.getElementById('batteryFloorValue');
    if (floorSlider) floorSlider.value = batteryLowSoc;
    if (floorValue) floorValue.textContent = batteryLowSoc;

    // Last update time
    const lastUpdateEl = document.getElementById('geyserLastUpdate');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    }

    // Load weather forecast
    loadWeatherForecast();
}

/**
 * Update inverter connection status indicator
 */
function updateInverterConnectionStatus() {
    const statusEl = document.getElementById('inverterConnectionStatus');
    if (!statusEl) return;

    const connection = state.getEntityState('binary_sensor.inverter_connection');

    if (connection === 'on') {
        statusEl.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="text-xs text-emerald-400">Connected</span>
        `;
    } else if (connection === 'off') {
        statusEl.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-red-400"></span>
            <span class="text-xs text-red-400">Offline</span>
        `;
    } else {
        statusEl.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
            <span class="text-xs text-white/50">Unknown</span>
        `;
    }
}

/**
 * Load 7-day weather forecast
 */
async function loadWeatherForecast() {
    const container = document.getElementById('forecastContainer');
    if (!container) return;

    try {
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-26.1076&longitude=28.0567&daily=temperature_2m_max,sunshine_duration,cloud_cover_mean&timezone=Africa/Johannesburg&forecast_days=7');
        const data = await response.json();

        if (data.daily) {
            const html = data.daily.time.map((date, i) => {
                const sunHours = (data.daily.sunshine_duration[i] / 3600).toFixed(1);
                const cloud = data.daily.cloud_cover_mean[i];
                const temp = data.daily.temperature_2m_max[i];
                const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });

                // Solar rating
                let solarColor, solarBg;
                if (sunHours > 10) {
                    solarColor = 'text-emerald-400';
                    solarBg = 'bg-emerald-500/20';
                } else if (sunHours > 7) {
                    solarColor = 'text-amber-400';
                    solarBg = 'bg-amber-500/20';
                } else {
                    solarColor = 'text-red-400';
                    solarBg = 'bg-red-500/20';
                }

                return `
                    <div class="flex flex-col items-center gap-1 p-2 rounded-lg ${solarBg}">
                        <div class="text-[10px] text-white/50">${dayName}</div>
                        <div class="text-lg font-light ${solarColor}">${sunHours}</div>
                        <div class="text-[9px] text-white/30">hrs sun</div>
                        <div class="text-xs text-white/40">${temp.toFixed(0)}°</div>
                    </div>
                `;
            }).join('');

            container.innerHTML = `<div class="grid grid-cols-7 gap-2 text-center">${html}</div>`;
        }
    } catch (e) {
        console.error('Failed to load forecast:', e);
        container.innerHTML = '<div class="text-xs text-white/40 text-center">Failed to load forecast</div>';
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

/**
 * Setup all event listeners for the modal
 */
function setupEventListeners() {
    // Battery floor slider
    const floorSlider = document.getElementById('batteryFloorSlider');
    const floorValue = document.getElementById('batteryFloorValue');
    if (floorSlider && floorValue) {
        floorSlider.addEventListener('input', () => {
            floorValue.textContent = floorSlider.value;
        });
    }

    // Geyser target temp slider
    const tempSlider = document.getElementById('geyserTargetTempSlider');
    const tempValue = document.getElementById('geyserTargetTempValue');
    if (tempSlider && tempValue) {
        tempSlider.addEventListener('input', () => {
            tempValue.textContent = tempSlider.value;
        });
    }

    // Grid charging toggle
    const gridToggle = document.getElementById('gridChargingToggle');
    if (gridToggle) {
        gridToggle.addEventListener('click', () => {
            const currentState = gridToggle.dataset.state;
            const newState = currentState === 'on' ? 'off' : 'on';
            gridToggle.dataset.state = newState;
            updateToggleVisual(gridToggle, newState === 'on');
        });
    }

    // Solar only button
    const solarOnlyBtn = document.getElementById('solarOnlyBtn');
    if (solarOnlyBtn) {
        solarOnlyBtn.addEventListener('click', applySolarOnlyMode);
    }

    // Apply floor button
    const applyFloorBtn = document.getElementById('applyFloorBtn');
    if (applyFloorBtn) {
        applyFloorBtn.addEventListener('click', applyBatteryFloor);
    }

    // Refresh forecast button
    const refreshBtn = document.getElementById('refreshForecastBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.classList.add('animate-spin');
            loadWeatherForecast().then(() => {
                setTimeout(() => refreshBtn.classList.remove('animate-spin'), 500);
            });
        });
    }

    // Save button
    const saveBtn = document.getElementById('saveGeyserSettingsBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveAllSettings);
    }
}

/**
 * Update toggle button visual state
 */
function updateToggleVisual(toggle, isOn) {
    const dot = toggle.querySelector('div');
    if (isOn) {
        toggle.classList.remove('bg-slate-700');
        toggle.classList.add('bg-emerald-500');
        if (dot) dot.style.transform = 'translateX(28px)';
    } else {
        toggle.classList.remove('bg-emerald-500');
        toggle.classList.add('bg-slate-700');
        if (dot) dot.style.transform = 'translateX(0)';
    }
}

// ============================================
// INVERTER CONTROL VIA WEBHOOK
// ============================================

/**
 * Call the inverter settings webhook
 */
async function callInverterWebhook(payload) {
    try {
        const haUrl = state.haUrl || 'http://192.168.68.75:8123';
        const response = await fetch(`${haUrl}/api/webhook/inverter_settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response.ok;
    } catch (e) {
        console.error('Webhook call failed:', e);
        return false;
    }
}

/**
 * Apply solar-only mode
 */
async function applySolarOnlyMode() {
    const btn = document.getElementById('solarOnlyBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Applying...';
    }

    try {
        const success = await callInverterWebhook({ action: 'solar_only', value: 'None' });

        if (success) {
            showToast('Solar-only mode applied', 'success');
            // Update UI
            const gridToggle = document.getElementById('gridChargingToggle');
            if (gridToggle) {
                gridToggle.dataset.state = 'off';
                updateToggleVisual(gridToggle, false);
            }
        } else {
            showToast('Failed to apply - inverter may be offline', 'error');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg> Solar Only Mode';
        }
    }
}

/**
 * Apply battery floor setting
 */
async function applyBatteryFloor() {
    const floorSlider = document.getElementById('batteryFloorSlider');
    const floorValue = floorSlider ? parseInt(floorSlider.value) : 30;

    const btn = document.getElementById('applyFloorBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Applying...';
    }

    try {
        const success = await callInverterWebhook({ action: 'set_floor', value: floorValue });

        if (success) {
            showToast(`Battery floor set to ${floorValue}%`, 'success');
        } else {
            showToast('Failed to apply - inverter may be offline', 'error');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg> Apply 30% Floor';
        }
    }
}

/**
 * Save all settings
 */
async function saveAllSettings() {
    const btn = document.getElementById('saveGeyserSettingsBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Saving...';
    }

    try {
        // Apply battery floor
        const floorSlider = document.getElementById('batteryFloorSlider');
        if (floorSlider) {
            await callInverterWebhook({ action: 'set_floor', value: parseInt(floorSlider.value) });
        }

        // Apply grid charging setting
        const gridToggle = document.getElementById('gridChargingToggle');
        if (gridToggle) {
            await callInverterWebhook({
                action: 'set',
                setting: 'grid_charging',
                value: gridToggle.dataset.state
            });
        }

        showToast('Settings saved successfully', 'success');
        closeGeyserSettingsModal();
    } catch (e) {
        console.error('Failed to save settings:', e);
        showToast('Failed to save some settings', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Apply Settings';
        }
    }
}

// ============================================
// UTILITIES
// ============================================

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    if (window.showNotification) {
        window.showNotification(message, type);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-xl text-sm font-medium z-[100] transition-all transform translate-y-0 opacity-100`;

    const colors = {
        success: 'bg-emerald-500/90 text-white',
        error: 'bg-red-500/90 text-white',
        info: 'bg-blue-500/90 text-white'
    };

    toast.classList.add(...(colors[type] || colors.info).split(' '));
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// Export for global access
window.geyserSettings = {
    open: openGeyserSettingsModal,
    close: closeGeyserSettingsModal
};
