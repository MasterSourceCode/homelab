/**
 * Delayed Exit Module
 * Provides a countdown timer before arming the alarm system
 * Allows user to leave the premises before alarm activates
 */

import { callService } from './api.js';
import { ALARM_PANEL, ALARM_PIN } from './config.js';
import { $ } from './utils.js';

// ============================================
// CONFIGURATION
// ============================================

const COUNTDOWN_SECONDS = 180; // 3 minutes

const EXIT_MODES = {
    arm_away: {
        label: 'ARM AWAY',
        description: 'Full perimeter + motion sensors',
        icon: `<svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>`,
        color: 'from-red-500 to-orange-500',
        glowColor: 'rgba(239, 68, 68, 0.4)'
    },
    arm_home: {
        label: 'ARM STAY',
        description: 'Perimeter only - motion bypassed',
        icon: `<svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
        </svg>`,
        color: 'from-amber-500 to-yellow-500',
        glowColor: 'rgba(245, 158, 11, 0.4)'
    },
    dog_mode: {
        label: 'DOG MODE',
        description: 'AI-powered person detection only',
        icon: `<svg class="w-10 h-10" viewBox="0 0 256 256" fill="currentColor">
            <path d="M240,108a28,28,0,1,1-28-28A28.1,28.1,0,0,1,240,108ZM72,108a28,28,0,1,0-28,28A28.1,28.1,0,0,0,72,108ZM92,88A28,28,0,1,0,64,60,28.1,28.1,0,0,0,92,88Zm72,0a28,28,0,1,0-28-28A28.1,28.1,0,0,0,164,88Zm23.1,60.8a35.3,35.3,0,0,1-16.9-21.1,43.9,43.9,0,0,0-84.4,0A35.5,35.5,0,0,1,69,148.8,40,40,0,0,0,88,224a40.5,40.5,0,0,0,15.5-3.1,64.2,64.2,0,0,1,48.9-.1A39.6,39.6,0,0,0,168,224a40,40,0,0,0,19.1-75.2Z"/>
        </svg>`,
        color: 'from-cyan-500 to-blue-500',
        glowColor: 'rgba(6, 182, 212, 0.4)'
    }
};

// ============================================
// STATE
// ============================================

let countdownInterval = null;
let remainingSeconds = 0;
let selectedMode = null;

// ============================================
// OVERLAY MANAGEMENT
// ============================================

export function showDelayedExitOverlay() {
    const overlay = $('delayedExitOverlay');
    if (!overlay) {
        console.error('Delayed exit overlay not found');
        return;
    }

    // Reset state
    resetCountdown();
    selectedMode = null;

    // Show mode selection, hide countdown
    const modeSelection = $('exitModeSelection');
    const countdownView = $('exitCountdownView');
    if (modeSelection) modeSelection.classList.remove('hidden');
    if (countdownView) countdownView.classList.add('hidden');

    // Show overlay with animation
    overlay.classList.remove('hidden');
    overlay.classList.add('delayed-exit-enter');

    // Trigger reflow for animation
    void overlay.offsetWidth;

    setTimeout(() => {
        overlay.classList.add('delayed-exit-active');
    }, 10);
}

export function hideDelayedExitOverlay() {
    const overlay = $('delayedExitOverlay');
    if (!overlay) return;

    resetCountdown();

    overlay.classList.remove('delayed-exit-active');
    overlay.classList.add('delayed-exit-exit');

    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('delayed-exit-enter', 'delayed-exit-exit');
    }, 300);
}

// ============================================
// MODE SELECTION
// ============================================

