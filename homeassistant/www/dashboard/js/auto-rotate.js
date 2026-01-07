/**
 * Auto-Rotate Module
 * Automatically cycles through dashboard views with configurable timing
 */

import { showView, selectFloor } from './views.js';
import { $ } from './utils.js';

// ============================================
// ROTATION CONFIGURATION
// ============================================

// Rotation sequence with timings in milliseconds
const ROTATION_SEQUENCE = [
    { name: 'Media Center', view: 'media', floor: null, duration: 10 * 60 * 1000 },        // 10 mins
    { name: 'Weather Command', view: 'weather', floor: null, duration: 12 * 60 * 1000 },   // 12 mins
    { name: 'Camera Dashboard', view: 'cameras', floor: null, duration: 20 * 60 * 1000 },  // 20 mins
    { name: 'Power Dashboard', view: 'energy-display', floor: null, duration: 25 * 60 * 1000 },    // 25 mins
    { name: 'Calendar', view: 'calendar', floor: null, duration: 25 * 60 * 1000 },         // 25 mins
    { name: 'System Performance', view: 'system', floor: null, duration: 10 * 60 * 1000 }, // 10 mins
];

// ============================================
// STATE
// ============================================

let isRotating = false;
let currentIndex = 0;
let rotationTimer = null;
let countdownTimer = null;
let remainingTime = 0;

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Start the auto-rotation
 */
export function startRotation() {
    if (isRotating) return;

    isRotating = true;
    currentIndex = 0;

    console.log('Auto-rotate started');
    updateToggleUI(true);
    showCurrentStep();
}

/**
 * Stop the auto-rotation
 */
export function stopRotation() {
    if (!isRotating) return;

    isRotating = false;

    if (rotationTimer) {
        clearTimeout(rotationTimer);
        rotationTimer = null;
    }

    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }

    console.log('Auto-rotate stopped');
    updateToggleUI(false);
    hideCountdown();
}

/**
 * Toggle rotation on/off
 */
export function toggleRotation() {
    if (isRotating) {
        stopRotation();
    } else {
        startRotation();
    }
}

/**
 * Check if rotation is active
 */
export function isRotationActive() {
    return isRotating;
}

// ============================================
// INTERNAL FUNCTIONS
// ============================================

/**
 * Show the current step in the rotation
 */
function showCurrentStep() {
    if (!isRotating) return;

    const step = ROTATION_SEQUENCE[currentIndex];

    console.log(`Auto-rotate: ${step.name} (${step.duration / 60000} mins)`);

    // Navigate to the view
    showView(step.view);

    // If it has a floor selection, apply it
    if (step.floor) {
        setTimeout(() => selectFloor(step.floor), 100);
    }

    // Update countdown display
    remainingTime = step.duration;
    updateCountdown(step.name);
    startCountdownTimer();

    // Schedule next step
    rotationTimer = setTimeout(() => {
        currentIndex = (currentIndex + 1) % ROTATION_SEQUENCE.length;
        showCurrentStep();
    }, step.duration);
}

/**
 * Start countdown timer for UI updates
 */
function startCountdownTimer() {
    if (countdownTimer) {
        clearInterval(countdownTimer);
    }

    countdownTimer = setInterval(() => {
        remainingTime -= 1000;
        if (remainingTime <= 0) {
            remainingTime = 0;
        }
        updateCountdownTime();
    }, 1000);
}

/**
 * Update the countdown display
 */
function updateCountdown(stepName) {
    const container = $('autoRotateCountdown');
    if (!container) return;

    container.classList.remove('hidden');

    const nameEl = container.querySelector('#rotateStepName');
    if (nameEl) nameEl.textContent = stepName;

    updateCountdownTime();
}

/**
 * Update just the time portion of countdown
 */
function updateCountdownTime() {
    const timeEl = $('rotateTimeRemaining');
    if (!timeEl) return;

    const mins = Math.floor(remainingTime / 60000);
    const secs = Math.floor((remainingTime % 60000) / 1000);
    timeEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Hide the countdown display
 */
function hideCountdown() {
    const container = $('autoRotateCountdown');
    if (container) {
        container.classList.add('hidden');
    }
}

/**
 * Update toggle button UI
 */
function updateToggleUI(active) {
    const toggle = $('autoRotateToggle');
    const knob = toggle?.querySelector('div');
    const btn = $('btnAutoRotate');
    const icon = $('autoRotateIcon');

    if (toggle && knob) {
        toggle.classList.toggle('bg-cyan-500', active);
        toggle.classList.toggle('bg-white/10', !active);
        knob.style.transform = active ? 'translateX(16px)' : 'translateX(0)';
    }

    if (btn) {
        btn.classList.toggle('border-cyan-500/50', active);
        btn.classList.toggle('bg-cyan-500/20', active);
        btn.classList.toggle('border-white/10', !active);
        btn.classList.toggle('bg-white/5', !active);
    }

    if (icon) {
        icon.classList.toggle('animate-spin', active);
    }
}

// ============================================
// EXPORTS
// ============================================

export default {
    startRotation,
    stopRotation,
    toggleRotation,
    isRotationActive
};
