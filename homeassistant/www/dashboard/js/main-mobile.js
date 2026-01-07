/**
 * Mobile Dashboard Entry Point
 * Optimized for iPhone touch interaction
 * Uses data-action event delegation - no inline onclick handlers
 */

import { state } from './state.js';
import { initMobileEventDelegation, registerMobileActions } from './mobile-event-handler.js';
import { REFRESH_RATES, ROOMS, ZONES, ICONS, ZONE_ICONS, getAllLights,
    GATE_COVER, GARAGE_COVER, ALARM_PANEL, ALARM_PIN, PANIC_BUTTONS,
    POWER_SENSORS, ENERGY_APPLIANCES, ENERGY_SENSORS, CAMERA_ENTITIES, ACCESS_CAMERAS,
    FAMILY_MEMBERS, FAMILY_CONFIG,
    GOOGLE_CALENDAR_API_KEY, GOOGLE_CALENDAR_ID, CALENDAR_TIMEZONE
} from './config.js';
import { connectWebSocket, setConnectionCallbacks, callService, getCameraUrl } from './api.js';
import { $, show, hide, setText, toggleClass, formatTime, formatDate, formatStatus,
    getAlarmColorScheme, getZoneColorScheme, vibrate
} from './utils.js';
import { initEnergyChart, recordPowerData, resizeChart, loadHistoryFromHA } from './energy-chart.js';
import { isAuthenticated, initiateOAuthFlow, createEvent } from './google-calendar-api.js';
import { FAMILY_MEMBERS as CALENDAR_FAMILY_MEMBERS } from './google-oauth-config.js';

// ============================================
// MOBILE UI UPDATE FUNCTIONS
// ============================================

function updateUI() {
    updateClock();
    updateWeather();
    updateLightsCount();
    updatePower();
    updateRoomGrid();
    updateGateGarageStatus();
    updateSecurityPill();
    updateSecurityView();
    updateDogModeUI();
    updateCriticalAlertsToggleUI();
    updateEnergy();
    updatePeopleHomeCount();
    refreshOpenModal();
    refreshAllLightsModal();
    // Update family view if it's currently displayed
    if (state.currentView === 'family') {
        updateFamilyView();
    }
}

function updateClock() {
    const now = new Date();
    setText('timeDisplay', formatTime(now));
    setText('dateDisplay', formatDate(now));
}

function updateWeather() {
    const w = state.getEntity('weather.forecast_home');
    if (w) {
        setText('weatherTemp', Math.round(w.attributes.temperature || 0) + '°');
    }
}

function updateLightsCount() {
    const allLights = getAllLights();
    const onCount = allLights.filter(id => state.getEntityState(id) === 'on').length;
    setText('lightsOnCount', onCount);
    setText('allLightsCount', `${onCount} lights on`);

    // Add glow to lights pill when lights are on
    const lightsPill = $('lightsPill');
    if (lightsPill) {
        toggleClass(lightsPill, 'active', onCount > 0);
    }
}

function updatePower() {
    // Use inverter load power as primary source (same as tablet)
    const loadSensor = state.getEntity(ENERGY_SENSORS.loadPower);
    const total = loadSensor ? parseFloat(loadSensor.state) || 0 : 0;
    setText('totalPower', Math.round(total) + 'W');
}

// ============================================
// GATE & GARAGE STATUS
// ============================================

function updateGateGarageStatus() {
    const gateState = state.getEntityState(GATE_COVER) || 'closed';
    const gateIsOpen = gateState === 'open' || gateState === 'opening';

    const gateBtn = $('gateBtn');
    const gateStatus = $('gateStatus');
    const cameraGateStatus = $('cameraGateStatus');

    if (gateBtn) {
        toggleClass(gateBtn, 'open', gateIsOpen);
    }
    if (gateStatus) {
        gateStatus.textContent = formatStatus(gateState);
    }
    if (cameraGateStatus) {
        cameraGateStatus.textContent = formatStatus(gateState);
    }

    const garageState = state.getEntityState(GARAGE_COVER) || 'closed';
    const garageIsOpen = garageState === 'open' || garageState === 'opening';

    const garageBtn = $('garageBtn');
    const garageStatus = $('garageStatus');
    const cameraGarageStatus = $('cameraGarageStatus');

    if (garageBtn) {
        toggleClass(garageBtn, 'open', garageIsOpen);
    }
    if (garageStatus) {
        garageStatus.textContent = formatStatus(garageState);
    }
    if (cameraGarageStatus) {
        cameraGarageStatus.textContent = formatStatus(garageState);
    }
}

// ============================================
// ROOM GRID
// ============================================

function updateRoomGrid() {
    const grid = $('roomsGrid');
    if (!grid) return;

    const floorRooms = ROOMS[state.currentFloor];

    grid.innerHTML = floorRooms.map(room => {
        const onLights = room.lights.filter(id => state.getEntityState(id) === 'on').length;
        const hasLightsOn = onLights > 0;

        const bgStyle = room.image
            ? `style="--room-bg-image: url('${room.image}')"`
            : '';
        const bgClass = room.image ? 'room-card-bg' : '';

        return `
            <button class="room-card ${bgClass} ${hasLightsOn ? 'has-lights-on' : ''}"
                ${bgStyle}
                data-action="openRoomModal" data-param-room="${room.id}">
                ${room.image ? '<div class="room-bg"></div>' : ''}
                <div class="room-content">
                    <div class="room-icon ${room.color}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${ICONS[room.icon] || ICONS.light}
                        </svg>
                    </div>
                    <div>
                        <div class="room-name">${room.name}</div>
                        <div class="room-status">${onLights > 0 ? `${onLights} light${onLights > 1 ? 's' : ''} on` : 'All off'}</div>
                    </div>
                    ${onLights > 0 ? `<div class="lights-count">${onLights}</div>` : ''}
                </div>
            </button>
        `;
    }).join('');
}

function selectFloor(floor) {
    state.setCurrentFloor(floor);

    const groundBtn = $('floorGround');
    const upperBtn = $('floorUpper');

    if (groundBtn) toggleClass(groundBtn, 'active', floor === 'ground');
    if (upperBtn) toggleClass(upperBtn, 'active', floor === 'upper');

    updateRoomGrid();
}

// ============================================
// SECURITY
// ============================================

function updateSecurityPill() {
    const alarm = state.getEntity(ALARM_PANEL);
    const status = alarm?.state || 'unknown';
    const colorScheme = getAlarmColorScheme(status);

    // Check if system is armed (DSC)
    const isArmed = status.startsWith('armed_') || status === 'triggered';

    // Check for critical alerts only mode (not DSC armed but monitoring)
    const criticalMode = state.getEntityState(CRITICAL_ALERTS_MODE_ENTITY) || 'off';
    const isCriticalAlertsOnly = criticalMode !== 'off' && !isArmed;

    const pillStatus = $('securityPillStatus');
    if (pillStatus) {
        if (isCriticalAlertsOnly) {
            pillStatus.textContent = `ALERTS: ${criticalMode.toUpperCase()}`;
        } else {
            pillStatus.textContent = colorScheme.label;
        }
        if (isArmed || isCriticalAlertsOnly) {
            pillStatus.classList.add('security-armed-text');
        } else {
            pillStatus.classList.remove('security-armed-text');
        }
    }

    const pill = $('securityPill');
    const icon = $('securityPillIcon');

    // Update pill state for armed glow with crimson heartbeat or pink for alerts
    if (pill) {
        toggleClass(pill, 'armed', isArmed || isCriticalAlertsOnly);
        pill.classList.remove('security-armed-indicator', 'security-alerts-indicator');
        if (isArmed) {
            pill.classList.add('security-armed-indicator');
        } else if (isCriticalAlertsOnly) {
            pill.classList.add('security-alerts-indicator');
        }
    }

    if (icon) {
        if (isArmed) {
            // Crimson color for armed state - animation handled by CSS
            icon.setAttribute('class', `icon`);
            icon.style.color = 'var(--armed-crimson)';
        } else if (isCriticalAlertsOnly) {
            // Pink color for critical alerts only mode
            icon.setAttribute('class', `icon`);
            icon.style.color = 'var(--alerts-pink, #ec4899)';
        } else {
            const colorClass = status === 'disarmed' ? 'text-emerald' : 'text-blue';
            icon.setAttribute('class', `icon ${colorClass}`);
            icon.style.color = '';
        }
    }
}

function updateSecurityView() {
    const alarm = state.getEntity(ALARM_PANEL);
    const status = alarm?.state || 'unknown';
    const colorScheme = getAlarmColorScheme(status);

    // Check if system is armed (DSC)
    const isArmed = status.startsWith('armed_') || status === 'triggered';

    // Check for critical alerts only mode (not DSC armed but monitoring)
    const criticalMode = state.getEntityState(CRITICAL_ALERTS_MODE_ENTITY) || 'off';
    const isCriticalAlertsOnly = criticalMode !== 'off' && !isArmed;

    const statusCard = $('securityStatusCard');
    const statusIcon = $('securityStatusIcon');
    const statusTitle = $('securityStatusTitle');
    const statusSub = $('securityStatusSub');

    if (statusCard) {
        let cardClass = 'security-status-card';
        if (isArmed) {
            cardClass += ' armed-away'; // Use armed-away for crimson styling
        } else if (isCriticalAlertsOnly) {
            cardClass += ' alerts-only'; // Use alerts-only for pink styling
        }
        statusCard.setAttribute('class', cardClass);
        if (isArmed) {
            statusCard.style.borderLeftColor = 'var(--armed-crimson)';
        } else if (isCriticalAlertsOnly) {
            statusCard.style.borderLeftColor = 'var(--alerts-pink, #ec4899)';
        } else {
            statusCard.style.borderLeftColor = `var(--accent-${colorScheme.bg})`;
        }
    }

    if (statusIcon) {
        statusIcon.classList.remove('security-armed-indicator', 'security-alerts-indicator');
        if (isArmed) {
            statusIcon.classList.add('security-armed-indicator');
        } else if (isCriticalAlertsOnly) {
            statusIcon.classList.add('security-alerts-indicator');
        }
    }

    if (statusTitle) {
        if (isCriticalAlertsOnly) {
            statusTitle.textContent = `ALERTS: ${criticalMode.toUpperCase()}`;
        } else {
            statusTitle.textContent = colorScheme.label;
        }
        if (isArmed || isCriticalAlertsOnly) {
            statusTitle.classList.add('security-armed-text');
        } else {
            statusTitle.classList.remove('security-armed-text');
        }
    }

    // Count active zones
    let activeZones = 0;
    ZONES.forEach(zone => {
        if (state.getEntityState(zone.id) === 'on') activeZones++;
    });

    if (statusSub) {
        statusSub.textContent = activeZones > 0
            ? `${activeZones} zone${activeZones > 1 ? 's' : ''} active`
            : 'All zones inactive';
    }

    setText('zoneStats', `${activeZones} active`);

    // Update zones grid with time-based color logic
    const zonesGrid = $('zonesGrid');
    if (zonesGrid) {
        zonesGrid.innerHTML = ZONES.map(zone => {
            const zoneState = state.getEntity(zone.id);
            const triggered = zoneState?.state === 'on';
            const lastChanged = zoneState?.last_changed;
            const colorScheme = getZoneColorScheme(triggered, lastChanged);

            // Show last triggered time if within 15 minutes
            let timeDisplay = '';
            if (lastChanged) {
                const lastTime = new Date(lastChanged);
                const now = new Date();
                const diffMins = (now - lastTime) / (1000 * 60);
                if (diffMins <= 15) {
                    const mins = Math.floor(diffMins);
                    timeDisplay = mins < 1 ? 'Just now' : `${mins}m ago`;
                }
            }

            return `
                <div class="zone-item zone-${colorScheme.bg}" data-status="${colorScheme.status}">
                    <div class="zone-icon zone-icon-${colorScheme.bg}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${ZONE_ICONS[zone.icon] || ZONE_ICONS.motion}
                        </svg>
                    </div>
                    <div class="zone-info">
                        <span class="zone-name">${zone.name}</span>
                        ${timeDisplay ? `<span class="zone-time">${timeDisplay}</span>` : ''}
                    </div>
                    <div class="zone-status ${colorScheme.dot}"></div>
                </div>
            `;
        }).join('');
    }
}

function armAlarm(action) {
    vibrate(30);

    const serviceMap = {
        'arm_home': 'alarm_arm_home',
        'arm_away': 'alarm_arm_away',
        'arm_custom_bypass': 'alarm_arm_custom_bypass',
        'disarm': 'alarm_disarm'
    };

    callService('alarm_control_panel', serviceMap[action] || action, {
        entity_id: ALARM_PANEL,
        code: ALARM_PIN
    });
}

function triggerPanicButton(type) {
    const entityId = PANIC_BUTTONS[type];
    if (!entityId) {
        console.error('Unknown panic type:', type);
        return;
    }

    // Confirm before triggering
    const labels = { police: 'POLICE', fire: 'FIRE', ambulance: 'MEDICAL' };
    if (!confirm(`⚠️ TRIGGER ${labels[type]} PANIC?\n\nThis will alert emergency services!`)) {
        return;
    }

    vibrate([100, 50, 100, 50, 100]); // Strong warning vibration
    callService('button', 'press', { entity_id: entityId });
}

// ============================================
// DOG MODE
// ============================================

const DOG_MODE_ENTITY = 'input_boolean.dog_mode';

function toggleDogMode() {
    vibrate(30);
    const currentState = state.getEntityState(DOG_MODE_ENTITY);
    const newState = currentState === 'on' ? 'off' : 'on';

    callService('input_boolean', newState === 'on' ? 'turn_on' : 'turn_off', {
        entity_id: DOG_MODE_ENTITY
    });

    // Optimistic UI update
    updateDogModeUI(newState === 'on');
}

