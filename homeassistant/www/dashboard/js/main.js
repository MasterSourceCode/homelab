/**
 * Main Entry Point
 * Initializes the dashboard and exposes API for event-handler.js
 * All actions use data-action attributes, no inline onclick handlers
 */

import { state } from './state.js';
import { REFRESH_RATES } from './config.js';
import { connectWebSocket, setConnectionCallbacks, checkFrigateAuth } from './api.js';
import { $, show, hide } from './utils.js';
import { updateUI, updateClock, showConnecting, showConnected, showDisconnected, showError } from './ui.js';
import { loadHistoryFromHA } from './energy-chart.js';

// Views module (includes view switching and room/light actions)
import {
    showView, selectFloor,
    openRoomModal, closeRoomModal,
    openAllLightsModal, closeAllLightsModal,
    toggleEntity, toggleAllRoomLights, allLightsOff,
    toggleGate, toggleGarage, toggleGateWithFeedback, toggleGarageWithFeedback,
    armAlarm, toggleCameraArm, armAllCameras, toggleAutoArmCameras, toggleDogMode,
    triggerPanic, bypassZone, refreshSecurityStatus,
    toggleZoneBypass, clearAllBypasses, cancelCountdown, toggleAutoArm, toggleCameraSync,
    showSystemDiagnostics, closeDiagnostics, triggerPanicButton,
    showActivityTimeline, closeActivityModal, showQuickActions, closeQuickActions,
    openFrigatePlayback,
    // Critical Alerts
    showCriticalAlertsConfig, closeCriticalAlertsConfig, selectCriticalAlertMode,
    toggleCriticalNotifyPerson, applyCriticalAlerts, disableCriticalAlerts,
    toggleCriticalAlerts, updateCriticalAlertsToggleUI,
    // Frigate Detection Control
    toggleFrigateDetection, updateFrigateDetectionToggle
} from './views.js';

// Calendar (still in calendar.js)
import {
    initCalendar, destroyCalendar,
    changeCalendarView, calendarToday, calendarPrev, calendarNext,
    closeEventModal, refreshCalendar,
    toggleCalendarAuth, closeAuthModal, signInAndClose,
    openCreateEventModal, closeCreateEventModal,
    onAllDayChange, updateAssigneePreview,
    saveEvent, deleteCurrentEvent, editCurrentEvent,
    toggleCalendarFilter, quickAddEvent, showEventById
} from './calendar.js';

import { toggleRotation as toggleAutoRotate } from './auto-rotate.js';

// ============================================
// PREMIUM PRESS FEEDBACK SYSTEM (Desktop)
// ============================================

const pressFeedback = {
    createRipple(element, event) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2;
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        const ripple = document.createElement('div');
        ripple.className = 'press-ripple';
        ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;

        const position = getComputedStyle(element).position;
        if (position === 'static') element.style.position = 'relative';
        element.style.overflow = 'hidden';

        element.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);
    },

    bounceIcon(element) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const icon = element.querySelector('svg, .icon');
        if (icon) {
            icon.classList.add('icon-bounce');
            setTimeout(() => icon.classList.remove('icon-bounce'), 300);
        }
    }
};

function initDesktopPressFeedback() {
    const selectors = [
        '.btn-control', '.glass', 'button', '[data-action]',
        '.security-mode-btn', '.exit-mode-btn', '.nav-tab',
        '#gateControlCard', '#garageControlCard', '.modal-close'
    ].join(', ');

    document.addEventListener('mousedown', (e) => {
        const target = e.target.closest(selectors);
        if (target) pressFeedback.createRipple(target, e);
    });

    document.addEventListener('mouseup', (e) => {
        const target = e.target.closest(selectors);
        if (target) setTimeout(() => pressFeedback.bounceIcon(target), 50);
    });
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDesktopPressFeedback);
} else {
    initDesktopPressFeedback();
}

// ============================================
// INITIALIZATION
// ============================================

// Hardcoded Home Assistant URL
const HA_URL = 'http://192.168.x.x:8123';

async function init() {
    // Start clock
    updateClock();
    setInterval(updateClock, REFRESH_RATES.clock);

    // Check Frigate auth for external access
    await checkFrigateAuth();

    // Start PC health badge updates (runs in background)
    startPCHealthBadge();

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
        state.setCredentials(HA_URL, state.haToken);
        hide('connectModal');
        show('app');
        connectWebSocket();
    }
}

