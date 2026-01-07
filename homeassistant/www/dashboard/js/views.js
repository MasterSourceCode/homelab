/**
 * Views Module
 * View switching and view-specific actions
 */

import { state } from './state.js';
import { callService, getCameraUrl, getFrigatePlaybackUrl, checkFrigateAuth } from './api.js';
import {
    ROOMS, ACCESS_CAMERAS, CAMERA_ENTITIES,
    GATE_COVER, GARAGE_COVER, ALARM_PANEL, ALARM_PIN,
    REFRESH_RATES, getAllLights, FRIGATE_EXTERNAL_URL
} from './config.js';
import { $, show, hide, vibrate, formatTimeWithSeconds } from './utils.js';
import {
    updateFloorSelector, updateRoomGrid, updateGateGarageStatus,
    renderRoomModal, renderAllLightsGrid, updateAutoArmToggle
} from './ui.js';
import { renderFrigateAuthPrompt } from './components.js';
import { resizeChart, refreshHistory } from './energy-chart.js';
import {
    initCalendar, destroyCalendar, changeCalendarView as calendarChangeView,
    calendarToday as calendarGoToday, calendarPrev as calendarGoPrev,
    calendarNext as calendarGoNext, closeEventModal as calendarCloseModal,
    refreshCalendar,
    // OAuth and event management
    toggleCalendarAuth, closeAuthModal, signInAndClose,
    openCreateEventModal, closeCreateEventModal,
    onAllDayChange, updateAssigneePreview,
    saveEvent, deleteCurrentEvent, editCurrentEvent,
    // Calendar sidebar and filters
    toggleCalendarFilter, quickAddEvent,
    updateUpcomingEvents, updateCalendarStats, showEventById
} from './calendar.js';

// Optional template loader import (for modular dashboard)
let templateLoader = null;
import('./template-loader.js').then(module => {
    templateLoader = module;
}).catch(() => {
    // Template loader not available, using inline views
    console.log('Using inline views (template-loader not available)');
});

// ============================================
// VIEW SWITCHING
// ============================================

export async function showView(view) {
    state.setCurrentView(view);

    // Load view template if template loader is available and view not loaded
    if (templateLoader && !$(`view-${view}`)) {
        await templateLoader.loadView(view);
    }

    ['home', 'cameras', 'security', 'energy', 'energy-display', 'garage', 'calendar', 'media', 'system', 'surveillance', 'guest-pass', 'weather', 'alexa'].forEach(v => {
        const el = $(`view-${v}`);
        if (el) el.classList.toggle('hidden', v !== view);
    });

    // Start/stop camera refresh based on view
    if (view === 'cameras') {
        startCameraRefresh();
        // Start delivery mode state polling
        import('./event-handler.js').then(module => {
            module.startDeliveryModePolling();
        });
    } else {
        stopCameraRefresh();
        // Stop delivery mode polling when leaving cameras view
        import('./event-handler.js').then(module => {
            module.stopDeliveryModePolling();
        }).catch(() => {});
    }

    // Initialize/destroy calendar based on view
    if (view === 'calendar') {
        initCalendar();
        // Update sidebar after a short delay to allow events to load
        setTimeout(() => {
            updateUpcomingEvents();
            updateCalendarStats();
        }, 1500);
    } else {
        destroyCalendar();
    }

    // Refresh energy chart when view becomes visible
    if (view === 'energy') {
        // Small delay to ensure DOM has updated
        setTimeout(() => {
            resizeChart();
            // Refresh historical data from HA to fill any gaps
            refreshHistory();
        }, 100);
    }

    // Initialize energy display dashboard when view becomes visible
    if (view === 'energy-display') {
        import('./energy-display.js').then(module => {
            module.initEnergyDisplay();
        }).catch(err => console.error('Failed to load energy-display.js:', err));
    }

    // Initialize media portal when view becomes visible
    if (view === 'media') {
        import('./media.js').then(module => {
            module.initMediaPortal();
        });
    }

    // Initialize/stop PC metrics when view changes
    if (view === 'system') {
        import('./pc-metrics.js').then(module => {
            module.initPCMetrics();
            module.startPCMetrics();
        });
    } else {
        // Stop PC metrics when leaving the view
        import('./pc-metrics.js').then(module => {
            module.stopPCMetrics();
        }).catch(() => {}); // Ignore if module not loaded yet
    }

    // Initialize/stop surveillance dashboard when view changes
    if (view === 'surveillance') {
        if (window.surveillance) {
            window.surveillance.onViewShow();
        }
    } else {
        if (window.surveillance) {
            window.surveillance.onViewHide();
        }
    }

    // Initialize weather dashboard when view becomes visible
    if (view === 'weather') {
        // Dispatch viewLoaded event for weather.js to pick up
        document.dispatchEvent(new CustomEvent('viewLoaded', { detail: { view: 'weather' } }));
        // Also call directly in case event listener isn't ready
        if (window.WeatherDashboard) {
            window.WeatherDashboard.init();
        }
    }

    // Initialize Alexa dashboard when view becomes visible
    if (view === 'alexa') {
        import('./alexa.js').then(module => {
            module.initAlexa();
        }).catch(err => console.error('Failed to load alexa.js:', err));
    }
}

