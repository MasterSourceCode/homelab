/**
 * Calendar Color Settings Module
 * Handles customization of family member colors for the calendar
 */

import { FAMILY_MEMBERS } from './google-oauth-config.js';
import { loadModal } from './template-loader.js';

const STORAGE_KEY = 'calendar_custom_colors';

// Default colors (from FAMILY_MEMBERS)
const DEFAULT_COLORS = {};
Object.keys(FAMILY_MEMBERS).forEach(key => {
    DEFAULT_COLORS[key] = FAMILY_MEMBERS[key].color;
});

// Current working colors (used during editing, before save)
let workingColors = {};

/**
 * Load custom colors from localStorage, falling back to defaults
 */
export function loadCustomColors() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge with defaults in case new members were added
            return { ...DEFAULT_COLORS, ...parsed };
        }
    } catch (e) {
        console.warn('Failed to load custom colors:', e);
    }
    return { ...DEFAULT_COLORS };
}

/**
 * Save custom colors to localStorage
 */
export function saveCustomColors(colors) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
        return true;
    } catch (e) {
        console.error('Failed to save custom colors:', e);
        return false;
    }
}

/**
 * Reset colors to defaults
 */
export function resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY);
    return { ...DEFAULT_COLORS };
}

/**
 * Get the current effective colors (saved or defaults)
 */
export function getEffectiveColors() {
    return loadCustomColors();
}

/**
 * Get color for a specific family member
 */
export function getMemberColor(memberKey) {
    const colors = loadCustomColors();
    return colors[memberKey] || DEFAULT_COLORS[memberKey] || '#9ca3af';
}

/**
 * Open the color settings modal
 */
export async function openColorSettingsModal() {
    // Ensure modal is loaded
    await loadModal('calendarColorSettings');

    const modal = document.getElementById('calendarColorSettingsModal');
    if (!modal) {
        console.error('Color settings modal not found');
        return;
    }

    // Initialize working colors from saved colors
    workingColors = loadCustomColors();

    // Render the modal content
    renderColorPickers();
    renderPreview();

    // Show modal
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
}

/**
 * Close the color settings modal
 */