// PC Health Badge (runs independently of the full system view)
async function startPCHealthBadge() {
    const PC_HEALTH_API = 'http://192.168.x.x:8765/api/metrics/health';

    async function updateHealthBadge() {
        try {
            const response = await fetch(PC_HEALTH_API);
            if (!response.ok) throw new Error('API error');
            const health = await response.json();

            const scoreText = $('pcHealthBadgeScore');
            const statusDot = $('pcHealthDot');
            const iconContainer = document.querySelector('#pcHealthBadge .pc-icon-container');

            if (scoreText) scoreText.textContent = `${health.score}%`;

            if (statusDot) {
                statusDot.className = `w-2 h-2 rounded-full ${
                    health.status === 'healthy' ? 'bg-emerald-500 shadow-emerald-500/50' :
                    health.status === 'warning' ? 'bg-amber-500 shadow-amber-500/50 animate-pulse' :
                    'bg-red-500 shadow-red-500/50 animate-pulse'
                } shadow-lg`;
            }

            if (iconContainer) {
                iconContainer.className = `pc-icon-container w-10 h-10 rounded-xl flex items-center justify-center group-hover:bg-cyan-500/30 transition ${
                    health.status === 'healthy' ? 'bg-emerald-500/20' :
                    health.status === 'warning' ? 'bg-amber-500/20' :
                    'bg-red-500/20'
                }`;
            }
        } catch (error) {
            // Silently fail - badge just shows stale data
            const scoreText = $('pcHealthBadgeScore');
            if (scoreText && scoreText.textContent === '--') {
                scoreText.textContent = 'N/A';
            }
        }
    }

    // Initial update
    updateHealthBadge();

    // Update every 10 seconds (lighter than full metrics)
    setInterval(updateHealthBadge, 10000);
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
// GLOBAL API
// Expose functions for onclick handlers in HTML
// ============================================

window.dashboard = {
    // Connection
    connectHA,

    // Views
    showView,
    selectFloor,

    // Room modal
    openRoomModal,
    closeRoomModal,

    // All lights modal
    openAllLightsModal,
    closeAllLightsModal,

    // Entity controls
    toggleEntity,
    toggleAllRoomLights,
    allLightsOff,

    // Gate & Garage
    toggleGate,
    toggleGarage,
    toggleGateWithFeedback,
    toggleGarageWithFeedback,

    // Security
    armAlarm,
    toggleCameraArm,
    armAllCameras,
    toggleAutoArmCameras,
    toggleDogMode,
    triggerPanic,
    bypassZone,
    refreshSecurityStatus,
    toggleZoneBypass,
    clearAllBypasses,
    cancelCountdown,
    toggleAutoArm,
    toggleCameraSync,
    showSystemDiagnostics,
    closeDiagnostics,
    triggerPanicButton,
    showActivityTimeline,
    closeActivityModal,
    showQuickActions,
    closeQuickActions,
    // Critical Alerts
    showCriticalAlertsConfig,
    closeCriticalAlertsConfig,
    selectCriticalAlertMode,
    toggleCriticalNotifyPerson,
    applyCriticalAlerts,
    disableCriticalAlerts,
    toggleCriticalAlerts,
    updateCriticalAlertsToggleUI,

    // Frigate
    openFrigatePlayback,
    checkFrigateAuth,
    toggleFrigateDetection,
    updateFrigateDetectionToggle,

    // Calendar
    changeCalendarView,
    calendarToday,
    calendarPrev,
    calendarNext,
    closeEventModal,
    refreshCalendar,
    // Calendar auth and events
    toggleCalendarAuth,
    closeAuthModal,
    signInAndClose,
    openCreateEventModal,
    closeCreateEventModal,
    onAllDayChange,
    updateAssigneePreview,
    saveEvent,
    deleteCurrentEvent,
    editCurrentEvent,

    // Media Portal (lazy loaded)
    toggleDeviceDropdown: () => import('./media.js').then(m => m.toggleDeviceDropdown()),
    selectDevice: (id) => import('./media.js').then(m => m.selectDevice(id)),
    openShowDetail: (id) => import('./media.js').then(m => m.openShowDetail(id)),
    closeShowDetail: () => import('./media.js').then(m => m.closeShowDetail()),
    selectSeason: (num) => import('./media.js').then(m => m.selectSeason(num)),
    selectEpisode: (s, e) => import('./media.js').then(m => m.selectEpisode(s, e)),
    toggleCinemaMode: () => import('./media.js').then(m => m.toggleCinemaMode()),
    playMedia: () => import('./media.js').then(m => m.playMedia()),
    playTrailer: () => import('./media.js').then(m => m.playTrailer()),
    addNewShow: () => import('./media.js').then(m => m.addNewShow()),
    setLibraryView: (view) => import('./media.js').then(m => m.setLibraryView(view)),
    quickResume: (id) => import('./media.js').then(m => m.quickResume(id)),

    // Guest Pass (lazy loaded)
    setPassPreset: (preset) => import('./guest-pass.js').then(m => m.setPassPreset(preset)),
    generateGuestPass: () => import('./guest-pass.js').then(m => m.generateGuestPass()),
    revokePass: (id) => import('./guest-pass.js').then(m => m.revokePass(id)),
    deletePass: (id) => import('./guest-pass.js').then(m => m.deletePass(id)),
    pausePass: (id) => import('./guest-pass.js').then(m => m.pausePass(id)),
    editPass: (id) => import('./guest-pass.js').then(m => m.editPass(id)),
    savePassEdit: () => import('./guest-pass.js').then(m => m.savePassEdit()),
    copyPassUrl: () => import('./guest-pass.js').then(m => m.copyPassUrl()),
    shareWhatsApp: () => import('./guest-pass.js').then(m => m.shareWhatsApp()),
    shareGeneric: () => import('./guest-pass.js').then(m => m.shareGeneric()),
    closePassModal: () => import('./guest-pass.js').then(m => m.closePassModal()),
    closeEditModal: () => import('./guest-pass.js').then(m => m.closeEditModal()),
    regeneratePassUrl: (id) => import('./guest-pass.js').then(m => m.regeneratePassUrl(id)),
    refreshPasses: () => import('./guest-pass.js').then(m => m.renderActivePasses()),
    toggleEditCustomDates: (show) => import('./guest-pass.js').then(m => m.toggleEditCustomDates(show)),
    // Activity log
    toggleActivityLog: () => import('./guest-pass.js').then(m => m.toggleActivityLog()),
    filterActivityByPass: (id) => import('./guest-pass.js').then(m => m.filterActivityByPass(id)),
    clearActivityLog: () => import('./guest-pass.js').then(m => m.clearActivityLog()),

    // Auto-Rotate
    toggleAutoRotate
};

// ============================================
// START APPLICATION
// ============================================

document.addEventListener('DOMContentLoaded', init);
