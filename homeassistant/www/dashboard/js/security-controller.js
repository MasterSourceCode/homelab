/**
 * Security Controller - Alarm, cameras, panic, bypass, countdown
 */

import { state } from './state.js';
import { callService, getFrigatePlaybackUrl } from './api.js';
import { ALARM_PANEL, ALARM_PIN, CAMERA_ENTITIES, ZONES, PARTITION_SENSORS, PANIC_BUTTONS } from './config.js';
import { $, formatTimeWithSeconds } from './utils.js';
import { updateAutoArmToggle, updateSecurityZones } from './ui.js';

// ============================================
// BYPASS STATE MANAGEMENT
// ============================================

const bypassedZones = new Set();
const activityTimeline = [];
const MAX_TIMELINE_EVENTS = 20;

// Track previous zone states for change detection
const previousZoneStates = new Map();

export function getBypassedZones() {
    return bypassedZones;
}

export function isZoneBypassed(zoneId) {
    return bypassedZones.has(zoneId);
}

export function toggleZoneBypass(zoneId, zoneName) {
    if (bypassedZones.has(zoneId)) {
        bypassedZones.delete(zoneId);
        addTimelineEvent('bypass', zoneName, 'Bypass removed');
    } else {
        bypassedZones.add(zoneId);
        addTimelineEvent('bypass', zoneName, 'Zone bypassed');
    }

    updateBypassUI();
    updateSecurityZones();
}

export function clearAllBypasses() {
    if (bypassedZones.size === 0) return;

    bypassedZones.clear();
    addTimelineEvent('bypass', 'All Zones', 'All bypasses cleared');
    updateBypassUI();
    updateSecurityZones();
}

function updateBypassUI() {
    const count = bypassedZones.size;
    const countEl = $('bypassCount');
    const countNumEl = $('bypassCountNum');
    const clearBtn = $('btnClearBypasses');

    if (countEl) {
        if (count > 0) {
            countEl.classList.remove('hidden');
            if (countNumEl) countNumEl.textContent = count;
        } else {
            countEl.classList.add('hidden');
        }
    }

    if (clearBtn) {
        if (count > 0) {
            clearBtn.disabled = false;
            clearBtn.classList.remove('opacity-50');
        } else {
            clearBtn.disabled = true;
            clearBtn.classList.add('opacity-50');
        }
    }
}

// ============================================
// ACTIVITY TIMELINE
// ============================================

export function addTimelineEvent(type, zone, description, zoneType = null) {
    const event = {
        type,
        zone,
        description,
        time: formatTimeWithSeconds(new Date()),
        timestamp: Date.now(),
        zoneType: zoneType || 'system'
    };

    activityTimeline.unshift(event);

    // Keep only the last N events
    if (activityTimeline.length > MAX_TIMELINE_EVENTS) {
        activityTimeline.pop();
    }

    renderTimeline();
}

export function getActivityTimeline() {
    return activityTimeline;
}