function updateDogModeUI(isOn = null) {
    if (isOn === null) {
        isOn = state.getEntityState(DOG_MODE_ENTITY) === 'on';
    }

    const toggle = document.getElementById('dogModeToggle');
    const knob = document.getElementById('dogModeKnob');
    const card = document.getElementById('dogModeCard');

    if (toggle && knob) {
        if (isOn) {
            toggle.style.background = '#fb923c';
            knob.style.transform = 'translateX(20px)';
            knob.style.background = 'white';
        } else {
            toggle.style.background = 'rgba(255,255,255,0.1)';
            knob.style.transform = 'translateX(0)';
            knob.style.background = 'rgba(255,255,255,0.6)';
        }
    }

    if (card) {
        card.style.borderColor = isOn ? '#fb923c' : 'rgba(251, 146, 60, 0.2)';
    }
}

// ============================================
// CRITICAL ALERTS
// ============================================

const CRITICAL_ALERTS_MODE_ENTITY = 'input_select.critical_alerts_mode';
const CRITICAL_ALERTS_NOTIFY_NICO = 'input_boolean.critical_alerts_notify_nico';
const CRITICAL_ALERTS_NOTIFY_TATIANA = 'input_boolean.critical_alerts_notify_tatiana';

let criticalAlertsConfig = {
    mode: 'outside',
    notifyNico: true,
    notifyTatiana: true
};

function showCriticalAlertsConfig() {
    vibrate(20);

    // Load current state from HA
    const currentMode = state.getEntityState(CRITICAL_ALERTS_MODE_ENTITY) || 'off';
    const notifyNico = state.getEntityState(CRITICAL_ALERTS_NOTIFY_NICO) === 'on';
    const notifyTatiana = state.getEntityState(CRITICAL_ALERTS_NOTIFY_TATIANA) === 'on';

    criticalAlertsConfig = {
        mode: currentMode === 'off' ? 'outside' : currentMode,
        notifyNico: notifyNico,
        notifyTatiana: notifyTatiana
    };

    const overlay = document.getElementById('criticalAlertsOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        updateCriticalAlertsConfigUI();
    }
}

function closeCriticalAlertsConfig() {
    vibrate(15);
    const overlay = document.getElementById('criticalAlertsOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

function selectCriticalAlertMode(mode) {
    vibrate(20);
    criticalAlertsConfig.mode = mode;
    updateCriticalAlertsConfigUI();
}

function toggleCriticalNotifyPerson(person) {
    vibrate(15);
    if (person === 'person1') {
        criticalAlertsConfig.notifyNico = !criticalAlertsConfig.notifyNico;
    } else if (person === 'person2') {
        criticalAlertsConfig.notifyTatiana = !criticalAlertsConfig.notifyTatiana;
    }
    updateCriticalAlertsConfigUI();
}

function applyCriticalAlerts() {
    vibrate([30, 50, 30]);
    console.log('Applying critical alerts:', criticalAlertsConfig);

    // Check WebSocket connection first
    if (!state.authenticated || !state.ws) {
        alert('ERROR: Not connected to Home Assistant!\n\nPlease refresh the page and try again.');
        console.error('applyCriticalAlerts: WebSocket not connected!', {
            authenticated: state.authenticated,
            ws: state.ws ? 'exists' : 'null'
        });
        return;
    }

    // Update notification toggles
    callService('input_boolean', criticalAlertsConfig.notifyNico ? 'turn_on' : 'turn_off', {
        entity_id: CRITICAL_ALERTS_NOTIFY_NICO
    });
    callService('input_boolean', criticalAlertsConfig.notifyTatiana ? 'turn_on' : 'turn_off', {
        entity_id: CRITICAL_ALERTS_NOTIFY_TATIANA
    });

    // Set the mode
    console.log('Setting critical alerts mode to:', criticalAlertsConfig.mode);
    callService('input_select', 'select_option', {
        entity_id: CRITICAL_ALERTS_MODE_ENTITY,
        option: criticalAlertsConfig.mode
    });

    // Show confirmation
    console.log('Critical alerts service calls sent successfully');

    // Optimistic UI update
    updateCriticalAlertsToggleUI(true, criticalAlertsConfig.mode);
    closeCriticalAlertsConfig();
}

function disableCriticalAlerts() {
    vibrate(30);

    callService('input_select', 'select_option', {
        entity_id: CRITICAL_ALERTS_MODE_ENTITY,
        option: 'off'
    });

    updateCriticalAlertsToggleUI(false, 'off');
    closeCriticalAlertsConfig();
}

function toggleCriticalAlerts() {
    const currentMode = state.getEntityState(CRITICAL_ALERTS_MODE_ENTITY) || 'off';

    if (currentMode === 'off') {
        // Show config to enable
        showCriticalAlertsConfig();
    } else {
        // Turn off
        vibrate(30);
        callService('input_select', 'select_option', {
            entity_id: CRITICAL_ALERTS_MODE_ENTITY,
            option: 'off'
        });
        updateCriticalAlertsToggleUI(false, 'off');
    }
}

function updateCriticalAlertsConfigUI() {
    // Update mode buttons (mobile uses 'm' prefix)
    const modeColors = {
        outside: { active: 'rgba(59, 130, 246, 0.3)', border: '#3b82f6' },
        stay: { active: 'rgba(245, 158, 11, 0.3)', border: '#f59e0b' },
        away: { active: 'rgba(239, 68, 68, 0.3)', border: '#ef4444' }
    };

    ['outside', 'stay', 'away'].forEach(mode => {
        const btn = document.getElementById(`mCriticalMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
        if (btn) {
            const colors = modeColors[mode];
            if (criticalAlertsConfig.mode === mode) {
                btn.style.background = colors.active;
                btn.style.borderColor = colors.border;
                btn.style.borderWidth = '3px';
                btn.style.transform = 'scale(1.05)';
            } else {
                btn.style.background = `rgba(${mode === 'outside' ? '59, 130, 246' : mode === 'stay' ? '245, 158, 11' : '239, 68, 68'}, 0.1)`;
                btn.style.borderColor = `rgba(${mode === 'outside' ? '59, 130, 246' : mode === 'stay' ? '245, 158, 11' : '239, 68, 68'}, 0.3)`;
                btn.style.borderWidth = '2px';
                btn.style.transform = 'scale(1)';
            }
        }
    });

    // Update person toggles (mobile uses 'm' prefix)
    const nicoCheck = document.getElementById('mCriticalNotifyNicoCheck');
    const tatianaCheck = document.getElementById('mCriticalNotifyTatianaCheck');
    const nicoBtn = document.getElementById('mCriticalNotifyNico');
    const tatianaBtn = document.getElementById('mCriticalNotifyTatiana');

    if (nicoCheck) {
        nicoCheck.style.display = criticalAlertsConfig.notifyNico ? 'flex' : 'none';
    }
    if (tatianaCheck) {
        tatianaCheck.style.display = criticalAlertsConfig.notifyTatiana ? 'flex' : 'none';
    }
    if (nicoBtn) {
        nicoBtn.style.borderColor = criticalAlertsConfig.notifyNico ? '#10b981' : 'rgba(255,255,255,0.2)';
        nicoBtn.style.borderWidth = criticalAlertsConfig.notifyNico ? '3px' : '2px';
        nicoBtn.style.background = criticalAlertsConfig.notifyNico ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)';
    }
    if (tatianaBtn) {
        tatianaBtn.style.borderColor = criticalAlertsConfig.notifyTatiana ? '#a855f7' : 'rgba(255,255,255,0.2)';
        tatianaBtn.style.borderWidth = criticalAlertsConfig.notifyTatiana ? '3px' : '2px';
        tatianaBtn.style.background = criticalAlertsConfig.notifyTatiana ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0.1)';
    }
}

function updateCriticalAlertsToggleUI(isOn = null, mode = 'off') {
    if (isOn === null) {
        const currentMode = state.getEntityState(CRITICAL_ALERTS_MODE_ENTITY) || 'off';
        isOn = currentMode !== 'off';
        mode = currentMode;
    }

    const toggle = document.getElementById('criticalAlertsToggle');
    const knob = document.getElementById('criticalAlertsKnob');
    const card = document.getElementById('criticalAlertsCard');
    const modeLabel = document.getElementById('criticalAlertsModeLabel');

    if (toggle && knob) {
        if (isOn) {
            toggle.style.background = '#ef4444';
            knob.style.transform = 'translateX(20px)';
            knob.style.background = 'white';
        } else {
            toggle.style.background = 'rgba(255,255,255,0.1)';
            knob.style.transform = 'translateX(0)';
            knob.style.background = 'rgba(255,255,255,0.6)';
        }
    }

    if (card) {
        card.style.borderColor = isOn ? '#ef4444' : 'rgba(239, 68, 68, 0.2)';
    }

    if (modeLabel) {
        if (isOn && mode !== 'off') {
            modeLabel.textContent = mode.toUpperCase();
            modeLabel.classList.remove('hidden');
        } else {
            modeLabel.classList.add('hidden');
        }
    }
}

// ============================================
// DELAYED EXIT (Server-Based Timer)
// Uses HA timer.exit_delay for reliable countdown even when app is backgrounded
// ============================================

const COUNTDOWN_SECONDS = 180; // 3 minutes (must match HA timer duration)
let exitDelayPollingInterval = null;
let selectedExitMode = null;

const EXIT_MODES = {
    arm_away: {
        label: 'ARM AWAY',
        description: 'Full protection',
        color: '#ef4444',
        icon: `<svg style="width:100%;height:100%;color:#ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`
    },
    arm_home: {
        label: 'ARM STAY',
        description: 'Perimeter only',
        color: '#f59e0b',
        icon: `<svg style="width:100%;height:100%;color:#f59e0b;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>`
    },
    dog_mode: {
        label: 'DOG MODE',
        description: 'AI person detection',
        color: '#06b6d4',
        icon: `<svg style="width:100%;height:100%;color:#06b6d4;" viewBox="0 0 256 256" fill="currentColor"><path d="M240,108a28,28,0,1,1-28-28A28.1,28.1,0,0,1,240,108ZM72,108a28,28,0,1,0-28,28A28.1,28.1,0,0,0,72,108ZM92,88A28,28,0,1,0,64,60,28.1,28.1,0,0,0,92,88Zm72,0a28,28,0,1,0-28-28A28.1,28.1,0,0,0,164,88Zm23.1,60.8a35.3,35.3,0,0,1-16.9-21.1,43.9,43.9,0,0,0-84.4,0A35.5,35.5,0,0,1,69,148.8,40,40,0,0,0,88,224a40.5,40.5,0,0,0,15.5-3.1,64.2,64.2,0,0,1,48.9-.1A39.6,39.6,0,0,0,168,224a40,40,0,0,0,19.1-75.2Z"/></svg>`
    }
};

// Get remaining seconds from HA timer entity
function getTimerRemainingSeconds() {
    const timer = state.getEntity('timer.exit_delay');
    if (!timer || timer.state !== 'active') return 0;

    const finishesAt = timer.attributes?.finishes_at;
    if (!finishesAt) return 0;

    const finishTime = new Date(finishesAt).getTime();
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((finishTime - now) / 1000));
    return remaining;
}

// Get the currently set exit delay mode from HA
function getExitDelayMode() {
    const modeEntity = state.getEntity('input_select.exit_delay_mode');
    return modeEntity?.state || 'none';
}

function showDelayedExitOverlay() {
    vibrate(30);
    const overlay = document.getElementById('delayedExitOverlay');
    const modeSelection = document.getElementById('exitModeSelection');
    const countdownView = document.getElementById('exitCountdownView');

    // Check if timer is already active (e.g., started from another device)
    const timer = state.getEntity('timer.exit_delay');
    const currentMode = getExitDelayMode();

    if (timer?.state === 'active' && currentMode !== 'none') {
        // Timer already running - show countdown view
        selectedExitMode = currentMode;
        if (overlay) overlay.style.display = 'block';
        if (modeSelection) modeSelection.style.display = 'none';
        if (countdownView) countdownView.style.display = 'flex';
        updateExitModeDisplay(currentMode);
        startExitDelaySync();
    } else {
        // Show mode selection
        if (overlay) overlay.style.display = 'block';
        if (modeSelection) modeSelection.style.display = 'flex';
        if (countdownView) countdownView.style.display = 'none';
    }
}

function hideDelayedExitOverlay() {
    const overlay = document.getElementById('delayedExitOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.remove('exit-success');
    }
    stopExitDelaySync();
    selectedExitMode = null;
}

function updateExitModeDisplay(mode) {
    const modeConfig = EXIT_MODES[mode];
    if (!modeConfig) return;

    const targetLabel = document.getElementById('exitTargetLabelMobile');
    const targetDesc = document.getElementById('exitTargetDescMobile');
    const targetIcon = document.getElementById('exitTargetIconMobile');

    if (targetLabel) targetLabel.textContent = modeConfig.label;
    if (targetDesc) targetDesc.textContent = modeConfig.description;
    if (targetIcon) targetIcon.innerHTML = modeConfig.icon;
}

async function selectExitMode(mode) {
    vibrate(30);
    if (!EXIT_MODES[mode]) return;

    selectedExitMode = mode;
    const modeConfig = EXIT_MODES[mode];

    const modeSelection = document.getElementById('exitModeSelection');
    const countdownView = document.getElementById('exitCountdownView');

    // Transition views
    if (modeSelection) modeSelection.style.display = 'none';
    if (countdownView) countdownView.style.display = 'flex';

    // Update display
    updateExitModeDisplay(mode);

    // Reset progress ring for animation start
    const progressRing = document.getElementById('countdownProgressMobile');
    if (progressRing) {
        progressRing.style.strokeDashoffset = '0';
    }

    try {
        // Start the server-side timer
        // First set the target mode
        await callService('input_select', 'select_option', {
            entity_id: 'input_select.exit_delay_mode',
            option: mode
        });

        // Then start the timer
        await callService('timer', 'start', {
            entity_id: 'timer.exit_delay',
            duration: '00:03:00'
        });

        // Start syncing with server
        startExitDelaySync();

    } catch (error) {
        console.error('Failed to start exit delay timer:', error);
        // Fallback: show error and return to mode selection
        if (modeSelection) modeSelection.style.display = 'flex';
        if (countdownView) countdownView.style.display = 'none';
    }
}

function startExitDelaySync() {
    // Stop any existing sync
    stopExitDelaySync();

    // Initial update
    updateCountdownDisplay();

    // Poll every 250ms for smooth updates
    exitDelayPollingInterval = setInterval(() => {
        const timer = state.getEntity('timer.exit_delay');

        if (!timer || timer.state !== 'active') {
            // Timer finished or cancelled
            const currentMode = getExitDelayMode();
            if (currentMode === 'none') {
                // Was cancelled or completed successfully
                handleExitDelayComplete();
            }
            return;
        }

        updateCountdownDisplay();
    }, 250);
}

function stopExitDelaySync() {
    if (exitDelayPollingInterval) {
        clearInterval(exitDelayPollingInterval);
        exitDelayPollingInterval = null;
    }
}

function updateCountdownDisplay() {
    const remaining = getTimerRemainingSeconds();
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    const timeDisplay = document.getElementById('exitCountdownTimeMobile');
    if (timeDisplay) {
        timeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Urgent styling for last 30 seconds
        if (remaining <= 30 && remaining > 0) {
            timeDisplay.style.color = '#f87171';
            timeDisplay.classList.add('countdown-urgent');
        } else {
            timeDisplay.style.color = 'white';
            timeDisplay.classList.remove('countdown-urgent');
        }
    }

    // Update progress ring
    const progressRing = document.getElementById('countdownProgressMobile');
    if (progressRing) {
        const circumference = 2 * Math.PI * 90; // radius = 90
        const progress = remaining / COUNTDOWN_SECONDS;
        const offset = circumference * (1 - progress);
        progressRing.style.strokeDashoffset = offset;
    }
}

function handleExitDelayComplete() {
    stopExitDelaySync();

    const timeDisplay = document.getElementById('exitCountdownTimeMobile');
    const overlay = document.getElementById('delayedExitOverlay');

    if (timeDisplay) {
        timeDisplay.textContent = 'ARMED';
        timeDisplay.style.color = '#10b981';
    }

    // Show success animation
    if (overlay) {
        overlay.classList.add('exit-success');
    }

    vibrate([50, 50, 100]); // Success haptic pattern

    // Close overlay after brief delay to show success state
    setTimeout(() => {
        hideDelayedExitOverlay();
    }, 2000);
}

async function cancelDelayedExit() {
    vibrate(30);
    const modeSelection = document.getElementById('exitModeSelection');
    const countdownView = document.getElementById('exitCountdownView');

    const timer = state.getEntity('timer.exit_delay');

    if (timer?.state === 'active') {
        // Cancel the server-side timer
        try {
            await callService('timer', 'cancel', {
                entity_id: 'timer.exit_delay'
            });
        } catch (error) {
            console.error('Failed to cancel timer:', error);
        }
    }

    if (countdownView && countdownView.style.display !== 'none') {
        // Go back to mode selection
        stopExitDelaySync();
        countdownView.style.display = 'none';
        if (modeSelection) modeSelection.style.display = 'flex';
        selectedExitMode = null;
    } else {
        // Close overlay
        hideDelayedExitOverlay();
    }
}

async function executeExitNow() {
    vibrate(50);

    if (!selectedExitMode) {
        selectedExitMode = getExitDelayMode();
    }

    if (!selectedExitMode || selectedExitMode === 'none') return;

    const timeDisplay = document.getElementById('exitCountdownTimeMobile');
    const overlay = document.getElementById('delayedExitOverlay');

    if (timeDisplay) {
        timeDisplay.textContent = 'ARMING';
        timeDisplay.style.color = '#10b981';
    }

    try {
        // Cancel the timer first
        await callService('timer', 'cancel', {
            entity_id: 'timer.exit_delay'
        });

        // Execute the action immediately
        if (selectedExitMode === 'dog_mode') {
            await callService('input_boolean', 'turn_on', {
                entity_id: 'input_boolean.dog_mode'
            });
        } else {
            const serviceMap = {
                'arm_home': 'alarm_arm_home',
                'arm_away': 'alarm_arm_away'
            };
            await callService('alarm_control_panel', serviceMap[selectedExitMode], {
                entity_id: ALARM_PANEL,
                code: ALARM_PIN
            });
        }

        // Reset the mode selector
        await callService('input_select', 'select_option', {
            entity_id: 'input_select.exit_delay_mode',
            option: 'none'
        });

        if (timeDisplay) {
            timeDisplay.textContent = 'ARMED';
        }

        if (overlay) {
            overlay.classList.add('exit-success');
        }

        vibrate([50, 50, 100]);

    } catch (error) {
        console.error('Failed to arm system:', error);
        if (timeDisplay) {
            timeDisplay.textContent = 'ERROR';
            timeDisplay.style.color = '#ef4444';
        }
    }

    // Close overlay after brief delay
    setTimeout(() => {
        hideDelayedExitOverlay();
    }, 1500);
}

// Sync exit delay state when app becomes visible (returns from background)
function syncExitDelayOnVisibility() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const overlay = document.getElementById('delayedExitOverlay');
            if (overlay && overlay.style.display !== 'none') {
                // Overlay is open, sync with server
                const timer = state.getEntity('timer.exit_delay');
                const currentMode = getExitDelayMode();

                if (timer?.state === 'active' && currentMode !== 'none') {
                    // Timer still running, update display
                    selectedExitMode = currentMode;
                    updateExitModeDisplay(currentMode);
                    updateCountdownDisplay();
                } else if (currentMode === 'none') {
                    // Timer finished while we were away
                    handleExitDelayComplete();
                }
            } else {
                // Check if timer was started elsewhere
                const timer = state.getEntity('timer.exit_delay');
                const currentMode = getExitDelayMode();

                if (timer?.state === 'active' && currentMode !== 'none') {
                    // Auto-show the overlay for an active timer
                    showDelayedExitOverlay();
                }
            }
        }
    });
}

