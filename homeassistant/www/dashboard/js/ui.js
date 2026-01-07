/**
 * UI Update Functions
 * Functions for updating the dashboard UI based on state
 */

import { state } from './state.js';
import {
    ROOMS, ZONES, ICONS, POWER_SENSORS, ENERGY_APPLIANCES, ENERGY_SENSORS,
    CAMERA_ENTITIES, GATE_COVER, GARAGE_COVER, getAllLights
} from './config.js';
import {
    $, setText, setHTML, show, hide, toggleClass,
    formatTime, formatDate, formatStatus, getAlarmColorScheme,
    calculatePercentage, calculateRingOffset
} from './utils.js';
import {
    renderRoomCard, renderSecurityZoneCard, renderModalZoneCard,
    renderLightToggleBtn, renderMasterToggleButtons, renderAllLightsItem
} from './components.js';
import { initEnergyChart, recordPowerData, getTodaysCost } from './energy-chart.js';

// ============================================
// MAIN UI UPDATE FUNCTION
// ============================================

export function updateUI() {
    updateClock();
    updateWeather();
    updateLightsCount();
    updatePower();
    updateRoomGrid();
    updateSecurity();
    updateEnergy();
    updateGarage();
    updateGateGarageStatus();
    updatePeopleHome();
    refreshOpenModal();
    refreshAllLightsModal();

    // Update Frigate detection toggle if on system view
    if (state.currentView === 'system') {
        import('./views.js').then(views => {
            views.updateFrigateDetectionToggle();
        });
    }
}

// ============================================
// CLOCK AND WEATHER
// ============================================

export function updateClock() {
    const now = new Date();
    setText('timeDisplay', formatTime(now));
    setText('dateDisplay', formatDate(now));
}

export function updateWeather() {
    const w = state.getEntity('weather.forecast_home');
    if (w) {
        setText('weatherTemp', Math.round(w.attributes.temperature || 0) + '°');
        setText('weatherCondition', w.state || 'Unknown');

        // Update weather icon based on condition
        const iconContainer = document.getElementById('weatherBadgeIcon');
        if (iconContainer) {
            const condition = (w.state || '').toLowerCase();
            const iconConfig = getWeatherIconConfig(condition);

            iconContainer.className = `w-10 h-10 rounded-xl ${iconConfig.bgClass} flex items-center justify-center group-hover:scale-110 transition-transform`;
            iconContainer.innerHTML = iconConfig.svg;
        }
    }
}

// Weather icon configuration for header badge
function getWeatherIconConfig(condition) {
    const configs = {
        'sunny': {
            bgClass: 'bg-amber-500/20',
            svg: `<svg class="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path stroke="currentColor" stroke-width="2" d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
        },
        'clear-night': {
            bgClass: 'bg-indigo-500/20',
            svg: `<svg class="w-6 h-6 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`
        },
        'partlycloudy': {
            bgClass: 'bg-slate-500/20',
            svg: `<svg class="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><circle cx="8" cy="8" r="3" fill="#fbbf24"/><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#94a3b8"/></svg>`
        },
        'cloudy': {
            bgClass: 'bg-slate-500/20',
            svg: `<svg class="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>`
        },
        'rainy': {
            bgClass: 'bg-blue-500/20',
            svg: `<svg class="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#64748b"/><path stroke="#3b82f6" stroke-width="2" stroke-linecap="round" d="M8 17v4M12 17v4M16 17v4"/></svg>`
        },
        'pouring': {
            bgClass: 'bg-blue-600/20',
            svg: `<svg class="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#475569"/><path stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" d="M7 17v5M11 17v5M15 17v5M19 17v3"/></svg>`
        },
        'lightning': {
            bgClass: 'bg-purple-500/20',
            svg: `<svg class="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#475569"/><path d="M13 12l-2 4h3l-2 5 5-6h-3l2-3h-3z" fill="#fbbf24"/></svg>`
        },
        'lightning-rainy': {
            bgClass: 'bg-purple-500/20',
            svg: `<svg class="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#475569"/><path d="M13 10l-2 4h3l-2 5 5-6h-3l2-3h-3z" fill="#fbbf24"/></svg>`
        },
        'snowy': {
            bgClass: 'bg-cyan-500/20',
            svg: `<svg class="w-6 h-6 text-cyan-300" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#94a3b8"/><circle cx="8" cy="18" r="1.5" fill="#e0f2fe"/><circle cx="12" cy="20" r="1.5" fill="#e0f2fe"/><circle cx="16" cy="18" r="1.5" fill="#e0f2fe"/></svg>`
        },
        'fog': {
            bgClass: 'bg-slate-500/20',
            svg: `<svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M4 8h16M4 12h16M4 16h12"/></svg>`
        },
        'windy': {
            bgClass: 'bg-teal-500/20',
            svg: `<svg class="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2"/></svg>`
        }
    };

    // Default to sunny if condition not found
    return configs[condition] || configs['sunny'];
}

// ============================================
// PEOPLE HOME / FAMILY TRACKING
// ============================================