function renderTimeline() {
    const container = $('activityTimeline');
    if (!container) return;

    if (activityTimeline.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-white/30">
                <svg class="w-8 h-8 mx-auto mb-2 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p class="text-xs">No recent activity</p>
            </div>
        `;
        return;
    }

    // Import renderActivityTimelineItem dynamically to avoid circular deps
    import('./components.js').then(({ renderActivityTimelineItem }) => {
        container.innerHTML = activityTimeline.map(renderActivityTimelineItem).join('');
    });
}

// ============================================
// ZONE STATE CHANGE TRACKING
// ============================================

/**
 * Initialize timeline from current zone states
 * Loads recent activity based on last_changed attribute
 */
export function initializeZoneTimeline() {
    if (!state.entities) return;

    const zoneEvents = [];

    // Get zone activity from last_changed
    ZONES.forEach(zone => {
        const entity = state.getEntity(zone.id);
        if (!entity || !entity.last_changed) return;

        const lastChanged = new Date(entity.last_changed);
        const now = new Date();
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        // Only include activity from the last hour
        if (lastChanged >= hourAgo) {
            zoneEvents.push({
                type: entity.state === 'on' ? 'motion' : 'clear',
                zone: zone.name,
                description: entity.state === 'on' ? 'Motion detected' : 'Zone cleared',
                time: formatTimeWithSeconds(lastChanged),
                timestamp: lastChanged.getTime(),
                zoneType: zone.location
            });
        }

        // Store current state
        previousZoneStates.set(zone.id, entity.state);
    });

    // Sort by timestamp descending (most recent first)
    zoneEvents.sort((a, b) => b.timestamp - a.timestamp);

    // Add to timeline (limit to max events)
    zoneEvents.slice(0, MAX_TIMELINE_EVENTS).forEach(event => {
        if (!activityTimeline.some(e => e.timestamp === event.timestamp && e.zone === event.zone)) {
            activityTimeline.push(event);
        }
    });

    // Re-sort timeline
    activityTimeline.sort((a, b) => b.timestamp - a.timestamp);

    // Trim to max
    while (activityTimeline.length > MAX_TIMELINE_EVENTS) {
        activityTimeline.pop();
    }

    renderTimeline();
}

/**
 * Check for zone state changes and update timeline
 * Called on each state update from WebSocket
 */
export function checkZoneStateChanges() {
    if (!state.entities) return;

    ZONES.forEach(zone => {
        const entity = state.getEntity(zone.id);
        if (!entity) return;

        const currentState = entity.state;
        const previousState = previousZoneStates.get(zone.id);

        // Detect state change
        if (previousState !== undefined && previousState !== currentState) {
            // Zone state changed
            if (currentState === 'on') {
                addTimelineEvent('motion', zone.name, 'Motion detected', zone.location);
            } else if (currentState === 'off' && previousState === 'on') {
                addTimelineEvent('clear', zone.name, 'Zone cleared', zone.location);
            }
        }

        // Update stored state
        previousZoneStates.set(zone.id, currentState);
    });
}

// ============================================
// COUNTDOWN SYSTEM
// ============================================

let countdownInterval = null;
let countdownSeconds = 0;
let countdownType = 'exit'; // 'exit' or 'entry'

export function startCountdown(seconds, type = 'exit', onComplete = null) {
    countdownSeconds = seconds;
    countdownType = type;

    // Show countdown panel and overlay
    const panel = $('countdownPanel');
    const overlay = $('countdownOverlay');

    if (panel) panel.classList.remove('hidden');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    }

    updateCountdownDisplay();

    // Clear any existing interval
    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
        countdownSeconds--;

        if (countdownSeconds <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            hideCountdown();

            if (onComplete) onComplete();
        } else {
            updateCountdownDisplay();
        }
    }, 1000);
}

function updateCountdownDisplay() {
    const label = countdownType === 'exit' ? 'Exit Delay' : 'Entry Delay';
    const hint = countdownType === 'exit' ? 'Please exit the premises' : 'Enter code to disarm';
    const progress = (countdownSeconds / (countdownType === 'exit' ? 180 : 30)) * 100;

    // Panel elements
    const panelLabel = $('countdownLabel');
    const panelTimer = $('countdownTimer');
    const panelBar = $('countdownBar');
    const panelHint = $('countdownHint');

    if (panelLabel) panelLabel.textContent = label;
    if (panelTimer) panelTimer.textContent = countdownSeconds;
    if (panelBar) panelBar.style.width = `${progress}%`;
    if (panelHint) panelHint.textContent = hint;

    // Overlay elements
    const overlayLabel = $('overlayCountdownLabel');
    const overlayTimer = $('overlayCountdownTimer');
    const overlayBar = $('overlayCountdownBar');
    const overlayHint = $('overlayCountdownHint');

    if (overlayLabel) overlayLabel.textContent = label;
    if (overlayTimer) overlayTimer.textContent = countdownSeconds;
    if (overlayBar) overlayBar.style.width = `${progress}%`;
    if (overlayHint) overlayHint.textContent = hint;

    // Change color when time is low
    if (countdownSeconds <= 10) {
        if (panelTimer) panelTimer.classList.add('text-red-400');
        if (overlayTimer) overlayTimer.classList.add('text-red-400');
    }
}

export function cancelCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    hideCountdown();
    addTimelineEvent('disarm', 'System', 'Countdown cancelled');
}

function hideCountdown() {
    const panel = $('countdownPanel');
    const overlay = $('countdownOverlay');

    if (panel) panel.classList.add('hidden');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }

    // Reset timer color
    const panelTimer = $('countdownTimer');
    const overlayTimer = $('overlayCountdownTimer');
    if (panelTimer) panelTimer.classList.remove('text-red-400');
    if (overlayTimer) overlayTimer.classList.remove('text-red-400');
}

export function showDelayedExit() {
    // Start 3-minute exit countdown then arm away
    addTimelineEvent('arm', 'System', 'Delayed exit started (3 min)');
    startCountdown(180, 'exit', () => {
        armAlarm('arm_away');
        addTimelineEvent('arm', 'System', 'Armed Away after delay');
    });
}

// ============================================
// ALARM CONTROLS
// ============================================

export function armAlarm(action) {
    const feedback = $('alarmFeedback');
    if (feedback) {
        feedback.textContent = action === 'disarm' ? 'Disarming...' : 'Arming...';
        feedback.classList.remove('hidden');
        feedback.classList.add('text-emerald-400');
    }

    const serviceMap = {
        'arm_home': 'alarm_arm_home',
        'arm_away': 'alarm_arm_away',
        'arm_custom_bypass': 'alarm_arm_custom_bypass',
        'disarm': 'alarm_disarm'
    };
    const service = serviceMap[action] || action;

    // Log to timeline
    const actionLabels = {
        'arm_home': 'Armed Stay',
        'arm_away': 'Armed Away',
        'arm_custom_bypass': 'Armed Night',
        'disarm': 'Disarmed'
    };
    addTimelineEvent(action === 'disarm' ? 'disarm' : 'arm', 'System', actionLabels[action] || action);

    callService('alarm_control_panel', service, {
        entity_id: ALARM_PANEL,
        code: ALARM_PIN
    });

    // Auto-arm cameras when arming
    if (state.autoArmCameras && (action === 'arm_home' || action === 'arm_away')) {
        armAllCameras(true);
    }

    setTimeout(() => {
        if (feedback) {
            feedback.textContent = 'Command sent!';
            setTimeout(() => feedback.classList.add('hidden'), 1500);
        }
    }, 500);
}

// ============================================
// CAMERA ARM CONTROLS
// ============================================

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

// ============================================
// DOG MODE
// ============================================

export function toggleDogMode() {
    const dogModeEntity = 'input_boolean.dog_mode';
    const currentState = state.getEntityState(dogModeEntity);
    const newState = currentState === 'on' ? 'off' : 'on';

    callService('input_boolean', newState === 'on' ? 'turn_on' : 'turn_off', {
        entity_id: dogModeEntity
    });
}

// ============================================
// PANIC & BYPASS
// ============================================

export function triggerPanic(type) {
    if (confirm('Are you sure you want to trigger the panic alarm?')) {
        callService('alarm_control_panel', 'alarm_trigger', { entity_id: ALARM_PANEL });
    }
}

export function bypassZone() {
    alert('Zone bypass: Select a zone in Home Assistant to bypass before arming.');
}

// ============================================
// REFRESH & PLAYBACK
// ============================================

export function refreshSecurityStatus() {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({
            id: state.getNextMsgId(),
            type: 'get_states'
        }));
    }
}

export function openFrigatePlayback(cameraName, isoTimestamp) {
    const url = getFrigatePlaybackUrl(cameraName, isoTimestamp);
    window.open(url, '_blank');
}

// ============================================
// SYSTEM DIAGNOSTICS MODAL
// ============================================

export function showSystemDiagnostics() {
    const modal = $('diagnosticsModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        updateDiagnosticsModal();
    }
}

export function closeDiagnostics() {
    const modal = $('diagnosticsModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

export function showActivityTimeline() {
    const modal = $('activityModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

export function closeActivityModal() {
    const modal = $('activityModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

export function showQuickActions() {
    const modal = $('quickActionsModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

export function closeQuickActions() {
    const modal = $('quickActionsModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function updateDiagnosticsModal() {
    // Update partition status grid
    updateDiagnosticItem('diagReady', PARTITION_SENSORS.ready, 'Yes', 'No', true);
    updateDiagnosticItem('diagAcPower', PARTITION_SENSORS.acPower, 'OK', 'Fail', true);
    updateDiagnosticItem('diagBattery', PARTITION_SENSORS.battery, 'OK', 'Low', true);
    updateDiagnosticItem('diagFire', PARTITION_SENSORS.fire, 'Clear', 'ACTIVE', false);
    updateDiagnosticItem('diagAlarm', PARTITION_SENSORS.alarm, 'No', 'YES', false);
    updateDiagnosticItem('diagBell', PARTITION_SENSORS.bell, 'Silent', 'ACTIVE', false);

    // Update zone faults list
    updateZoneFaultsList();

    // Update keypad activity
    const keypadEntity = state.getEntity(PARTITION_SENSORS.keypad);
    const keypadEl = $('lastKeypadActivity');
    if (keypadEl && keypadEntity) {
        const lastChanged = keypadEntity.last_changed ? new Date(keypadEntity.last_changed) : null;
        keypadEl.textContent = lastChanged ?
            `Keypad ${keypadEntity.state} @ ${formatTimeWithSeconds(lastChanged)}` :
            keypadEntity.state || '--';
    }
}

function updateDiagnosticItem(elementId, entityId, goodText, badText, goodIsOn) {
    const el = $(elementId);
    if (!el) return;

    const entity = state.getEntity(entityId);
    const isOn = entity?.state === 'on';
    const isGood = goodIsOn ? isOn : !isOn;

    const dot = el.querySelector('.rounded-full');
    const text = el.querySelector('.font-medium');

    if (dot) {
        dot.className = `w-2 h-2 rounded-full ${isGood ? 'bg-emerald-500' : 'bg-red-500'}`;
    }
    if (text) {
        text.textContent = isGood ? goodText : badText;
        text.className = `text-sm font-medium ${isGood ? 'text-emerald-400' : 'text-red-400'}`;
    }

    // Update border if bad
    el.className = el.className.replace(/border-\w+-\d+/g, '');
    el.classList.add(isGood ? 'border-white/10' : 'border-red-500/50');
}

function updateZoneFaultsList() {
    const container = $('zoneFaultsList');
    if (!container) return;

    const faultyZones = ZONES.filter(zone => {
        const faultEntity = state.getEntity(zone.faultId);
        return faultEntity?.state === 'on';
    });

    if (faultyZones.length === 0) {
        container.innerHTML = `
            <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <div class="flex items-center justify-center gap-2">
                    <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span class="text-sm text-emerald-400 font-medium">All ${ZONES.length} zones healthy</span>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = faultyZones.map(zone => `
            <div class="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                </div>
                <div class="flex-1">
                    <div class="text-sm font-medium text-red-400">${zone.name}</div>
                    <div class="text-[10px] text-white/40">Zone ${zone.zoneNum} - Fault Detected</div>
                </div>
            </div>
        `).join('');
    }
}