export function closeColorSettingsModal() {
    const modal = document.getElementById('calendarColorSettingsModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }
}

/**
 * Render color picker rows for each family member
 */
function renderColorPickers() {
    const container = document.getElementById('colorPickersContainer');
    if (!container) return;

    const html = Object.keys(FAMILY_MEMBERS).map(key => {
        const member = FAMILY_MEMBERS[key];
        const currentColor = workingColors[key] || member.color;

        return `
            <div class="flex items-center justify-between glass-light rounded-xl p-3 hover:bg-white/5 transition">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg border-2 border-white/20 color-preview-swatch"
                         data-member="${key}"
                         style="background-color: ${currentColor};">
                    </div>
                    <div>
                        <div class="font-medium text-sm">${member.name}</div>
                        <div class="text-xs text-white/40">Google Calendar: ${getGoogleColorName(member.colorId)}</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <input type="color"
                           id="colorPicker_${key}"
                           value="${currentColor}"
                           class="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                           style="padding: 0;"
                           data-member="${key}">
                    <input type="text"
                           id="colorHex_${key}"
                           value="${currentColor}"
                           class="w-24 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-sm font-mono text-center"
                           placeholder="#000000"
                           maxlength="7"
                           data-member="${key}">
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;

    // Add event listeners
    container.querySelectorAll('input[type="color"]').forEach(input => {
        input.addEventListener('input', handleColorChange);
    });

    container.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('input', handleHexChange);
        input.addEventListener('blur', handleHexBlur);
    });
}

/**
 * Render the preview section
 */
function renderPreview() {
    const container = document.getElementById('colorPreviewContainer');
    if (!container) return;

    const html = Object.keys(FAMILY_MEMBERS).map(key => {
        const member = FAMILY_MEMBERS[key];
        const currentColor = workingColors[key] || member.color;

        return `
            <div class="preview-chip flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition"
                 data-member="${key}"
                 style="background-color: ${hexToRgba(currentColor, 0.3)}; border: 1px solid ${hexToRgba(currentColor, 0.5)}; color: ${currentColor};">
                <span class="w-3 h-3 rounded-full" style="background-color: ${currentColor};"></span>
                ${member.name}
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * Handle color picker change
 */
function handleColorChange(e) {
    const member = e.target.dataset.member;
    const color = e.target.value;

    workingColors[member] = color;

    // Update hex input
    const hexInput = document.getElementById(`colorHex_${member}`);
    if (hexInput) hexInput.value = color;

    // Update swatch
    const swatch = document.querySelector(`.color-preview-swatch[data-member="${member}"]`);
    if (swatch) swatch.style.backgroundColor = color;

    // Update preview
    updatePreviewChip(member, color);

    // Apply live preview to calendar
    applyLivePreview();
}

/**
 * Handle hex input change
 */
function handleHexChange(e) {
    const member = e.target.dataset.member;
    let color = e.target.value.trim();

    // Add # if missing
    if (color && !color.startsWith('#')) {
        color = '#' + color;
        e.target.value = color;
    }

    // Validate hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        workingColors[member] = color;

        // Update color picker
        const colorPicker = document.getElementById(`colorPicker_${member}`);
        if (colorPicker) colorPicker.value = color;

        // Update swatch
        const swatch = document.querySelector(`.color-preview-swatch[data-member="${member}"]`);
        if (swatch) swatch.style.backgroundColor = color;

        // Update preview
        updatePreviewChip(member, color);

        // Apply live preview
        applyLivePreview();
    }
}

/**
 * Handle hex input blur (validate and fix)
 */
function handleHexBlur(e) {
    const member = e.target.dataset.member;
    let color = e.target.value.trim();

    // Validate and fix
    if (!color.startsWith('#')) color = '#' + color;
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        // Invalid - reset to current
        e.target.value = workingColors[member] || DEFAULT_COLORS[member];
    }
}

/**
 * Update a single preview chip
 */
function updatePreviewChip(member, color) {
    const chip = document.querySelector(`.preview-chip[data-member="${member}"]`);
    if (chip) {
        chip.style.backgroundColor = hexToRgba(color, 0.3);
        chip.style.borderColor = hexToRgba(color, 0.5);
        chip.style.color = color;

        const dot = chip.querySelector('span');
        if (dot) dot.style.backgroundColor = color;
    }
}

/**
 * Apply live preview to the calendar
 */
function applyLivePreview() {
    // Update CSS custom properties for immediate visual feedback
    const root = document.documentElement;

    Object.keys(workingColors).forEach(member => {
        root.style.setProperty(`--calendar-color-${member}`, workingColors[member]);
    });

    // Update filter chips in the sidebar
    updateFilterChips(workingColors);

    // If calendar is visible, refresh event colors
    if (window.calendarInstance) {
        try {
            // Force re-render of events with new colors
            const events = window.calendarInstance.getEvents();
            events.forEach(event => {
                const owner = detectOwnerFromEvent(event);
                if (owner && workingColors[owner]) {
                    event.setProp('backgroundColor', hexToRgba(workingColors[owner], 0.3));
                    event.setProp('borderColor', workingColors[owner]);
                    event.setProp('textColor', workingColors[owner]);
                }
            });
        } catch (e) {
            console.warn('Could not update calendar events:', e);
        }
    }
}

/**
 * Update filter chip colors in the sidebar
 */
function updateFilterChips(colors) {
    Object.keys(colors).forEach(member => {
        const chip = document.querySelector(`#filter${capitalize(member)} .chip-dot`);
        if (chip) {
            chip.style.backgroundColor = colors[member];
        }
    });
}

/**
 * Detect owner from event properties
 */
function detectOwnerFromEvent(event) {
    const title = (event.title || '').toLowerCase();
    const colorId = event.extendedProps?.colorId;

    // Check for holidays first (by title pattern)
    if (title.startsWith('saheti:') ||
        title.includes('half-term') ||
        title.includes('school holiday') ||
        title.includes('public holiday') ||
        title.includes('staff development') ||
        title.includes('human rights day') ||
        title.includes('youth day') ||
        title.includes('heritage day') ||
        title.includes('greek independence') ||
        title.includes('oxi day') ||
        title.includes("founders' day") ||
        title.includes('welcome day')) {
        return 'holiday';
    }

    // Check by colorId
    const colorIdMap = {
        '8': 'nico',
        '6': 'tatiana',
        '9': 'alexandra',
        '2': 'mila',
        '4': 'bothGirls',
        '10': 'parents',
        '11': 'everyone'
    };

    if (colorId && colorIdMap[colorId]) {
        return colorIdMap[colorId];
    }

    // Check by title
    if (title.includes('alexandra')) return 'alexandra';
    if (title.includes('mila')) return 'mila';
    if (title.includes('tatiana')) return 'tatiana';
    if (title.includes('nico')) return 'nico';

    return null;
}

/**
 * Save colors and close modal
 */
export function saveColorsAndClose() {
    if (saveCustomColors(workingColors)) {
        // Update the global color configuration
        updateGlobalColors(workingColors);

        // Refresh calendar with new colors
        if (window.calendarInstance) {
            window.calendarInstance.refetchEvents();
        }

        closeColorSettingsModal();

        // Show success feedback
        showToast('Colors saved successfully!', 'success');
    } else {
        showToast('Failed to save colors', 'error');
    }
}

/**
 * Reset colors to defaults
 */
export function resetColors() {
    workingColors = { ...DEFAULT_COLORS };

    // Re-render everything
    renderColorPickers();
    renderPreview();
    applyLivePreview();

    showToast('Colors reset to defaults', 'info');
}

/**
 * Update global FAMILY_MEMBERS colors (in-memory only)
 */
function updateGlobalColors(colors) {
    Object.keys(colors).forEach(key => {
        if (FAMILY_MEMBERS[key]) {
            FAMILY_MEMBERS[key].color = colors[key];
        }
    });
}

/**
 * Get Google Calendar color name from colorId
 */
function getGoogleColorName(colorId) {
    const names = {
        '1': 'Lavender',
        '2': 'Sage',
        '3': 'Grape',
        '4': 'Flamingo',
        '5': 'Banana',
        '6': 'Tangerine',
        '7': 'Peacock',
        '8': 'Graphite',
        '9': 'Blueberry',
        '10': 'Basil',
        '11': 'Tomato'
    };
    return names[colorId] || 'Default';
}

/**
 * Convert hex to rgba
 */
function hexToRgba(hex, alpha = 1) {
    if (!hex) return `rgba(156, 163, 175, ${alpha})`;

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
    }
    return `rgba(156, 163, 175, ${alpha})`;
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Try to use existing toast system
    if (window.showNotification) {
        window.showNotification(message, type);
        return;
    }

    // Fallback simple toast
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-xl text-sm font-medium z-[100] transition-all transform translate-y-0 opacity-100`;

    const colors = {
        success: 'bg-emerald-500/90 text-white',
        error: 'bg-red-500/90 text-white',
        info: 'bg-blue-500/90 text-white'
    };

    toast.classList.add(...(colors[type] || colors.info).split(' '));
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

/**
 * Initialize color settings on page load
 */
export function initializeColorSettings() {
    // Load and apply saved colors on startup
    const savedColors = loadCustomColors();
    updateGlobalColors(savedColors);
    updateFilterChips(savedColors);

    console.log('[ColorSettings] Initialized with colors:', savedColors);
}

// Export for global access
window.calendarColorSettings = {
    open: openColorSettingsModal,
    close: closeColorSettingsModal,
    save: saveColorsAndClose,
    reset: resetColors,
    getColors: getEffectiveColors,
    getMemberColor
};
