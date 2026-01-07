/**
 * Alexa Announcements Module
 * Handles sending announcements to Alexa devices throughout the house
 * Uses alexa_devices integration with notify.send_message action
 *
 * Reference: https://www.home-assistant.io/integrations/alexa_devices/
 */

import { callService } from './api.js';
import { $ } from './utils.js';

// ============================================
// CONFIGURATION
// ============================================

// Alexa announce entity IDs (from alexa_devices integration)
// These are used as targets for notify.send_message
const ANNOUNCE_TARGETS = {
    // Whole house / group services
    all: 'notify.party_time_announce',        // Whole house group
    downstairs: 'notify.downstairs_announce', // Downstairs group
    upstairs: 'notify.upstairs_announce',     // Upstairs group
    kids: 'notify.kids_rooms_announce',       // Kids rooms group

    // Individual devices
    livingroom: 'notify.livingroom_echo_announce',
    kitchen: 'notify.kitchenecho_announce',
    sunroom: 'notify.sun_room_echo_announce',
    understairs: 'notify.understairsecho_announce',
    bedroom: 'notify.bedroom_show_announce',
    cinema: 'notify.cinemashow_announce',
    nico: 'notify.nico_s_echo_dot_announce',
    alexandra: 'notify.alexandra_s_echo_announce',
    kids_echo: 'notify.kids_echo_announce'
};

// ============================================
// ANNOUNCEMENT FUNCTIONS
// ============================================

/**
 * Send an announcement to Alexa devices
 * Uses notify.send_message with target entity_id (alexa_devices integration format)
 *
 * @param {string} message - The message to announce
 * @param {string} target - Target key from ANNOUNCE_TARGETS (default: 'all')
 */
export function sendAnnouncement(message, target = 'all') {
    console.log('=== ALEXA ANNOUNCEMENT DEBUG ===');
    console.log('1. sendAnnouncement called');
    console.log('   Message:', message);
    console.log('   Target key:', target);

    if (!message) {
        console.warn('No message provided for announcement');
        showFeedback('No message provided', 'error');
        return false;
    }

    // Get the entity ID for the target
    const targetEntity = ANNOUNCE_TARGETS[target] || ANNOUNCE_TARGETS.all;
    console.log('2. Resolved target entity:', targetEntity);

    // Build service data (message only) and target separately
    // HA WebSocket API requires target at top level, NOT inside service_data
    const serviceData = {
        message: message
    };
    const serviceTarget = {
        entity_id: targetEntity
    };
    console.log('3. Service data:', JSON.stringify(serviceData, null, 2));
    console.log('4. Target:', JSON.stringify(serviceTarget, null, 2));

    try {
        // alexa_devices integration uses notify.send_message with target
        // See: https://www.home-assistant.io/integrations/alexa_devices/
        console.log('5. Calling: notify.send_message');
        callService('notify', 'send_message', serviceData, serviceTarget);

        console.log('6. callService returned (WebSocket message sent)');
        console.log('=== END DEBUG ===');
        showFeedback('Announcing...', 'success');
        return true;
    } catch (error) {
        console.error('ERROR in sendAnnouncement:', error);
        showFeedback('Failed to announce', 'error');
        return false;
    }
}

/**
 * Send a custom message from the input field
 */
export function sendCustomAnnouncement() {
    const input = $('alexaCustomMessage');
    if (!input) return;

    const message = input.value.trim();
    if (!message) {
        showFeedback('Please enter a message', 'error');
        return;
    }

    sendAnnouncement(message, 'all');
    input.value = ''; // Clear input after sending
}

// ============================================
// UI FEEDBACK
// ============================================

/**
 * Show feedback toast
 * @param {string} message - Feedback message
 * @param {string} type - 'success' or 'error'
 */
function showFeedback(message, type = 'success') {
    const feedback = $('alexaFeedback');
    if (!feedback) return;

    // Update content
    const textSpan = feedback.querySelector('span');
    if (textSpan) textSpan.textContent = message;

    // Update styling
    feedback.classList.remove('bg-emerald-500', 'bg-red-500');
    feedback.classList.add(type === 'success' ? 'bg-emerald-500' : 'bg-red-500');

    // Show toast
    feedback.classList.remove('translate-y-20', 'opacity-0');
    feedback.classList.add('translate-y-0', 'opacity-100');

    // Hide after delay
    setTimeout(() => {
        feedback.classList.remove('translate-y-0', 'opacity-100');
        feedback.classList.add('translate-y-20', 'opacity-0');
    }, 2500);
}

// ============================================
// INITIALIZATION
// ============================================

export function initAlexa() {
    console.log('Alexa module initialized');

    // Set up Enter key handler for custom message input
    const input = $('alexaCustomMessage');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendCustomAnnouncement();
            }
        });
    }
}

// ============================================
// EXPORTS
// ============================================

export default {
    sendAnnouncement,
    sendCustomAnnouncement,
    initAlexa
};