// Family members configuration for tracking
const FAMILY_TRACKERS = {
    tatiana: {
        name: 'Tatiana',
        color: '#ec4899',
        tracker: 'device_tracker.tatiana_iphone',
        battery: 'sensor.tatiana_iphone_battery_level',
        avatar: '/local/dashboard/Tatiana.png'
    },
    nico: {
        name: 'Nico',
        color: '#3b82f6',
        tracker: 'device_tracker.nico',
        battery: 'sensor.nico_battery_level',
        avatar: '/local/dashboard/Nico.jpeg'
    },
    alexandra: {
        name: 'Alexandra',
        color: '#a855f7',
        tracker: 'device_tracker.alexandra_iphone',
        battery: 'sensor.alexandra_iphone_battery_level',
        avatar: '/local/dashboard/Alexandra.png'
    },
    mila: {
        name: 'Mila',
        color: '#14b8a6',
        tracker: 'device_tracker.milas_iphone',
        battery: 'sensor.milas_iphone_battery_level',
        avatar: '/local/dashboard/Mila.png'
    }
};

export function updatePeopleHome() {
    const countEl = $('peopleHomeCount');
    const namesEl = $('peopleHomeNames');
    const warningDot = $('batteryWarningDot');
    const avatarsEl = $('peopleHomeAvatars');
    const iconEl = $('peopleHomeIcon');

    if (!countEl || !namesEl) return;

    let homeCount = 0;
    const homeNames = [];
    const homeMembers = [];
    let lowBattery = false;

    Object.entries(FAMILY_TRACKERS).forEach(([key, member]) => {
        const trackerState = state.getEntityState(member.tracker);
        const batteryLevel = parseFloat(state.getEntity(member.battery)?.state) || 0;

        if (trackerState === 'home') {
            homeCount++;
            homeNames.push(member.name);
            homeMembers.push(member);
        }

        // Check for low battery (below 20%)
        if (batteryLevel > 0 && batteryLevel <= 20) {
            lowBattery = true;
        }
    });

    // Update count
    countEl.textContent = homeCount;

    // Render avatars
    if (avatarsEl) {
        if (homeCount > 0) {
            // Show avatars, hide icon
            if (iconEl) iconEl.classList.add('hidden');
            avatarsEl.innerHTML = homeMembers.map(member => `
                <img src="${member.avatar}" alt="${member.name}"
                     class="w-9 h-9 rounded-full border-2 border-dark-900 object-cover"
                     style="box-shadow: 0 0 0 2px ${member.color}40;"
                     onerror="this.style.display='none'">
            `).join('');
        } else {
            // No one home - show icon, hide avatars
            if (iconEl) iconEl.classList.remove('hidden');
            avatarsEl.innerHTML = '';
        }
    }

    // Update names display
    if (homeCount === 0) {
        namesEl.textContent = 'Nobody home';
    } else if (homeCount === Object.keys(FAMILY_TRACKERS).length) {
        namesEl.textContent = 'Everyone home';
    } else if (homeNames.length <= 2) {
        namesEl.textContent = homeNames.join(' & ');
    } else {
        namesEl.textContent = `${homeNames.slice(0, 2).join(', ')} +${homeNames.length - 2}`;
    }

    // Show/hide battery warning dot
    if (warningDot) {
        if (lowBattery) {
            warningDot.classList.remove('hidden');
        } else {
            warningDot.classList.add('hidden');
        }
    }
}

// ============================================
// LIGHTS COUNT
// ============================================

export function updateLightsCount() {
    const allLights = getAllLights();
    const onLights = allLights.filter(id => state.getEntityState(id) === 'on');

    setText('lightsOnCount', onLights.length);
    setText('allLightsCount', `${onLights.length} lights on`);

    const badge = $('lightsBadge');
    toggleClass(badge, 'glow-amber', onLights.length > 0);
}

// ============================================
// POWER DISPLAY
// ============================================

export function updatePower() {
    // Use inverter load power as the main power indicator
    const loadSensor = state.getEntity(ENERGY_SENSORS.loadPower);
    const total = loadSensor ? parseFloat(loadSensor.state) || 0 : 0;

    setText('totalPower', Math.round(total) + 'W');

    // Update power ring (max 5000W)
    const pct = calculatePercentage(total, 5000);
    const offset = calculateRingOffset(pct);
    const ring = $('powerRing');
    if (ring) ring.style.strokeDashoffset = offset;
}

// ============================================
// ROOM GRID
// ============================================

export function updateRoomGrid() {
    const grid = $('roomGrid');
    if (!grid) return;

    const floorRooms = ROOMS[state.currentFloor];

    grid.innerHTML = floorRooms.map(room => {
        const onLights = room.lights.filter(id => state.getEntityState(id) === 'on').length;
        const hasLightsOn = onLights > 0;
        return renderRoomCard(room, onLights, hasLightsOn);
    }).join('');
}

// ============================================
// FLOOR SELECTOR
// ============================================

export function updateFloorSelector() {
    const groundBtn = $('floorGround');
    const upperBtn = $('floorUpper');

    const activeClass = 'px-5 py-2 rounded-xl font-medium transition floor-btn bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-white';
    const inactiveClass = 'px-5 py-2 rounded-xl font-medium transition floor-btn bg-white/5 border border-white/10 text-white/60 hover:bg-white/10';

    if (groundBtn) groundBtn.className = state.currentFloor === 'ground' ? activeClass : inactiveClass;
    if (upperBtn) upperBtn.className = state.currentFloor === 'upper' ? activeClass : inactiveClass;
}

// ============================================
// SECURITY UPDATES
// ============================================

