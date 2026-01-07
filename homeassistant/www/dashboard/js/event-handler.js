/**
 * Event Handler Module
 * Centralized event delegation system
 * Replaces inline onclick handlers with data-action attributes
 */

// ============================================
// ACTION REGISTRY
// ============================================

// Maps action names to handler functions
const actionHandlers = new Map();

// ============================================
// DELIVERY MODE UI STATE
// ============================================

/**
 * Update Delivery Mode UI state
 * @param {'idle'|'active'|'package_detected'} state
 */
function updateDeliveryModeUI(state) {
    const startBtn = document.getElementById('deliveryModeStartBtn');
    const activeDiv = document.getElementById('deliveryModeActive');
    const thankYouDiv = document.getElementById('deliveryModeThankYou');

    if (!startBtn || !activeDiv || !thankYouDiv) return;

    // Hide all first
    startBtn.classList.add('hidden');
    activeDiv.classList.add('hidden');
    thankYouDiv.classList.add('hidden');

    // Show the appropriate state
    switch (state) {
        case 'idle':
            startBtn.classList.remove('hidden');
            break;
        case 'active':
            activeDiv.classList.remove('hidden');
            break;
        case 'package_detected':
            thankYouDiv.classList.remove('hidden');
            break;
    }
}

// Track delivery mode state from HA persistent_notifications
let deliveryModePollingInterval = null;

/**
 * Start polling for delivery mode state changes
 */
