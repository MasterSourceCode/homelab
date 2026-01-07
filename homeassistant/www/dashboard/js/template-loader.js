/**
 * Template Loader Module
 * Handles dynamic loading of view and modal templates
 * Uses view-registry.js as single source of truth
 */

import { VIEW_REGISTRY, MODAL_REGISTRY } from './view-registry.js';

// ============================================
// CONFIGURATION
// ============================================

const VIEWS_PATH = '/local/dashboard/views';
const MODALS_PATH = '/local/dashboard/modals';

// ============================================
// STATE
// ============================================

const loadedViews = new Set();
const loadedModals = new Set();
const templateCache = new Map();

// ============================================
// TEMPLATE LOADING
// ============================================

/**
 * Get cache-busting version string
 * Uses URL param if present (from hard refresh), otherwise uses a session-stable value
 */
function getCacheBuster() {
    // Check for refresh param in URL (set by hard refresh button)
    const urlParams = new URLSearchParams(window.location.search);
    const refreshParam = urlParams.get('_refresh');
    if (refreshParam) {
        return refreshParam;
    }
    // Use session storage to maintain consistency within a session
    // but bust cache on new sessions
    let sessionBuster = sessionStorage.getItem('_templateBuster');
    if (!sessionBuster) {
        sessionBuster = Date.now().toString();
        sessionStorage.setItem('_templateBuster', sessionBuster);
    }
    return sessionBuster;
}

/**
 * Fetch and cache a template file
 */
async function fetchTemplate(path) {
    if (templateCache.has(path)) {
        return templateCache.get(path);
    }

    try {
        // Add cache-busting query param
        const cacheBuster = getCacheBuster();
        const url = `${path}?v=${cacheBuster}`;

        const response = await fetch(url, {
            cache: 'no-cache'  // Tell browser not to use HTTP cache
        });
        if (!response.ok) {
            throw new Error(`Failed to load template: ${path}`);
        }
        const html = await response.text();
        templateCache.set(path, html);
        return html;
    } catch (error) {
        console.error(`Template load error: ${path}`, error);
        return null;
    }
}

/**
 * Load a view template into the main content area
 */
export async function loadView(viewName) {
    const viewConfig = VIEW_REGISTRY[viewName];
    if (!viewConfig) {
        console.warn(`Unknown view: ${viewName}`);
        return false;
    }
    const templateFile = viewConfig.template;

    // Already loaded - just return true
    if (loadedViews.has(viewName)) {
        return true;
    }

    const path = `${VIEWS_PATH}/${templateFile}`;
    const html = await fetchTemplate(path);

    if (!html) {
        return false;
    }

    // Find the views container
    const container = document.getElementById('views-container');
    if (!container) {
        console.error('Views container not found');
        return false;
    }

    // Create a temporary container to parse the HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Append all children to the views container
    while (temp.firstChild) {
        container.appendChild(temp.firstChild);
    }

    loadedViews.add(viewName);
    console.log(`View loaded: ${viewName}`);

    // Dispatch event for view initialization
    window.dispatchEvent(new CustomEvent('viewLoaded', { detail: { viewName } }));

    return true;
}

/**
 * Load a modal template into the modals container
 */
export async function loadModal(modalName) {
    const templateFile = MODAL_REGISTRY[modalName];
    if (!templateFile) {
        console.warn(`Unknown modal: ${modalName}`);
        return false;
    }

    // Already loaded - just return true
    if (loadedModals.has(modalName)) {
        return true;
    }

    const path = `${MODALS_PATH}/${templateFile}`;
    const html = await fetchTemplate(path);

    if (!html) {
        return false;
    }

    // Find the modals container
    const container = document.getElementById('modals-container');
    if (!container) {
        console.error('Modals container not found');
        return false;
    }

    // Create a temporary container to parse the HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Append all children to the modals container
    while (temp.firstChild) {
        container.appendChild(temp.firstChild);
    }

    loadedModals.add(modalName);
    console.log(`Modal loaded: ${modalName}`);

    // Dispatch event for modal initialization
    window.dispatchEvent(new CustomEvent('modalLoaded', { detail: { modalName } }));

    return true;
}

/**
 * Preload essential views for faster initial experience
 */
export async function preloadEssentialViews() {
    // Load home view immediately
    await loadView('home');

    // Preload other commonly used views in background
    setTimeout(() => {
        loadView('cameras');
        loadView('security');
        loadView('energy');
    }, 1000);
}

/**
 * Preload all modals (they're small and needed for interactions)
 */
export async function preloadModals() {
    const modalPromises = Object.keys(MODAL_REGISTRY).map(name => loadModal(name));
    await Promise.all(modalPromises);
}

/**
 * Check if a view is loaded
 */
export function isViewLoaded(viewName) {
    return loadedViews.has(viewName);
}

/**
 * Check if a modal is loaded
 */
export function isModalLoaded(modalName) {
    return loadedModals.has(modalName);
}

/**
 * Get list of all available views
 */
export function getAvailableViews() {
    return Object.keys(VIEW_REGISTRY);
}

/**
 * Get list of all available modals
 */
export function getAvailableModals() {
    return Object.keys(MODAL_REGISTRY);
}

// ============================================
// EXPORTS
// ============================================

export default {
    loadView,
    loadModal,
    preloadEssentialViews,
    preloadModals,
    isViewLoaded,
    isModalLoaded,
    getAvailableViews,
    getAvailableModals
};
