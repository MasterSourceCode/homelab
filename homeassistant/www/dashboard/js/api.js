/**
 * API Module
 * WebSocket connection and Home Assistant API communication
 */

import { state } from './state.js';
import { FRIGATE_LOCAL_URL, FRIGATE_EXTERNAL_URL, REFRESH_RATES } from './config.js';

// ============================================
// CONNECTION STATUS CALLBACKS
// ============================================

let onConnecting = null;
let onConnected = null;
let onDisconnected = null;
let onError = null;
let onAuthInvalid = null;
let onStatesUpdated = null;

export function setConnectionCallbacks(callbacks) {
    onConnecting = callbacks.onConnecting;
    onConnected = callbacks.onConnected;
    onDisconnected = callbacks.onDisconnected;
    onError = callbacks.onError;
    onAuthInvalid = callbacks.onAuthInvalid;
    onStatesUpdated = callbacks.onStatesUpdated;
}

// ============================================
// WEBSOCKET CONNECTION
// ============================================

export function connectWebSocket() {
    // Build WebSocket URL based on current protocol
    // If we're on HTTPS (Nabu Casa), we MUST use wss:// with the same origin
    // If we're on HTTP (local), use ws:// with the configured haUrl
    let wsUrl;
    if (window.location.protocol === 'https:') {
        // On HTTPS - use current origin with wss://
        wsUrl = window.location.origin.replace('https:', 'wss:') + '/api/websocket';
        console.log('[API] Using secure WebSocket (Nabu Casa):', wsUrl);
    } else {
        // On HTTP - use configured haUrl
        wsUrl = state.haUrl.replace('http', 'ws') + '/api/websocket';
        console.log('[API] Using local WebSocket:', wsUrl);
    }

    if (onConnecting) onConnecting();

    const ws = new WebSocket(wsUrl);
    state.setWebSocket(ws);

    ws.onopen = () => {
        console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (onError) onError(error);
    };

    ws.onclose = () => {
        state.setAuthenticated(false);
        if (onDisconnected) onDisconnected();

        // Attempt reconnect
        setTimeout(connectWebSocket, REFRESH_RATES.reconnect);
    };
}

// Pending history requests (msgId -> resolve function)
const pendingHistoryRequests = new Map();

function handleMessage(msg) {
    // Check if this is a history response first
    if (msg.type === 'result' && pendingHistoryRequests.has(msg.id)) {
        const { resolve, reject, entityIds } = pendingHistoryRequests.get(msg.id);
        pendingHistoryRequests.delete(msg.id);

        if (msg.success && msg.result) {
            // Transform result to simpler format
            const result = {};
            for (const entityId of entityIds) {
                const history = msg.result[entityId] || [];
                result[entityId] = history.map(entry => ({
                    timestamp: new Date(entry.lu * 1000 || entry.last_updated || entry.last_changed).getTime(),
                    state: parseFloat(entry.s ?? entry.state) || 0
                })).filter(e => !isNaN(e.state))
                  .sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp to prevent chart loops
            }
            resolve(result);
        } else {
            reject(new Error(msg.error?.message || 'History fetch failed'));
        }
        return;
    }

    switch (msg.type) {
        case 'auth_required':
            state.ws.send(JSON.stringify({
                type: 'auth',
                access_token: state.haToken
            }));
            break;

        case 'auth_ok':
            state.setAuthenticated(true);
            if (onConnected) onConnected();
            subscribeToStates();
            break;

        case 'auth_invalid':
            state.clearCredentials();
            if (onAuthInvalid) onAuthInvalid();
            break;

        case 'result':
            if (msg.success && msg.result && Array.isArray(msg.result)) {
                state.setEntities(msg.result);
                if (onStatesUpdated) onStatesUpdated();
            }
            break;

        case 'event':
            if (msg.event?.event_type === 'state_changed' && msg.event.data.new_state) {
                state.setEntity(
                    msg.event.data.new_state.entity_id,
                    msg.event.data.new_state
                );
                if (onStatesUpdated) onStatesUpdated();
            }
            break;
    }
}

function subscribeToStates() {
    state.ws.send(JSON.stringify({
        id: state.getNextMsgId(),
        type: 'get_states'
    }));
    state.ws.send(JSON.stringify({
        id: state.getNextMsgId(),
        type: 'subscribe_events',
        event_type: 'state_changed'
    }));
}

// ============================================
// SERVICE CALLS
// ============================================

export function callService(domain, service, data, target = null) {
    console.log(`[callService] domain=${domain}, service=${service}`);
    console.log(`[callService] authenticated=${state.authenticated}, ws=${state.ws ? 'connected' : 'null'}`);

    if (!state.authenticated || !state.ws) {
        console.error('[callService] BLOCKED - not authenticated or no WebSocket!');
        return;
    }

    const msgId = state.getNextMsgId();
    const payload = {
        id: msgId,
        type: 'call_service',
        domain,
        service,
        service_data: data
    };

    // Add target at top level if provided (required for notify.send_message etc)
    if (target) {
        payload.target = target;
    }

    console.log(`[callService] Sending WebSocket message #${msgId}:`, JSON.stringify(payload, null, 2));
    try {
        state.ws.send(JSON.stringify(payload));
        console.log(`[callService] Message sent successfully`);
    } catch (err) {
        console.error(`[callService] FAILED to send:`, err);
    }
}

// ============================================
// FRIGATE API
// ============================================