// Initialize visibility sync
syncExitDelayOnVisibility();

// Make functions globally accessible
window.showDelayedExitOverlay = showDelayedExitOverlay;
window.hideDelayedExitOverlay = hideDelayedExitOverlay;
window.selectExitMode = selectExitMode;
window.cancelDelayedExit = cancelDelayedExit;
window.executeExitNow = executeExitNow;

// ============================================
// ALEXA ANNOUNCEMENTS
// ============================================

function alexaAnnounce(message) {
    haptic.medium();

    callService('notify', 'alexa_media', {
        message: message,
        target: 'media_player.everywhere',
        data: {
            type: 'announce'
        }
    }).then(() => {
        showAlexaFeedback();
    }).catch(err => {
        console.error('Alexa announce failed:', err);
        showAlexaFeedback('Failed');
    });
}

function alexaCustomAnnounce() {
    const input = $('alexaCustomInput');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    alexaAnnounce(message);
    input.value = '';
}

function startDeliveryMode() {
    haptic.heavy();

    // Call Home Assistant script that handles the delivery mode loop
    callService('script', 'turn_on', {
        entity_id: 'script.delivery_mode'
    });

    showAlexaFeedback('Delivery Mode Started!');
}

// Start delivery mode from camera view with UI state management
function startDeliveryModeFromCamera() {
    haptic.heavy();
    callService('script', 'turn_on', { entity_id: 'script.delivery_mode' });
    updateDeliveryModeUI('active');
}

// Cancel delivery mode
function cancelDeliveryMode() {
    haptic.medium();
    // Turn off the running script
    callService('script', 'turn_off', { entity_id: 'script.delivery_mode' });
    // Dismiss notifications to clean up
    callService('persistent_notification', 'dismiss', { notification_id: 'delivery_mode_active' });
    callService('persistent_notification', 'dismiss', { notification_id: 'delivery_mode_package_detected' });
    // Reset UI
    updateDeliveryModeUI('idle');
}

// Update delivery mode UI state
function updateDeliveryModeUI(state) {
    const startBtn = $('deliveryModeStartBtn');
    const activeDiv = $('deliveryModeActive');
    const thankYouDiv = $('deliveryModeThankYou');

    if (!startBtn || !activeDiv || !thankYouDiv) return;

    // Hide all first
    startBtn.style.display = 'none';
    activeDiv.style.display = 'none';
    thankYouDiv.style.display = 'none';

    // Show appropriate state
    switch (state) {
        case 'idle':
            startBtn.style.display = 'flex';
            break;
        case 'active':
            activeDiv.style.display = 'flex';
            break;
        case 'package_detected':
            thankYouDiv.style.display = 'flex';
            break;
    }
}

// Delivery mode state polling
let deliveryModePollingInterval = null;

function startDeliveryModePolling() {
    if (deliveryModePollingInterval) return;

    const checkState = async () => {
        try {
            const states = await getStates();
            const activeNotif = states.find(s => s.entity_id === 'persistent_notification.delivery_mode_active');
            const packageNotif = states.find(s => s.entity_id === 'persistent_notification.delivery_mode_package_detected');
            const scriptState = states.find(s => s.entity_id === 'script.delivery_mode');

            if (packageNotif && packageNotif.state !== 'unavailable') {
                updateDeliveryModeUI('package_detected');
            } else if (activeNotif && activeNotif.state !== 'unavailable') {
                updateDeliveryModeUI('active');
            } else if (scriptState && scriptState.state === 'on') {
                updateDeliveryModeUI('active');
            } else {
                updateDeliveryModeUI('idle');
            }
        } catch (e) {
            console.warn('Delivery mode state check failed:', e);
        }
    };

    checkState();
    deliveryModePollingInterval = setInterval(checkState, 2000);
}

function stopDeliveryModePolling() {
    if (deliveryModePollingInterval) {
        clearInterval(deliveryModePollingInterval);
        deliveryModePollingInterval = null;
    }
}

function showAlexaFeedback(text = 'Sent!') {
    const toast = $('alexaFeedbackToast');
    if (!toast) return;

    // Update text if needed
    const span = toast.querySelector('span') || toast;
    if (span && text !== 'Sent!') {
        span.textContent = text;
    }

    // Show toast
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';

    // Hide after 2 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        toast.style.opacity = '0';
    }, 2000);
}

// Make Alexa functions globally accessible
window.alexaAnnounce = alexaAnnounce;
window.alexaCustomAnnounce = alexaCustomAnnounce;
window.showAlexaFeedback = showAlexaFeedback;

// ============================================
// FAMILY VIEW
// ============================================

// Current metric tab for the family view
let currentFamilyMetric = 'floors';

function getFamilyData() {
    const data = {};
    Object.entries(FAMILY_MEMBERS).forEach(([key, member]) => {
        const trackerState = state.getEntityState(member.sensors.tracker) || 'unknown';
        const batteryLevel = parseFloat(state.getEntity(member.sensors.battery)?.state) || 0;
        const batteryStateRaw = state.getEntity(member.sensors.batteryState)?.state || 'Unknown';
        const isCharging = batteryStateRaw === 'Charging' || batteryStateRaw === 'Full';
        const geoLocation = state.getEntity(member.sensors.location)?.state || '';
        const focusState = state.getEntityState(member.sensors.focus) || 'off';

        data[key] = {
            key,
            name: member.name,
            color: member.color,
            avatar: member.avatar,
            location: trackerState,
            isHome: trackerState === 'home',
            battery: batteryLevel,
            batteryState: batteryStateRaw,
            isCharging,
            steps: parseInt(state.getEntity(member.sensors.steps)?.state) || 0,
            floorsUp: parseInt(state.getEntity(member.sensors.floorsUp)?.state) || 0,
            floorsDown: parseInt(state.getEntity(member.sensors.floorsDown)?.state) || 0,
            distance: parseFloat(state.getEntity(member.sensors.distance)?.state) || 0,
            activity: state.getEntity(member.sensors.activity)?.state || 'unknown',
            focus: focusState === 'on',
            geoLocation: geoLocation ? geoLocation.split('\n')[0] : ''
        };
    });
    return data;
}

function updateFamilyView() {
    if (!FAMILY_MEMBERS || Object.keys(FAMILY_MEMBERS).length === 0) {
        return;
    }

    const familyData = getFamilyData();
    const members = Object.values(familyData);

    updateFamilyBatteryAlerts(members);
    updateFamilyHomeSummary(members);
    updateFamilyCards(members);
    updateFamilyStepsLeaderboard(members);
    updateFamilyMetricsLeaderboard(members);
}

function updatePeopleHomeCount() {
    const familyData = getFamilyData();
    const members = Object.values(familyData);
    const homeCount = members.filter(m => m.isHome).length;
    setText('peopleHome', homeCount);

    // Update family pill styling based on who's home
    const pill = $('familyPill');
    if (pill) {
        pill.classList.remove('all-home', 'some-home');
        if (homeCount === members.length && homeCount > 0) {
            pill.classList.add('all-home');
        } else if (homeCount > 0) {
            pill.classList.add('some-home');
        }
    }
}

function updateFamilyBatteryAlerts(members) {
    const container = $('familyBatteryAlerts');
    if (!container) return;

    const lowBatteryMembers = members
        .filter(m => m.battery > 0 && m.battery <= FAMILY_CONFIG.lowBatteryThreshold && !m.isCharging)
        .sort((a, b) => a.battery - b.battery);

    if (lowBatteryMembers.length === 0) {
        container.innerHTML = '';
        return;
    }

    // Compact pill-style alerts for iOS design
    container.innerHTML = lowBatteryMembers.map(member => {
        const isCritical = member.battery <= FAMILY_CONFIG.criticalBatteryThreshold;
        return `
            <div class="battery-alert ${isCritical ? 'critical' : 'warning'}">
                <div class="battery-alert-avatar">
                    <img src="${member.avatar}" alt="${member.name}">
                </div>
                <span class="battery-alert-text">${member.name} ${Math.round(member.battery)}%</span>
            </div>
        `;
    }).join('');
}

