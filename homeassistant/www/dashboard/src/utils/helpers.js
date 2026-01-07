/**
 * Utility Helpers
 * Common utility functions used across components
 */

/**
 * Format a number with specified decimal places
 */
export function formatNumber(value, decimals = 0) {
    if (value === null || value === undefined || isNaN(value)) return '--';
    return Number(value).toFixed(decimals);
}

/**
 * Format power value with appropriate unit (W or kW)
 */
export function formatPower(watts, decimals = 0) {
    if (watts === null || watts === undefined || isNaN(watts)) return '--';
    const w = Number(watts);
    if (Math.abs(w) >= 1000) {
        return `${(w / 1000).toFixed(1)}kW`;
    }
    return `${w.toFixed(decimals)}W`;
}

/**
 * Format energy value (kWh)
 */
export function formatEnergy(kwh, decimals = 1) {
    if (kwh === null || kwh === undefined || isNaN(kwh)) return '--';
    return `${Number(kwh).toFixed(decimals)}kWh`;
}

/**
 * Format temperature with unit
 */
export function formatTemperature(value, unit = '°C') {
    if (value === null || value === undefined || isNaN(value)) return '--';
    return `${Math.round(Number(value))}${unit}`;
}

/**
 * Format percentage
 */
export function formatPercent(value, decimals = 0) {
    if (value === null || value === undefined || isNaN(value)) return '--';
    return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Format duration in human readable form
 */
export function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '--';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

/**
 * Format time as HH:MM
 */
export function formatTime(date) {
    if (!date) return '--';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Format date as readable string
 */
export function formatDate(date, options = {}) {
    if (!date) return '--';
    const d = date instanceof Date ? date : new Date(date);
    const defaultOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    return d.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function timeAgo(date) {
    if (!date) return '--';
    const d = date instanceof Date ? date : new Date(date);
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
        { label: 'second', seconds: 1 }
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
        }
    }
    return 'just now';
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert snake_case to Title Case
 */
export function snakeToTitle(str) {
    if (!str) return '';
    return str.split('_').map(capitalize).join(' ');
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str, maxLength = 50) {
    if (!str || str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
}

/**
 * Debounce function
 */
export function debounce(fn, delay = 300) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Throttle function
 */
export function throttle(fn, limit = 300) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Object) {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, deepClone(value)])
        );
    }
    return obj;
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
}

/**
 * Generate a unique ID
 */
export function uniqueId(prefix = 'id') {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Clamp a number between min and max
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(start, end, t) {
    return start + (end - start) * clamp(t, 0, 1);
}

/**
 * Map a value from one range to another
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Get CSS variable value
 */
export function getCSSVar(name, element = document.documentElement) {
    return getComputedStyle(element).getPropertyValue(name).trim();
}

/**
 * Set CSS variable value
 */
export function setCSSVar(name, value, element = document.documentElement) {
    element.style.setProperty(name, value);
}

/**
 * Check if device is mobile
 */
export function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Check if device supports touch
 */
export function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Check if we're on local network
 */
export function isLocalNetwork() {
    const hostname = window.location.hostname;
    return hostname === 'localhost' ||
           hostname === '127.0.0.1' ||
           hostname.startsWith('192.168.') ||
           hostname.startsWith('10.') ||
           hostname.endsWith('.local');
}

/**
 * Sleep/delay promise
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await sleep(delay * Math.pow(2, i));
        }
    }
}

/**
 * Parse entity ID into domain and name
 */
export function parseEntityId(entityId) {
    if (!entityId) return { domain: '', name: '' };
    const [domain, ...nameParts] = entityId.split('.');
    return { domain, name: nameParts.join('.') };
}

/**
 * Get entity friendly name or fallback
 */
export function getEntityName(entity) {
    if (!entity) return 'Unknown';
    return entity.attributes?.friendly_name || snakeToTitle(parseEntityId(entity.entity_id).name);
}

/**
 * Check if entity is on/active
 */
export function isEntityOn(entity) {
    if (!entity) return false;
    const state = entity.state?.toLowerCase();
    return ['on', 'home', 'open', 'playing', 'active', 'armed_away', 'armed_home'].includes(state);
}

/**
 * Get entity state color
 */
export function getStateColor(state, type = 'default') {
    const stateColors = {
        on: 'var(--color-amber)',
        off: 'var(--color-text-muted)',
        home: 'var(--color-emerald)',
        away: 'var(--color-text-muted)',
        disarmed: 'var(--color-emerald)',
        armed_away: 'var(--color-red)',
        armed_home: 'var(--color-amber)',
        pending: 'var(--color-amber)',
        triggered: 'var(--color-red)',
        unavailable: 'var(--color-text-muted)'
    };
    return stateColors[state?.toLowerCase()] || 'var(--color-text-secondary)';
}