// ============================================
// FLOOR SELECTION
// ============================================

export function selectFloor(floor) {
    state.setCurrentFloor(floor);
    updateFloorSelector();
    updateRoomGrid();
}

// ============================================
// ROOM MODAL
// ============================================

export function openRoomModal(roomId) {
    state.setOpenRoomId(roomId);
    renderRoomModal(roomId);
    show('roomModal');
}

export function closeRoomModal() {
    state.setOpenRoomId(null);
    hide('roomModal');
}

// ============================================
// ALL LIGHTS MODAL
// ============================================

export function openAllLightsModal() {
    state.setAllLightsModalOpen(true);
    renderAllLightsGrid();
    show('allLightsModal');
}

export function closeAllLightsModal() {
    state.setAllLightsModalOpen(false);
    hide('allLightsModal');
}

// ============================================
// ENTITY TOGGLE
// ============================================

export function toggleEntity(entityId) {
    const domain = entityId.startsWith('light.') ? 'light' : 'switch';
    const currentlyOn = state.getEntityState(entityId) === 'on';
    const service = currentlyOn ? 'turn_off' : 'turn_on';

    callService(domain, service, { entity_id: entityId });

    // Optimistic UI update
    const currentEntity = state.getEntity(entityId);
    if (currentEntity) {
        state.setEntity(entityId, {
            ...currentEntity,
            state: currentlyOn ? 'off' : 'on'
        });
    }
}

// ============================================
// FRIGATE DETECTION CONTROL
// ============================================

export function toggleFrigateDetection() {
    const entityId = 'input_boolean.frigate_detection_paused';
    const currentState = state.getEntityState(entityId);

    console.log('[Frigate Toggle] Current state:', currentState);
    console.log('[Frigate Toggle] Authenticated:', state.authenticated);
    console.log('[Frigate Toggle] WebSocket:', state.ws ? 'connected' : 'disconnected');

    // If entity doesn't exist yet, default to 'off' (detection active)
    const currentlyPaused = currentState === 'on';
    const service = currentlyPaused ? 'turn_off' : 'turn_on';

    console.log('[Frigate Toggle] Calling service:', service);

    callService('input_boolean', service, { entity_id: entityId });

    // Optimistic UI update
    const currentEntity = state.getEntity(entityId);
    if (currentEntity) {
        state.setEntity(entityId, {
            ...currentEntity,
            state: currentlyPaused ? 'off' : 'on'
        });
    }

    // Update toggle UI immediately for feedback
    setTimeout(() => updateFrigateDetectionToggle(), 100);
}

