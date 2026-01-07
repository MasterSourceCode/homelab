/**
 * State Management
 * Centralized state for the dashboard application
 */

import { DEFAULT_LOCAL_HA_URL, FRIGATE_EXTERNAL_URL } from './config.js';

// ============================================
// APPLICATION STATE
// ============================================

class AppState {
    constructor() {
        // Connection state
        this.haUrl = localStorage.getItem('ha_url') || this._getDefaultHaUrl();
        this.haToken = localStorage.getItem('ha_token') || '';
        this.ws = null;
        this.msgId = 1;
        this.authenticated = false;

        // Frigate state
        this.frigateExternalUrl = FRIGATE_EXTERNAL_URL;
        this.frigateAuthRequired = false;

        // Entity states (from Home Assistant)
        this.entities = {};

        // UI state
        this.currentFloor = 'ground';
        this.currentView = 'home';
        this.openRoomId = null;
        this.allLightsModalOpen = false;

        // Security state
        this.autoArmCameras = true;

        // Timers
        this.accessControlTimer = null;
        this.gateLastUpdateTime = null;
        this.garageLastUpdateTime = null;

        // Event listeners
        this._listeners = {};
    }

    // ============================================
    // NETWORK DETECTION
    // ============================================

    isLocalNetwork() {
        const host = window.location.hostname;
        return host.startsWith('192.168.') ||
               host.startsWith('10.') ||
               host.startsWith('172.') ||
               host === 'localhost' ||
               host === '127.0.0.1';
    }

    _getDefaultHaUrl() {
        // If we're already on an HA page (local or Nabu Casa), use that
        if (window.location.port === '8123' || window.location.hostname.includes('nabu.casa')) {
            return window.location.origin;
        }
        // Fallback to local IP
        return DEFAULT_LOCAL_HA_URL;
    }

    // ============================================
    // CONNECTION STATE
    // ============================================

    setCredentials(url, token) {
        this.haUrl = url;
        this.haToken = token;
        localStorage.setItem('ha_url', url);
        localStorage.setItem('ha_token', token);
    }

    clearCredentials() {
        localStorage.removeItem('ha_token');
        this.haToken = '';
        this.authenticated = false;
    }

    setWebSocket(ws) {
        this.ws = ws;
    }

    setAuthenticated(value) {
        this.authenticated = value;
        this._emit('authChanged', value);
    }

    getNextMsgId() {
        return this.msgId++;
    }

    // ============================================
    // ENTITY STATE
    // ============================================

    setEntity(entityId, state) {
        const oldState = this.entities[entityId];
        this.entities[entityId] = state;

        if (!oldState || oldState.state !== state.state) {
            this._emit('entityChanged', { entityId, oldState, newState: state });
        }
    }

    setEntities(statesArray) {
        statesArray.forEach(s => {
            this.entities[s.entity_id] = s;
        });
        this._emit('statesUpdated');
    }

    getEntity(entityId) {
        return this.entities[entityId];
    }

    getEntityState(entityId) {
        return this.entities[entityId]?.state;
    }

    // ============================================
    // UI STATE
    // ============================================

    setCurrentFloor(floor) {
        this.currentFloor = floor;
        this._emit('floorChanged', floor);
    }

    setCurrentView(view) {
        const oldView = this.currentView;
        this.currentView = view;
        this._emit('viewChanged', { oldView, newView: view });
    }

    setOpenRoomId(roomId) {
        this.openRoomId = roomId;
        this._emit('roomModalChanged', roomId);
    }

    setAllLightsModalOpen(value) {
        this.allLightsModalOpen = value;
        this._emit('allLightsModalChanged', value);
    }

    // ============================================
    // SECURITY STATE
    // ============================================

    setAutoArmCameras(value) {
        this.autoArmCameras = value;
        this._emit('autoArmChanged', value);
    }

    toggleAutoArmCameras() {
        this.setAutoArmCameras(!this.autoArmCameras);
    }

    // ============================================
    // FRIGATE STATE
    // ============================================

    setFrigateAuthRequired(value) {
        this.frigateAuthRequired = value;
    }

    // ============================================
    // TIMER STATE
    // ============================================

    setAccessControlTimer(timer) {
        this.accessControlTimer = timer;
    }

    clearAccessControlTimer() {
        if (this.accessControlTimer) {
            clearTimeout(this.accessControlTimer);
            this.accessControlTimer = null;
        }
    }

    setGateLastUpdateTime(time) {
        this.gateLastUpdateTime = time;
    }

    setGarageLastUpdateTime(time) {
        this.garageLastUpdateTime = time;
    }

    // ============================================
    // EVENT EMITTER
    // ============================================

    on(event, callback) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
    }

    off(event, callback) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }

    _emit(event, data) {
        if (!this._listeners[event]) return;
        this._listeners[event].forEach(cb => cb(data));
    }
}

// Export singleton instance
export const state = new AppState();