export function updateSecurity() {
    const alarm = state.getEntity('alarm_control_panel.alarm_partition_1');
    const status = alarm?.state || 'unknown';
    const colorScheme = getAlarmColorScheme(status);

    // Check if system is armed (any armed state - DSC)
    const isArmed = status.startsWith('armed_') || status === 'triggered';

    // Check for critical alerts only mode (not DSC armed but monitoring)
    const criticalMode = state.getEntityState('input_select.critical_alerts_mode') || 'off';
    const isCriticalAlertsOnly = criticalMode !== 'off' && !isArmed;

    // Update header badge with armed styling
    const statusEl = $('securityStatus');
    if (statusEl) {
        if (isCriticalAlertsOnly) {
            statusEl.textContent = `ALERTS: ${criticalMode.toUpperCase()}`;
        } else {
            statusEl.textContent = formatStatus(status);
        }
        if (isArmed || isCriticalAlertsOnly) {
            statusEl.classList.add('security-armed-text');
        } else {
            statusEl.classList.remove('security-armed-text');
        }
    }

    const iconEl = $('securityIcon');
    if (iconEl) {
        if (isArmed) {
            // Apply crimson armed indicator with heartbeat animation
            iconEl.className = `w-10 h-10 rounded-xl flex items-center justify-center security-armed-indicator`;
        } else if (isCriticalAlertsOnly) {
            // Apply pink alerts indicator with heartbeat animation
            iconEl.className = `w-10 h-10 rounded-xl flex items-center justify-center security-alerts-indicator`;
        } else {
            iconEl.className = `w-10 h-10 rounded-xl bg-${colorScheme.bg}-500/20 flex items-center justify-center`;
            const svg = iconEl.querySelector('svg');
            if (svg) svg.setAttribute('class', `w-5 h-5 text-${colorScheme.text}-400`);
        }
    }

    // Update security view header
    const headerIcon = $('securityHeaderIcon');
    const headerStatus = $('securityHeaderStatus');
    const securityHeader = headerIcon?.closest('.flex.items-center.justify-between');

    if (headerIcon) {
        if (isArmed) {
            headerIcon.className = `w-14 h-14 rounded-2xl flex items-center justify-center security-armed-indicator`;
        } else if (isCriticalAlertsOnly) {
            headerIcon.className = `w-14 h-14 rounded-2xl flex items-center justify-center security-alerts-indicator`;
        } else {
            headerIcon.className = `w-14 h-14 rounded-2xl bg-${colorScheme.bg}-500/20 flex items-center justify-center border border-${colorScheme.bg}-500/30 security-icon-pulse`;
            const svg = headerIcon.querySelector('svg');
            if (svg) svg.setAttribute('class', `w-7 h-7 text-${colorScheme.text}-400`);
        }
    }
    if (headerStatus) {
        if (isCriticalAlertsOnly) {
            headerStatus.textContent = `Critical Alerts: ${criticalMode.toUpperCase()}`;
        } else {
            headerStatus.textContent = `System ${colorScheme.label}`;
        }
        if (isArmed || isCriticalAlertsOnly) {
            headerStatus.className = `text-sm font-medium security-armed-text`;
        } else {
            headerStatus.className = `text-${colorScheme.text}-400 text-sm font-medium`;
        }
    }

    // Apply armed header styling to security view
    const viewSecurity = $('view-security');
    if (viewSecurity) {
        const header = viewSecurity.querySelector('.flex.items-center.justify-between.mb-4');
        if (header) {
            header.classList.remove('security-header-armed', 'security-header-alerts', 'rounded-xl', 'p-3', '-m-3', 'mb-1');
            if (isArmed) {
                header.classList.add('security-header-armed', 'rounded-xl', 'p-3', '-m-3', 'mb-1');
            } else if (isCriticalAlertsOnly) {
                header.classList.add('security-header-alerts', 'rounded-xl', 'p-3', '-m-3', 'mb-1');
            }
        }
    }

    // Update status banner with alarm state and critical alerts mode
    updateSecurityBanner(colorScheme, status, isCriticalAlertsOnly, criticalMode);

    // Update zone grid
    updateZoneGrid();

    // Update camera status
    updateCameraStatus();

    // Update dog mode toggle
    updateDogModeToggle();

    // Update family geofence status
    updateFamilyGeofence();
}

