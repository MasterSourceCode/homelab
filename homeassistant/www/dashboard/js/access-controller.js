/**
 * Access Controller - Gate, Garage, Camera refresh
 */

import { state } from './state.js';
import { callService, getCameraUrl, checkFrigateAuth } from './api.js';
import { ACCESS_CAMERAS, GATE_COVER, GARAGE_COVER, REFRESH_RATES, FRIGATE_EXTERNAL_URL } from './config.js';
import { $, vibrate, formatTimeWithSeconds } from './utils.js';
import { updateGateGarageStatus } from './ui.js';
import { renderFrigateAuthPrompt } from './components.js';

// ============================================
// ACTION OVERLAY - Visual Feedback
// ============================================

function showActionOverlay(type) {
    // Remove any existing overlay
    const existing = document.getElementById('actionOverlay');
    if (existing) existing.remove();

    // Gate: Always "Opening" (auto-closes, no close sensor)
    // Garage: Check actual state from HA
    let label;
    if (type === 'gate') {
        label = 'Opening Gate';
    } else {
        const garageState = state.getEntityState(GARAGE_COVER);
        const isOpen = garageState === 'open' || garageState === 'opening';
        label = isOpen ? 'Closing Garage' : 'Opening Garage';
    }

    const icon = type === 'gate'
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>';

    const overlay = document.createElement('div');
    overlay.id = 'actionOverlay';
    overlay.className = 'action-overlay';
    overlay.innerHTML = `
        <div class="action-overlay-content">
            <div class="action-overlay-icon ${type}">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">${icon}</svg>
            </div>
            <div class="action-overlay-text">${label}</div>
            <div class="action-overlay-spinner"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Trigger animation
    requestAnimationFrame(() => overlay.classList.add('visible'));

    // Auto-dismiss after 2.5 seconds
    setTimeout(() => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
    }, 2500);
}

function showNotReadyOverlay() {
    // Remove any existing overlay
    const existing = document.getElementById('actionOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'actionOverlay';
    overlay.className = 'action-overlay not-ready';
    overlay.innerHTML = `
        <div class="action-overlay-content">
            <div class="action-overlay-spinner loading"></div>
            <div class="action-overlay-text">Connecting...</div>
            <div class="action-overlay-subtext">Please wait</div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Trigger animation
    requestAnimationFrame(() => overlay.classList.add('visible'));

    // Auto-dismiss after 2 seconds
    setTimeout(() => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
    }, 2000);
}

// ============================================
// GATE & GARAGE CONTROLS
// ============================================

export function toggleGate() {
    callService('cover', 'toggle', { entity_id: GATE_COVER });
}

export function toggleGarage() {
    callService('cover', 'toggle', { entity_id: GARAGE_COVER });
}

export function toggleGateWithFeedback() {
    // Check if dashboard is ready (connected and has data)
    if (!state.authenticated || Object.keys(state.entities).length === 0) {
        console.warn('Dashboard not ready - connection pending');
        showNotReadyOverlay();
        return;
    }

    const card = $('gateControlCard');
    const scanLine = $('gateScanLine');
    const icon = $('gateIcon');

    if (card) card.classList.add('activating');
    if (scanLine) scanLine.classList.add('active');
    if (icon) icon.style.transform = 'rotate(180deg)';

    vibrate();
    showActionOverlay('gate');
    callService('cover', 'toggle', { entity_id: GATE_COVER });

    setTimeout(() => {
        if (card) card.classList.remove('activating');
        if (scanLine) scanLine.classList.remove('active');
        if (icon) icon.style.transform = '';
    }, 3000);
}

export function toggleGarageWithFeedback() {
    // Check if dashboard is ready (connected and has data)
    if (!state.authenticated || Object.keys(state.entities).length === 0) {
        console.warn('Dashboard not ready - connection pending');
        showNotReadyOverlay();
        return;
    }

    const card = $('garageControlCard');
    const scanLine = $('garageScanLine');
    const icon = $('garageIcon');

    if (card) card.classList.add('activating');
    if (scanLine) scanLine.classList.add('active');
    if (icon) icon.style.transform = 'rotate(180deg)';

    vibrate();
    showActionOverlay('garage');
    callService('cover', 'toggle', { entity_id: GARAGE_COVER });

    setTimeout(() => {
        if (card) card.classList.remove('activating');
        if (scanLine) scanLine.classList.remove('active');
        if (icon) icon.style.transform = '';
    }, 3000);
}

// ============================================
// CAMERA REFRESH
// ============================================

function updateAccessCameras() {
    if (state.currentView !== 'cameras') {
        state.setAccessControlTimer(null);
        return;
    }

    if (!state.isLocalNetwork() && state.frigateAuthRequired) {
        showFrigateAuthPrompt();
    }

    const timestamp = Date.now();

    const gateImg = $('cam-gate');
    if (gateImg) {
        gateImg.src = getCameraUrl(ACCESS_CAMERAS.gate.frigate, timestamp);
        state.setGateLastUpdateTime(new Date());
        updateLastUpdateDisplay('gate');
    }

    const garageImg = $('cam-garage');
    if (garageImg) {
        garageImg.src = getCameraUrl(ACCESS_CAMERAS.garage.frigate, timestamp);
        state.setGarageLastUpdateTime(new Date());
        updateLastUpdateDisplay('garage');
    }

    updateGateGarageStatus();

    const refreshRate = state.isLocalNetwork() ? REFRESH_RATES.camerasLocal : REFRESH_RATES.camerasExternal;
    const timer = setTimeout(updateAccessCameras, refreshRate);
    state.setAccessControlTimer(timer);
}

function updateLastUpdateDisplay(type) {
    const el = $(`${type}LastUpdate`);
    if (el) {
        el.textContent = formatTimeWithSeconds(new Date());
    }
}

export function startCameraRefresh() {
    if (!state.accessControlTimer) {
        updateAccessCameras();
    }
}

export function stopCameraRefresh() {
    state.clearAccessControlTimer();
}

function showFrigateAuthPrompt() {
    const container = $('main-content') || document.body;
    if (document.getElementById('frigate-auth-prompt')) return;

    const prompt = document.createElement('div');
    prompt.id = 'frigate-auth-prompt';
    prompt.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 z-50 glass rounded-2xl p-4 flex items-center gap-4 shadow-2xl';
    prompt.innerHTML = renderFrigateAuthPrompt(FRIGATE_EXTERNAL_URL);
    container.appendChild(prompt);
}

export { checkFrigateAuth };