export async function checkFrigateAuth() {
    if (state.isLocalNetwork()) {
        state.setFrigateAuthRequired(false);
        return true;
    }

    // For external access via Nabu Casa, we use HA's proxy which handles auth
    // So we don't need separate Frigate auth - just check if HA token exists
    if (state.haToken) {
        state.setFrigateAuthRequired(false);
        console.log('Frigate: Using HA proxy for external access');
        return true;
    }

    // Fallback: Try Cloudflare tunnel
    return new Promise((resolve) => {
        const testImg = new Image();

        testImg.onload = () => {
            state.setFrigateAuthRequired(false);
            console.log('Frigate: Authenticated via Cloudflare Access');
            resolve(true);
        };

        testImg.onerror = () => {
            state.setFrigateAuthRequired(true);
            console.log('Frigate: Auth required - image failed to load');
            resolve(false);
        };

        // Test with a small snapshot via Cloudflare
        testImg.src = `${FRIGATE_EXTERNAL_URL}/api/front_door/latest.jpg?h=50&_t=${Date.now()}`;

        // Timeout after 5 seconds
        setTimeout(() => {
            if (!state.frigateAuthRequired) return;
            state.setFrigateAuthRequired(true);
            console.log('Frigate: Auth check timed out');
            resolve(false);
        }, 5000);
    });
}

/**
 * Check if we're accessing through Home Assistant (local or Nabu Casa)
 */
function isHaAccess() {
    return window.location.hostname.includes('nabu.casa') ||
           window.location.port === '8123';
}

/**
 * Get the Home Assistant base URL
 */
function getHaBaseUrl() {
    if (window.location.hostname.includes('nabu.casa')) {
        return window.location.origin;
    }
    if (window.location.port === '8123') {
        return window.location.origin;
    }
    return state.haUrl || 'http://192.168.x.x:8123';
}

/**
 * Get camera snapshot URL
 * Uses entity_picture (signed URL) for external access via Nabu Casa
 */
export function getCameraUrl(cameraName, timestamp) {
    if (state.isLocalNetwork()) {
        // Direct Frigate API access (faster, higher quality)
        return `${FRIGATE_LOCAL_URL}/api/${cameraName}/latest.jpg?h=480&quality=70&_t=${timestamp}`;
    }

    // For external access, try to use the signed entity_picture from state
    const entityId = `camera.${cameraName}`;
    const cameraEntity = state.getEntity(entityId);

    if (cameraEntity && cameraEntity.attributes?.entity_picture) {
        // entity_picture contains a signed URL
        const signedPath = cameraEntity.attributes.entity_picture;
        const separator = signedPath.includes('?') ? '&' : '?';
        return `${getHaBaseUrl()}${signedPath}${separator}_t=${timestamp}`;
    }

    // Fallback: try camera proxy (may not work without proper auth)
    if (isHaAccess()) {
        return `${getHaBaseUrl()}/api/camera_proxy/camera.${cameraName}?_t=${timestamp}`;
    } else if (FRIGATE_EXTERNAL_URL) {
        return `${FRIGATE_EXTERNAL_URL}/api/${cameraName}/latest.jpg?h=480&quality=70&_t=${timestamp}`;
    } else {
        return `${state.haUrl}/api/camera_proxy/camera.${cameraName}?token=${state.haToken}&_t=${timestamp}`;
    }
}

/**
 * Get Frigate playback URL
 * Note: Frigate UI doesn't work through HA proxy, so we use Cloudflare tunnel for external
 */
export function getFrigatePlaybackUrl(cameraName, isoTimestamp) {
    // Frigate UI requires direct access (doesn't work through HA proxy)
    const frigateBaseUrl = state.isLocalNetwork()
        ? 'http://192.168.x.x:8971'
        : FRIGATE_EXTERNAL_URL || 'https://your-frigate-domain.com';

    if (!isoTimestamp || isoTimestamp === 'undefined') {
        return `${frigateBaseUrl}/#/recording/${cameraName}`;
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

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hours}:${mins}:${secs}`;

    return `${frigateBaseUrl}/#/recording/${cameraName}/${dateStr}/${timeStr}`;
}

// ============================================
// HISTORY API
// ============================================

/**
 * Fetch historical sensor data from Home Assistant
 * @param {string[]} entityIds - Array of entity IDs to fetch history for
 * @param {number} hoursBack - How many hours of history to fetch (default 6)
 * @returns {Promise<Object>} - Object mapping entity_id to array of {timestamp, state} objects
 */
export function fetchHistory(entityIds, hoursBack = 6) {
    return new Promise((resolve, reject) => {
        if (!state.authenticated || !state.ws) {
            reject(new Error('Not connected'));
            return;
        }

        const now = new Date();
        const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

        const msgId = state.getNextMsgId();

        // Store the resolve function for when we get the response
        pendingHistoryRequests.set(msgId, { resolve, reject, entityIds });

        // Request history from HA
        state.ws.send(JSON.stringify({
            id: msgId,
            type: 'history/history_during_period',
            start_time: startTime.toISOString(),
            end_time: now.toISOString(),
            entity_ids: entityIds,
            minimal_response: true,
            no_attributes: true,
            significant_changes_only: false
        }));

        // Timeout after 10 seconds
        setTimeout(() => {
            if (pendingHistoryRequests.has(msgId)) {
                pendingHistoryRequests.delete(msgId);
                reject(new Error('History request timed out'));
            }
        }, 10000);
    });
}