// ============================================
// SYSTEM HEALTH UPDATES
// ============================================

export function updateSystemHealthPanel() {
    // Update main health panel indicators
    updateHealthIndicator('healthReady', PARTITION_SENSORS.ready, 'Yes', 'No', true);
    updateHealthIndicator('healthPower', PARTITION_SENSORS.acPower, 'OK', 'Fail', true);
    updateHealthIndicator('healthBattery', PARTITION_SENSORS.battery, 'OK', 'Low', true);

    // Check zone faults
    const faultyZones = ZONES.filter(zone => {
        const faultEntity = state.getEntity(zone.faultId);
        return faultEntity?.state === 'on';
    });

    const zonesEl = $('healthZones');
    if (zonesEl) {
        const dot = zonesEl.querySelector('.status-dot');
        const text = zonesEl.querySelector('.status-text');
        const isHealthy = faultyZones.length === 0;

        if (dot) {
            dot.className = `w-1.5 h-1.5 rounded-full status-dot ${isHealthy ? 'bg-emerald-500' : 'bg-red-500'}`;
        }
        if (text) {
            text.textContent = isHealthy ? 'None' : `${faultyZones.length} fault${faultyZones.length > 1 ? 's' : ''}`;
            text.className = `text-[10px] font-medium status-text ${isHealthy ? 'text-emerald-400' : 'text-red-400'}`;
        }
    }

    // Update alert indicators
    const alertContainer = $('alertIndicators');
    const fireAlert = $('fireAlert');
    const bellAlert = $('bellAlert');

    const fireEntity = state.getEntity(PARTITION_SENSORS.fire);
    const bellEntity = state.getEntity(PARTITION_SENSORS.bell);

    const fireActive = fireEntity?.state === 'on';
    const bellActive = bellEntity?.state === 'on';

    if (alertContainer) {
        if (fireActive || bellActive) {
            alertContainer.classList.remove('hidden');
        } else {
            alertContainer.classList.add('hidden');
        }
    }

    if (fireAlert) {
        fireActive ? fireAlert.classList.remove('hidden') : fireAlert.classList.add('hidden');
    }
    if (bellAlert) {
        bellActive ? bellAlert.classList.remove('hidden') : bellAlert.classList.add('hidden');
    }

    // Update header badge
    updateSystemHealthBadge(faultyZones.length, fireActive, bellActive);
}

