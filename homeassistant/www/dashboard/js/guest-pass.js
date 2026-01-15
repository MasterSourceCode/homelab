/**
 * Guest Pass Management Module
 * Handles creation, listing, editing, and revocation of guest access passes
 * Uses server-side JSON file for persistence (accessible from any device)
 * Falls back to localStorage for offline/caching
 */

import { state } from './state.js';
import { $ } from './utils.js';
import { callService } from './api.js';

// ============================================
// CONFIGURATION
// ============================================

const STORAGE_KEY = 'residence_guest_passes';
const ACTIVITY_STORAGE_KEY = 'residence_pass_activity';
const SECRET_KEY_ENTITY = 'input_text.guest_pass_secret';
const DEFAULT_SECRET = 'your-secret-key-here';

// Server-side storage path (relative to HA www folder)
const PASSES_FILE_URL = '/local/dashboard/data/passes.json';

// Cache for server data
let serverPassesCache = null;
let serverActivityCache = null;
let lastServerSync = 0;
const SYNC_INTERVAL = 30000; // 30 seconds

// External URL for guest access (loaded from env.local.js)
const ENV = window.DASHBOARD_ENV || {};
const EXTERNAL_BASE_URL = ENV.EXTERNAL_HA_URL || 'https://your-instance.ui.nabu.casa';
const PASS_URL_PATH = '/local/dashboard/guest-access.html';

// Duration presets in milliseconds
const PRESETS = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    lifetime: 100 * 365 * 24 * 60 * 60 * 1000
};

// Duration labels for display
const DURATION_LABELS = {
    day: '24 Hours',
    week: '1 Week',
    month: '1 Month',
    lifetime: 'Lifetime'
};

// ============================================
// STATE
// ============================================

let currentGeneratedPass = null;
let editingPassId = null;

// ============================================
// CRYPTO UTILITIES
// ============================================

function simpleHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return hash >>> 0;
}

function generateSignature(message, key) {
    const combined1 = key + message + key;
    const combined2 = message + key + message;
    const hash1 = simpleHash(combined1);
    const hash2 = simpleHash(combined2);
    const hash3 = simpleHash(key + hash1.toString() + hash2.toString());
    return (hash1.toString(16) + hash2.toString(16) + hash3.toString(16)).padStart(24, '0');
}

function generatePassId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'gp_';
    for (let i = 0; i < 10; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

function base64UrlEncode(str) {
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        return true;
    } finally {
        document.body.removeChild(textArea);
    }
}

// ============================================
// STORAGE (Server-side with localStorage fallback)
// ============================================

async function loadPassesFromServer() {
    try {
        const cacheBuster = `?t=${Date.now()}`;
        const response = await fetch(PASSES_FILE_URL + cacheBuster);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        serverPassesCache = data.passes || [];
        serverActivityCache = data.activity || [];
        lastServerSync = Date.now();
        // Update localStorage cache
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverPassesCache));
        localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(serverActivityCache));
        console.log('[GuestPass] Loaded from server:', serverPassesCache.length, 'passes');
        return serverPassesCache;
    } catch (e) {
        console.warn('[GuestPass] Failed to load from server, using localStorage:', e);
        return loadPassesFromLocalStorage();
    }
}

function loadPassesFromLocalStorage() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.warn('[GuestPass] Failed to load from localStorage:', e);
        return [];
    }
}

function loadPasses() {
    // Return cached data if recent, otherwise use localStorage
    // Async load will update in background
    if (serverPassesCache && (Date.now() - lastServerSync < SYNC_INTERVAL)) {
        return serverPassesCache;
    }
    // Trigger async refresh
    loadPassesFromServer().then(passes => {
        serverPassesCache = passes;
    });
    // Return localStorage immediately for UI
    return loadPassesFromLocalStorage();
}

async function savePassesToServer(passes, activity) {
    try {
        const data = {
            version: 1,
            passes: passes,
            activity: activity || loadActivityFromLocalStorage(),
            lastModified: new Date().toISOString()
        };

        // Use dedicated save server (more reliable than python_script)
        const saveUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:8124/save'
            : `http://${window.location.hostname.replace(':8123', '')}:8124/save`;

        const response = await fetch(saveUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`Save failed: ${response.status}`);
        }

        serverPassesCache = passes;
        lastServerSync = Date.now();
        console.log('[GuestPass] Saved to server:', passes.length, 'passes');
        return true;
    } catch (e) {
        console.error('[GuestPass] Failed to save to server:', e);
        // Still return true if localStorage save worked
        return false;
    }
}

