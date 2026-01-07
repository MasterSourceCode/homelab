/**
 * Frigate API Abstraction Layer
 * Smart routing for local vs external access through Home Assistant proxy
 *
 * Local Access: Direct to Frigate CORS proxy (fastest)
 * External Access: Through HA's Frigate integration proxy (works via Nabu Casa)
 */

import { state } from './state.js';
import { FRIGATE_LOCAL_URL, FRIGATE_EXTERNAL_URL } from './config.js';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // Local Frigate access (via CORS proxy)
    localApiBase: 'http://192.168.x.x:5003/api',
    localUiBase: 'http://192.168.x.x:8971',

    // Frigate integration client ID (usually 'frigate' unless custom)
    frigateClientId: 'frigate',

    // Cloudflare tunnel fallback
    cloudflareUrl: FRIGATE_EXTERNAL_URL,

    // Timeouts
    requestTimeout: 10000,
    authCheckTimeout: 5000
};

// ============================================
// NETWORK DETECTION
// ============================================

/**
 * Check if we're on the local network
 */
export function isLocalNetwork() {
    const host = window.location.hostname;
    return host.startsWith('192.168.') ||
           host.startsWith('10.') ||
           host.startsWith('172.') ||
           host === 'localhost' ||
           host === '127.0.0.1';
}

/**
 * Get the Home Assistant base URL (works for both local and Nabu Casa)
 */
export function getHaBaseUrl() {
    // If on Nabu Casa, use current origin
    if (window.location.hostname.includes('nabu.casa')) {
        return window.location.origin;
    }
    // If on local HA, use origin
    if (window.location.port === '8123') {
        return window.location.origin;
    }
    // Otherwise use stored HA URL
    return state.haUrl || 'http://192.168.x.x:8123';
}

/**
 * Get authentication headers for HA API requests
 */
function getAuthHeaders() {
    const token = state.haToken;
    if (!token) {
        console.warn('[FrigateAPI] No HA token available');
        return {};
    }
    return {
        'Authorization': `Bearer ${token}`
    };
}

// ============================================
// URL GENERATORS
// ============================================

/**
 * Get URL for camera's latest snapshot
 * @param {string} cameraName - Camera name (e.g., 'front_door')
 * @param {Object} options - Optional parameters
 * @returns {string} URL for the snapshot
 */
export function getSnapshotUrl(cameraName, options = {}) {
    const { height = 480, quality = 70, timestamp = Date.now() } = options;

    if (isLocalNetwork()) {
        // Direct Frigate API (fastest)
        return `${CONFIG.localApiBase}/${cameraName}/latest.jpg?h=${height}&quality=${quality}&_t=${timestamp}`;
    } else {
        // Use Cloudflare tunnel for external access (this was working before)
        return `${CONFIG.cloudflareUrl}/api/${cameraName}/latest.jpg?h=${height}&quality=${quality}&_t=${timestamp}`;
    }
}

/**
 * Get URL for event thumbnail
 * @param {string} eventId - Frigate event ID
 * @returns {string} URL for the thumbnail
 */
export function getEventThumbnailUrl(eventId) {
    if (isLocalNetwork()) {
        return `${CONFIG.localApiBase}/events/${eventId}/thumbnail.jpg`;
    } else {
        // Use Frigate integration's notification endpoint (works through Nabu Casa)
        return `${getHaBaseUrl()}/api/frigate/${CONFIG.frigateClientId}/notifications/${eventId}/thumbnail.jpg`;
    }
}

/**
 * Get URL for event snapshot (full resolution)
 * @param {string} eventId - Frigate event ID
 * @returns {string} URL for the snapshot
 */
export function getEventSnapshotUrl(eventId) {
    if (isLocalNetwork()) {
        return `${CONFIG.localApiBase}/events/${eventId}/snapshot.jpg`;
    } else {
        return `${getHaBaseUrl()}/api/frigate/${CONFIG.frigateClientId}/notifications/${eventId}/snapshot.jpg`;
    }
}

/**
 * Get URL for event video clip
 * @param {string} eventId - Frigate event ID
 * @returns {string} URL for the clip
 */
export function getEventClipUrl(eventId) {
    if (isLocalNetwork()) {
        return `${CONFIG.localApiBase}/events/${eventId}/clip.mp4`;
    } else {
        return `${getHaBaseUrl()}/api/frigate/${CONFIG.frigateClientId}/notifications/${eventId}/clip.mp4`;
    }
}

/**
 * Get URL for Frigate UI (recording playback)
 * @param {string} cameraName - Camera name
 * @param {string} isoTimestamp - Optional timestamp to jump to
 * @returns {string} URL for Frigate UI
 */
