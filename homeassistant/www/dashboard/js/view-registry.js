/**
 * View Registry - Single source of truth for all views
 * Add new views here only - no other files need modification
 */

export const VIEW_REGISTRY = {
    home: {
        template: 'home.html',
        preload: true
    },
    cameras: {
        template: 'cameras.html',
        module: './access-controller.js',
        onShow: 'startCameraRefresh',
        onHide: 'stopCameraRefresh'
    },
    security: {
        template: 'security.html',
        module: './security-controller.js',
        onShow: 'initializeZoneTimeline'
    },
    energy: {
        template: 'energy.html',
        module: './energy-chart.js',
        onShow: 'onEnergyViewShow'
    },
    'energy-display': {
        template: 'energy-display.html',
        module: './energy-display.js',
        onShow: 'initEnergyDisplay'
    },
    garage: {
        template: 'garage.html'
    },
    calendar: {
        template: 'calendar.html',
        module: './calendar.js',
        onShow: 'initCalendar',
        onHide: 'destroyCalendar'
    },
    media: {
        template: 'media.html',
        module: './media.js',
        onShow: 'initMediaPortal'
    },
    system: {
        template: 'system.html',
        module: './pc-metrics.js',
        onShow: 'startPCMetrics',
        onHide: 'stopPCMetrics'
    },
    surveillance: {
        template: 'surveillance.html',
        module: './surveillance.js',
        onShow: 'onViewShow',
        onHide: 'onViewHide'
    },
    'guest-pass': {
        template: 'guest-pass.html',
        module: './guest-pass.js'
    },
    weather: {
        template: 'weather.html',
        module: './weather.js',
        onShow: 'init'
    },
    alexa: {
        template: 'alexa.html',
        module: './alexa.js',
        onShow: 'initAlexa'
    }
};

export const MODAL_REGISTRY = {
    room: 'room-modal.html',
    allLights: 'all-lights-modal.html',
    eventDetail: 'event-detail-modal.html',
    eventCreate: 'event-create-modal.html',
    calendarAuth: 'calendar-auth-modal.html',
    delayedExit: '../views/delayed-exit.html'
};

/**
 * Get all view names
 */
export function getViewNames() {
    return Object.keys(VIEW_REGISTRY);
}

/**
 * Get view config
 */
export function getViewConfig(viewName) {
    return VIEW_REGISTRY[viewName];
}