function savePasses(passes) {
    // Always save to localStorage immediately (for responsiveness)
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(passes));
    } catch (e) {
        console.error('[GuestPass] Failed to save to localStorage:', e);
    }
    // Also save to server (async)
    savePassesToServer(passes);
}

function loadActivityFromLocalStorage() {
    try {
        const data = localStorage.getItem(ACTIVITY_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

// ============================================
// ACTIVITY LOG STORAGE
// ============================================

export function loadActivityLog() {
    // Return cached server data if available
    if (serverActivityCache && (Date.now() - lastServerSync < SYNC_INTERVAL)) {
        return serverActivityCache;
    }
    // Fall back to localStorage
    return loadActivityFromLocalStorage();
}

function saveActivityLog(log) {
    // Keep only last 500 entries to prevent storage issues
    const trimmedLog = log.slice(-500);

    // Save to localStorage immediately
    try {
        localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(trimmedLog));
    } catch (e) {
        console.error('[GuestPass] Failed to save activity log:', e);
    }

    // Also save to server with current passes
    serverActivityCache = trimmedLog;
    savePassesToServer(loadPasses(), trimmedLog);
}

export function logActivity(entry) {
    const log = loadActivityLog();
    log.push({
        id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        passId: entry.passId,
        guestName: entry.guestName,
        action: entry.action,
        success: entry.success,
        timestamp: entry.timestamp || Date.now(),
        userAgent: entry.userAgent || null
    });
    saveActivityLog(log);
}

export function getActivityByPass(passId) {
    const log = loadActivityLog();
    return log.filter(entry => entry.passId === passId);
}

export function clearActivityLog() {
    if (confirm('Are you sure you want to clear all activity history?')) {
        localStorage.removeItem(ACTIVITY_STORAGE_KEY);
        renderActivityLog();
        showToast('Activity log cleared', 'success');
    }
}

// ============================================
// PASS MANAGEMENT
// ============================================

export async function generatePass(options) {
    const { name, permissions, validFrom, validUntil, durationType } = options;

    const secretEntity = state.entities[SECRET_KEY_ENTITY];
    const secretKey = secretEntity?.state || DEFAULT_SECRET;

    const passData = {
        v: 1,
        id: generatePassId(),
        name: name,
        perms: permissions,
        validFrom: Math.floor(validFrom.getTime() / 1000),
        validUntil: Math.floor(validUntil.getTime() / 1000),
        created: Math.floor(Date.now() / 1000),
        creator: 'Admin'
    };

    const payloadString = JSON.stringify(passData);
    const fullSig = generateSignature(payloadString, secretKey);
    passData.sig = fullSig.substring(0, 16);

    const token = base64UrlEncode(JSON.stringify(passData));

    // Store pass locally
    storePass({
        id: passData.id,
        name: passData.name,
        perms: passData.perms,
        validFrom: passData.validFrom,
        validUntil: passData.validUntil,
        created: passData.created,
        durationType: durationType || 'custom',
        active: true,
        paused: false
    });

    const passUrl = `${EXTERNAL_BASE_URL}${PASS_URL_PATH}?token=${token}`;
    currentGeneratedPass = { passData, token, url: passUrl };
    return currentGeneratedPass;
}

function storePass(passRecord) {
    const passes = loadPasses();
    const existingIndex = passes.findIndex(p => p.id === passRecord.id);
    if (existingIndex >= 0) {
        passes[existingIndex] = passRecord;
    } else {
        passes.push(passRecord);
    }
    savePasses(passes);
}

export async function revokePass(passId) {
    const passes = loadPasses();
    const pass = passes.find(p => p.id === passId);
    if (pass) {
        pass.active = false;
        pass.revokedAt = Math.floor(Date.now() / 1000);
        savePasses(passes);
    }
    setTimeout(renderActivePasses, 100);
    return true;
}

export async function deletePass(passId) {
    let passes = loadPasses();
    passes = passes.filter(p => p.id !== passId);
    savePasses(passes);
    setTimeout(renderActivePasses, 100);
    return true;
}

export async function pausePass(passId) {
    const passes = loadPasses();
    const pass = passes.find(p => p.id === passId);
    if (pass) {
        pass.paused = !pass.paused;
        savePasses(passes);
    }
    setTimeout(renderActivePasses, 100);
    return true;
}

export async function updatePass(passId, updates) {
    const passes = loadPasses();
    const pass = passes.find(p => p.id === passId);
    if (pass) {
        Object.assign(pass, updates);
        savePasses(passes);
    }
    setTimeout(renderActivePasses, 100);
    return true;
}

export function getActivePasses() {
    const passes = loadPasses();
    const now = Math.floor(Date.now() / 1000);
    return passes.filter(p => p.active && p.validUntil > now);
}

export function getAllPasses() {
    return loadPasses();
}

// ============================================
// UI FUNCTIONS
// ============================================

let currentPreset = 'day';

export function setPassPreset(preset) {
    currentPreset = preset;
    const customSection = $('customValiditySection');

    const formatDateTime = (date) => date.toISOString().slice(0, 16);
    const now = new Date();
    const validFromInput = $('validFrom');
    const validUntilInput = $('validUntil');

    if (preset === 'custom') {
        if (customSection) customSection.classList.remove('hidden');
        if (validFromInput && !validFromInput.value) {
            validFromInput.value = formatDateTime(now);
        }
        if (validUntilInput && !validUntilInput.value) {
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            validUntilInput.value = formatDateTime(tomorrow);
        }
    } else {
        if (customSection) customSection.classList.add('hidden');
        const duration = PRESETS[preset];
        if (duration) {
            const validUntil = new Date(now.getTime() + duration);
            if (validFromInput) validFromInput.value = formatDateTime(now);
            if (validUntilInput) validUntilInput.value = formatDateTime(validUntil);
        }
    }

    // Visual feedback
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-amber-500', 'ring-cyan-500', 'ring-purple-500', 'ring-emerald-500', 'ring-rose-500');
    });
    const clickedBtn = document.querySelector(`[data-param-preset="${preset}"]`);
    if (clickedBtn) {
        const ringColor = preset === 'day' ? 'ring-amber-500' :
                          preset === 'week' ? 'ring-cyan-500' :
                          preset === 'month' ? 'ring-purple-500' :
                          preset === 'lifetime' ? 'ring-emerald-500' : 'ring-rose-500';
        clickedBtn.classList.add('ring-2', ringColor);
    }
}