function updateSecurityBanner(colorScheme, alarmState, isCriticalAlertsOnly = false, criticalMode = 'off') {
    const banner = $('securityBanner');
    const bannerIcon = $('bannerIcon');
    const bannerTitle = $('bannerTitle');
    const bannerSubtitle = $('bannerSubtitle');
    const bannerBadge = $('bannerBadge');
    const bannerTime = $('bannerTime');

    // Count active zones
    let activeZones = 0;
    ZONES.forEach(zone => {
        if (state.getEntityState(zone.id) === 'on') activeZones++;
    });

    // Determine status class for styling based on alarm state
    let statusClass = alarmState === 'armed_away' ? 'armed-away'
        : alarmState === 'armed_home' ? 'armed-home'
        : alarmState === 'armed_custom_bypass' ? 'armed-night'
        : alarmState === 'triggered' ? 'triggered'
        : '';

    // Override with alerts-only class if critical alerts is enabled
    if (isCriticalAlertsOnly) {
        statusClass = 'alerts-only';
    }

    if (banner) {
        banner.className = `security-status-banner glass rounded-2xl p-5 flex items-center justify-between border-l-4 border-${colorScheme.bg}-500 transition-all ${statusClass}`;
    }
    if (bannerIcon) {
        if (isCriticalAlertsOnly) {
            bannerIcon.className = `w-16 h-16 rounded-2xl flex items-center justify-center security-alerts-indicator`;
        } else {
            bannerIcon.className = `w-16 h-16 rounded-2xl bg-${colorScheme.bg}-500/20 flex items-center justify-center security-banner-icon`;
            const svg = bannerIcon.querySelector('svg');
            if (svg) svg.setAttribute('class', `w-8 h-8 text-${colorScheme.text}-400`);
        }
    }
    if (bannerTitle) {
        if (isCriticalAlertsOnly) {
            bannerTitle.textContent = `Critical Alerts: ${criticalMode.toUpperCase()}`;
        } else {
            bannerTitle.textContent = `System ${colorScheme.label}`;
        }
    }
    if (bannerSubtitle) {
        if (isCriticalAlertsOnly) {
            bannerSubtitle.textContent = `Monitoring ${criticalMode} zones - DSC not armed`;
        } else {
            bannerSubtitle.textContent = activeZones > 0
                ? `${activeZones} zone${activeZones > 1 ? 's' : ''} active`
                : 'All zones secure - Ready to arm';
        }
    }
    if (bannerBadge) {
        if (isCriticalAlertsOnly) {
            bannerBadge.innerHTML = `<div class="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></div> Alerts Only`;
            bannerBadge.className = `inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500/20 text-pink-400 font-semibold text-sm`;
        } else {
            bannerBadge.innerHTML = `<div class="w-2 h-2 rounded-full bg-${colorScheme.text}-400"></div> ${colorScheme.badge}`;
            bannerBadge.className = `inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-${colorScheme.bg}-500/20 text-${colorScheme.text}-400 font-semibold text-sm`;
        }
    }
    if (bannerTime) {
        bannerTime.textContent = `Last update: ${new Date().toLocaleTimeString()}`;
    }

    // Update zone stats
    setText('zoneStats', `${activeZones} active`);
}

function updateZoneGrid() {
    const zoneGrid = $('zoneGrid');
    if (!zoneGrid) return;

    // Dynamically import to avoid circular dependencies
    import('./security-controller.js').then(({ isZoneBypassed, getZoneFaultStatus }) => {
        zoneGrid.innerHTML = ZONES.map(zone => {
            const zoneState = state.getEntity(zone.id);
            const bypassed = isZoneBypassed(zone.id);
            const hasFault = getZoneFaultStatus(zone.id);
            return renderSecurityZoneCard(zone, zoneState, bypassed, hasFault);
        }).join('');
    });
}

// Exported alias for security controller to call
export function updateSecurityZones() {
    updateZoneGrid();
    updateFamilyGeofence();

    // Check for zone state changes to update timeline
    import('./security-controller.js').then(({ checkZoneStateChanges, updateSystemHealthPanel }) => {
        checkZoneStateChanges();
        updateSystemHealthPanel();
    }).catch(() => {});
}

function updateFamilyGeofence() {
    const container = $('familyGeofence');
    if (!container) return;

    // Family member person entities
    const familyMembers = [
        { name: 'Nico', entity: 'person.nico' },
        { name: 'Tatiana', entity: 'person.tatiana' },
        { name: 'Alexandra', entity: 'person.alexandra' },
        { name: 'Mila', entity: 'person.mila' }
    ];

    import('./components.js').then(({ renderFamilyGeofenceItem }) => {
        container.innerHTML = familyMembers.map(member => {
            const personState = state.getEntityState(member.entity) || 'unknown';
            return renderFamilyGeofenceItem({
                name: member.name,
                state: personState
            });
        }).join('');
    });
}

export function updateCameraStatus() {
    let armedCount = 0;

    Object.entries(CAMERA_ENTITIES).forEach(([name, entityId]) => {
        const isOn = state.getEntityState(entityId) === 'on';
        if (isOn) armedCount++;

        // Update individual camera dots
        const dotId = 'camera' + name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Dot';
        const dot = $(dotId);
        if (dot) {
            toggleClass(dot, 'bg-violet-400', isOn);
            toggleClass(dot, 'bg-white/30', !isOn);
        }
    });

    // Update all cameras toggle
    const allOn = armedCount === Object.keys(CAMERA_ENTITIES).length;
    const toggle = $('allCamerasToggle');
    const knob = toggle?.querySelector('div');
    if (toggle && knob) {
        toggleClass(toggle, 'bg-violet-500', allOn);
        toggleClass(toggle, 'bg-white/10', !allOn);
        knob.style.transform = allOn ? 'translateX(16px)' : 'translateX(0)';
    }

    // Update status text
    const statusEl = $('cameraArmStatus');
    if (statusEl) {
        if (armedCount === 0) {
            statusEl.textContent = 'All cameras disarmed';
            statusEl.classList.remove('text-violet-400');
            statusEl.classList.add('text-white/40');
        } else if (allOn) {
            statusEl.textContent = 'All cameras armed';
            statusEl.classList.add('text-violet-400');
            statusEl.classList.remove('text-white/40');
        } else {
            statusEl.textContent = `${armedCount} of ${Object.keys(CAMERA_ENTITIES).length} cameras armed`;
        }
    }
}

// ============================================
// ENERGY VIEW - POWER FLOW DASHBOARD
// ============================================

export function updateEnergy() {
    // Update old appliance view (backwards compatibility)
    ENERGY_APPLIANCES.forEach(app => {
        const power = parseFloat(state.getEntity(app.id)?.state) || 0;
        setText(`${app.el}Power`, Math.round(power) + 'W');
        setText(`${app.el}Status`, power > 5 ? 'Running' : 'Idle');

        if (app.toggle && app.switch) {
            const isOn = state.getEntityState(app.switch) === 'on';
            const toggle = $(app.toggle);
            if (toggle) {
                toggleClass(toggle, 'bg-emerald-500', isOn);
                const knob = toggle.querySelector('div');
                if (knob) knob.style.transform = isOn ? 'translateX(24px)' : 'translateX(0)';
            }
        }
    });

    // Update new Energy Flow Dashboard
    updateEnergyFlowDashboard();
}