function updateFamilyHomeSummary(members) {
    const homeMembers = members.filter(m => m.isHome);

    setText('familyHomeCount', homeMembers.length);

    // Update "Updated X ago" text
    const updateEl = $('familyLastUpdate');
    if (updateEl) {
        updateEl.textContent = 'Updated just now';
    }

    const namesEl = $('familyHomeNames');
    if (namesEl) {
        if (homeMembers.length === 0) {
            namesEl.textContent = 'Nobody home';
        } else if (homeMembers.length === members.length) {
            namesEl.textContent = 'Everyone is home';
        } else {
            namesEl.textContent = homeMembers.map(m => m.name).join(' & ');
        }
    }

    // Stacked avatars for hero card
    const avatarsEl = $('familyHomeAvatars');
    if (avatarsEl) {
        avatarsEl.innerHTML = homeMembers.map(member => `
            <div class="stack-avatar" style="background: ${member.color}">
                ${member.avatar
                    ? `<img src="${member.avatar}" alt="${member.name}">`
                    : `<div class="stack-avatar-initial" style="background: ${member.color}">${member.name.charAt(0)}</div>`
                }
            </div>
        `).join('');
    }
}

function updateFamilyCards(members) {
    const container = $('familyCardsGrid');
    if (!container) return;

    container.innerHTML = members.map(member => {
        const batteryClass = member.battery <= 10 ? 'low' : member.battery <= 30 ? 'medium' : 'good';
        const batteryColor = member.battery <= 10 ? '#ef4444' : member.battery <= 30 ? '#f59e0b' : '#22c55e';
        const distanceKm = (member.distance / 1000).toFixed(1);
        const activityClass = member.activity?.toLowerCase() || 'stationary';

        return `
            <div class="family-member-card" style="--member-color: ${member.color}">
                ${member.focus ? `
                    <div class="focus-badge">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                        </svg>
                        Focus
                    </div>
                ` : ''}
                <div class="member-card-header">
                    <div class="member-avatar" style="border-color: ${member.color}">
                        <img src="${member.avatar}" alt="${member.name}">
                        <div class="member-status-badge ${member.isHome ? 'home' : 'away'}">
                            ${member.isHome
                                ? '<svg fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>'
                                : '<svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>'
                            }
                        </div>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div class="member-name">${member.name}</div>
                        <div class="member-location">${member.isHome ? 'Home' : (member.geoLocation || capitalizeFirst(member.location))}</div>
                    </div>
                </div>
                <div class="member-battery">
                    <div class="battery-header">
                        <span class="battery-label">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zm16 3h2"/>
                            </svg>
                        </span>
                        <span class="battery-value ${batteryClass}">
                            ${member.isCharging ? '<svg class="charging-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>' : ''}
                            ${Math.round(member.battery)}%
                        </span>
                    </div>
                    <div class="battery-bar">
                        <div class="battery-bar-fill" style="width: ${member.battery}%; background: ${batteryColor}"></div>
                    </div>
                </div>
                <div class="member-stats">
                    <div class="member-stat">
                        <div class="member-stat-value steps">${formatSteps(member.steps)}</div>
                        <div class="member-stat-label">Steps</div>
                    </div>
                    <div class="member-stat">
                        <div class="member-stat-value distance">${distanceKm}km</div>
                        <div class="member-stat-label">Dist</div>
                    </div>
                    <div class="member-stat">
                        <div class="member-stat-value floors">${member.floorsUp}</div>
                        <div class="member-stat-label">Floors</div>
                    </div>
                    <div class="member-stat">
                        <div class="member-stat-value" style="color: var(--text-secondary)">${getActivityIcon(member.activity)}</div>
                        <div class="member-stat-label">Activity</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateFamilyStepsLeaderboard(members) {
    const container = $('familyStepsLeaderboard');
    if (!container) return;

    const sorted = [...members].sort((a, b) => b.steps - a.steps);
    const totalSteps = sorted.reduce((sum, m) => sum + m.steps, 0);

    setText('familyTotalSteps', formatSteps(totalSteps));

    container.innerHTML = sorted.map((member, index) => {
        const rank = index + 1;
        const rankLabel = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
        const barWidth = sorted[0].steps > 0 ? (member.steps / sorted[0].steps) * 100 : 0;
        const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';

        return `
            <div class="leaderboard-item ${rank === 1 ? 'rank-1' : ''}">
                <div class="leaderboard-rank ${rankClass}">${rankLabel}</div>
                <div class="leaderboard-avatar" style="border-color: ${member.color}">
                    <img src="${member.avatar}" alt="${member.name}">
                </div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${member.name}</div>
                    <div class="leaderboard-bar">
                        <div class="leaderboard-bar-fill" style="width: ${barWidth}%; background: ${member.color}"></div>
                    </div>
                </div>
                <div class="leaderboard-value" style="color: ${member.color}">${formatSteps(member.steps)}</div>
            </div>
        `;
    }).join('');
}

function updateFamilyMetricsLeaderboard(members) {
    const container = $('familyMetricsLeaderboard');
    if (!container) return;

    const metric = currentFamilyMetric;
    let sorted, getValue, formatValue, unit;

    if (metric === 'floors') {
        sorted = [...members].sort((a, b) => b.floorsUp - a.floorsUp);
        getValue = m => m.floorsUp;
        formatValue = v => v;
        unit = 'floors';
    } else {
        sorted = [...members].sort((a, b) => b.distance - a.distance);
        getValue = m => m.distance;
        formatValue = v => (v / 1000).toFixed(1);
        unit = 'km';
    }

    container.innerHTML = sorted.map((member, index) => {
        const rank = index + 1;
        const rankLabel = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
        const value = getValue(member);
        const maxValue = getValue(sorted[0]);
        const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
        const metricColor = metric === 'floors' ? 'var(--accent-blue)' : 'var(--accent-emerald)';

        return `
            <div class="metrics-item ${rank === 1 ? 'rank-1 ' + metric : ''}">
                <div class="leaderboard-rank ${rankClass}">${rankLabel}</div>
                <div class="leaderboard-avatar" style="border-color: ${member.color}">
                    <img src="${member.avatar}" alt="${member.name}">
                </div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${member.name}</div>
                    <div class="leaderboard-bar">
                        <div class="leaderboard-bar-fill" style="width: ${barWidth}%; background: ${metricColor}"></div>
                    </div>
                </div>
                <div class="metrics-value">
                    <span class="metrics-value-main" style="color: ${metricColor}">${formatValue(value)}</span>
                    <span class="metrics-value-sub">${unit}${metric === 'floors' ? ` (↓${member.floorsDown})` : ''}</span>
                </div>
            </div>
        `;
    }).join('');
}

function switchFamilyMetric(metric) {
    vibrate(15);
    currentFamilyMetric = metric;

    // Update tab UI
    ['floors', 'distance'].forEach(m => {
        const tab = $(`tab-${m}`);
        if (tab) toggleClass(tab, 'active', m === metric);
    });

    // Re-render leaderboard
    const familyData = getFamilyData();
    updateFamilyMetricsLeaderboard(Object.values(familyData));
}

// Helper functions for family view
function formatSteps(num) {
    if (num >= 10000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toLocaleString();
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getActivityIcon(activity) {
    if (!activity || activity === 'unknown') return '•';
    const lower = activity.toLowerCase();
    if (lower === 'stationary') return '⏸';
    if (lower === 'walking') return '🚶';
    if (lower === 'running') return '🏃';
    if (lower === 'cycling' || lower === 'automotive') return '🚗';
    return '⚡';
}

// ============================================
// CALENDAR VIEW
// ============================================

// Calendar state
let calendarEvents = [];
let calendarSelectedDate = new Date();
let calendarCurrentMonth = new Date();
let miniCalendarExpanded = false;
let calendarViewMode = 'week'; // 'day', 'week', 'all'
let calendarWeekOffset = 0; // For week navigation (0 = current week)

// Family member colors for calendar events
const CALENDAR_COLORS = {
    person2: { color: '#ec4899', name: 'Person2' },
    person1: { color: '#3b82f6', name: 'Person1' },
    child1: { color: '#a855f7', name: 'Child1' },
    child2: { color: '#14b8a6', name: 'Child2' },
    everyone: { color: '#f59e0b', name: 'Everyone' }
};

// Google Calendar color ID mapping
const GCAL_COLOR_MAP = {
    '1': 'person1',      // Blue
    '2': 'child2',      // Green/Teal
    '3': 'child1', // Purple
    '4': 'person2',   // Pink
    '5': 'everyone',  // Yellow/Amber
    '6': 'everyone',  // Orange
    '7': 'child2',      // Teal
    '8': 'everyone',  // Gray
    '9': 'person1',      // Bold Blue
    '10': 'everyone', // Bold Green
    '11': 'person2'   // Bold Red
};

function initCalendarView() {
    calendarSelectedDate = new Date();
    calendarCurrentMonth = new Date();
    updateCalendarHeader();
    renderWeekStrip();
    fetchCalendarEvents();
}

function updateCalendarHeader() {
    const monthYear = calendarCurrentMonth.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });
    setText('calMonthYear', monthYear);
}

function renderWeekStrip() {
    const container = $('weekStripScroll');
    if (!container) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get start of the base week (Sunday of current week + offset)
    const baseDate = new Date(today);
    baseDate.setDate(baseDate.getDate() + (calendarWeekOffset * 7));
    const startOfWeek = new Date(baseDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    // Generate 3 weeks (previous, current, next)
    const allDays = [];
    for (let w = -1; w <= 1; w++) {
        for (let d = 0; d < 7; d++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + (w * 7) + d);
            allDays.push(date);
        }
    }

    // Count events per day for indicators
    const eventCounts = {};
    calendarEvents.forEach(e => {
        const d = new Date(e.start.dateTime || e.start.date);
        const key = d.toDateString();
        eventCounts[key] = (eventCounts[key] || 0) + 1;
    });

    container.innerHTML = allDays.map((date, index) => {
        const isToday = date.toDateString() === today.toDateString();
        const isSelected = date.toDateString() === calendarSelectedDate.toDateString();
        const eventCount = eventCounts[date.toDateString()] || 0;
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
        const isCurrentMonth = date.getMonth() === calendarCurrentMonth.getMonth();

        return `
            <button class="week-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${eventCount > 0 ? 'has-events' : ''} ${!isCurrentMonth ? 'other-month' : ''}"
                    data-action="selectCalendarDate" data-param-date="${date.toISOString()}"
                    data-date="${date.toISOString()}">
                <span class="week-day-name">${dayName}</span>
                <span class="week-day-num">${date.getDate()}</span>
                ${eventCount > 0 ? `<span class="week-day-dots">${eventCount > 3 ? '•••' : '•'.repeat(eventCount)}</span>` : ''}
            </button>
        `;
    }).join('');

    // Scroll to center (current week) after render
    setTimeout(() => {
        const selectedBtn = container.querySelector('.week-day.selected') || container.querySelector('.week-day.today');
        if (selectedBtn) {
            selectedBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, 50);

    // Update month/year display
    updateCalendarHeader();
}

// Navigate week with swipe
function calendarPrevWeek() {
    vibrate(15);
    calendarWeekOffset--;

    // Update selected date to same day of week in new week
    calendarSelectedDate.setDate(calendarSelectedDate.getDate() - 7);
    calendarCurrentMonth = new Date(calendarSelectedDate);

    renderWeekStrip();
    renderAgenda();
}

function calendarNextWeek() {
    vibrate(15);
    calendarWeekOffset++;

    // Update selected date to same day of week in new week
    calendarSelectedDate.setDate(calendarSelectedDate.getDate() + 7);
    calendarCurrentMonth = new Date(calendarSelectedDate);

    renderWeekStrip();
    renderAgenda();
}

async function fetchCalendarEvents() {
    const container = $('agendaContainer');
    if (!container) return;

    // Show loading
    container.innerHTML = `
        <div class="agenda-loading">
            <div class="spinner"></div>
            <span>Loading events...</span>
        </div>
    `;

    try {
        // Fetch events for the next 30 days
        const now = new Date();
        const timeMin = now.toISOString();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const timeMax = futureDate.toISOString();

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events?` +
            `key=${GOOGLE_CALENDAR_API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch events');

        const data = await response.json();
        calendarEvents = data.items || [];

        updateCalendarStats();
        renderWeekStrip();
        renderAgenda();
    } catch (error) {
        console.error('Calendar fetch error:', error);
        container.innerHTML = `
            <div class="agenda-empty">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <span class="agenda-empty-text">Couldn't load calendar</span>
                <span class="agenda-empty-sub">Pull down to refresh</span>
            </div>
        `;
    }
}

function updateCalendarStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));

    let todayCount = 0;
    let weekCount = 0;
    let upcomingCount = calendarEvents.length;

    calendarEvents.forEach(event => {
        const eventDate = new Date(event.start.dateTime || event.start.date);
        eventDate.setHours(0, 0, 0, 0);

        if (eventDate.getTime() === today.getTime()) {
            todayCount++;
        }
        if (eventDate >= today && eventDate <= endOfWeek) {
            weekCount++;
        }
    });

    setText('calTodayCount', todayCount);
    setText('calWeekCount', weekCount);
    setText('calUpcomingCount', upcomingCount);
}

function renderAgenda() {
    const container = $('agendaContainer');
    if (!container) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter events based on view mode
    let filteredEvents = [...calendarEvents];
    const selectedDateStr = calendarSelectedDate.toDateString();

    if (calendarViewMode === 'day') {
        // Show only events for selected day
        filteredEvents = calendarEvents.filter(event => {
            const eventDate = new Date(event.start.dateTime || event.start.date);
            return eventDate.toDateString() === selectedDateStr;
        });
    } else if (calendarViewMode === 'week') {
        // Show events for the selected week
        const startOfWeek = new Date(calendarSelectedDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        filteredEvents = calendarEvents.filter(event => {
            const eventDate = new Date(event.start.dateTime || event.start.date);
            return eventDate >= startOfWeek && eventDate <= endOfWeek;
        });
    }
    // 'all' mode shows everything

    if (filteredEvents.length === 0) {
        const emptyMessage = calendarViewMode === 'day'
            ? `No events on ${calendarSelectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
            : calendarViewMode === 'week'
            ? 'No events this week'
            : 'No upcoming events';

        container.innerHTML = `
            <div class="agenda-empty">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <span class="agenda-empty-text">${emptyMessage}</span>
                <span class="agenda-empty-sub">Tap + to add an event</span>
            </div>
        `;
        return;
    }

    // Group events by date
    const grouped = {};

    filteredEvents.forEach(event => {
        const eventDate = new Date(event.start.dateTime || event.start.date);
        const dateKey = eventDate.toDateString();

        if (!grouped[dateKey]) {
            grouped[dateKey] = {
                date: new Date(eventDate.setHours(0, 0, 0, 0)),
                events: []
            };
        }
        grouped[dateKey].events.push(event);
    });

    // Sort dates
    const sortedDates = Object.keys(grouped).sort((a, b) =>
        new Date(a) - new Date(b)
    );

    container.innerHTML = sortedDates.map(dateKey => {
        const group = grouped[dateKey];
        const date = group.date;
        const isToday = date.toDateString() === today.toDateString();
        const isTomorrow = date.toDateString() === new Date(today.getTime() + 86400000).toDateString();
        const isSelected = date.toDateString() === selectedDateStr;

        let dayLabel = '';
        if (isToday) dayLabel = 'Today';
        else if (isTomorrow) dayLabel = 'Tomorrow';

        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return `
            <div class="agenda-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}">
                <div class="agenda-day-header">
                    <div class="agenda-day-info">
                        <span class="agenda-day-name">${dayName}</span>
                        <span class="agenda-day-date-str">${dateStr}</span>
                    </div>
                    ${dayLabel ? `<span class="agenda-day-label">${dayLabel}</span>` : ''}
                </div>
                <div class="agenda-events">
                    ${group.events.map(event => renderAgendaEvent(event)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function setCalendarViewMode(mode) {
    vibrate(15);
    calendarViewMode = mode;

    // Update toggle buttons
    document.querySelectorAll('.cal-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    renderAgenda();
    updateCalendarStats();
}

function renderAgendaEvent(event) {
    const isAllDay = !event.start.dateTime;
    const startTime = isAllDay ? null : new Date(event.start.dateTime);
    const endTime = isAllDay ? null : new Date(event.end.dateTime);

    // Get assignee from color
    const colorId = event.colorId || '5';
    const assigneeKey = GCAL_COLOR_MAP[colorId] || 'everyone';
    const assignee = CALENDAR_COLORS[assigneeKey];

    const location = event.location || '';

    let timeHtml;
    if (isAllDay) {
        timeHtml = '<span class="agenda-event-time-allday">All day</span>';
    } else {
        const startStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const endStr = endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        timeHtml = `
            <span class="agenda-event-time-start">${startStr}</span>
            <span class="agenda-event-time-end">${endStr}</span>
        `;
    }

    return `
        <button class="agenda-event" style="--event-color: ${assignee.color}"
                data-action="showCalendarEvent" data-param-id="${event.id}">
            <div class="agenda-event-time">${timeHtml}</div>
            <div class="agenda-event-content">
                <div class="agenda-event-title">${event.summary || 'Untitled'}</div>
                ${location ? `
                    <div class="agenda-event-location">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        </svg>
                        ${location}
                    </div>
                ` : ''}
            </div>
            <div class="agenda-event-assignee" style="background-color: ${assignee.color}">
                ${assignee.name.charAt(0)}
            </div>
        </button>
    `;
}

function selectCalendarDate(isoString) {
    vibrate(15);
    calendarSelectedDate = new Date(isoString);
    calendarCurrentMonth = new Date(isoString);

    // Reset week offset when selecting a specific date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedNormalized = new Date(calendarSelectedDate);
    selectedNormalized.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((selectedNormalized - today) / (1000 * 60 * 60 * 24));
    calendarWeekOffset = Math.floor(diffDays / 7);

    updateCalendarHeader();
    renderWeekStrip();
    renderAgenda();
    updateCalendarStats();
}

function calendarPrevMonth() {
    vibrate(15);
    calendarCurrentMonth.setMonth(calendarCurrentMonth.getMonth() - 1);
    calendarSelectedDate = new Date(calendarCurrentMonth);
    calendarSelectedDate.setDate(1);
    calendarWeekOffset = 0;

    // Calculate new week offset
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((calendarSelectedDate - today) / (1000 * 60 * 60 * 24));
    calendarWeekOffset = Math.floor(diffDays / 7);

    updateCalendarHeader();
    renderWeekStrip();
    renderMiniCalendar();
    renderAgenda();
}

function calendarNextMonth() {
    vibrate(15);
    calendarCurrentMonth.setMonth(calendarCurrentMonth.getMonth() + 1);
    calendarSelectedDate = new Date(calendarCurrentMonth);
    calendarSelectedDate.setDate(1);

    // Calculate new week offset
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((calendarSelectedDate - today) / (1000 * 60 * 60 * 24));
    calendarWeekOffset = Math.floor(diffDays / 7);

    updateCalendarHeader();
    renderWeekStrip();
    renderMiniCalendar();
    renderAgenda();
}

function calendarGoToday() {
    vibrate(20);
    calendarSelectedDate = new Date();
    calendarCurrentMonth = new Date();
    calendarWeekOffset = 0;

    updateCalendarHeader();
    renderWeekStrip();
    renderMiniCalendar();
    renderAgenda();
    updateCalendarStats();
}

function toggleMiniCalendar() {
    vibrate(15);
    const container = $('miniCalendarContainer');
    const icon = document.querySelector('.cal-dropdown-icon');

    miniCalendarExpanded = !miniCalendarExpanded;

    if (miniCalendarExpanded) {
        container.classList.remove('collapsed');
        container.classList.add('expanded');
        icon?.classList.add('open');
        renderMiniCalendar();
    } else {
        container.classList.remove('expanded');
        container.classList.add('collapsed');
        icon?.classList.remove('open');
    }
}

function renderMiniCalendar() {
    const container = $('miniCalendarGrid');
    if (!container) return;

    const year = calendarCurrentMonth.getFullYear();
    const month = calendarCurrentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Event dates for this month
    const eventDates = new Set(calendarEvents.map(e => {
        const d = new Date(e.start.dateTime || e.start.date);
        return d.toDateString();
    }));

    let html = '';

    // Day headers
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        html += `<div class="mini-cal-header">${day}</div>`;
    });

    // Empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
        const prevDate = new Date(year, month, i - startDay + 1);
        html += `<button class="mini-cal-day other-month" data-action="selectCalendarDate" data-param-date="${prevDate.toISOString()}">${prevDate.getDate()}</button>`;
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isToday = date.toDateString() === today.toDateString();
        const isSelected = date.toDateString() === calendarSelectedDate.toDateString();
        const hasEvents = eventDates.has(date.toDateString());

        html += `
            <button class="mini-cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasEvents ? 'has-events' : ''}"
                    data-action="selectCalendarDate" data-param-date="${date.toISOString()}">${day}</button>
        `;
    }

    // Fill remaining cells
    const totalCells = startDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
        const nextDate = new Date(year, month + 1, i);
        html += `<button class="mini-cal-day other-month" data-action="selectCalendarDate" data-param-date="${nextDate.toISOString()}">${i}</button>`;
    }

    container.innerHTML = html;
}

function showCalendarEvent(eventId) {
    vibrate(20);
    const event = calendarEvents.find(e => e.id === eventId);
    if (!event) return;

    const modal = $('calEventModal');
    if (!modal) return;

    // Title
    setText('calEventTitle', event.summary || 'Untitled');

    // Date
    const startDate = new Date(event.start.dateTime || event.start.date);
    const dateStr = startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });
    setText('calEventDate', dateStr);

    // Time
    const isAllDay = !event.start.dateTime;
    if (isAllDay) {
        setText('calEventTime', 'All day');
    } else {
        const endDate = new Date(event.end.dateTime);
        const startStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const endStr = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        setText('calEventTime', `${startStr} - ${endStr}`);
    }

    // Location
    const locationRow = $('calEventLocationRow');
    const locationEl = $('calEventLocation');
    if (event.location) {
        locationEl.textContent = event.location;
        locationRow.classList.remove('hidden');
    } else {
        locationRow.classList.add('hidden');
    }

    // Description
    const descRow = $('calEventDescRow');
    const descEl = $('calEventDesc');
    if (event.description) {
        descEl.textContent = event.description;
        descRow.classList.remove('hidden');
    } else {
        descRow.classList.add('hidden');
    }

    // Assignee
    const colorId = event.colorId || '5';
    const assigneeKey = GCAL_COLOR_MAP[colorId] || 'everyone';
    const assignee = CALENDAR_COLORS[assigneeKey];
    const assigneeEl = $('calEventAssignee');
    if (assigneeEl) {
        assigneeEl.innerHTML = `
            <div style="width: 28px; height: 28px; border-radius: 50%; background: ${assignee.color}; display: flex; align-items: center; justify-content: center; font-weight: 600; color: white; font-size: 0.75rem;">
                ${assignee.name.charAt(0)}
            </div>
            <span style="font-size: 0.875rem; color: var(--text-secondary)">${assignee.name}</span>
        `;
    }

    modal.classList.remove('hidden');
}

function closeCalEventModal() {
    const modal = $('calEventModal');
    if (modal) modal.classList.add('hidden');
}

function openQuickAddEvent() {
    vibrate(20);
    const modal = $('calQuickAddModal');
    if (!modal) return;

    // Reset form
    const titleInput = $('quickEventTitle');
    const dateInput = $('quickEventDate');
    const allDayCheckbox = $('quickEventAllDay');
    const descInput = $('quickEventDesc');

    if (titleInput) titleInput.value = '';
    if (dateInput) dateInput.value = calendarSelectedDate.toISOString().split('T')[0];
    if (allDayCheckbox) {
        allDayCheckbox.checked = true;
        toggleQuickEventTime();
    }
    if (descInput) descInput.value = '';

    modal.classList.remove('hidden');

    // Focus title input
    setTimeout(() => titleInput?.focus(), 300);
}

function closeQuickAddModal() {
    const modal = $('calQuickAddModal');
    if (modal) modal.classList.add('hidden');
}

function toggleQuickEventTime() {
    const allDayCheckbox = $('quickEventAllDay');
    const timeRow = $('quickTimeRow');
    if (allDayCheckbox && timeRow) {
        timeRow.classList.toggle('hidden', allDayCheckbox.checked);
    }
}

async function saveQuickEvent() {
    const title = $('quickEventTitle')?.value?.trim();
    if (!title) {
        $('quickEventTitle')?.focus();
        return;
    }

    vibrate(30);

    // Check if authenticated with Google Calendar
    if (!isAuthenticated()) {
        // Store event data to create after OAuth
        const pendingEvent = {
            title,
            date: $('quickEventDate')?.value,
            allDay: $('quickEventAllDay')?.checked,
            startTime: $('quickEventStart')?.value || '09:00',
            endTime: $('quickEventEnd')?.value || '10:00',
            description: $('quickEventDesc')?.value || '',
            assignee: $('quickEventAssignee')?.value || 'everyone'
        };
        localStorage.setItem('pending_calendar_event', JSON.stringify(pendingEvent));

        // Initiate OAuth flow - will redirect to Google sign-in
        initiateOAuthFlow();
        return;
    }

    // Authenticated - create event via API
    await createCalendarEvent();
}

async function createCalendarEvent() {
    const title = $('quickEventTitle')?.value?.trim();
    const dateInput = $('quickEventDate')?.value;
    const isAllDay = $('quickEventAllDay')?.checked;
    const startTime = $('quickEventStart')?.value || '09:00';
    const endTime = $('quickEventEnd')?.value || '10:00';
    const description = $('quickEventDesc')?.value || '';
    const assignee = $('quickEventAssignee')?.value || 'everyone';

    // Show loading state
    const saveBtn = document.querySelector('.cal-save-btn');
    const originalText = saveBtn?.textContent;
    if (saveBtn) {
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
    }

    try {
        // Build event data for API
        const eventData = {
            title,
            description,
            assignee,
            allDay: isAllDay
        };

        if (isAllDay) {
            eventData.startDate = dateInput;
            // End date is next day for all-day events in Google Calendar
            const endDateObj = new Date(dateInput);
            endDateObj.setDate(endDateObj.getDate() + 1);
            eventData.endDate = endDateObj.toISOString().split('T')[0];
        } else {
            eventData.startDateTime = `${dateInput}T${startTime}:00`;
            eventData.endDateTime = `${dateInput}T${endTime}:00`;
        }

        await createEvent(eventData);

        vibrate([30, 50, 30]); // Success vibration pattern

        // Refresh calendar view
        await fetchCalendarEvents();
        renderAgenda();
        renderWeekStrip();
        updateCalendarStats();

        closeQuickAddModal();

    } catch (error) {
        console.error('Failed to create event:', error);
        vibrate(100); // Error vibration

        // Show error message
        alert(`Failed to create event: ${error.message}`);

    } finally {
        // Restore button
        if (saveBtn) {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    }
}

// Check for pending event after OAuth callback
function checkPendingCalendarEvent() {
    const pending = localStorage.getItem('pending_calendar_event');
    if (pending && isAuthenticated()) {
        const eventData = JSON.parse(pending);
        localStorage.removeItem('pending_calendar_event');

        // Populate the form and show modal
        setTimeout(() => {
            showView('calendar');
            setTimeout(() => {
                openQuickAddEvent();
                // Fill in the form
                const titleInput = $('quickEventTitle');
                const dateInput = $('quickEventDate');
                const allDayCheckbox = $('quickEventAllDay');
                const startInput = $('quickEventStart');
                const endInput = $('quickEventEnd');
                const descInput = $('quickEventDesc');
                const assigneeSelect = $('quickEventAssignee');

                if (titleInput) titleInput.value = eventData.title;
                if (dateInput) dateInput.value = eventData.date;
                if (allDayCheckbox) allDayCheckbox.checked = eventData.allDay;
                if (startInput) startInput.value = eventData.startTime;
                if (endInput) endInput.value = eventData.endTime;
                if (descInput) descInput.value = eventData.description;
                if (assigneeSelect) assigneeSelect.value = eventData.assignee;

                toggleQuickEventTime();

                // Auto-submit
                createCalendarEvent();
            }, 300);
        }, 100);
    }
}

// ============================================
// ENERGY
// ============================================

function updateEnergy() {
    // Update solar/battery/load overview
    updateSolarStats();

    // Update appliances
    ENERGY_APPLIANCES.forEach(app => {
        const power = parseFloat(state.getEntity(app.id)?.state) || 0;
        setText(`${app.el}Power`, Math.round(power) + 'W');
        setText(`${app.el}Status`, power > 5 ? 'Running' : 'Idle');

        if (app.toggle && app.switch) {
            const isOn = state.getEntityState(app.switch) === 'on';
            const toggle = $(app.toggle);
            if (toggle) {
                toggleClass(toggle, 'on', isOn);
            }
        }
    });
}

function updateSolarStats() {
    // Solar production
    const solarPower = parseFloat(state.getEntity(ENERGY_SENSORS.solarPower)?.state) || 0;
    setText('solarPower', Math.round(solarPower) + 'W');

    // Battery percentage and state
    const batteryPercent = parseFloat(state.getEntity(ENERGY_SENSORS.batteryPercent)?.state) || 0;
    const batteryStateRaw = state.getEntity(ENERGY_SENSORS.batteryState)?.state || 'unknown';
    const batteryPower = parseFloat(state.getEntity(ENERGY_SENSORS.batteryPower)?.state) || 0;

    setText('batteryPercent', Math.round(batteryPercent) + '%');

    // Format battery state label
    let batteryLabel = 'Battery';
    if (batteryStateRaw === 'charging' || batteryPower > 0) {
        batteryLabel = 'Charging';
    } else if (batteryStateRaw === 'discharging' || batteryPower < 0) {
        batteryLabel = 'Discharging';
    } else if (batteryStateRaw === 'standby' || batteryPower === 0) {
        batteryLabel = 'Standby';
    }
    setText('batteryState', batteryLabel);

    // Update battery bar
    const batteryBar = $('batteryBarFill');
    if (batteryBar) {
        batteryBar.style.width = Math.min(100, Math.max(0, batteryPercent)) + '%';

        // Color based on level
        if (batteryPercent < 20) {
            batteryBar.style.background = 'linear-gradient(90deg, var(--accent-red), var(--accent-orange))';
        } else if (batteryPercent < 50) {
            batteryBar.style.background = 'linear-gradient(90deg, var(--accent-amber), var(--accent-orange))';
        } else {
            batteryBar.style.background = 'linear-gradient(90deg, var(--accent-emerald), var(--accent-teal))';
        }
    }

    // House load
    const loadPower = parseFloat(state.getEntity(ENERGY_SENSORS.loadPower)?.state) || 0;
    setText('loadPower', Math.round(loadPower) + 'W');

    // Grid power
    const gridPower = parseFloat(state.getEntity(ENERGY_SENSORS.gridPower)?.state) || 0;
    setText('gridPower', Math.round(Math.abs(gridPower)) + 'W');
    setText('gridDirection', gridPower > 10 ? 'Importing' : gridPower < -10 ? 'Exporting' : 'Idle');

    // Record power data for the trend chart
    recordPowerData({
        loadPower,
        solarPower,
        gridPower,
        batteryPower
    });
}

// ============================================
// VIEW SWITCHING
// ============================================

function showView(view) {
    state.setCurrentView(view);

    // Hide ALL views (including More menu views like alexa, surveillance, guest-pass)
    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));

    // Show the target view
    const targetView = $(`view-${view}`);
    if (targetView) targetView.classList.remove('hidden');

    // Update bottom nav (family doesn't have bottom nav item)
    ['home', 'cameras', 'calendar', 'security', 'energy'].forEach(v => {
        const navItem = $(`nav-${v}`);
        if (navItem) toggleClass(navItem, 'active', v === view);
    });

    // Handle view-specific updates
    if (view === 'cameras') {
        startCameraRefresh();
        startDeliveryModePolling();
    } else {
        stopCameraRefresh();
        stopDeliveryModePolling();
    }

    if (view === 'security') {
        updateSecurityView();
    }

    if (view === 'energy') {
        updateEnergy();
        // Initialize and resize chart when energy view is shown
        setTimeout(() => {
            initEnergyChart();
            resizeChart();
        }, 100);
    }

    if (view === 'family') {
        updateFamilyView();
    }

    if (view === 'calendar') {
        initCalendarView();
    }
}

// ============================================
// CAMERA REFRESH
// ============================================

function updateAccessCameras() {
    if (state.currentView !== 'cameras') {
        state.setAccessControlTimer(null);
        return;
    }

    const timestamp = Date.now();

    const gateImg = $('cam-gate');
    if (gateImg) {
        gateImg.src = getCameraUrl(ACCESS_CAMERAS.gate.frigate, timestamp);
    }

    const garageImg = $('cam-garage');
    if (garageImg) {
        garageImg.src = getCameraUrl(ACCESS_CAMERAS.garage.frigate, timestamp);
    }

    updateGateGarageStatus();

    const refreshRate = state.isLocalNetwork() ? REFRESH_RATES.camerasLocal : REFRESH_RATES.camerasExternal;
    const timer = setTimeout(updateAccessCameras, refreshRate);
    state.setAccessControlTimer(timer);
}

function startCameraRefresh() {
    if (!state.accessControlTimer) {
        updateAccessCameras();
    }
}

function stopCameraRefresh() {
    state.clearAccessControlTimer();
}

// ============================================
// GATE & GARAGE CONTROLS
// ============================================

function toggleGate() {
    callService('cover', 'toggle', { entity_id: GATE_COVER });
}

function toggleGarage() {
    callService('cover', 'toggle', { entity_id: GARAGE_COVER });
}

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

function toggleGateWithFeedback() {
    // Check if dashboard is ready (connected and has data)
    if (!state.authenticated || Object.keys(state.entities).length === 0) {
        console.warn('Dashboard not ready - connection pending');
        showNotReadyOverlay();
        return;
    }

    vibrate(30);
    showActionOverlay('gate');

    const btn = $('gateBtn');
    if (btn) {
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => btn.style.transform = '', 150);
    }
    toggleGate();
}

function toggleGarageWithFeedback() {
    // Check if dashboard is ready (connected and has data)
    if (!state.authenticated || Object.keys(state.entities).length === 0) {
        console.warn('Dashboard not ready - connection pending');
        showNotReadyOverlay();
        return;
    }

    vibrate(30);
    showActionOverlay('garage');

    const btn = $('garageBtn');
    if (btn) {
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => btn.style.transform = '', 150);
    }
    toggleGarage();
}

// ============================================
// ENTITY TOGGLE
// ============================================

function toggleEntity(entityId) {
    vibrate(20);
    const domain = entityId.startsWith('light.') ? 'light' : 'switch';
    const currentlyOn = state.getEntityState(entityId) === 'on';
    const service = currentlyOn ? 'turn_off' : 'turn_on';
    callService(domain, service, { entity_id: entityId });

    // Optimistic update
    const currentEntity = state.getEntity(entityId);
    if (currentEntity) {
        state.setEntity(entityId, {
            ...currentEntity,
            state: currentlyOn ? 'off' : 'on'
        });
    }

    // Immediately re-render UI
    refreshOpenModal();
    refreshAllLightsModal();
    updateRoomGrid();
    updateLightsCount();
}

function toggleAllRoomLights(roomId, turnOn) {
    vibrate(30);
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

        const currentEntity = state.getEntity(id);
        if (currentEntity) {
            state.setEntity(id, {
                ...currentEntity,
                state: turnOn ? 'on' : 'off'
            });
        }
    });

    // Immediately re-render UI
    refreshOpenModal();
    updateRoomGrid();
    updateLightsCount();
}

function allLightsOff() {
    vibrate(50);
    const allLights = getAllLights();
    allLights.forEach(id => {
        if (state.getEntityState(id) === 'on') {
            const domain = id.startsWith('light.') ? 'light' : 'switch';
            callService(domain, 'turn_off', { entity_id: id });

            // Optimistic update
            const currentEntity = state.getEntity(id);
            if (currentEntity) {
                state.setEntity(id, { ...currentEntity, state: 'off' });
            }
        }
    });

    // Immediately re-render UI
    refreshAllLightsModal();
    updateRoomGrid();
    updateLightsCount();
}

// ============================================
// ROOM MODAL
// ============================================

function openRoomModal(roomId) {
    vibrate(20);
    state.setOpenRoomId(roomId);
    renderRoomModal(roomId);
    show('roomModal');

    // Animate sheet in
    setTimeout(() => {
        const sheet = $('roomModalSheet');
        if (sheet) sheet.classList.add('open');
    }, 10);
}

function closeRoomModal() {
    const sheet = $('roomModalSheet');
    if (sheet) sheet.classList.remove('open');

    setTimeout(() => {
        hide('roomModal');
        state.setOpenRoomId(null);
    }, 300);
}

function renderRoomModal(roomId) {
    const allRooms = [...ROOMS.ground, ...ROOMS.upper];
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;

    const onLights = room.lights.filter(id => state.getEntityState(id) === 'on').length;
    const allOn = onLights === room.lights.length;
    const someOn = onLights > 0;

    setText('modalRoomName', room.name);
    setText('modalRoomStatus', someOn ? `${onLights} of ${room.lights.length} lights on` : 'All lights off');

    const iconEl = $('modalRoomIcon');
    if (iconEl) {
        iconEl.setAttribute('class', `room-icon ${room.color}`);
        iconEl.innerHTML = `
            <svg style="width: 22px; height: 22px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                ${ICONS[room.icon] || ICONS.light}
            </svg>
        `;
    }

    // Master controls
    const masterControls = $('modalMasterControls');
    if (masterControls) {
        masterControls.innerHTML = `
            <button class="master-btn all-on" data-action="toggleAllRoomLights" data-param-room="${roomId}" data-param-turnon="true">
                <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${ICONS.light}
                </svg>
                All On
            </button>
            <button class="master-btn all-off" data-action="toggleAllRoomLights" data-param-room="${roomId}" data-param-turnon="false">
                <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                </svg>
                All Off
            </button>
        `;
    }

    // Light grid
    const lightGrid = $('modalLightGrid');
    if (lightGrid) {
        lightGrid.innerHTML = room.lights.map((id, idx) => {
            const isOn = state.getEntityState(id) === 'on';
            const name = room.lightNames?.[idx] || (room.lights.length > 1 ? `Light ${idx + 1}` : 'Light');

            return `
                <button class="light-btn ${isOn ? 'on' : ''}" data-action="toggleEntity" data-param-entity="${id}">
                    <div class="light-icon">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${ICONS.light}
                        </svg>
                    </div>
                    <span class="light-name">${name}</span>
                </button>
            `;
        }).join('');
    }
}

function refreshOpenModal() {
    if (state.openRoomId) {
        renderRoomModal(state.openRoomId);
    }
}

// ============================================
// ALL LIGHTS MODAL
// ============================================

function openAllLightsModal() {
    vibrate(20);
    state.setAllLightsModalOpen(true);
    renderAllLightsGrid();
    show('allLightsModal');

    setTimeout(() => {
        const sheet = $('allLightsModalSheet');
        if (sheet) sheet.classList.add('open');
    }, 10);
}

function closeAllLightsModal() {
    const sheet = $('allLightsModalSheet');
    if (sheet) sheet.classList.remove('open');

    setTimeout(() => {
        hide('allLightsModal');
        state.setAllLightsModalOpen(false);
    }, 300);
}

function renderAllLightsGrid() {
    const grid = $('allLightsGrid');
    if (!grid) return;

    const renderLights = (rooms) => rooms.flatMap(room =>
        room.lights.map((id, idx) => {
            const isOn = state.getEntityState(id) === 'on';
            const name = room.lightNames?.[idx] || (room.lights.length > 1 ? `${room.name} ${idx + 1}` : room.name);

            return `
                <button class="light-btn ${isOn ? 'on' : ''}" data-action="toggleEntity" data-param-entity="${id}">
                    <div class="light-icon">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${ICONS.light}
                        </svg>
                    </div>
                    <span class="light-name">${name}</span>
                </button>
            `;
        })
    ).join('');

    grid.innerHTML = renderLights([...ROOMS.ground, ...ROOMS.upper]);
}

function refreshAllLightsModal() {
    if (state.allLightsModalOpen) {
        renderAllLightsGrid();
    }
}

// ============================================
// CONNECTION UI
// ============================================

function showConnecting() {
    const dot = $('connDot');
    if (dot) {
        dot.classList.remove('disconnected');
        dot.style.background = 'var(--accent-amber)';
    }
}

function showConnected() {
    const dot = $('connDot');
    if (dot) {
        dot.classList.remove('disconnected');
        dot.style.background = 'var(--accent-emerald)';
    }
}

function showDisconnected() {
    const dot = $('connDot');
    if (dot) {
        dot.classList.add('disconnected');
        dot.style.background = 'var(--accent-red)';
    }
}

function showError(msg) {
    const el = $('errorMsg');
    if (el) {
        el.textContent = msg;
        el.classList.remove('hidden');
    }
}

// ============================================
// INITIALIZATION
// ============================================

// Hardcoded Home Assistant URL for mobile app
const HA_URL = 'http://192.168.x.x:8123';

async function init() {
    // Initialize event delegation (data-action handlers)
    initMobileEventDelegation();
    registerMobileActions();

    // Start clock
    updateClock();
    setInterval(updateClock, REFRESH_RATES.clock);

    // Setup connection callbacks
    setConnectionCallbacks({
        onConnecting: showConnecting,
        onConnected: () => {
            showConnected();
            hide('connectModal');
            show('app');
            // Load historical chart data from Home Assistant
            loadHistoryFromHA();
        },
        onDisconnected: showDisconnected,
        onError: () => showDisconnected(),
        onAuthInvalid: () => {
            show('connectModal');
            hide('app');
            showError('Invalid token');
        },
        onStatesUpdated: updateUI
    });

    // Auto-connect if token exists (URL is hardcoded)
    if (state.haToken) {
        // Ensure URL is set to hardcoded value
        state.setCredentials(HA_URL, state.haToken);
        hide('connectModal');
        show('app');
        connectWebSocket();
    }

    // Check for pending calendar event after OAuth callback
    checkPendingCalendarEvent();
}

// ============================================
// CONNECTION HANDLER
// ============================================

function connectHA() {
    const token = $('haToken')?.value?.trim();

    if (!token) {
        showError('Please enter your access token');
        return;
    }

    // Use hardcoded URL with provided token
    state.setCredentials(HA_URL, token);
    hide('connectModal');
    show('app');
    connectWebSocket();
}

// ============================================
// AI SURVEILLANCE MODULE - Mobile Optimized
// ============================================

const FRIGATE_CLIENT_ID = 'frigate';
const LOCAL_FRIGATE_API = 'http://192.168.x.x:5003/api';

// Surveillance state
let survState = {
    events: [],
    selectedEvent: null,
    timeFilter: '1h',
    objectFilter: 'all',
    isLoading: false
};

function isLocalNetwork() {
    const host = window.location.hostname;
    return host.startsWith('192.168.') || host.startsWith('10.') || host === 'localhost';
}

function getHaBaseUrl() {
    if (window.location.hostname.includes('nabu.casa')) return window.location.origin;
    if (window.location.port === '8123') return window.location.origin;
    return 'http://192.168.x.x:8123';
}

function getEventThumbnailUrl(eventId) {
    if (isLocalNetwork()) return `${LOCAL_FRIGATE_API}/events/${eventId}/thumbnail.jpg`;
    return `${getHaBaseUrl()}/api/frigate/${FRIGATE_CLIENT_ID}/notifications/${eventId}/thumbnail.jpg`;
}

function getEventClipUrl(eventId) {
    if (isLocalNetwork()) return `${LOCAL_FRIGATE_API}/events/${eventId}/clip.mp4`;
    return `${getHaBaseUrl()}/api/frigate/${FRIGATE_CLIENT_ID}/notifications/${eventId}/clip.mp4`;
}

function getEventSnapshotUrl(eventId) {
    if (isLocalNetwork()) return `${LOCAL_FRIGATE_API}/events/${eventId}/snapshot.jpg`;
    return `${getHaBaseUrl()}/api/frigate/${FRIGATE_CLIENT_ID}/notifications/${eventId}/snapshot.jpg`;
}

async function loadSurveillanceEvents() {
    survState.isLoading = true;
    const loadingEl = $('survMobileLoading');
    const eventsListEl = $('survMobileEventsList');

    try {
        // Time filter map
        const timeMap = { '1h': 3600, '6h': 21600, '24h': 86400 };
        const seconds = timeMap[survState.timeFilter] || 3600;
        const before = Math.floor(Date.now() / 1000);
        const after = before - seconds;

        let events = [];

        if (isLocalNetwork()) {
            // Direct Frigate API for local access
            const url = `${LOCAL_FRIGATE_API}/events?after=${after}&before=${before}&limit=50`;
            const response = await fetch(url);
            if (response.ok) {
                events = await response.json();
            }
        } else {
            // For external access, try MQTT subscription or recent events
            // Fall back to showing a message about local-only feature
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 48px; height: 48px; margin-bottom: var(--spacing-md);">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                    <h3>Local Network Required</h3>
                    <p>Event listing requires local network access. Recent notifications are available.</p>
                `;
            }
            survState.isLoading = false;
            return;
        }

        // Filter by object type if set
        if (survState.objectFilter !== 'all') {
            events = events.filter(e => e.label === survState.objectFilter);
        }

        survState.events = events;

        // Update stats
        updateSurvStats();

        // Render events
        renderSurvEvents();

    } catch (e) {
        console.error('[Surveillance] Failed to load events:', e);
        if (loadingEl) {
            loadingEl.innerHTML = `
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 48px; height: 48px; margin-bottom: var(--spacing-md);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <h3>Connection Error</h3>
                <p>Unable to reach Frigate. Please try again.</p>
            `;
        }
    }

    survState.isLoading = false;
}

function updateSurvStats() {
    const events = survState.events;
    const $todayEvents = $('survMobileTodayEvents');
    const $personCount = $('survMobilePersonCount');
    const $vehicleCount = $('survMobileVehicleCount');
    const $aiCount = $('survMobileAiCount');

    if ($todayEvents) $todayEvents.textContent = events.length;
    if ($personCount) $personCount.textContent = events.filter(e => e.label === 'person').length;
    if ($vehicleCount) $vehicleCount.textContent = events.filter(e => e.label === 'car').length;
    if ($aiCount) $aiCount.textContent = events.filter(e => e.data?.top_score >= 0.7).length;

    const $lastUpdate = $('survMobileLastUpdate');
    if ($lastUpdate) {
        const now = new Date();
        $lastUpdate.textContent = `LAST UPDATE ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
}

function renderSurvEvents() {
    const eventsListEl = $('survMobileEventsList');
    if (!eventsListEl) return;

    if (survState.events.length === 0) {
        eventsListEl.innerHTML = `
            <div class="surv-empty">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <h3>All Clear</h3>
                <p>No events in the selected time range</p>
            </div>
        `;
        return;
    }

    const cameraNames = {
        front_door: 'Front Door',
        backyard: 'Backyard',
        wyze_garage: 'Garage',
        ezviz_indoor: 'Indoor'
    };

    eventsListEl.innerHTML = survState.events.map(event => {
        const time = new Date(event.start_time * 1000);
        const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const confidence = Math.round((event.data?.top_score || event.score || 0) * 100);
        const cameraName = cameraNames[event.camera] || event.camera;
        const isThreat = event.data?.ai_result?.includes('THREAT');

        return `
            <div class="surv-event-card ${isThreat ? 'threat' : ''}" data-action="openSurvEventDetail" data-param-id="${event.id}">
                <div class="surv-event-thumb">
                    <img src="${getEventThumbnailUrl(event.id)}" alt="${event.label}" onerror="this.style.opacity='0.3'">
                    <div class="play-overlay">
                        <svg fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                    </div>
                </div>
                <div class="surv-event-info">
                    <div class="surv-event-header">
                        <span class="surv-event-label ${event.label}">${event.label.toUpperCase()}</span>
                        <span class="surv-event-confidence">${confidence}%</span>
                    </div>
                    <div class="surv-event-camera">${cameraName}</div>
                    <div class="surv-event-time">${timeStr} • ${dateStr}</div>
                    ${event.data?.ai_result ? `<div class="surv-event-ai ${isThreat ? 'threat' : ''}">${event.data.ai_result.substring(0, 80)}...</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function setSurvTimeFilter(time) {
    survState.timeFilter = time;
    document.querySelectorAll('.surv-filter-btn[data-time]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.time === time);
    });
    loadSurveillanceEvents();
    haptic.light();
}

function setSurvObjectFilter(obj) {
    survState.objectFilter = survState.objectFilter === obj ? 'all' : obj;
    document.querySelectorAll('.surv-filter-btn[data-obj]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.obj === survState.objectFilter);
    });
    loadSurveillanceEvents();
    haptic.light();
}

function openSurvEventDetail(eventId) {
    const event = survState.events.find(e => e.id === eventId);
    if (!event) return;

    survState.selectedEvent = event;
    haptic.medium();

    const modal = $('survDetailModal');
    const $label = $('survDetailLabel');
    const $camera = $('survDetailCamera');
    const $image = $('survDetailImage');
    const $video = $('survDetailVideo');
    const $time = $('survDetailTime');
    const $confidence = $('survDetailConfidence');
    const $ai = $('survDetailAI');

    const cameraNames = { front_door: 'Front Door', backyard: 'Backyard', wyze_garage: 'Garage', ezviz_indoor: 'Indoor' };

    if ($label) {
        $label.textContent = event.label.toUpperCase();
        $label.className = `surv-event-label ${event.label}`;
    }
    if ($camera) $camera.textContent = cameraNames[event.camera] || event.camera;
    if ($image) $image.src = getEventSnapshotUrl(event.id);
    if ($video) $video.classList.add('hidden');
    if ($image) $image.classList.remove('hidden');

    const time = new Date(event.start_time * 1000);
    if ($time) $time.textContent = time.toLocaleString();
    if ($confidence) $confidence.textContent = `${Math.round((event.data?.top_score || event.score || 0) * 100)}% certainty`;
    if ($ai) $ai.textContent = event.data?.ai_result || 'No AI analysis available';

    if (modal) modal.classList.remove('hidden');
}

function closeSurvDetailModal() {
    const modal = $('survDetailModal');
    const video = $('survDetailVideo');
    if (video) {
        video.pause();
        video.src = '';
    }
    if (modal) modal.classList.add('hidden');
}

function playSurvClip() {
    if (!survState.selectedEvent) return;
    const $image = $('survDetailImage');
    const $video = $('survDetailVideo');

    if ($image) $image.classList.add('hidden');
    if ($video) {
        $video.src = getEventClipUrl(survState.selectedEvent.id);
        $video.classList.remove('hidden');
        $video.play();
    }
}

function downloadSurvClip() {
    if (!survState.selectedEvent) return;
    window.open(getEventClipUrl(survState.selectedEvent.id), '_blank');
}

// ============================================
// GUEST PASS MODULE - Mobile Optimized
// ============================================

const GUEST_PASS_URL = 'https://your-instance.ui.nabu.casa/local/dashboard/guest-access.html';
const PASSES_FILE_URL = '/local/dashboard/data/passes.json';
const PRESETS = { day: 86400000, week: 604800000, month: 2592000000, lifetime: 3153600000000 };

let guestState = {
    preset: 'day',
    generatedPass: null,
    passes: []
};

function setGuestPreset(preset) {
    guestState.preset = preset;
    document.querySelectorAll('.guest-preset').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === preset);
    });
    haptic.light();
}

function simpleHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return hash >>> 0;
}

function generateSignature(message, key) {
    const combined1 = key + message + key;
    const combined2 = message + key + message;
    const hash1 = simpleHash(combined1);
    const hash2 = simpleHash(combined2);
    const hash3 = simpleHash(key + hash1.toString() + hash2.toString());
    return (hash1.toString(16) + hash2.toString(16) + hash3.toString(16)).padStart(24, '0');
}

function generatePassId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'gp_';
    for (let i = 0; i < 10; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
    return id;
}

async function generateMobileGuestPass() {
    const nameInput = $('guestMobileName');
    const name = nameInput?.value?.trim();

    if (!name) {
        haptic.error();
        nameInput?.focus();
        return;
    }

    haptic.medium();

    const gateChecked = $('guestMobilePermGate')?.checked ?? true;
    const garageChecked = $('guestMobilePermGarage')?.checked ?? true;
    const permissions = [];
    if (gateChecked) permissions.push('gate');
    if (garageChecked) permissions.push('garage');

    const now = new Date();
    const duration = PRESETS[guestState.preset] || PRESETS.day;
    const validUntil = new Date(now.getTime() + duration);

    const secretEntity = state.entities['input_text.guest_pass_secret'];
    const secretKey = secretEntity?.state || 'townsend-golden-ticket-2024';

    const passData = {
        v: 1,
        id: generatePassId(),
        name: name,
        perms: permissions,
        validFrom: Math.floor(now.getTime() / 1000),
        validUntil: Math.floor(validUntil.getTime() / 1000),
        created: Math.floor(Date.now() / 1000),
        creator: 'Mobile'
    };

    const payloadString = JSON.stringify(passData);
    const fullSig = generateSignature(payloadString, secretKey);
    passData.sig = fullSig.substring(0, 16);

    const token = btoa(JSON.stringify(passData)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const passUrl = `${GUEST_PASS_URL}?token=${token}`;

    guestState.generatedPass = { passData, token, url: passUrl };

    // Save pass to storage
    saveGuestPass(passData);

    // Show modal
    const $modal = $('guestMobilePassModal');
    const $name = $('guestModalName');
    const $url = $('guestModalUrl');
    const $validity = $('guestModalValidity');

    if ($name) $name.textContent = name;
    if ($url) $url.value = passUrl;

    const durationLabels = { day: '24 hours', week: '1 week', month: '1 month', lifetime: 'Lifetime access' };
    if ($validity) $validity.textContent = `Valid for ${durationLabels[guestState.preset] || '24 hours'}`;

    if ($modal) $modal.classList.remove('hidden');

    // Clear input
    if (nameInput) nameInput.value = '';

    haptic.success();
}

async function saveGuestPass(passData) {
    try {
        const stored = localStorage.getItem('townsend_guest_passes');
        const passes = stored ? JSON.parse(stored) : [];
        passes.push({
            ...passData,
            active: true,
            durationType: guestState.preset
        });
        localStorage.setItem('townsend_guest_passes', JSON.stringify(passes));

        // Save to server for cross-browser sync (only on HTTP to avoid mixed content)
        if (window.location.protocol === 'http:') {
            const saveUrl = 'http://192.168.x.x:8124/save';
            const data = {
                version: 1,
                passes: passes,
                activity: [],
                lastModified: new Date().toISOString()
            };
            fetch(saveUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).catch(e => console.warn('[GuestPass] Server save failed:', e));
        }

        loadGuestPasses();
    } catch (e) {
        console.error('[GuestPass] Failed to save:', e);
    }
}

async function loadGuestPasses() {
    try {
        // Load from static JSON file (works over both HTTP and HTTPS)
        const loadUrl = PASSES_FILE_URL + '?t=' + Date.now();
        try {
            const response = await fetch(loadUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.passes && data.passes.length > 0) {
                    guestState.passes = data.passes;
                    localStorage.setItem('townsend_guest_passes', JSON.stringify(data.passes));
                    console.log('[GuestPass] Loaded from server:', data.passes.length, 'passes');
                    renderGuestPasses();
                    return;
                }
            }
        } catch (e) {
            console.warn('[GuestPass] Server load failed, using localStorage:', e);
        }

        // Fallback to localStorage
        const stored = localStorage.getItem('townsend_guest_passes');
        guestState.passes = stored ? JSON.parse(stored) : [];
        renderGuestPasses();
    } catch (e) {
        guestState.passes = [];
        renderGuestPasses();
    }
}

function renderGuestPasses() {
    const listEl = $('guestMobilePassesList');
    const countEl = $('guestMobilePassCount');
    if (!listEl) return;

    const now = Math.floor(Date.now() / 1000);
    const activePasses = guestState.passes.filter(p => p.active && p.validUntil > now);

    if (countEl) countEl.textContent = `${activePasses.length} active`;

    if (activePasses.length === 0) {
        listEl.innerHTML = `
            <div class="guest-empty">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
                </svg>
                <h3>No active passes</h3>
                <p>Create one to share access with guests</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = activePasses.map(pass => {
        const expiry = new Date(pass.validUntil * 1000);
        const expiryStr = expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const initial = pass.name.charAt(0).toUpperCase();

        return `
            <div class="guest-pass-card">
                <div class="guest-pass-avatar">${initial}</div>
                <div class="guest-pass-info">
                    <div class="guest-pass-name">${pass.name}</div>
                    <div class="guest-pass-meta">
                        <div class="guest-pass-perms">
                            ${pass.perms.includes('gate') ? '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--accent-purple);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>' : ''}
                            ${pass.perms.includes('garage') ? '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--accent-blue);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>' : ''}
                        </div>
                        <div class="guest-pass-expires">Expires ${expiryStr}</div>
                    </div>
                </div>
                <div class="guest-pass-actions">
                    <button class="guest-pass-btn share" data-action="reshareGuestPass" data-param-id="${pass.id}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                    </button>
                    <button class="guest-pass-btn revoke" data-action="revokeGuestPass" data-param-id="${pass.id}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function revokeGuestPass(passId) {
    haptic.medium();
    const passes = guestState.passes.map(p => {
        if (p.id === passId) p.active = false;
        return p;
    });
    localStorage.setItem('townsend_guest_passes', JSON.stringify(passes));
    guestState.passes = passes;
    renderGuestPasses();
}

function reshareGuestPass(passId) {
    const pass = guestState.passes.find(p => p.id === passId);
    if (!pass) return;

    const secretEntity = state.entities['input_text.guest_pass_secret'];
    const secretKey = secretEntity?.state || 'townsend-golden-ticket-2024';

    const passData = {
        v: 1,
        id: pass.id,
        name: pass.name,
        perms: pass.perms,
        validFrom: pass.validFrom,
        validUntil: pass.validUntil,
        created: pass.created,
        creator: 'Mobile',
        sig: pass.sig
    };

    const token = btoa(JSON.stringify(passData)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const passUrl = `${GUEST_PASS_URL}?token=${token}`;

    guestState.generatedPass = { passData, token, url: passUrl };

    const $modal = $('guestMobilePassModal');
    const $name = $('guestModalName');
    const $url = $('guestModalUrl');
    const $validity = $('guestModalValidity');

    if ($name) $name.textContent = pass.name;
    if ($url) $url.value = passUrl;

    const expiry = new Date(pass.validUntil * 1000);
    if ($validity) $validity.textContent = `Expires ${expiry.toLocaleDateString()}`;

    if ($modal) $modal.classList.remove('hidden');
    haptic.light();
}

function closeGuestPassModal() {
    const modal = $('guestMobilePassModal');
    if (modal) modal.classList.add('hidden');
}

async function copyGuestPassUrl() {
    const input = $('guestModalUrl');
    const btnText = $('guestCopyBtnText');
    if (!input) return;

    try {
        await navigator.clipboard.writeText(input.value);
        if (btnText) btnText.textContent = 'Copied!';
        haptic.success();
        setTimeout(() => { if (btnText) btnText.textContent = 'Copy'; }, 2000);
    } catch (e) {
        input.select();
        document.execCommand('copy');
        if (btnText) btnText.textContent = 'Copied!';
        haptic.success();
        setTimeout(() => { if (btnText) btnText.textContent = 'Copy'; }, 2000);
    }
}

function shareGuestPassWhatsApp() {
    if (!guestState.generatedPass) return;
    const { passData, url } = guestState.generatedPass;
    const message = encodeURIComponent(`Here's your access pass for Townsend House: ${url}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
    haptic.light();
}

function shareGuestPassNative() {
    if (!guestState.generatedPass || !navigator.share) return;
    const { passData, url } = guestState.generatedPass;

    navigator.share({
        title: 'Guest Access Pass',
        text: `Here's your access pass for Townsend House`,
        url: url
    }).catch(() => {});
    haptic.light();
}

// ============================================
// MORE MENU
// ============================================

function openMoreMenu() {
    const overlay = $('moreMenuOverlay');
    if (overlay) overlay.classList.remove('hidden');
    haptic.light();
}

function closeMoreMenu() {
    const overlay = $('moreMenuOverlay');
    if (overlay) overlay.classList.add('hidden');
}

// ============================================
// HAPTIC FEEDBACK HELPER - Enhanced 2025 Patterns
// ============================================

const haptic = {
    // Basic patterns
    light: () => { try { navigator.vibrate?.(8); } catch(e) {} },
    medium: () => { try { navigator.vibrate?.(20); } catch(e) {} },
    heavy: () => { try { navigator.vibrate?.([35, 15, 35]); } catch(e) {} },

    // Contextual patterns
    tap: () => { try { navigator.vibrate?.(6); } catch(e) {} },
    press: () => { try { navigator.vibrate?.(15); } catch(e) {} },
    release: () => { try { navigator.vibrate?.(8); } catch(e) {} },

    // Feedback patterns
    success: () => { try { navigator.vibrate?.([8, 40, 12]); } catch(e) {} },
    error: () => { try { navigator.vibrate?.([40, 80, 40]); } catch(e) {} },
    warning: () => { try { navigator.vibrate?.([20, 50, 20, 50, 20]); } catch(e) {} },

    // Action patterns
    toggle: () => { try { navigator.vibrate?.([12, 30, 8]); } catch(e) {} },
    confirm: () => { try { navigator.vibrate?.([10, 20, 25]); } catch(e) {} },
    dismiss: () => { try { navigator.vibrate?.(5); } catch(e) {} },

    // Security patterns
    arm: () => { try { navigator.vibrate?.([30, 50, 30, 50, 50]); } catch(e) {} },
    disarm: () => { try { navigator.vibrate?.([15, 30, 15]); } catch(e) {} },

    // Navigation patterns
    navigate: () => { try { navigator.vibrate?.(10); } catch(e) {} },
    select: () => { try { navigator.vibrate?.(12); } catch(e) {} }
};

// ============================================
// PREMIUM PRESS FEEDBACK SYSTEM
// ============================================

const pressFeedback = {
    // Create ripple effect on element
    createRipple(element, event) {
        // Check for reduced motion preference
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2;

        // Get touch/click position
        const x = (event.touches ? event.touches[0].clientX : event.clientX) - rect.left - size / 2;
        const y = (event.touches ? event.touches[0].clientY : event.clientY) - rect.top - size / 2;

        const ripple = document.createElement('div');
        ripple.className = 'press-ripple';
        ripple.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
        `;

        // Ensure element has position for ripple
        const position = getComputedStyle(element).position;
        if (position === 'static') {
            element.style.position = 'relative';
        }
        element.style.overflow = 'hidden';

        element.appendChild(ripple);

        // Remove ripple after animation
        setTimeout(() => ripple.remove(), 500);
    },

    // Add flash highlight effect
    flash(element) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        element.classList.add('press-flash');
        setTimeout(() => element.classList.remove('press-flash'), 300);
    },

    // Add success pulse effect
    success(element) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        element.classList.add('press-success');
        setTimeout(() => element.classList.remove('press-success'), 400);
    },

    // Bounce icon inside element
    bounceIcon(element) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const icon = element.querySelector('svg, .icon, .light-icon, .room-icon, .icon-wrapper');
        if (icon) {
            icon.classList.add('icon-bounce');
            setTimeout(() => icon.classList.remove('icon-bounce'), 300);
        }
    }
};

// ============================================
// GLOBAL PRESS HANDLER - Auto-attach feedback
// ============================================

function initPremiumPressFeedback() {
    // Elements that get ripple + haptic on press
    const interactiveSelectors = [
        '.nav-item',
        '.status-pill',
        '.room-card',
        '.camera-card',
        '.quick-action-btn',
        '.alarm-btn',
        '.light-btn',
        '.master-btn',
        '.floor-btn',
        '.modal-close',
        '.cal-nav-btn',
        '.cal-today-btn',
        '.cal-view-btn',
        '.metric-tab',
        '.surv-filter-btn',
        '.guest-preset',
        '.more-menu-item',
        '.connect-btn',
        '.zone-item',
        '.leaderboard-item',
        '[data-action]'
    ].join(', ');

    // Use event delegation on document
    document.addEventListener('touchstart', (e) => {
        const target = e.target.closest(interactiveSelectors);
        if (target) {
            // Haptic on press start
            haptic.press();

            // Create ripple at touch point
            pressFeedback.createRipple(target, e);
        }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        const target = e.target.closest(interactiveSelectors);
        if (target) {
            // Light haptic on release
            haptic.release();

            // Bounce icon for satisfying feedback
            setTimeout(() => pressFeedback.bounceIcon(target), 50);
        }
    }, { passive: true });

    // Mouse support for desktop
    document.addEventListener('mousedown', (e) => {
        // Skip if touch device
        if ('ontouchstart' in window) return;

        const target = e.target.closest(interactiveSelectors);
        if (target) {
            pressFeedback.createRipple(target, e);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if ('ontouchstart' in window) return;

        const target = e.target.closest(interactiveSelectors);
        if (target) {
            setTimeout(() => pressFeedback.bounceIcon(target), 50);
        }
    });
}

// Initialize premium feedback on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPremiumPressFeedback);
} else {
    initPremiumPressFeedback();
}

// ============================================
// VIEW SWITCHING EXTENSION
// ============================================

// Extend showView to handle new views
const originalShowView = showView;
function showViewExtended(viewName) {
    // For standard views, use original showView which has view-specific logic
    const standardViews = ['home', 'cameras', 'security', 'energy', 'family', 'calendar'];
    if (standardViews.includes(viewName)) {
        originalShowView(viewName);
        haptic.light();
        return;
    }

    // Handle surveillance view
    if (viewName === 'surveillance') {
        loadSurveillanceEvents();
    }

    // Handle guest-pass view
    if (viewName === 'guest-pass') {
        loadGuestPasses();
    }

    // Show the view (for non-standard views)
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const targetView = $('view-' + viewName) || $(`view-${viewName}`);
    if (targetView) targetView.classList.remove('hidden');

    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = $('nav-' + viewName);
    if (navItem) navItem.classList.add('active');

    state.currentView = viewName;
    haptic.light();
}

// ============================================
// COMPOUND ACTIONS (for data-action handlers)
// ============================================

function showViewAndCloseMenu(view) {
    closeMoreMenu();
    showViewExtended(view);
}

function allLightsOffAndClose() {
    allLightsOff();
    closeAllLightsModal();
}

// ============================================
// GLOBAL API - Single object for event handler
// ============================================

window.mobile = {
    // Connection
    connectHA,

    // Navigation
    showView: showViewExtended,
    showViewAndCloseMenu,
    selectFloor,

    // Room/Lights
    openRoomModal,
    closeRoomModal,
    openAllLightsModal,
    closeAllLightsModal,
    toggleEntity,
    toggleAllRoomLights,
    allLightsOff,
    allLightsOffAndClose,

    // Gate & Garage
    toggleGate,
    toggleGarage,
    toggleGateWithFeedback,
    toggleGarageWithFeedback,

    // Security
    armAlarm,
    triggerPanicButton,
    toggleDogMode,
    // Critical Alerts
    showCriticalAlertsConfig,
    closeCriticalAlertsConfig,
    selectCriticalAlertMode,
    toggleCriticalNotifyPerson,
    applyCriticalAlerts,
    disableCriticalAlerts,
    toggleCriticalAlerts,
    // Delayed Exit
    showDelayedExitOverlay,
    hideDelayedExitOverlay,
    selectExitMode,
    cancelDelayedExit,
    executeExitNow,

    // Family
    switchFamilyMetric,

    // Calendar
    calendarPrevMonth,
    calendarNextMonth,
    calendarPrevWeek,
    calendarNextWeek,
    calendarGoToday,
    toggleMiniCalendar,
    selectCalendarDate,
    setCalendarViewMode,
    showCalendarEvent,
    closeCalEventModal,
    openQuickAddEvent,
    closeQuickAddModal,
    saveQuickEvent,
    toggleQuickEventTime,

    // Surveillance
    setSurvTimeFilter,
    setSurvObjectFilter,
    openSurvEventDetail,
    closeSurvDetailModal,
    playSurvClip,
    downloadSurvClip,

    // Alexa
    alexaAnnounce,
    alexaCustomAnnounce,
    startDeliveryMode,
    startDeliveryModeFromCamera,
    cancelDeliveryMode,
    startDeliveryModePolling,
    stopDeliveryModePolling,

    // Guest Pass
    setGuestPreset,
    generateMobileGuestPass,
    closeGuestPassModal,
    copyGuestPassUrl,
    shareGuestPassWhatsApp,
    shareGuestPassNative,
    revokeGuestPass,
    reshareGuestPass,

    // More menu
    openMoreMenu,
    closeMoreMenu
};

// ============================================
// START APPLICATION
// ============================================

document.addEventListener('DOMContentLoaded', init);