export function startDeliveryModePolling() {
    if (deliveryModePollingInterval) return; // Already polling

    const checkState = async () => {
        try {
            const { getStates } = await import('./api.js');
            const states = await getStates();

            // Check persistent_notification entities
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

    // Check immediately and then every 2 seconds
    checkState();
    deliveryModePollingInterval = setInterval(checkState, 2000);
}

/**
 * Stop polling for delivery mode state
 */
export function stopDeliveryModePolling() {
    if (deliveryModePollingInterval) {
        clearInterval(deliveryModePollingInterval);
        deliveryModePollingInterval = null;
    }
}

// ============================================
// REGISTRATION
// ============================================

/**
 * Register an action handler
 * @param {string} action - Action name (used in data-action attribute)
 * @param {Function} handler - Handler function(element, event, params)
 */
export function registerAction(action, handler) {
    actionHandlers.set(action, handler);
}

/**
 * Register multiple actions at once
 * @param {Object} actions - Object mapping action names to handlers
 */
export function registerActions(actions) {
    Object.entries(actions).forEach(([action, handler]) => {
        registerAction(action, handler);
    });
}

// ============================================
// EVENT DELEGATION
// ============================================

/**
 * Initialize the event delegation system
 * Attaches a single click handler to the document
 */
export function initEventDelegation() {
    // Click events - use CAPTURE phase to catch events before stopPropagation
    document.addEventListener('click', handleClick, true);

    // Change events (for inputs/selects)
    document.addEventListener('change', handleChange, true);

    // Context menu (right-click)
    document.addEventListener('contextmenu', handleContextMenu, true);

    // Keyboard events
    document.addEventListener('keydown', handleKeydown);

    console.log('Event delegation initialized (capture phase)');
}

/**
 * Handle click events via delegation
 */
function handleClick(event) {
    // Find the closest element with data-action
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    const handler = actionHandlers.get(action);

    if (handler) {
        event.preventDefault();
        event.stopPropagation();
        const params = parseParams(actionEl);
        console.log('Action triggered:', action, params);
        handler(actionEl, event, params);
    } else {
        console.warn(`No handler registered for action: ${action}`);
    }
}

/**
 * Handle change events via delegation
 */
function handleChange(event) {
    const actionEl = event.target.closest('[data-change-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.changeAction;
    const handler = actionHandlers.get(action);

    if (handler) {
        const params = parseParams(actionEl);
        params.value = event.target.value;
        params.checked = event.target.checked;
        handler(actionEl, event, params);
    }
}

/**
 * Handle context menu events
 */
function handleContextMenu(event) {
    const actionEl = event.target.closest('[data-context-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.contextAction;
    const handler = actionHandlers.get(action);

    if (handler) {
        event.preventDefault();
        const params = parseParams(actionEl);
        handler(actionEl, event, params);
    }
}

/**
 * Handle keyboard events
 */
function handleKeydown(event) {
    // ESC key closes modals
    if (event.key === 'Escape') {
        const handler = actionHandlers.get('closeActiveModal');
        if (handler) {
            handler(null, event, {});
        }
    }
}

/**
 * Parse data-* parameters from an element
 */
function parseParams(element) {
    const params = {};

    // Extract all data-param-* attributes
    for (const [key, value] of Object.entries(element.dataset)) {
        if (key.startsWith('param')) {
            // Convert paramFoo to foo
            const paramName = key.slice(5).toLowerCase();
            params[paramName] = parseValue(value);
        } else if (key !== 'action' && key !== 'changeAction' && key !== 'contextAction') {
            // Include other data attributes
            params[key] = parseValue(value);
        }
    }

    return params;
}

/**
 * Parse string value to appropriate type
 */
function parseValue(value) {
    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Number
    if (!isNaN(value) && value !== '') return Number(value);

    // JSON object/array
    if ((value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']'))) {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    return value;
}

// ============================================
// BUILT-IN ACTIONS
// ============================================

/**
 * Register common built-in actions
 */
export function registerBuiltInActions(dashboard) {
    registerActions({
        // Navigation
        'showView': (el, e, p) => dashboard.showView(p.view),
        'showHome': () => dashboard.showView('home'),

        // Entity control
        'toggleEntity': (el, e, p) => dashboard.toggleEntity(p.entity),
        'callService': (el, e, p) => dashboard.callService(p.domain, p.service, p.data),

        // Room controls
        'openRoomModal': (el, e, p) => dashboard.openRoomModal(p.room),
        'closeRoomModal': () => dashboard.closeRoomModal(),
        'toggleAllRoomLights': (el, e, p) => dashboard.toggleAllRoomLights(p.room, p.turnon),

        // All lights
        'openAllLightsModal': () => dashboard.openAllLightsModal(),
        'closeAllLightsModal': () => dashboard.closeAllLightsModal(),
        'allLightsOff': () => dashboard.allLightsOff(),

        // Security
        'armAlarm': (el, e, p) => dashboard.armAlarm(p.mode),
        'toggleCameraArm': (el, e, p) => dashboard.toggleCameraArm(p.camera),
        'toggleAutoArmCameras': () => dashboard.toggleAutoArmCameras(),
        'toggleDogMode': () => dashboard.toggleDogMode(),
        'triggerPanic': (el, e, p) => dashboard.triggerPanic(p.type),
        'bypassZone': () => dashboard.bypassZone(),
        'refreshSecurityStatus': () => dashboard.refreshSecurityStatus(),
        'toggleZoneBypass': (el, e, p) => dashboard.toggleZoneBypass(p.zone, p.name),
        'clearAllBypasses': () => dashboard.clearAllBypasses(),
        'cancelCountdown': () => dashboard.cancelCountdown(),
        'toggleAutoArm': () => dashboard.toggleAutoArm(),
        'toggleCameraSync': () => dashboard.toggleCameraSync(),
        'showSystemDiagnostics': () => dashboard.showSystemDiagnostics(),
        'closeDiagnostics': () => dashboard.closeDiagnostics(),
        'triggerPanicButton': (el, e, p) => dashboard.triggerPanicButton(p.type),
        'showActivityTimeline': () => dashboard.showActivityTimeline(),
        'closeActivityModal': () => dashboard.closeActivityModal(),
        'showQuickActions': () => dashboard.showQuickActions(),
        'closeQuickActions': () => dashboard.closeQuickActions(),
        // Critical Alerts
        'showCriticalAlertsConfig': () => dashboard.showCriticalAlertsConfig(),
        'closeCriticalAlertsConfig': () => dashboard.closeCriticalAlertsConfig(),
        'selectCriticalAlertMode': (el, e, p) => dashboard.selectCriticalAlertMode(p.mode),
        'toggleCriticalNotifyPerson': (el, e, p) => dashboard.toggleCriticalNotifyPerson(p.person),
        'applyCriticalAlerts': () => dashboard.applyCriticalAlerts(),
        'disableCriticalAlerts': () => dashboard.disableCriticalAlerts(),
        'toggleCriticalAlerts': () => dashboard.toggleCriticalAlerts(),

        // Gate & Garage
        'toggleGate': () => dashboard.toggleGate(),
        'toggleGarage': () => dashboard.toggleGarage(),
        'toggleGateWithFeedback': () => dashboard.toggleGateWithFeedback(),
        'toggleGarageWithFeedback': () => dashboard.toggleGarageWithFeedback(),

        // Floor selection
        'selectFloor': (el, e, p) => dashboard.selectFloor(p.floor),

        // Calendar
        'changeCalendarView': (el, e, p) => dashboard.changeCalendarView(p.view),
        'calendarToday': () => dashboard.calendarToday(),
        'calendarPrev': () => dashboard.calendarPrev(),
        'calendarNext': () => dashboard.calendarNext(),
        'toggleCalendarAuth': () => dashboard.toggleCalendarAuth(),
        'closeAuthModal': () => dashboard.closeAuthModal(),
        'signInAndClose': () => dashboard.signInAndClose(),
        'openCreateEventModal': (el, e, p) => dashboard.openCreateEventModal(p.date),
        'closeCreateEventModal': () => dashboard.closeCreateEventModal(),
        'closeEventModal': () => dashboard.closeEventModal(),
        'saveEvent': () => dashboard.saveEvent(),
        'deleteCurrentEvent': () => dashboard.deleteCurrentEvent(),
        'editCurrentEvent': () => dashboard.editCurrentEvent(),
        'toggleCalendarFilter': (el, e, p) => dashboard.toggleCalendarFilter(p.filter),

        // Media
        'toggleDeviceDropdown': () => dashboard.toggleDeviceDropdown(),
        'selectDevice': (el, e, p) => dashboard.selectDevice(p.device),
        'openShowDetail': (el, e, p) => dashboard.openShowDetail(p.id),
        'closeShowDetail': () => dashboard.closeShowDetail(),
        'selectSeason': (el, e, p) => dashboard.selectSeason(p.season),
        'playMedia': () => dashboard.playMedia(),
        'playTrailer': () => dashboard.playTrailer(),
        'toggleCinemaMode': () => dashboard.toggleCinemaMode(),
        'setLibraryView': (el, e, p) => dashboard.setLibraryView(p.view),
        'quickResume': (el, e, p) => dashboard.quickResume(p.id),

        // Frigate
        'openFrigatePlayback': (el, e, p) => dashboard.openFrigatePlayback(p.camera, p.time),
        'toggleFrigateDetection': () => dashboard.toggleFrigateDetection(),

        // Guest Pass
        'setPassPreset': (el, e, p) => dashboard.setPassPreset(p.preset),
        'generateGuestPass': () => dashboard.generateGuestPass(),
        'revokePass': (el, e, p) => dashboard.revokePass(p.passid),
        'deletePass': (el, e, p) => dashboard.deletePass(p.passid),
        'pausePass': (el, e, p) => dashboard.pausePass(p.passid),
        'editPass': (el, e, p) => dashboard.editPass(p.passid),
        'savePassEdit': () => dashboard.savePassEdit(),
        'copyPassUrl': () => dashboard.copyPassUrl(),
        'shareWhatsApp': () => dashboard.shareWhatsApp(),
        'shareGeneric': () => dashboard.shareGeneric(),
        'closePassModal': () => dashboard.closePassModal(),
        'closeEditModal': () => dashboard.closeEditModal(),
        'regeneratePassUrl': (el, e, p) => dashboard.regeneratePassUrl(p.passid),
        'refreshPasses': () => dashboard.refreshPasses(),
        'toggleEditCustomDates': (el, e, p) => dashboard.toggleEditCustomDates(p.show === 'true'),
        'toggleActivityLog': () => dashboard.toggleActivityLog(),
        'filterActivityByPass': (el, e, p) => dashboard.filterActivityByPass(p.passid),
        'clearActivityLog': () => dashboard.clearActivityLog(),

        // Connection
        'connectHA': () => dashboard.connectHA(),

        // Auto-Rotate
        'toggleAutoRotate': () => dashboard.toggleAutoRotate(),

        // Delayed Exit
        'showDelayedExit': async () => {
            const { loadModal } = await import('./template-loader.js');
            await loadModal('delayedExit');
            const delayedExit = await import('./delayed-exit.js');
            delayedExit.showDelayedExitOverlay();
        },
        'selectExitMode': async (el, e, p) => {
            const delayedExit = await import('./delayed-exit.js');
            delayedExit.selectExitMode(p.mode);
        },
        'cancelDelayedExit': async () => {
            const delayedExit = await import('./delayed-exit.js');
            delayedExit.cancelDelayedExit();
        },
        'executeExitNow': async () => {
            const delayedExit = await import('./delayed-exit.js');
            delayedExit.executeSelectedMode();
        },

        // Alexa Announcements
        'alexaAnnounce': async (el, e, p) => {
            console.log('alexaAnnounce action triggered', p);
            try {
                const alexa = await import('./alexa.js');
                console.log('alexa module loaded, calling sendAnnouncement');
                alexa.sendAnnouncement(p.message, p.target || 'all');
            } catch (err) {
                console.error('Failed to load alexa module:', err);
            }
        },
        'alexaCustomAnnounce': async () => {
            console.log('alexaCustomAnnounce action triggered');
            try {
                const alexa = await import('./alexa.js');
                alexa.sendCustomAnnouncement();
            } catch (err) {
                console.error('Failed to load alexa module:', err);
            }
        },
        'startDeliveryMode': () => {
            // Call HA script for delivery mode (opens garage, announces until closed)
            const { callService } = window.dashboardAPI || {};
            if (callService) {
                callService('script', 'turn_on', { entity_id: 'script.delivery_mode' });
            } else {
                // Fallback: import api module
                import('./api.js').then(api => {
                    api.callService('script', 'turn_on', { entity_id: 'script.delivery_mode' });
                });
            }
            // Show feedback
            const feedback = document.getElementById('alexaFeedback');
            if (feedback) {
                const span = feedback.querySelector('span');
                if (span) span.textContent = 'Delivery Mode Started!';
                feedback.style.transform = 'translateX(-50%) translateY(0)';
                feedback.style.opacity = '1';
                setTimeout(() => {
                    feedback.style.transform = 'translateX(-50%) translateY(20px)';
                    feedback.style.opacity = '0';
                    if (span) span.textContent = 'Sent!';
                }, 2000);
            }
        },

        // Delivery Mode from Camera View - with UI state management
        'startDeliveryModeFromCamera': () => {
            import('./api.js').then(api => {
                api.callService('script', 'turn_on', { entity_id: 'script.delivery_mode' });
            });
            // Update UI to show active state
            updateDeliveryModeUI('active');
        },

        'cancelDeliveryMode': () => {
            import('./api.js').then(api => {
                // Turn off the running script
                api.callService('script', 'turn_off', { entity_id: 'script.delivery_mode' });
                // Also dismiss notifications to clean up
                api.callService('persistent_notification', 'dismiss', { notification_id: 'delivery_mode_active' });
                api.callService('persistent_notification', 'dismiss', { notification_id: 'delivery_mode_package_detected' });
            });
            // Reset UI to initial state
            updateDeliveryModeUI('idle');
        },

        // Hard Refresh - clears ALL caches and forces complete reload
        'hardRefresh': async () => {
            try {
                // Clear service worker caches
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                    console.log('Cleared SW caches');
                }
                // Unregister service workers
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map(reg => reg.unregister()));
                    console.log('Unregistered service workers');
                }
                // Clear session storage (template cache buster)
                sessionStorage.clear();
                console.log('Cleared session storage');
            } catch (e) {
                console.warn('Cache clear failed:', e);
            }
            // Navigate with cache-busting param to force complete fresh load
            // This ensures the browser fetches index.html fresh, which then loads fresh JS modules
            const url = new URL(window.location.href);
            url.searchParams.set('_refresh', Date.now());
            window.location.replace(url.href);
        },

        // Modal escape
        'closeActiveModal': () => {
            // Close any open modal
            document.querySelectorAll('.modal-container:not(.hidden)').forEach(modal => {
                modal.classList.add('hidden');
            });
            dashboard.closeRoomModal?.();
            dashboard.closeAllLightsModal?.();
            dashboard.closeEventModal?.();
            dashboard.closeShowDetail?.();
        }
    });
}

// ============================================
// EXPORTS
// ============================================

export default {
    registerAction,
    registerActions,
    initEventDelegation,
    registerBuiltInActions,
    startDeliveryModePolling,
    stopDeliveryModePolling
};
