/**
 * Mobile Event Handler
 * Event delegation for mobile dashboard
 * Uses same data-action pattern as desktop
 */

// ============================================
// ACTION REGISTRY
// ============================================

const actionHandlers = new Map();

// ============================================
// REGISTRATION
// ============================================

export function registerAction(action, handler) {
    actionHandlers.set(action, handler);
}

export function registerActions(actions) {
    Object.entries(actions).forEach(([action, handler]) => {
        registerAction(action, handler);
    });
}

// ============================================
// EVENT DELEGATION
// ============================================

export function initMobileEventDelegation() {
    // Use CAPTURE phase to catch events before any stopPropagation
    document.addEventListener('click', handleClick, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });
    console.log('Mobile event delegation initialized (capture phase)');
}

function handleClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    const handler = actionHandlers.get(action);

    if (handler) {
        event.preventDefault();
        event.stopPropagation();
        const params = parseParams(actionEl);
        console.log('Mobile action triggered:', action, params);
        handler(actionEl, event, params);
    } else {
        console.warn(`No handler for action: ${action}`);
    }
}

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

function handleTouchEnd(event) {
    // Handle swipe gestures for modals if needed
    const modal = event.target.closest('.modal-sheet');
    if (modal && modal.dataset.swipeAction) {
        const action = modal.dataset.swipeAction;
        const handler = actionHandlers.get(action);
        if (handler) handler(modal, event, {});
    }
}

function parseParams(element) {
    const params = {};
    for (const [key, value] of Object.entries(element.dataset)) {
        if (key.startsWith('param')) {
            const paramName = key.slice(5).toLowerCase();
            params[paramName] = parseValue(value);
        } else if (key !== 'action' && key !== 'changeAction') {
            params[key] = parseValue(value);
        }
    }
    return params;
}

function parseValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(value) && value !== '') return Number(value);
    if ((value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']'))) {
        try { return JSON.parse(value); } catch { return value; }
    }
    return value;
}

// ============================================
// BUILT-IN ACTIONS FOR MOBILE
// ============================================