export function updateFrigateDetectionToggle() {
    const entityId = 'input_boolean.frigate_detection_paused';
    const isPaused = state.getEntityState(entityId) === 'on';
    const toggleBtn = document.getElementById('frigateDetectionToggle');

    if (!toggleBtn) return;

    if (isPaused) {
        // Paused state (red)
        toggleBtn.classList.remove('bg-white/20');
        toggleBtn.classList.add('bg-rose-500');
        toggleBtn.querySelector('div').style.transform = 'translateX(24px)';
        toggleBtn.title = 'Frigate detection paused - click to resume';
    } else {
        // Active state (gray)
        toggleBtn.classList.remove('bg-rose-500');
        toggleBtn.classList.add('bg-white/20');
        toggleBtn.querySelector('div').style.transform = 'translateX(0)';
        toggleBtn.title = 'Frigate detection active - click to pause and save CPU';
    }
}

// ============================================
// ROOM LIGHT CONTROLS
// ============================================

export function toggleAllRoomLights(roomId, turnOn) {
    const allRooms = [...ROOMS.ground, ...ROOMS.upper];
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;

    room.lights.forEach(id => {
        const currentState = state.getEntityState(id);
        const domain = id.startsWith('light.') ? 'light' : 'switch';

        if (turnOn && currentState !== 'on') {
            callService(domain, 'turn_on', { entity_id: id });
        } else if (!turnOn && currentState === 'on') {
            callService(domain, 'turn_off', { entity_id: id });
        }

        // Optimistic UI update
        const currentEntity = state.getEntity(id);
        if (currentEntity) {
            state.setEntity(id, {
                ...currentEntity,
                state: turnOn ? 'on' : 'off'
            });
        }
    });
}

