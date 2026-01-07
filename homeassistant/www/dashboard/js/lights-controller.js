/**
 * Lights Controller - Light toggles and all-lights modal
 */

import { state } from './state.js';
import { callService } from './api.js';
import { ROOMS, getAllLights } from './config.js';
import { show, hide } from './utils.js';
import { renderAllLightsGrid } from './ui.js';

// ============================================
// ENTITY TOGGLE
// ============================================

export function toggleEntity(entityId) {
    const domain = entityId.startsWith('light.') ? 'light' : 'switch';
    const currentlyOn = state.getEntityState(entityId) === 'on';
    const service = currentlyOn ? 'turn_off' : 'turn_on';

    callService(domain, service, { entity_id: entityId });

    // Optimistic UI update
    const currentEntity = state.getEntity(entityId);
    if (currentEntity) {
        state.setEntity(entityId, {
            ...currentEntity,
            state: currentlyOn ? 'off' : 'on'
        });
    }
}

// ============================================
// ROOM LIGHT CONTROLS
// ============================================

export function toggleAllRoomLights(roomId, turnOn) {
    const allRooms = [...ROOMS.ground, ...ROOMS.upper];
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;

    room.lights.forEach(id => {
        const currentState = state.getEntityState(id);
        const domain = id.startsWith('light.') ? 'light' : 'switch';

        if (turnOn && currentState !== 'on') {
            callService(domain, 'turn_on', { entity_id: id });
        } else if (!turnOn && currentState === 'on') {
            callService(domain, 'turn_off', { entity_id: id });
        }

        // Optimistic UI update
        const currentEntity = state.getEntity(id);
        if (currentEntity) {
            state.setEntity(id, {
                ...currentEntity,
                state: turnOn ? 'on' : 'off'
            });
        }
    });
}

export function allLightsOff() {
    const allLights = getAllLights();
    allLights.forEach(id => {
        if (state.getEntityState(id) === 'on') {
            const domain = id.startsWith('light.') ? 'light' : 'switch';
            callService(domain, 'turn_off', { entity_id: id });
        }
    });
}

// ============================================
// ALL LIGHTS MODAL
// ============================================

export function openAllLightsModal() {
    state.setAllLightsModalOpen(true);
    renderAllLightsGrid();
    show('allLightsModal');
}

export function closeAllLightsModal() {
    state.setAllLightsModalOpen(false);
    hide('allLightsModal');
}