// Track if chart is initialized
let chartInitialized = false;

function updateEnergyFlowDashboard() {
    const getVal = (key) => {
        const entity = state.getEntity(ENERGY_SENSORS[key]);
        return entity ? parseFloat(entity.state) || 0 : 0;
    };

    // === SOLAR ===
    const solarPower = getVal('solarPower');
    const pv1 = getVal('pv1Power');
    const pv2 = getVal('pv2Power');
    const solarToday = getVal('solarToday');
    const solarTotal = getVal('solarTotal');

    setText('solarPower', Math.round(solarPower).toLocaleString());
    setText('pv1Power', Math.round(pv1) + 'W');
    setText('pv2Power', Math.round(pv2) + 'W');
    setText('solarToday', solarToday.toFixed(1) + ' kWh');

    // Format total production (MWh if over 1000 kWh)
    const totalProdDisplay = solarTotal >= 1000
        ? (solarTotal / 1000).toFixed(2) + ' MWh'
        : solarTotal.toFixed(0) + ' kWh';
    setText('totalProduction', totalProdDisplay);

    // Solar progress bar (max 8000W)
    const solarBar = $('solarBar');
    if (solarBar) {
        const solarPct = Math.min(solarPower / 8000, 1) * 100;
        solarBar.style.width = solarPct + '%';
    }

    // Solar status dot
    const solarStatus = $('solarStatus');
    if (solarStatus) {
        solarStatus.className = solarPower > 50 ? 'energy-status-dot active' : 'energy-status-dot';
    }

    // === BATTERY ===
    const batteryPercent = getVal('batteryPercent');
    const batteryPower = getVal('batteryPower');
    const batteryTemp = getVal('batteryTemp');
    const batteryVoltage = getVal('batteryVoltage');

    setText('batteryPercent', Math.round(batteryPercent));
    setText('batteryPower', Math.abs(Math.round(batteryPower)) + 'W');
    setText('batteryTemp', Math.round(batteryTemp) + '°C');
    setText('batteryVoltage', Math.round(batteryVoltage) + 'V');

    // Battery state and status
    const batteryStateEl = $('batteryState');
    const batteryStatus = $('batteryStatus');
    const batteryCard = document.querySelector('.energy-card-battery');

    if (batteryStateEl) {
        if (batteryPower > 100) {
            batteryStateEl.textContent = 'CHARGING';
            if (batteryStatus) batteryStatus.className = 'energy-status-dot charging';
        } else if (batteryPower < -100) {
            batteryStateEl.textContent = 'DISCHARGING';
            if (batteryStatus) batteryStatus.className = 'energy-status-dot discharging';
        } else {
            batteryStateEl.textContent = 'IDLE';
            if (batteryStatus) batteryStatus.className = 'energy-status-dot';
        }
    }

    // Battery bar and low warning
    const batteryBar = $('batteryBar');
    if (batteryBar) {
        batteryBar.style.width = batteryPercent + '%';
    }

    if (batteryCard) {
        if (batteryPercent < 20) {
            batteryCard.classList.add('low');
        } else {
            batteryCard.classList.remove('low');
        }
    }

    // === GRID ===
    const gridPower = getVal('gridPower');
    const gridVoltage = getVal('gridVoltage');
    const gridFrequency = getVal('gridFrequency');
    const gridImportToday = getVal('gridImportToday');
    const gridExportToday = getVal('gridExportToday');

    setText('gridPower', Math.abs(Math.round(gridPower)).toLocaleString());
    setText('gridVoltage', Math.round(gridVoltage) + 'V');
    setText('gridFrequency', gridFrequency.toFixed(1) + 'Hz');
    setText('gridImportToday', gridImportToday.toFixed(1) + ' kWh');
    setText('gridExportToday', gridExportToday.toFixed(1) + ' kWh');

    // Grid direction and status
    const gridDirection = $('gridDirection');
    const gridStatus = $('gridStatus');
    const gridCard = document.querySelector('.energy-card-grid');
    const gridBar = $('gridBar');

    if (gridDirection) {
        if (gridPower > 50) {
            gridDirection.textContent = 'IMPORTING';
            if (gridStatus) gridStatus.className = 'energy-status-dot importing';
            if (gridCard) gridCard.classList.add('importing');
            if (gridBar) gridBar.style.width = Math.min(gridPower / 5000, 1) * 100 + '%';
        } else if (gridPower < -50) {
            gridDirection.textContent = 'EXPORTING';
            if (gridStatus) gridStatus.className = 'energy-status-dot exporting';
            if (gridCard) gridCard.classList.remove('importing');
            if (gridBar) gridBar.style.width = Math.min(Math.abs(gridPower) / 5000, 1) * 100 + '%';
        } else {
            gridDirection.textContent = 'IDLE';
            if (gridStatus) gridStatus.className = 'energy-status-dot';
            if (gridCard) gridCard.classList.remove('importing');
            if (gridBar) gridBar.style.width = '0%';
        }
    }

    // === LOAD/CONSUMPTION ===
    const loadPower = getVal('loadPower');
    const loadToday = getVal('loadToday');

    setText('loadPower', Math.round(loadPower).toLocaleString());
    setText('loadToday', loadToday.toFixed(1) + 'kWh');

    // Load bar (max 10000W)
    const loadBar = $('loadBar');
    if (loadBar) {
        const loadPct = Math.min(loadPower / 10000, 1) * 100;
        loadBar.style.width = loadPct + '%';
    }

    // Load status
    const loadStatus = $('loadStatus');
    if (loadStatus) {
        loadStatus.className = loadPower > 50 ? 'energy-status-dot active' : 'energy-status-dot';
    }

    // === INVERTER ===
    const inverterTemp = getVal('inverterTemp');
    setText('inverterTemp', Math.round(inverterTemp) + '°C');

    // === COST CALCULATIONS ===
    const todaysCost = getTodaysCost(gridImportToday, gridExportToday);
    setText('energyCostToday', 'R ' + todaysCost.toFixed(2));
    setText('loadCost', 'R' + (loadToday * 2.50).toFixed(0)); // Approximate

    // === UPDATE CHART ===
    // Initialize chart if needed
    if (!chartInitialized) {
        initEnergyChart();
        chartInitialized = true;
    }

    // Record power data for chart
    recordPowerData({
        loadPower,
        solarPower,
        gridPower,
        batteryPower
    });

    // === LAST UPDATE TIME ===
    const updateEl = $('energyLastUpdate');
    if (updateEl) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        updateEl.textContent = `LIVE // ${timeStr}`;
    }

    // === DEVICE CONTROLS (Geyser & Pool) ===
    updateDeviceControls();

    // === APPLIANCE POWER MONITORS (Washer & Dishwasher) ===
    updateAppliancePowerMonitors(getVal);
}