export function allLightsOff() {
    const allLights = getAllLights();
    allLights.forEach(id => {
        if (state.getEntityState(id) === 'on') {
            const domain = id.startsWith('light.') ? 'light' : 'switch';
            callService(domain, 'turn_off', { entity_id: id });
        }
    });
}

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
    const iconEl = $('gateIcon');

    // Visual feedback
    if (card) card.classList.add('activating');
    if (scanLine) scanLine.classList.add('active');
    if (iconEl) iconEl.style.transform = 'rotate(180deg)';

    vibrate();
    showActionOverlay('gate');
    callService('cover', 'toggle', { entity_id: GATE_COVER });

    // Remove animation after delay
    setTimeout(() => {
        if (card) card.classList.remove('activating');
        if (scanLine) scanLine.classList.remove('active');
        if (iconEl) iconEl.style.transform = '';
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
    const iconEl = $('garageIcon');

    // Visual feedback
    if (card) card.classList.add('activating');
    if (scanLine) scanLine.classList.add('active');
    if (iconEl) iconEl.style.transform = 'rotate(180deg)';

    vibrate();
    showActionOverlay('garage');
    callService('cover', 'toggle', { entity_id: GARAGE_COVER });

    // Remove animation after delay
    setTimeout(() => {
        if (card) card.classList.remove('activating');
        if (scanLine) scanLine.classList.remove('active');
        if (iconEl) iconEl.style.transform = '';
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

    // Check if external and needs auth
    if (!state.isLocalNetwork() && state.frigateAuthRequired) {
        showFrigateAuthPrompt();
    }

    const timestamp = Date.now();

    // Update gate camera
    const gateImg = $('cam-gate');
    if (gateImg) {
        gateImg.src = getCameraUrl(ACCESS_CAMERAS.gate.frigate, timestamp);
        state.setGateLastUpdateTime(new Date());
        updateLastUpdateDisplay('gate');
    }

    // Update garage camera
    const garageImg = $('cam-garage');
    if (garageImg) {
        garageImg.src = getCameraUrl(ACCESS_CAMERAS.garage.frigate, timestamp);
        state.setGarageLastUpdateTime(new Date());
        updateLastUpdateDisplay('garage');
    }

    // Update status displays
    updateGateGarageStatus();

    // Schedule next refresh
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

// ============================================
// SECURITY CONTROLS
// ============================================

export function armAlarm(action) {
    const feedback = $('alarmFeedback');
    if (feedback) {
        feedback.textContent = action === 'disarm' ? 'Disarming...' : 'Arming...';
        feedback.classList.remove('hidden');
        feedback.classList.add('text-emerald-400');
    }

    // Map actions to HA service names
    const serviceMap = {
        'arm_home': 'alarm_arm_home',
        'arm_away': 'alarm_arm_away',
        'arm_custom_bypass': 'alarm_arm_custom_bypass',
        'disarm': 'alarm_disarm'
    };
    const service = serviceMap[action] || action;

    callService('alarm_control_panel', service, {
        entity_id: ALARM_PANEL,
        code: ALARM_PIN
    });

    // Auto-arm cameras when arming
    if (state.autoArmCameras && (action === 'arm_home' || action === 'arm_away')) {
        armAllCameras(true);
    }

    // Clear feedback
    setTimeout(() => {
        if (feedback) {
            feedback.textContent = 'Command sent!';
            setTimeout(() => feedback.classList.add('hidden'), 1500);
        }
    }, 500);
}

export function toggleCameraArm(camera) {
    if (camera === 'all') {
        const allOn = Object.values(CAMERA_ENTITIES).every(e => state.getEntityState(e) === 'on');
        armAllCameras(!allOn);
    } else {
        const entityId = CAMERA_ENTITIES[camera];
        if (entityId) {
            const currentlyOn = state.getEntityState(entityId) === 'on';
            callService('switch', currentlyOn ? 'turn_off' : 'turn_on', { entity_id: entityId });
        }
    }
}

export function armAllCameras(arm) {
    Object.values(CAMERA_ENTITIES).forEach(entityId => {
        callService('switch', arm ? 'turn_on' : 'turn_off', { entity_id: entityId });
    });
}

export function toggleAutoArmCameras() {
    state.toggleAutoArmCameras();
    updateAutoArmToggle();
}

export function toggleDogMode() {
    const dogModeEntity = 'input_boolean.dog_mode';
    const currentState = state.getEntityState(dogModeEntity);
    const newState = currentState === 'on' ? 'off' : 'on';

    callService('input_boolean', newState === 'on' ? 'turn_on' : 'turn_off', {
        entity_id: dogModeEntity
    });

    // Visual feedback immediately
    updateDogModeToggle(newState === 'on');
}

export function triggerPanic(type) {
    if (confirm('Are you sure you want to trigger the panic alarm?')) {
        callService('alarm_control_panel', 'alarm_trigger', { entity_id: ALARM_PANEL });
    }
}

export function bypassZone() {
    alert('Zone bypass: Select a zone in Home Assistant to bypass before arming.');
}

export function refreshSecurityStatus() {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({
            id: state.getNextMsgId(),
            type: 'get_states'
        }));
    }
}

// New Security Command Center functions - delegate to security-controller
export async function toggleZoneBypass(zoneId, zoneName) {
    const { toggleZoneBypass: toggle } = await import('./security-controller.js');
    toggle(zoneId, zoneName);
}

export async function clearAllBypasses() {
    const { clearAllBypasses: clear } = await import('./security-controller.js');
    clear();
}

export async function cancelCountdown() {
    const { cancelCountdown: cancel } = await import('./security-controller.js');
    cancel();
}

export async function showSystemDiagnostics() {
    const { showSystemDiagnostics: show } = await import('./security-controller.js');
    show();
}

export async function closeDiagnostics() {
    const { closeDiagnostics: close } = await import('./security-controller.js');
    close();
}

export async function triggerPanicButton(type) {
    const { triggerPanicButton: trigger } = await import('./security-controller.js');
    trigger(type);
}

export async function showActivityTimeline() {
    const { showActivityTimeline: show } = await import('./security-controller.js');
    show();
}

export async function closeActivityModal() {
    const { closeActivityModal: close } = await import('./security-controller.js');
    close();
}

export async function showQuickActions() {
    const { showQuickActions: show } = await import('./security-controller.js');
    show();
}

export async function closeQuickActions() {
    const { closeQuickActions: close } = await import('./security-controller.js');
    close();
}

// ============================================
// CRITICAL ALERTS ONLY MODE
// ============================================

// Temporary state for the config modal
let criticalAlertsConfig = {
    mode: 'outside',
    notifyNico: true,
    notifyTatiana: true
};

export function showCriticalAlertsConfig() {
    // Load current state from HA
    const currentMode = state.getEntityState('input_select.critical_alerts_mode') || 'off';
    const notifyNico = state.getEntityState('input_boolean.critical_alerts_notify_nico') === 'on';
    const notifyTatiana = state.getEntityState('input_boolean.critical_alerts_notify_tatiana') === 'on';

    criticalAlertsConfig = {
        mode: currentMode === 'off' ? 'outside' : currentMode,
        notifyNico,
        notifyTatiana
    };

    updateCriticalAlertsModalUI();

    const overlay = document.getElementById('criticalAlertsOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    }
}

export function closeCriticalAlertsConfig() {
    const overlay = document.getElementById('criticalAlertsOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }
}

export function selectCriticalAlertMode(mode) {
    criticalAlertsConfig.mode = mode;
    updateCriticalAlertsModalUI();
}

export function toggleCriticalNotifyPerson(person) {
    if (person === 'person1') {
        criticalAlertsConfig.notifyNico = !criticalAlertsConfig.notifyNico;
    } else if (person === 'person2') {
        criticalAlertsConfig.notifyTatiana = !criticalAlertsConfig.notifyTatiana;
    }
    updateCriticalAlertsModalUI();
}

export function applyCriticalAlerts() {
    // Set the mode
    callService('input_select', 'select_option', {
        entity_id: 'input_select.critical_alerts_mode',
        option: criticalAlertsConfig.mode
    });

    // Set notify toggles
    callService('input_boolean', criticalAlertsConfig.notifyNico ? 'turn_on' : 'turn_off', {
        entity_id: 'input_boolean.critical_alerts_notify_nico'
    });
    callService('input_boolean', criticalAlertsConfig.notifyTatiana ? 'turn_on' : 'turn_off', {
        entity_id: 'input_boolean.critical_alerts_notify_tatiana'
    });

    // Update the main toggle UI
    updateCriticalAlertsToggleUI(true, criticalAlertsConfig.mode);

    closeCriticalAlertsConfig();
}

export function disableCriticalAlerts() {
    callService('input_select', 'select_option', {
        entity_id: 'input_select.critical_alerts_mode',
        option: 'off'
    });

    updateCriticalAlertsToggleUI(false, 'off');
    closeCriticalAlertsConfig();
}

export function toggleCriticalAlerts() {
    const currentMode = state.getEntityState('input_select.critical_alerts_mode') || 'off';

    if (currentMode === 'off') {
        // Show config modal to enable
        showCriticalAlertsConfig();
    } else {
        // Turn off directly
        disableCriticalAlerts();
    }
}

function updateCriticalAlertsModalUI() {
    const modes = ['outside', 'stay', 'away'];
    modes.forEach(mode => {
        const btn = document.getElementById(`criticalMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
        if (btn) {
            if (criticalAlertsConfig.mode === mode) {
                btn.classList.add('ring-2', 'ring-white/50', 'scale-105');
            } else {
                btn.classList.remove('ring-2', 'ring-white/50', 'scale-105');
            }
        }
    });

    // Update notify checkmarks
    const nicoCheck = document.getElementById('criticalNotifyNicoCheck');
    const tatianaCheck = document.getElementById('criticalNotifyTatianaCheck');

    if (nicoCheck) {
        if (criticalAlertsConfig.notifyNico) {
            nicoCheck.classList.remove('hidden');
            nicoCheck.classList.add('flex');
        } else {
            nicoCheck.classList.add('hidden');
            nicoCheck.classList.remove('flex');
        }
    }

    if (tatianaCheck) {
        if (criticalAlertsConfig.notifyTatiana) {
            tatianaCheck.classList.remove('hidden');
            tatianaCheck.classList.add('flex');
        } else {
            tatianaCheck.classList.add('hidden');
            tatianaCheck.classList.remove('flex');
        }
    }
}

export function updateCriticalAlertsToggleUI(isOn, mode = 'off') {
    const toggle = document.getElementById('btnCriticalAlertsToggle');
    const knob = document.getElementById('criticalAlertsKnob');
    const status = document.getElementById('criticalAlertsStatus');

    if (toggle && knob) {
        if (isOn && mode !== 'off') {
            toggle.classList.remove('bg-white/10');
            toggle.classList.add('bg-pink-500');
            knob.style.transform = 'translateX(16px)';
        } else {
            toggle.classList.add('bg-white/10');
            toggle.classList.remove('bg-pink-500');
            knob.style.transform = 'translateX(0)';
        }
    }

    if (status) {
        const modeLabels = {
            'off': 'Off',
            'outside': 'Outside',
            'stay': 'Stay',
            'away': 'Away'
        };
        status.textContent = modeLabels[mode] || 'Off';
    }
}

export function toggleAutoArm() {
    // Toggle auto-arm when everyone leaves
    const autoArmEntity = 'input_boolean.auto_arm_enabled';
    const currentState = state.getEntityState(autoArmEntity);
    const newState = currentState === 'on' ? 'off' : 'on';
    callService('input_boolean', newState === 'on' ? 'turn_on' : 'turn_off', {
        entity_id: autoArmEntity
    });
    // Update toggle UI
    updateAutoArmUI(newState === 'on');
}

export function toggleCameraSync() {
    state.toggleAutoArmCameras();
    updateCameraSyncUI();
}

function updateAutoArmUI(isOn) {
    const btn = $('btnAutoArm');
    const knob = $('autoArmKnob');
    if (btn) {
        if (isOn) {
            btn.classList.add('bg-blue-500');
            btn.classList.remove('bg-white/10');
        } else {
            btn.classList.remove('bg-blue-500');
            btn.classList.add('bg-white/10');
        }
    }
    if (knob) {
        knob.style.transform = isOn ? 'translateX(20px)' : 'translateX(0)';
    }
}

function updateCameraSyncUI() {
    const btn = $('btnCameraSync');
    const knob = $('cameraSyncKnob');
    const isOn = state.autoArmCameras;
    if (btn) {
        if (isOn) {
            btn.classList.add('bg-blue-500');
            btn.classList.remove('bg-white/10');
        } else {
            btn.classList.remove('bg-blue-500');
            btn.classList.add('bg-white/10');
        }
    }
    if (knob) {
        knob.style.transform = isOn ? 'translateX(20px)' : 'translateX(0)';
    }
}

// ============================================
// FRIGATE PLAYBACK
// ============================================

export function openFrigatePlayback(cameraName, isoTimestamp) {
    const url = getFrigatePlaybackUrl(cameraName, isoTimestamp);
    window.open(url, '_blank');
}

// Re-export checkFrigateAuth for global access
export { checkFrigateAuth };

// ============================================
// CALENDAR CONTROLS (re-export for global access)
// ============================================

export function changeCalendarView(view) {
    calendarChangeView(view);
}

export function calendarToday() {
    calendarGoToday();
}

export function calendarPrev() {
    calendarGoPrev();
}

export function calendarNext() {
    calendarGoNext();
}

export function closeEventModal() {
    calendarCloseModal();
}

export { refreshCalendar };

// Calendar auth and event management (re-export for global access)
export {
    toggleCalendarAuth,
    closeAuthModal,
    signInAndClose,
    openCreateEventModal,
    closeCreateEventModal,
    onAllDayChange,
    updateAssigneePreview,
    saveEvent,
    deleteCurrentEvent,
    editCurrentEvent
};

// Calendar sidebar and filters (re-export for global access)
export {
    toggleCalendarFilter,
    quickAddEvent,
    updateUpcomingEvents,
    updateCalendarStats,
    showEventById
};