function updateHealthIndicator(elementId, entityId, goodText, badText, goodIsOn) {
    const el = $(elementId);
    if (!el) return;

    const entity = state.getEntity(entityId);
    const isOn = entity?.state === 'on';
    const isGood = goodIsOn ? isOn : !isOn;

    const dot = el.querySelector('.status-dot');
    const text = el.querySelector('.status-text');

    if (dot) {
        dot.className = `w-1.5 h-1.5 rounded-full status-dot ${isGood ? 'bg-emerald-500' : 'bg-red-500'}`;
    }
    if (text) {
        text.textContent = isGood ? goodText : badText;
        text.className = `text-[10px] font-medium status-text ${isGood ? 'text-emerald-400' : 'text-red-400'}`;
    }
}

function updateSystemHealthBadge(faultCount, fireActive, bellActive) {
    const badge = $('systemHealthBadge');
    if (!badge) return;

    const dot = badge.querySelector('.rounded-full');
    const text = badge.querySelector('span');

    const hasIssues = faultCount > 0 || fireActive || bellActive;

    if (dot) {
        dot.className = `w-2 h-2 rounded-full ${hasIssues ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`;
    }
    if (text) {
        if (fireActive) {
            text.textContent = 'FIRE ALARM';
            text.className = 'text-xs text-red-400 font-bold';
        } else if (bellActive) {
            text.textContent = 'SIREN ACTIVE';
            text.className = 'text-xs text-amber-400 font-bold';
        } else if (faultCount > 0) {
            text.textContent = `${faultCount} Zone Fault${faultCount > 1 ? 's' : ''}`;
            text.className = 'text-xs text-red-400';
        } else {
            text.textContent = 'System OK';
            text.className = 'text-xs text-white/60';
        }
    }
}