export function getFrigateUiUrl(cameraName, isoTimestamp = null) {
    // Frigate UI doesn't work through HA proxy, so we need direct access
    // For external, try Cloudflare tunnel, otherwise local
    const baseUrl = isLocalNetwork() ? CONFIG.localUiBase : CONFIG.cloudflareUrl;

    if (!isoTimestamp) {
        return `${baseUrl}/#/recording/${cameraName}`;
    }

    // Parse timestamp and go back 10 seconds
    const triggerTime = new Date(isoTimestamp);
    triggerTime.setSeconds(triggerTime.getSeconds() - 10);

    const year = triggerTime.getFullYear();
    const month = String(triggerTime.getMonth() + 1).padStart(2, '0');
    const day = String(triggerTime.getDate()).padStart(2, '0');
    const hours = String(triggerTime.getHours()).padStart(2, '0');
    const mins = String(triggerTime.getMinutes()).padStart(2, '0');
    const secs = String(triggerTime.getSeconds()).padStart(2, '0');

    return `${baseUrl}/#/recording/${cameraName}/${year}-${month}-${day}/${hours}:${mins}:${secs}`;
}

// ============================================
// API FETCH METHODS
// ============================================

/**
 * Fetch events from Frigate API
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} Array of events
 */
export async function fetchEvents(params = {}) {
    const queryParams = new URLSearchParams(params);

    if (isLocalNetwork()) {
        // Direct API call
        const response = await fetch(`${CONFIG.localApiBase}/events?${queryParams}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    } else {
        // Use HA WebSocket to get events (more reliable than REST proxy)
        // Fall back to Cloudflare tunnel if available
        try {
            const response = await fetch(`${CONFIG.cloudflareUrl}/api/events?${queryParams}`, {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                return response.json();
            }
        } catch (e) {
            console.warn('[FrigateAPI] Cloudflare tunnel failed, trying HA method:', e);
        }

        // Last resort: try to fetch via HA REST API with Frigate proxy
        // Note: This may not work for /events endpoint, but worth trying
        const response = await fetch(`${getHaBaseUrl()}/api/frigate/${CONFIG.frigateClientId}/events?${queryParams}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }
}

/**
 * Fetch camera stats from Frigate
 * @returns {Promise<Object>} Stats object
 */
export async function fetchCameraStats() {
    if (isLocalNetwork()) {
        const response = await fetch(`${CONFIG.localApiBase}/stats`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    } else {
        // Stats endpoint may not be available through HA proxy
        // Try Cloudflare tunnel first
        try {
            const response = await fetch(`${CONFIG.cloudflareUrl}/api/stats`);
            if (response.ok) {
                return response.json();
            }
        } catch (e) {
            console.warn('[FrigateAPI] Could not fetch stats externally:', e);
        }

        // Return empty stats if unavailable
        return { cameras: {} };
    }
}

/**
 * Load a snapshot image with proper authentication
 * @param {HTMLImageElement} imgElement - Image element to load into
 * @param {string} url - Snapshot URL
 * @returns {Promise<void>}
 */
export async function loadAuthenticatedImage(imgElement, url) {
    if (isLocalNetwork()) {
        // Direct load for local network
        imgElement.src = url;
        return;
    }

    // For external access, we need to handle HA's camera proxy authentication
    // The camera proxy requires a signed token in the URL or a session cookie
    // When accessed via Nabu Casa, the session should already be authenticated

    try {
        // Try direct load first (works if session is authenticated)
        imgElement.src = url;

        // If that fails, try with fetch and blob
        imgElement.onerror = async () => {
            try {
                const response = await fetch(url, {
                    headers: getAuthHeaders(),
                    credentials: 'include'
                });

                if (response.ok) {
                    const blob = await response.blob();
                    imgElement.src = URL.createObjectURL(blob);
                }
            } catch (e) {
                console.warn('[FrigateAPI] Failed to load image:', e);
                imgElement.style.opacity = '0.3';
            }
        };
    } catch (e) {
        console.warn('[FrigateAPI] Image load error:', e);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get the current access mode
 * @returns {string} 'local' or 'external'
 */
export function getAccessMode() {
    return isLocalNetwork() ? 'local' : 'external';
}

/**
 * Get human-readable connection info
 * @returns {Object} Connection info
 */
export function getConnectionInfo() {
    return {
        mode: getAccessMode(),
        isLocal: isLocalNetwork(),
        haUrl: getHaBaseUrl(),
        frigateUrl: isLocalNetwork() ? CONFIG.localApiBase : CONFIG.cloudflareUrl,
        hasAuth: !!state.haToken
    };
}

/**
 * Test connectivity to Frigate
 * @returns {Promise<Object>} Connectivity status
 */
export async function testConnectivity() {
    const results = {
        local: false,
        external: false,
        haProxy: false
    };

    // Test local
    try {
        const response = await fetch(`${CONFIG.localApiBase}/stats`, {
            signal: AbortSignal.timeout(3000)
        });
        results.local = response.ok;
    } catch (e) {
        results.local = false;
    }

    // Test external (Cloudflare)
    try {
        const response = await fetch(`${CONFIG.cloudflareUrl}/api/stats`, {
            signal: AbortSignal.timeout(5000)
        });
        results.external = response.ok;
    } catch (e) {
        results.external = false;
    }

    // Test HA proxy
    try {
        const response = await fetch(`${getHaBaseUrl()}/api/frigate/${CONFIG.frigateClientId}/stats`, {
            headers: getAuthHeaders(),
            signal: AbortSignal.timeout(5000)
        });
        results.haProxy = response.ok;
    } catch (e) {
        results.haProxy = false;
    }

    return results;
}

// Export CONFIG for debugging
export { CONFIG as FrigateConfig };
