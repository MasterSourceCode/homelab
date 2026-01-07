/**
 * Utility Functions
 * Helper functions used throughout the dashboard
 */

// ============================================
// TIME FORMATTING
// ============================================

/**
 * Format time for display (HH:MM format)
 */
export function formatTime(date = new Date()) {
    return date.toLocaleTimeString('en-ZA', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format date for display
 */
export function formatDate(date = new Date()) {
    return date.toLocaleDateString('en-ZA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
}

/**
 * Format time with seconds for camera updates
 */
export function formatTimeWithSeconds(date = new Date()) {
    return date.toLocaleTimeString('en-ZA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Format relative time (e.g., "5m ago", "2h ago")
 */
export function formatLastTriggered(isoTimestamp, isCurrentlyTriggered = false) {
    if (!isoTimestamp) return 'Never';

    const lastTime = new Date(isoTimestamp);
    const now = new Date();
    const diffMs = now - lastTime;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (isCurrentlyTriggered) {
        if (diffSecs < 5) return 'Just now';
        if (diffSecs < 60) return `${diffSecs}s ago`;
        if (diffMins < 60) return `${diffMins}m ago`;
        return `${diffHours}h ago`;
    }

    // For cleared zones, show when it was last triggered
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    // Format as date for older
    return lastTime.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

// ============================================
// STRING FORMATTING
// ============================================

/**
 * Capitalize first letter of a string
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format status text (capitalize and replace underscores)
 */
export function formatStatus(status) {
    if (!status) return 'Unknown';
    return capitalize(status.replace(/_/g, ' '));
}

// ============================================
// DOM HELPERS
// ============================================

/**
 * Get element by ID with optional error logging
 */
export function $(id) {
    return document.getElementById(id);
}

/**
 * Toggle class on element
 */
export function toggleClass(element, className, condition) {
    if (!element) return;
    element.classList.toggle(className, condition);
}

/**
 * Add class to element
 */
export function addClass(element, className) {
    if (!element) return;
    element.classList.add(className);
}

/**
 * Remove class from element
 */
export function removeClass(element, className) {
    if (!element) return;
    element.classList.remove(className);
}

/**
 * Set element text content
 */
export function setText(elementOrId, text) {
    const el = typeof elementOrId === 'string' ? $(elementOrId) : elementOrId;
    if (el) el.textContent = text;
}

/**
 * Set element inner HTML
 */
export function setHTML(elementOrId, html) {
    const el = typeof elementOrId === 'string' ? $(elementOrId) : elementOrId;
    if (el) el.innerHTML = html;
}

/**
 * Show element (remove hidden class)
 */
export function show(elementOrId) {
    const el = typeof elementOrId === 'string' ? $(elementOrId) : elementOrId;
    if (el) el.classList.remove('hidden');
}

/**
 * Hide element (add hidden class)
 */
export function hide(elementOrId) {
    const el = typeof elementOrId === 'string' ? $(elementOrId) : elementOrId;
    if (el) el.classList.add('hidden');
}

// ============================================
// HAPTIC FEEDBACK
// ============================================

/**
 * Trigger haptic feedback if available
 */
export function vibrate(duration = 50) {
    if (navigator.vibrate) {
        navigator.vibrate(duration);
    }
}

// ============================================
// CALCULATIONS
// ============================================

/**
 * Calculate percentage (with max limit)
 */
export function calculatePercentage(value, max) {
    return Math.min(value / max, 1);
}

/**
 * Calculate ring offset for circular progress
 */
export function calculateRingOffset(percentage, circumference = 125.6) {
    return circumference * (1 - percentage);
}

// ============================================
// SECURITY COLOR SCHEMES
// ============================================

/**
 * Get color scheme based on alarm status
 */
export function getAlarmColorScheme(status) {
    const schemes = {
        disarmed: { bg: 'emerald', text: 'emerald', label: 'Disarmed', badge: 'Ready' },
        armed_away: { bg: 'red', text: 'red', label: 'Armed Away', badge: 'Armed' },
        armed_home: { bg: 'amber', text: 'amber', label: 'Armed Stay', badge: 'Stay' },
        armed_custom_bypass: { bg: 'blue', text: 'blue', label: 'Outside Only', badge: 'Outside' },
        arming: { bg: 'amber', text: 'amber', label: 'Arming...', badge: 'Wait' },
        pending: { bg: 'amber', text: 'amber', label: 'Pending', badge: 'Exit' },
        triggered: { bg: 'red', text: 'red', label: 'TRIGGERED!', badge: 'ALARM' }
    };

    return schemes[status] || schemes.disarmed;
}

/**
 * Get zone color scheme based on state and timing
 *
 * Color logic:
 * - RED: Currently triggered (motion) OR activity in last 2 mins OR sensor blocked (stuck on 5+ mins)
 * - AMBER: Activity 2-5 mins ago (recently active)
 * - ORANGE: Activity 5-15 mins ago
 * - GREY: No activity in 15+ mins (clear)
 */
export function getZoneColorScheme(triggered, lastChanged) {
    const lastTime = lastChanged ? new Date(lastChanged) : null;
    const now = new Date();
    const diffMs = lastTime ? now - lastTime : Infinity;
    const diffMins = diffMs / (60 * 1000);

    // Time thresholds (in minutes)
    const TWO_MINS = 2;
    const FIVE_MINS = 5;
    const FIFTEEN_MINS = 15;

    if (triggered) {
        // Sensor is currently ON
        if (diffMins <= TWO_MINS) {
            // Recent motion (within 2 mins) - RED with pulse
            return {
                bg: 'red',
                text: 'red',
                dot: 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50',
                border: 'border-red-500/50 bg-red-500/10',
                status: 'Motion Detected'
            };
        } else {
            // Blocked sensor (triggered for more than 2 mins) - RED solid
            return {
                bg: 'red',
                text: 'red',
                dot: 'bg-red-500 shadow-lg shadow-red-500/30',
                border: 'border-red-500/50 bg-red-500/10',
                status: 'Sensor Blocked'
            };
        }
    }

    // Sensor is OFF - check time since last activity
    if (!lastTime) {
        // Never triggered or no data
        return {
            bg: 'slate',
            text: 'slate',
            dot: 'bg-slate-500/50',
            border: 'border-white/5',
            status: 'Clear'
        };
    }

    if (diffMins <= TWO_MINS) {
        // Cleared within last 2 mins - RED (recent motion just ended)
        return {
            bg: 'red',
            text: 'red',
            dot: 'bg-red-500 shadow-md shadow-red-500/30',
            border: 'border-red-500/40 bg-red-500/5',
            status: 'Just Cleared'
        };
    }

    if (diffMins <= FIVE_MINS) {
        // Activity 2-5 mins ago - AMBER (recently active)
        return {
            bg: 'amber',
            text: 'amber',
            dot: 'bg-amber-500 shadow-md shadow-amber-500/30',
            border: 'border-amber-500/30 bg-amber-500/5',
            status: 'Recently Active'
        };
    }

    if (diffMins <= FIFTEEN_MINS) {
        // Activity 5-15 mins ago - ORANGE
        return {
            bg: 'orange',
            text: 'orange',
            dot: 'bg-orange-500/70',
            border: 'border-orange-500/20 bg-orange-500/5',
            status: 'Active Earlier'
        };
    }

    // No activity in 15+ mins - GREY (clear)
    return {
        bg: 'slate',
        text: 'slate',
        dot: 'bg-slate-500/50',
        border: 'border-white/5',
        status: 'Clear'
    };
}