export function registerMobileActions() {
    // Wait for window.mobile to be available
    const mobile = window.mobile;
    if (!mobile) {
        console.error('window.mobile not available');
        return;
    }

    registerActions({
        // Connection
        'connectHA': () => mobile.connectHA(),

        // Navigation
        'showView': (el, e, p) => mobile.showView(p.view),
        'showHome': () => mobile.showView('home'),
        'showViewAndCloseMenu': (el, e, p) => mobile.showViewAndCloseMenu(p.view),

        // Floor selection
        'selectFloor': (el, e, p) => mobile.selectFloor(p.floor),

        // Room/Lights
        'openRoomModal': (el, e, p) => mobile.openRoomModal(p.room),
        'closeRoomModal': () => mobile.closeRoomModal(),
        'openAllLightsModal': () => mobile.openAllLightsModal(),
        'closeAllLightsModal': () => mobile.closeAllLightsModal(),
        'toggleEntity': (el, e, p) => mobile.toggleEntity(p.entity),
        'toggleAllRoomLights': (el, e, p) => mobile.toggleAllRoomLights(p.room, p.turnon),
        'allLightsOff': () => mobile.allLightsOff(),
        'allLightsOffAndClose': () => mobile.allLightsOffAndClose(),

        // Gate & Garage
        'toggleGate': () => mobile.toggleGate(),
        'toggleGarage': () => mobile.toggleGarage(),
        'toggleGateWithFeedback': () => mobile.toggleGateWithFeedback(),
        'toggleGarageWithFeedback': () => mobile.toggleGarageWithFeedback(),

        // Security
        'armAlarm': (el, e, p) => mobile.armAlarm(p.mode),
        'triggerPanicButton': (el, e, p) => mobile.triggerPanicButton(p.type),
        'toggleDogMode': () => mobile.toggleDogMode(),
        // Critical Alerts
        'showCriticalAlertsConfig': () => mobile.showCriticalAlertsConfig(),
        'closeCriticalAlertsConfig': () => mobile.closeCriticalAlertsConfig(),
        'selectCriticalAlertMode': (el, e, p) => mobile.selectCriticalAlertMode(p.mode),
        'toggleCriticalNotifyPerson': (el, e, p) => mobile.toggleCriticalNotifyPerson(p.person),
        'applyCriticalAlerts': () => mobile.applyCriticalAlerts(),
        'disableCriticalAlerts': () => mobile.disableCriticalAlerts(),
        'toggleCriticalAlerts': () => mobile.toggleCriticalAlerts(),
        'showDelayedExit': () => mobile.showDelayedExitOverlay(),
        'hideDelayedExit': () => mobile.hideDelayedExitOverlay(),
        'selectExitMode': (el, e, p) => mobile.selectExitMode(p.mode),
        'cancelDelayedExit': () => mobile.cancelDelayedExit(),
        'executeExitNow': () => mobile.executeExitNow(),

        // Family
        'switchFamilyMetric': (el, e, p) => mobile.switchFamilyMetric(p.metric),

        // Calendar
        'calendarPrevMonth': () => mobile.calendarPrevMonth(),
        'calendarNextMonth': () => mobile.calendarNextMonth(),
        'calendarPrevWeek': () => mobile.calendarPrevWeek(),
        'calendarNextWeek': () => mobile.calendarNextWeek(),
        'calendarGoToday': () => mobile.calendarGoToday(),
        'toggleMiniCalendar': () => mobile.toggleMiniCalendar(),
        'selectCalendarDate': (el, e, p) => mobile.selectCalendarDate(p.date),
        'setCalendarViewMode': (el, e, p) => mobile.setCalendarViewMode(p.mode),
        'showCalendarEvent': (el, e, p) => mobile.showCalendarEvent(p.id),
        'closeCalEventModal': () => mobile.closeCalEventModal(),
        'openQuickAddEvent': () => mobile.openQuickAddEvent(),
        'closeQuickAddModal': () => mobile.closeQuickAddModal(),
        'saveQuickEvent': () => mobile.saveQuickEvent(),
        'toggleQuickEventTime': () => mobile.toggleQuickEventTime(),

        // Surveillance
        'setSurvTimeFilter': (el, e, p) => mobile.setSurvTimeFilter(p.filter),
        'setSurvObjectFilter': (el, e, p) => mobile.setSurvObjectFilter(p.filter),
        'openSurvEventDetail': (el, e, p) => mobile.openSurvEventDetail(p.id),
        'closeSurvDetailModal': () => mobile.closeSurvDetailModal(),
        'playSurvClip': () => mobile.playSurvClip(),
        'downloadSurvClip': () => mobile.downloadSurvClip(),

        // Alexa
        'alexaAnnounce': (el, e, p) => mobile.alexaAnnounce(p.message, p.target),
        'alexaCustomAnnounce': () => mobile.alexaCustomAnnounce(),
        'startDeliveryMode': () => mobile.startDeliveryMode(),
        'startDeliveryModeFromCamera': () => mobile.startDeliveryModeFromCamera(),
        'cancelDeliveryMode': () => mobile.cancelDeliveryMode(),

        // Guest Pass
        'setGuestPreset': (el, e, p) => mobile.setGuestPreset(p.preset),
        'generateGuestPass': () => mobile.generateMobileGuestPass(),
        'closeGuestPassModal': () => mobile.closeGuestPassModal(),
        'copyGuestPassUrl': () => mobile.copyGuestPassUrl(),
        'shareGuestPassWhatsApp': () => mobile.shareGuestPassWhatsApp(),
        'shareGuestPassNative': () => mobile.shareGuestPassNative(),
        'revokeGuestPass': (el, e, p) => mobile.revokeGuestPass(p.id),
        'reshareGuestPass': (el, e, p) => mobile.reshareGuestPass(p.id),

        // More Menu
        'openMoreMenu': () => mobile.openMoreMenu(),
        'closeMoreMenu': () => mobile.closeMoreMenu()
    });
}

export default {
    registerAction,
    registerActions,
    initMobileEventDelegation,
    registerMobileActions
};