// ============================================
// ZONE FAULT INDICATOR FOR CARDS
// ============================================

export function getZoneFaultStatus(zoneId) {
    const zone = ZONES.find(z => z.id === zoneId);
    if (!zone?.faultId) return false;

    const faultEntity = state.getEntity(zone.faultId);
    return faultEntity?.state === 'on';
}

// ============================================
// PANIC BUTTON HANDLER
// ============================================

export function triggerPanicButton(type) {
    const typeLabels = {
        police: 'Police Emergency',
        fire: 'Fire Department',
        ambulance: 'Medical Emergency'
    };

    const confirmed = confirm(`⚠️ EMERGENCY ALERT\n\nYou are about to trigger a ${typeLabels[type]} panic alarm.\n\nThis will immediately alert emergency services.\n\nAre you sure you want to continue?`);

    if (!confirmed) return;

    // Second confirmation for safety
    const doubleConfirm = confirm(`FINAL CONFIRMATION\n\nPress OK to send ${typeLabels[type]} alert NOW.`);

    if (!doubleConfirm) return;

    const buttonEntity = PANIC_BUTTONS[type];
    if (buttonEntity) {
        callService('button', 'press', { entity_id: buttonEntity });
        addTimelineEvent('panic', 'EMERGENCY', `${typeLabels[type]} panic triggered`);

        // Show confirmation feedback
        alert(`${typeLabels[type]} alert has been triggered.\n\nEmergency services have been notified.`);
    }
}