export async function generateGuestPass() {
    const name = $('guestPassName')?.value?.trim();
    const permGate = $('permGate')?.checked;
    const permGarage = $('permGarage')?.checked;
    const validFromStr = $('validFrom')?.value;
    const validUntilStr = $('validUntil')?.value;

    if (!name) {
        showToast('Please enter a guest name', 'error');
        $('guestPassName')?.focus();
        return;
    }

    if (!permGate && !permGarage) {
        showToast('Please select at least one permission', 'error');
        return;
    }

    if (!validFromStr || !validUntilStr) {
        showToast('Please select validity dates', 'error');
        return;
    }

    const validFrom = new Date(validFromStr);
    const validUntil = new Date(validUntilStr);

    if (validUntil <= validFrom) {
        showToast('End date must be after start date', 'error');
        return;
    }

    const permissions = [];
    if (permGate) permissions.push('gate');
    if (permGarage) permissions.push('garage');

    try {
        const result = await generatePass({
            name,
            permissions,
            validFrom,
            validUntil,
            durationType: currentPreset
        });

        showGeneratedPassModal(result);
        setTimeout(renderActivePasses, 300);
        $('guestPassName').value = '';
        showToast(`Pass created for ${name}`, 'success');
    } catch (e) {
        console.error('[GuestPass] Generation failed:', e);
        showToast('Failed to generate pass', 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl z-50 text-sm font-medium shadow-lg transition-all transform translate-y-2 opacity-0 ${
        type === 'success' ? 'bg-emerald-500/90 text-white' :
        type === 'error' ? 'bg-red-500/90 text-white' :
        'bg-white/10 backdrop-blur text-white'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(10px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showGeneratedPassModal(result) {
    const modal = $('generatedPassModal');
    if (!modal) return;

    $('modalGuestName').textContent = result.passData.name;
    $('generatedPassUrl').value = result.url;

    const validUntil = new Date(result.passData.validUntil * 1000);
    const now = new Date();
    const diffHours = Math.round((validUntil - now) / (1000 * 60 * 60));

    let validityText;
    if (diffHours > 24 * 365) {
        validityText = 'Lifetime access';
    } else if (diffHours > 24 * 30) {
        validityText = `Valid for ${Math.round(diffHours / (24 * 30))} month(s)`;
    } else if (diffHours > 24) {
        validityText = `Valid for ${Math.round(diffHours / 24)} day(s)`;
    } else {
        validityText = `Valid for ${diffHours} hour(s)`;
    }
    $('modalValidity').textContent = validityText;

    modal.classList.remove('hidden');
}

export function closePassModal() {
    const modal = $('generatedPassModal');
    if (modal) modal.classList.add('hidden');
}

export function closeEditModal() {
    const modal = $('editPassModal');
    if (modal) modal.classList.add('hidden');
    editingPassId = null;
}

export async function copyPassUrl() {
    const url = $('generatedPassUrl')?.value || currentGeneratedPass?.url;
    if (!url) return;

    try {
        await copyToClipboard(url);
        const btn = $('copyBtnText');
        if (btn) {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        }
        showToast('Link copied to clipboard', 'success');
    } catch (e) {
        console.error('[GuestPass] Copy failed:', e);
    }
}

export function shareWhatsApp() {
    const url = $('generatedPassUrl')?.value || currentGeneratedPass?.url;
    const name = currentGeneratedPass?.passData?.name || 'Guest';
    if (!url) return;

    const message = encodeURIComponent(
        `Hi ${name}! Here's your guest access pass for Your Residence.\n\n` +
        `Tap the link to access the gate and garage:\n${url}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
}

export async function shareGeneric() {
    const url = $('generatedPassUrl')?.value || currentGeneratedPass?.url;
    const name = currentGeneratedPass?.passData?.name || 'Guest';
    if (!url) return;

    if (navigator.share) {
        try {
            await navigator.share({
                title: `Guest Pass for ${name}`,
                text: `Access pass for Your Residence`,
                url: url
            });
        } catch (e) {
            console.log('[GuestPass] Share cancelled');
        }
    } else {
        copyPassUrl();
    }
}

// ============================================
// PASS LIST RENDERING
// ============================================

export function renderActivePasses() {
    const container = $('activePassesList');
    const countEl = $('activePassCount');
    if (!container) return;

    const allPasses = getAllPasses();
    const now = Math.floor(Date.now() / 1000);

    // Filter to active, non-expired passes
    const passes = allPasses.filter(p => p.active && p.validUntil > now);

    // Sort by created date (newest first)
    passes.sort((a, b) => b.created - a.created);

    if (countEl) {
        countEl.textContent = `${passes.length} active`;
    }

    if (passes.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-white/30">
                <svg class="w-20 h-20 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1"
                          d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
                </svg>
                <div class="text-base font-medium">No active passes</div>
                <div class="text-xs mt-2 text-white/20">Create a Golden Ticket to get started</div>
            </div>
        `;
        return;
    }

    container.innerHTML = passes.map(pass => renderPassCard(pass)).join('');
}

function renderPassCard(pass) {
    const validUntil = new Date(pass.validUntil * 1000);
    const now = new Date();
    const hoursLeft = Math.round((validUntil - now) / (1000 * 60 * 60));
    const isExpiringSoon = hoursLeft < 24 && hoursLeft > 0;
    const isPaused = pass.paused;

    let expiryText, expiryClass = '';
    if (hoursLeft > 24 * 365) {
        expiryText = 'Lifetime';
        expiryClass = 'text-emerald-400';
    } else if (hoursLeft > 24 * 7) {
        expiryText = `${Math.round(hoursLeft / (24 * 7))}w left`;
    } else if (hoursLeft > 24) {
        expiryText = `${Math.round(hoursLeft / 24)}d left`;
    } else if (hoursLeft > 0) {
        expiryText = `${hoursLeft}h left`;
        expiryClass = 'text-amber-400';
    } else {
        expiryText = 'Expired';
        expiryClass = 'text-red-400';
    }

    const durationLabel = DURATION_LABELS[pass.durationType] || 'Custom';
    const permIcons = pass.perms.map(p =>
        p === 'gate' ? `<span class="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center" title="Gate">
            <svg class="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
            </svg>
        </span>` :
        `<span class="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center" title="Garage">
            <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
        </span>`
    ).join('');

    return `
        <div class="glass-light rounded-2xl p-4 ${isPaused ? 'opacity-50' : ''}" data-pass-id="${pass.id}">
            <!-- Header Row -->
            <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20
                                flex items-center justify-center border border-amber-500/30 font-display text-amber-400 text-lg font-bold">
                        ${pass.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="font-semibold text-white text-lg">${pass.name}</div>
                        <div class="flex items-center gap-2 mt-0.5">
                            ${permIcons}
                            <span class="text-xs text-white/40 ml-1">${durationLabel}</span>
                            ${isPaused ? '<span class="text-xs text-yellow-400 ml-2">PAUSED</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm font-medium ${expiryClass}">${expiryText}</div>
                    <div class="text-xs text-white/30 mt-0.5">${new Date(pass.created * 1000).toLocaleDateString()}</div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2 pt-3 border-t border-white/5">
                <button data-action="regeneratePassUrl" data-param-passid="${pass.id}"
                        class="flex-1 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition text-sm text-white/70 flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                    </svg>
                    Share
                </button>
                <button data-action="editPass" data-param-passid="${pass.id}"
                        class="py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition" title="Edit">
                    <svg class="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                </button>
                <button data-action="pausePass" data-param-passid="${pass.id}"
                        class="py-2 px-3 rounded-lg bg-white/5 hover:bg-yellow-500/20 transition" title="${isPaused ? 'Resume' : 'Pause'}">
                    ${isPaused ?
                        `<svg class="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>` :
                        `<svg class="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>`
                    }
                </button>
                <button data-action="deletePass" data-param-passid="${pass.id}"
                        class="py-2 px-3 rounded-lg bg-white/5 hover:bg-red-500/20 transition" title="Delete">
                    <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// ============================================
// ACTIVITY LOG RENDERING
// ============================================

let activityLogOpen = false;
let activityFilterPass = null;

export function toggleActivityLog() {
    const container = $('activityLogPanel');
    if (!container) return;

    activityLogOpen = !activityLogOpen;
    if (activityLogOpen) {
        container.classList.remove('hidden');
        renderActivityLog();
    } else {
        container.classList.add('hidden');
    }
}

export function filterActivityByPass(passId) {
    activityFilterPass = passId === activityFilterPass ? null : passId;
    renderActivityLog();
}

export function renderActivityLog() {
    const container = $('activityLogContent');
    if (!container) return;

    let activities = loadActivityLog();

    // Update stats
    const allActivities = loadActivityLog();
    const statTotal = $('activityStatTotal');
    const statGate = $('activityStatGate');
    const statGarage = $('activityStatGarage');
    if (statTotal) statTotal.textContent = allActivities.length;
    if (statGate) statGate.textContent = allActivities.filter(a => a.action === 'gate').length;
    if (statGarage) statGarage.textContent = allActivities.filter(a => a.action === 'garage').length;

    // Apply filter if set
    if (activityFilterPass) {
        activities = activities.filter(a => a.passId === activityFilterPass);
    }

    // Sort by timestamp descending (newest first)
    activities.sort((a, b) => b.timestamp - a.timestamp);

    // Group by date
    const grouped = {};
    activities.forEach(activity => {
        const date = new Date(activity.timestamp);
        const dateKey = date.toDateString();
        if (!grouped[dateKey]) {
            grouped[dateKey] = [];
        }
        grouped[dateKey].push(activity);
    });

    if (activities.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16">
                <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-white/5 to-white/0 flex items-center justify-center">
                    <svg class="w-10 h-10 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                    </svg>
                </div>
                <div class="text-white/40 text-base font-medium">No activity yet</div>
                <div class="text-white/20 text-sm mt-2">Pass usage will appear here</div>
            </div>
        `;
        return;
    }

    let html = '';

    Object.entries(grouped).forEach(([dateKey, dayActivities], dateIndex) => {
        const isToday = dateKey === new Date().toDateString();
        const isYesterday = dateKey === new Date(Date.now() - 86400000).toDateString();
        const dateLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' :
                          new Date(dayActivities[0].timestamp).toLocaleDateString('en-US', {
                              weekday: 'short', month: 'short', day: 'numeric'
                          });

        html += `
            <div class="mb-6 ${dateIndex > 0 ? 'pt-4 border-t border-white/5' : ''}">
                <div class="sticky top-0 z-10 bg-gradient-to-r from-slate-900/95 to-slate-900/80 backdrop-blur-sm py-2 px-1 -mx-1 mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-2 rounded-full ${isToday ? 'bg-emerald-500 shadow-emerald-500/50 shadow-lg' : 'bg-white/30'}"></div>
                        <span class="text-sm font-medium ${isToday ? 'text-emerald-400' : 'text-white/60'}">${dateLabel}</span>
                        <span class="text-xs text-white/30">${dayActivities.length} action${dayActivities.length > 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div class="space-y-2 relative">
                    <!-- Timeline line -->
                    <div class="absolute left-[11px] top-3 bottom-3 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent"></div>
                    ${dayActivities.map(activity => renderActivityItem(activity)).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderActivityItem(activity) {
    const time = new Date(activity.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true
    });

    const isGate = activity.action === 'gate';
    const actionIcon = isGate ?
        `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>` :
        `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>`;

    // Use explicit classes instead of interpolation for Tailwind
    const dotClass = isGate ?
        'bg-purple-500/20 border-purple-500/40' :
        'bg-blue-500/20 border-blue-500/40';
    const dotInnerClass = isGate ? 'bg-purple-400' : 'bg-blue-400';
    const iconBgClass = isGate ?
        'from-purple-500/30 to-purple-600/10 border-purple-400/30 shadow-purple-500/10' :
        'from-blue-500/30 to-blue-600/10 border-blue-400/30 shadow-blue-500/10';
    const iconTextClass = isGate ? 'text-purple-400' : 'text-blue-400';
    const actionLabel = isGate ? 'Gate' : 'Garage';

    const statusDotClass = activity.success ? 'bg-emerald-500/20' : 'bg-red-500/20';
    const statusIconClass = activity.success ? 'text-emerald-400' : 'text-red-400';
    const statusTextClass = activity.success ? 'text-emerald-400/80' : 'text-red-400/80';
    const statusIcon = activity.success ?
        `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>` :
        `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>`;

    return `
        <div class="relative flex items-start gap-4 pl-8 pr-2 py-3 rounded-xl hover:bg-white/[0.02] transition-colors group">
            <!-- Timeline dot -->
            <div class="absolute left-0 top-5 w-6 h-6 rounded-full ${dotClass} border-2 flex items-center justify-center">
                <div class="w-2 h-2 rounded-full ${dotInnerClass}"></div>
            </div>

            <!-- Icon -->
            <div class="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${iconBgClass} border flex items-center justify-center shadow-lg">
                <svg class="w-5 h-5 ${iconTextClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${actionIcon}
                </svg>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-white text-sm">${activity.guestName || 'Unknown'}</span>
                    <span class="text-white/40 text-xs">opened the</span>
                    <span class="font-medium ${iconTextClass} text-sm">${actionLabel}</span>
                </div>
                <div class="flex items-center gap-3 mt-1.5">
                    <span class="text-xs text-white/40">${time}</span>
                    <div class="flex items-center gap-1.5">
                        <span class="w-4 h-4 rounded-full ${statusDotClass} flex items-center justify-center">
                            <svg class="w-2.5 h-2.5 ${statusIconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                ${statusIcon}
                            </svg>
                        </span>
                        <span class="text-xs ${statusTextClass}">${activity.success ? 'Success' : 'Failed'}</span>
                    </div>
                </div>
            </div>

            <!-- Pass ID badge (shown on hover) -->
            <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                <div class="text-[10px] font-mono text-white/20 bg-white/5 px-2 py-1 rounded">
                    ${activity.passId?.substring(0, 10) || '--'}
                </div>
            </div>
        </div>
    `;
}

// ============================================
// EDIT PASS
// ============================================

export function editPass(passId) {
    const passes = loadPasses();
    const pass = passes.find(p => p.id === passId);
    if (!pass) return;

    editingPassId = passId;

    // Populate edit modal
    const modal = $('editPassModal');
    if (!modal) {
        // Create modal if it doesn't exist
        createEditModal();
    }

    $('editPassName').value = pass.name;
    $('editPermGate').checked = pass.perms.includes('gate');
    $('editPermGarage').checked = pass.perms.includes('garage');

    // Set duration type
    const durationSelect = $('editDurationType');
    if (durationSelect) {
        durationSelect.value = pass.durationType || 'custom';
        toggleEditCustomDates(pass.durationType === 'custom');
    }

    // Set dates
    const formatDateTime = (ts) => new Date(ts * 1000).toISOString().slice(0, 16);
    $('editValidFrom').value = formatDateTime(pass.validFrom);
    $('editValidUntil').value = formatDateTime(pass.validUntil);

    $('editPassModal').classList.remove('hidden');
}

function createEditModal() {
    const modalHtml = `
        <div id="editPassModal" class="fixed inset-0 z-50 hidden flex items-center justify-center modal-backdrop">
            <div class="glass rounded-3xl p-6 max-w-md w-full mx-4 slide-up">
                <div class="flex items-center justify-between mb-6">
                    <div class="text-xl font-bold">Edit Pass</div>
                    <button data-action="closeEditModal" class="p-2 rounded-lg hover:bg-white/10 transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <!-- Guest Name -->
                <div class="mb-4">
                    <label class="text-xs text-white/50 uppercase tracking-wider block mb-1">Guest Name</label>
                    <input type="text" id="editPassName"
                           class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                                  focus:border-amber-500 focus:outline-none transition text-white">
                </div>

                <!-- Permissions -->
                <div class="mb-4">
                    <label class="text-xs text-white/50 uppercase tracking-wider block mb-2">Permissions</label>
                    <div class="flex gap-4">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="editPermGate"
                                   class="w-5 h-5 rounded bg-white/5 border-white/20 text-amber-500">
                            <span class="text-sm text-white/80">Gate</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="editPermGarage"
                                   class="w-5 h-5 rounded bg-white/5 border-white/20 text-amber-500">
                            <span class="text-sm text-white/80">Garage</span>
                        </label>
                    </div>
                </div>

                <!-- Duration Type -->
                <div class="mb-4">
                    <label class="text-xs text-white/50 uppercase tracking-wider block mb-1">Duration</label>
                    <select id="editDurationType" onchange="window.dashboard?.toggleEditCustomDates?.(this.value === 'custom')"
                            class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                                   focus:border-amber-500 focus:outline-none transition text-white">
                        <option value="day">24 Hours</option>
                        <option value="week">1 Week</option>
                        <option value="month">1 Month</option>
                        <option value="lifetime">Lifetime</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>

                <!-- Custom Dates -->
                <div id="editCustomDates" class="hidden mb-4">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-xs text-white/40 block mb-1">From</label>
                            <input type="datetime-local" id="editValidFrom"
                                   class="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10
                                          focus:border-amber-500 focus:outline-none transition text-white text-sm">
                        </div>
                        <div>
                            <label class="text-xs text-white/40 block mb-1">Until</label>
                            <input type="datetime-local" id="editValidUntil"
                                   class="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10
                                          focus:border-amber-500 focus:outline-none transition text-white text-sm">
                        </div>
                    </div>
                </div>

                <!-- Save Button -->
                <button data-action="savePassEdit"
                        class="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600
                               font-semibold text-lg hover:opacity-90 transition mt-4">
                    Save Changes
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

export function toggleEditCustomDates(show) {
    const customDates = $('editCustomDates');
    if (customDates) {
        customDates.classList.toggle('hidden', !show);
    }
}

export async function savePassEdit() {
    if (!editingPassId) return;

    const name = $('editPassName')?.value?.trim();
    const permGate = $('editPermGate')?.checked;
    const permGarage = $('editPermGarage')?.checked;
    const durationType = $('editDurationType')?.value;

    if (!name) {
        showToast('Please enter a guest name', 'error');
        return;
    }

    if (!permGate && !permGarage) {
        showToast('Please select at least one permission', 'error');
        return;
    }

    const permissions = [];
    if (permGate) permissions.push('gate');
    if (permGarage) permissions.push('garage');

    // Calculate new validity dates based on duration type
    let validFrom, validUntil;
    if (durationType === 'custom') {
        validFrom = new Date($('editValidFrom')?.value).getTime() / 1000;
        validUntil = new Date($('editValidUntil')?.value).getTime() / 1000;
    } else {
        const passes = loadPasses();
        const pass = passes.find(p => p.id === editingPassId);
        validFrom = pass?.validFrom || Math.floor(Date.now() / 1000);
        const duration = PRESETS[durationType];
        validUntil = Math.floor((Date.now() + duration) / 1000);
    }

    await updatePass(editingPassId, {
        name,
        perms: permissions,
        durationType,
        validFrom: Math.floor(validFrom),
        validUntil: Math.floor(validUntil)
    });

    closeEditModal();
    showToast('Pass updated successfully', 'success');
}

// ============================================
// REGENERATE URL
// ============================================

export async function regeneratePassUrl(passId) {
    const passes = loadPasses();
    const pass = passes.find(p => p.id === passId);
    if (!pass) return;

    const secretEntity = state.entities[SECRET_KEY_ENTITY];
    const secretKey = secretEntity?.state || DEFAULT_SECRET;

    const passData = {
        v: 1,
        id: pass.id,
        name: pass.name,
        perms: pass.perms,
        validFrom: pass.validFrom,
        validUntil: pass.validUntil,
        created: pass.created,
        creator: 'Admin'
    };

    const payloadString = JSON.stringify(passData);
    const fullSig = generateSignature(payloadString, secretKey);
    passData.sig = fullSig.substring(0, 16);

    const token = base64UrlEncode(JSON.stringify(passData));
    const url = `${EXTERNAL_BASE_URL}${PASS_URL_PATH}?token=${token}`;

    // Store for modal
    currentGeneratedPass = { passData, token, url };

    // Show the generated pass modal with share options
    $('modalGuestName').textContent = pass.name;
    $('generatedPassUrl').value = url;

    const validUntil = new Date(pass.validUntil * 1000);
    const now = new Date();
    const diffHours = Math.round((validUntil - now) / (1000 * 60 * 60));
    let validityText;
    if (diffHours > 24 * 365) {
        validityText = 'Lifetime access';
    } else if (diffHours > 24) {
        validityText = `Valid for ${Math.round(diffHours / 24)} day(s)`;
    } else {
        validityText = `Valid for ${diffHours} hour(s)`;
    }
    $('modalValidity').textContent = validityText;

    $('generatedPassModal').classList.remove('hidden');
}

// ============================================
// REFRESH PASSES
// ============================================

export function refreshPasses() {
    renderActivePasses();
    showToast('Pass list refreshed', 'info');
}

// ============================================
// INITIALIZATION
// ============================================

export async function initGuestPassView() {
    setPassPreset('day');

    // Force sync from server on view load
    console.log('[GuestPass] Initializing, syncing from server...');
    try {
        await loadPassesFromServer();
    } catch (e) {
        console.warn('[GuestPass] Server sync failed, using local data');
    }

    renderActivePasses();

    // Create edit modal if needed
    if (!$('editPassModal')) {
        createEditModal();
    }
}

// Force refresh from server
export async function syncFromServer() {
    try {
        await loadPassesFromServer();
        renderActivePasses();
        showToast('Synced from server', 'success');
    } catch (e) {
        showToast('Sync failed', 'error');
    }
}

window.addEventListener('viewLoaded', (event) => {
    if (event.detail?.viewName === 'guest-pass') {
        console.log('[GuestPass] View loaded, initializing...');
        initGuestPassView();
    }
});

// ============================================
// EXPORTS
// ============================================

export default {
    generatePass,
    revokePass,
    deletePass,
    pausePass,
    updatePass,
    getActivePasses,
    getAllPasses,
    setPassPreset,
    generateGuestPass,
    closePassModal,
    closeEditModal,
    copyPassUrl,
    shareWhatsApp,
    shareGeneric,
    renderActivePasses,
    regeneratePassUrl,
    refreshPasses,
    editPass,
    savePassEdit,
    toggleEditCustomDates,
    initGuestPassView,
    syncFromServer,
    // Activity log
    logActivity,
    loadActivityLog,
    getActivityByPass,
    clearActivityLog,
    toggleActivityLog,
    filterActivityByPass,
    renderActivityLog
};
