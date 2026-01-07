/**
 * View Manager - Handles view switching using registry
 * Single source of truth: view-registry.js
 */

import { state } from './state.js';
import { VIEW_REGISTRY, getViewNames } from './view-registry.js';
import { $ } from './utils.js';

// Template loader (loaded dynamically)
let templateLoader = null;

// Cache for loaded modules
const moduleCache = new Map();

// Previous view for cleanup
let previousView = null;

/**
 * Initialize view manager
 */
export async function initViewManager() {
    try {
        templateLoader = await import('./template-loader.js');
    } catch (e) {
        console.log('Template loader not available, using inline views');
    }
}

/**
 * Show a view by name
 */
export async function showView(viewName) {
    const config = VIEW_REGISTRY[viewName];
    if (!config) {
        console.warn(`Unknown view: ${viewName}`);
        return;
    }

    // Run cleanup on previous view
    if (previousView && previousView !== viewName) {
        await cleanupView(previousView);
    }

    state.setCurrentView(viewName);
    previousView = viewName;

    // Load template if needed
    if (templateLoader && !$(`view-${viewName}`)) {
        await templateLoader.loadView(viewName);
    }

    // Hide all views, show current
    getViewNames().forEach(v => {
        const el = $(`view-${v}`);
        if (el) el.classList.toggle('hidden', v !== viewName);
    });

    // Initialize view module if configured
    if (config.module && config.onShow) {
        await initializeView(config);
    }
}

/**
 * Initialize a view's module
 */
async function initializeView(config) {
    try {
        let mod = moduleCache.get(config.module);
        if (!mod) {
            mod = await import(config.module);
            moduleCache.set(config.module, mod);
        }

        if (config.onShow && typeof mod[config.onShow] === 'function') {
            mod[config.onShow]();
        }
    } catch (e) {
        console.warn(`Failed to init view module ${config.module}:`, e);
    }
}

/**
 * Cleanup when leaving a view
 */
async function cleanupView(viewName) {
    const config = VIEW_REGISTRY[viewName];
    if (!config || !config.onHide) return;

    try {
        const mod = moduleCache.get(config.module);
        if (mod && typeof mod[config.onHide] === 'function') {
            mod[config.onHide]();
        }
    } catch (e) {
        // Ignore cleanup errors
    }
}

export default { initViewManager, showView };