function updateDeviceControls() {
    // Geyser control
    const geyserSwitch = 'switch.sonoff_10018908af';
    const geyserIsOn = state.getEntityState(geyserSwitch) === 'on';
    const geyserBtn = $('geyserControlBtn');
    const geyserState = $('geyserState');

    if (geyserBtn) {
        toggleClass(geyserBtn, 'is-on', geyserIsOn);
    }
    if (geyserState) {
        geyserState.textContent = geyserIsOn ? 'On' : 'Off';
    }

    // Pool pump control
    const poolSwitch = 'switch.sonoff_10017f2d90_1';
    const poolIsOn = state.getEntityState(poolSwitch) === 'on';
    const poolBtn = $('poolControlBtn');
    const poolState = $('poolState');

    if (poolBtn) {
        toggleClass(poolBtn, 'is-on', poolIsOn);
    }
    if (poolState) {
        poolState.textContent = poolIsOn ? 'On' : 'Off';
    }
}

// ============================================
// APPLIANCE POWER MONITORS (Washer & Dishwasher)
// ============================================

function updateAppliancePowerMonitors(getVal) {
    // Max power for donut chart scale (2000W = full circle)
    const MAX_POWER = 2000;
    const DONUT_CIRCUMFERENCE = 251.3; // 2 * π * 40

    // Update each appliance
    updateApplianceCard('washer', getVal('washerPower'), getVal('washerEnergy'));
    updateApplianceCard('dishwasher', getVal('dishwasherPower'), getVal('dishwasherEnergy'));

    function updateApplianceCard(appliance, power, energy) {
        const card = $(`${appliance}Card`);
        const powerValue = $(`${appliance}PowerValue`);
        const stateLabel = $(`${appliance}StateLabel`);
        const statusDot = $(`${appliance}StatusDot`);
        const donutRing = $(`${appliance}DonutRing`);
        const todayEnergy = $(`${appliance}TodayEnergy`);

        if (!card) return;

        // Update power value
        if (powerValue) {
            powerValue.textContent = Math.round(power);
        }

        // Update today's energy
        if (todayEnergy && energy !== undefined) {
            todayEnergy.textContent = energy.toFixed(2) + ' kWh';
        }

        // Determine power level and state
        let powerClass = 'power-idle';
        let stateText = 'IDLE';
        let isRunning = false;

        if (power > 5) {
            isRunning = true;
            if (power < 200) {
                powerClass = 'power-low';
                stateText = 'STANDBY';
            } else if (power < 500) {
                powerClass = 'power-medium';
                stateText = 'RUNNING';
            } else if (power < 1000) {
                powerClass = 'power-high';
                stateText = 'ACTIVE';
            } else {
                powerClass = 'power-critical';
                stateText = 'HIGH POWER';
            }
        }

        // Update state label
        if (stateLabel) {
            stateLabel.textContent = stateText;
        }

        // Update status dot
        if (statusDot) {
            statusDot.className = isRunning ? 'energy-status-dot active' : 'energy-status-dot';
        }

        // Update card classes
        card.className = card.className
            .replace(/power-\w+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        card.classList.add('energy-card-neo', 'energy-card-appliance', powerClass);

        if (isRunning && power >= 200) {
            card.classList.add('running');
        } else {
            card.classList.remove('running');
        }

        // Update donut chart
        if (donutRing) {
            // Calculate fill percentage (capped at 100%)
            const fillPct = Math.min(power / MAX_POWER, 1);
            const offset = DONUT_CIRCUMFERENCE * (1 - fillPct);
            donutRing.style.strokeDashoffset = offset;
        }
    }
}

// ============================================
// GARAGE VIEW
// ============================================

export function updateGarage() {
    const garage = state.getEntity('cover.smart_garage_door_2311083729366461070548e1e9e12926_garage');
    const gate = state.getEntity('cover.gate_switch_door_1');
    const light = state.getEntity('switch.garage_switch');

    if (garage) {
        const isOpen = garage.state === 'open';
        setText('garageDoorState', formatStatus(garage.state));
        const icon = $('garageDoorIcon');
        if (icon) {
            toggleClass(icon, 'bg-orange-500/20', isOpen);
            toggleClass(icon, 'bg-emerald-500/20', !isOpen);
            const svg = icon.querySelector('svg');
            if (svg) {
                toggleClass(svg, 'text-orange-400', isOpen);
                toggleClass(svg, 'text-emerald-400', !isOpen);
            }
        }
    }

    if (gate) {
        const isOpen = gate.state === 'open';
        setText('gateState', formatStatus(gate.state));
        const icon = $('gateIcon');
        if (icon) {
            toggleClass(icon, 'bg-orange-500/20', isOpen);
            toggleClass(icon, 'bg-emerald-500/20', !isOpen);
            const svg = icon.querySelector('svg');
            if (svg) {
                toggleClass(svg, 'text-orange-400', isOpen);
                toggleClass(svg, 'text-emerald-400', !isOpen);
            }
        }
    }

    if (light) {
        const isOn = light.state === 'on';
        setText('garageLightState', isOn ? 'On' : 'Off');
        const icon = $('garageLightIcon');
        if (icon) {
            toggleClass(icon, 'bg-amber-500/20', isOn);
            toggleClass(icon, 'bg-white/10', !isOn);
            const svg = icon.querySelector('svg');
            if (svg) {
                toggleClass(svg, 'text-amber-400', isOn);
                toggleClass(svg, 'text-white/40', !isOn);
            }
        }
    }
}

// ============================================
// GATE & GARAGE STATUS (CAMERAS VIEW)
// ============================================

export function updateGateGarageStatus() {
    // Gate status
    const gateState = state.getEntityState(GATE_COVER) || 'closed';
    const gateIsOpen = gateState === 'open' || gateState === 'opening';

    toggleClass($('gateControlCard'), 'open', gateIsOpen);

    const gateStatusText = $('gateStatusText');
    if (gateStatusText) {
        gateStatusText.textContent = formatStatus(gateState);
        gateStatusText.className = `text-lg font-medium ${gateIsOpen ? 'text-orange-400' : 'text-emerald-400'}`;
    }

    toggleClass($('gateStatusDot'), 'status-open', gateIsOpen);

    const gateRing = $('gateRingProgress');
    if (gateRing) gateRing.style.strokeDashoffset = gateIsOpen ? '0' : '176';

    // Garage status
    const garageState = state.getEntityState(GARAGE_COVER) || 'closed';
    const garageIsOpen = garageState === 'open' || garageState === 'opening';

    toggleClass($('garageControlCard'), 'open', garageIsOpen);

    const garageStatusText = $('garageStatusText');
    if (garageStatusText) {
        garageStatusText.textContent = formatStatus(garageState);
        garageStatusText.className = `text-lg font-medium ${garageIsOpen ? 'text-orange-400' : 'text-emerald-400'}`;
    }

    toggleClass($('garageStatusDot'), 'status-open', garageIsOpen);

    const garageRing = $('garageRingProgress');
    if (garageRing) garageRing.style.strokeDashoffset = garageIsOpen ? '0' : '176';
}

// ============================================
// ROOM MODAL
// ============================================

export function refreshOpenModal() {
    if (state.openRoomId) {
        renderRoomModal(state.openRoomId);
    }
}

export function renderRoomModal(roomId) {
    const allRooms = [...ROOMS.ground, ...ROOMS.upper];
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;

    const onLights = room.lights.filter(id => state.getEntityState(id) === 'on').length;
    const allOn = onLights === room.lights.length;
    const someOn = onLights > 0;

    // Set background image
    const bgEl = $('modalBgImage');
    if (bgEl) {
        if (room.image) {
            bgEl.style.backgroundImage = `url('${room.image}')`;
            bgEl.style.opacity = someOn ? '0.5' : '0.35';
            bgEl.style.filter = someOn ? 'saturate(1.2)' : 'saturate(0.8)';
        } else {
            bgEl.style.backgroundImage = 'none';
            bgEl.style.background = 'linear-gradient(135deg, rgba(30,30,50,1) 0%, rgba(10,10,20,1) 100%)';
        }
    }

    // Update header
    setText('modalRoomName', room.name);
    setText('modalRoomStatus', someOn ? `${onLights} of ${room.lights.length} lights on` : 'All lights off');

    const iconEl = $('modalRoomIcon');
    if (iconEl) {
        iconEl.className = `room-icon ${room.color} w-16 h-16`;
        iconEl.innerHTML = `
            <svg class="w-8 h-8 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                ${ICONS[room.icon] || ICONS.light}
            </svg>
        `;
    }

    // Master toggle buttons
    setHTML('modalMasterToggle', renderMasterToggleButtons(roomId, allOn, someOn));

    // Light controls
    const controls = $('modalControls');
    if (!controls) return;

    const getLightState = (id) => state.getEntityState(id) === 'on';

    if (room.zones && room.zones.length > 0) {
        controls.innerHTML = room.zones.map(zone => {
            const zoneOnCount = zone.lights.filter(id => getLightState(id)).length;
            return renderModalZoneCard(zone, zoneOnCount, getLightState);
        }).join('');
    } else {
        // Simple room without zones
        controls.innerHTML = `
            <div class="modal-zone-card ${someOn ? 'has-lights-on' : ''}">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl ${someOn ? 'bg-amber-500/20' : 'bg-white/10'} flex items-center justify-center">
                            <svg class="w-5 h-5 ${someOn ? 'text-amber-400' : 'text-white/50'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                ${ICONS.light}
                            </svg>
                        </div>
                        <div>
                            <h4 class="font-semibold text-lg">Lights</h4>
                            <p class="text-sm ${someOn ? 'text-amber-400' : 'text-white/40'}">
                                ${someOn ? `${onLights} of ${room.lights.length} on` : 'All off'}
                            </p>
                        </div>
                    </div>
                </div>
                <div class="flex flex-wrap gap-3">
                    ${room.lights.map((id, idx) => {
                        const isOn = getLightState(id);
                        const name = room.lightNames?.[idx] || (room.lights.length > 1 ? `Light ${idx + 1}` : 'Light');
                        return renderLightToggleBtn(id, name, isOn);
                    }).join('')}
                </div>
            </div>
        `;
    }
}

// ============================================
// ALL LIGHTS MODAL
// ============================================

export function refreshAllLightsModal() {
    if (state.allLightsModalOpen) {
        renderAllLightsGrid();
    }
}

export function renderAllLightsGrid() {
    const grid = $('allLightsGrid');
    if (!grid) return;

    // Helper to render lights for a floor
    const renderFloorLights = (rooms) => rooms.flatMap(room =>
        room.lights.map((id, idx) => {
            const isOn = state.getEntityState(id) === 'on';
            const name = room.lightNames?.[idx] || (room.lights.length > 1 ? `${room.name} ${idx + 1}` : room.name);
            return renderAllLightsItem(room, id, name, isOn);
        })
    ).join('');

    // Count lights on per floor
    const countOn = (rooms) => rooms.reduce((count, room) =>
        count + room.lights.filter(id => state.getEntityState(id) === 'on').length, 0);

    const groundOnCount = countOn(ROOMS.ground);
    const upperOnCount = countOn(ROOMS.upper);

    grid.innerHTML = `
        <!-- Ground Floor Section -->
        <div class="col-span-4 flex items-center gap-3 mb-2 mt-1">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                    </svg>
                </div>
                <span class="text-sm font-semibold text-white/80">Ground Floor</span>
            </div>
            <div class="flex-1 h-px bg-gradient-to-r from-blue-500/30 to-transparent"></div>
            <span class="text-xs ${groundOnCount > 0 ? 'text-amber-400/80' : 'text-white/40'}">${groundOnCount} on</span>
        </div>
        ${renderFloorLights(ROOMS.ground)}

        <!-- Upper Floor Section -->
        <div class="col-span-4 flex items-center gap-3 mb-2 mt-6">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                    </svg>
                </div>
                <span class="text-sm font-semibold text-white/80">Upper Floor</span>
            </div>
            <div class="flex-1 h-px bg-gradient-to-r from-purple-500/30 to-transparent"></div>
            <span class="text-xs ${upperOnCount > 0 ? 'text-amber-400/80' : 'text-white/40'}">${upperOnCount} on</span>
        </div>
        ${renderFloorLights(ROOMS.upper)}
    `;
}

// ============================================
// AUTO ARM TOGGLE
// ============================================

export function updateAutoArmToggle() {
    const toggle = $('autoArmCamerasToggle');
    const knob = toggle?.querySelector('div');
    if (toggle && knob) {
        toggleClass(toggle, 'bg-violet-500', state.autoArmCameras);
        toggleClass(toggle, 'bg-white/10', !state.autoArmCameras);
        knob.style.transform = state.autoArmCameras ? 'translateX(16px)' : 'translateX(0)';
    }
}

export function updateDogModeToggle(isOn = null) {
    // If isOn not provided, get from state
    if (isOn === null) {
        isOn = state.getEntityState('input_boolean.dog_mode') === 'on';
    }

    const toggle = $('dogModeToggle');
    const knob = toggle?.querySelector('div');
    const statusEl = $('dogModeStatus');
    const btn = $('btnDogMode');

    if (toggle && knob) {
        toggleClass(toggle, 'bg-orange-500', isOn);
        toggleClass(toggle, 'bg-white/10', !isOn);
        knob.style.transform = isOn ? 'translateX(16px)' : 'translateX(0)';
    }

    if (statusEl) {
        toggleClass(statusEl, 'hidden', !isOn);
    }

    if (btn) {
        toggleClass(btn, 'border-orange-500/50', isOn);
        toggleClass(btn, 'bg-orange-500/20', isOn);
        toggleClass(btn, 'border-orange-500/20', !isOn);
        toggleClass(btn, 'bg-orange-500/10', !isOn);
    }
}

// ============================================
// CONNECTION STATUS
// ============================================

export function showConnecting() {
    setText('connStatus', 'Connecting...');
    const dot = $('connDot');
    if (dot) {
        dot.classList.remove('bg-emerald-500', 'bg-red-500');
        dot.classList.add('bg-amber-500');
    }
}

export function showConnected() {
    setText('connStatus', 'Connected');
    const dot = $('connDot');
    if (dot) {
        dot.classList.remove('bg-amber-500', 'bg-red-500');
        dot.classList.add('bg-emerald-500');
    }
}

export function showDisconnected() {
    setText('connStatus', 'Disconnected');
    const dot = $('connDot');
    if (dot) {
        dot.classList.remove('bg-emerald-500', 'bg-amber-500');
        dot.classList.add('bg-red-500');
    }
}

export function showError(msg) {
    const el = $('errorMsg');
    if (el) {
        el.textContent = msg;
        el.classList.remove('hidden');
    }
}