export function selectExitMode(mode) {
    if (!EXIT_MODES[mode]) {
        console.error('Invalid exit mode:', mode);
        return;
    }

    selectedMode = mode;
    const modeConfig = EXIT_MODES[mode];

    // Update UI to show countdown
    const modeSelection = $('exitModeSelection');
    const countdownView = $('exitCountdownView');

    if (modeSelection) modeSelection.classList.add('hidden');
    if (countdownView) countdownView.classList.remove('hidden');

    // Set target state display
    const targetLabel = $('exitTargetLabel');
    const targetDesc = $('exitTargetDesc');
    const targetIcon = $('exitTargetIcon');
    const countdownRing = $('countdownRing');

    if (targetLabel) targetLabel.textContent = modeConfig.label;
    if (targetDesc) targetDesc.textContent = modeConfig.description;
    if (targetIcon) targetIcon.innerHTML = modeConfig.icon;

    // Set glow color
    if (countdownRing) {
        countdownRing.style.setProperty('--glow-color', modeConfig.glowColor);
    }

    // Start countdown
    startCountdown();
}

// ============================================
// COUNTDOWN TIMER
// ============================================

function startCountdown() {
    remainingSeconds = COUNTDOWN_SECONDS;
    updateCountdownDisplay();

    countdownInterval = setInterval(() => {
        remainingSeconds--;
        updateCountdownDisplay();

        if (remainingSeconds <= 0) {
            executeSelectedMode();
        }
    }, 1000);
}

function updateCountdownDisplay() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    // Update time display
    const timeDisplay = $('exitCountdownTime');
    if (timeDisplay) {
        timeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // Update progress ring
    const progressRing = $('countdownProgress');
    if (progressRing) {
        const circumference = 2 * Math.PI * 140; // radius = 140
        const progress = remainingSeconds / COUNTDOWN_SECONDS;
        const offset = circumference * (1 - progress);
        progressRing.style.strokeDashoffset = offset;
    }

    // Pulse effect when under 30 seconds
    const container = $('countdownContainer');
    if (container) {
        container.classList.toggle('countdown-urgent', remainingSeconds <= 30);
    }

    // Final countdown audio cue (last 10 seconds)
    if (remainingSeconds <= 10 && remainingSeconds > 0) {
        const ring = $('countdownRing');
        if (ring) {
            ring.classList.add('countdown-pulse');
            setTimeout(() => ring.classList.remove('countdown-pulse'), 200);
        }
    }
}

function resetCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    remainingSeconds = 0;
    selectedMode = null;
}

// ============================================
// MODE EXECUTION
// ============================================

export function executeSelectedMode() {
    resetCountdown();

    if (!selectedMode) return;

    const modeConfig = EXIT_MODES[selectedMode];

    // Show activation feedback
    const timeDisplay = $('exitCountdownTime');
    if (timeDisplay) {
        timeDisplay.textContent = 'ACTIVATING';
        timeDisplay.classList.add('text-glow-pulse');
    }

    // Execute the action
    if (selectedMode === 'dog_mode') {
        // Turn on dog mode
        callService('input_boolean', 'turn_on', {
            entity_id: 'input_boolean.dog_mode'
        });
    } else {
        // Arm the alarm
        const serviceMap = {
            'arm_home': 'alarm_arm_home',
            'arm_away': 'alarm_arm_away'
        };
        callService('alarm_control_panel', serviceMap[selectedMode], {
            entity_id: ALARM_PANEL,
            code: ALARM_PIN
        });
    }

    // Close overlay after brief delay
    setTimeout(() => {
        hideDelayedExitOverlay();
    }, 1500);
}

// ============================================
// CANCEL
// ============================================

export function cancelDelayedExit() {
    resetCountdown();

    // Return to mode selection or close overlay
    const modeSelection = $('exitModeSelection');
    const countdownView = $('exitCountdownView');

    if (countdownView && !countdownView.classList.contains('hidden')) {
        // Was in countdown - go back to selection
        countdownView.classList.add('hidden');
        if (modeSelection) modeSelection.classList.remove('hidden');
    } else {
        // Was in selection - close overlay
        hideDelayedExitOverlay();
    }
}

// ============================================
// EXPORTS
// ============================================

export default {
    showDelayedExitOverlay,
    hideDelayedExitOverlay,
    selectExitMode,
    cancelDelayedExit,
    executeSelectedMode
};
