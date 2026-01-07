/**
 * Room Controller - Room modal and floor selection
 */

import { state } from './state.js';
import { ROOMS } from './config.js';
import { show, hide } from './utils.js';
import { updateFloorSelector, updateRoomGrid, renderRoomModal } from './ui.js';

// ============================================
// FLOOR SELECTION
// ============================================

export function selectFloor(floor) {
    state.setCurrentFloor(floor);
    updateFloorSelector();
    updateRoomGrid();
}

// ============================================
// ROOM MODAL
// ============================================

export function openRoomModal(roomId) {
    state.setOpenRoomId(roomId);
    renderRoomModal(roomId);
    show('roomModal');
}

export function closeRoomModal() {
    state.setOpenRoomId(null);
    hide('roomModal');
}

// ============================================
// HELPERS
// ============================================

export function getRoomById(roomId) {
    const allRooms = [...ROOMS.ground, ...ROOMS.upper];
    return allRooms.find(r => r.id === roomId);
}
