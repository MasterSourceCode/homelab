/**
 * UI Components
 * Reusable HTML component generators
 */

import { ICONS, ZONE_ICONS } from './config.js';
import { formatLastTriggered, getZoneColorScheme } from './utils.js';

// ============================================
// ROOM CARD COMPONENT
// ============================================

export function renderRoomCard(room, onLights, hasLightsOn) {
    const icon = ICONS[room.icon] || ICONS.light;
    const hasImage = !!room.image;
    const bgVar = hasImage ? `--room-bg-image: url('${room.image}')` : '';
    const cardClass = hasImage ? 'room-card-bg' : 'glass';

    return `
        <div data-action="openRoomModal" data-param-room="${room.id}"
            class="${cardClass} rounded-2xl p-5 cursor-pointer hover:bg-white/5 transition btn-control ${hasLightsOn ? 'glow-amber' : ''}"
            style="${bgVar}">
            <div class="room-content">
                <div class="flex items-start justify-between mb-4">
                    <div class="room-icon ${room.color}">
                        <svg class="w-6 h-6 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${icon}
                        </svg>
                    </div>
                    ${hasLightsOn ? `
                        <div class="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 backdrop-blur-sm">
                            <div class="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                            <span class="text-xs text-amber-400">${onLights}</span>
                        </div>
                    ` : ''}
                </div>
                <h3 class="font-semibold text-lg drop-shadow-lg">${room.name}</h3>
                <p class="text-white/50 text-sm mt-1 drop-shadow">${room.lights.length} light${room.lights.length > 1 ? 's' : ''}</p>
            </div>
        </div>
    `;
}

// ============================================
// LIGHT TOGGLE BUTTON COMPONENT
// ============================================

export function renderLightToggleBtn(entityId, name, isOn) {
    return `
        <button data-action="toggleEntity" data-param-entity="${entityId}"
            class="light-toggle-btn ${isOn ? 'is-on' : ''}">
            <div class="light-icon ${isOn ? '' : 'bg-white/10'}">
                <svg class="w-6 h-6 ${isOn ? 'text-amber-400' : 'text-white/40'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${ICONS.light}
                </svg>
            </div>
            <span class="text-sm font-medium">${name}</span>
            <span class="text-xs ${isOn ? 'text-amber-400' : 'text-white/40'}">${isOn ? 'On' : 'Off'}</span>
        </button>
    `;
}

// ============================================
// ZONE CARD COMPONENT (Modal)
// ============================================

export function renderModalZoneCard(zone, zoneOnCount, getLightState) {
    const zoneHasLights = zoneOnCount > 0;

    return `
        <div class="modal-zone-card ${zoneHasLights ? 'has-lights-on' : ''}">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl ${zoneHasLights ? 'bg-amber-500/20' : 'bg-white/10'} flex items-center justify-center">
                        <svg class="w-5 h-5 ${zoneHasLights ? 'text-amber-400' : 'text-white/50'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${zone.name.toLowerCase().includes('bath') ? ICONS.bath : ICONS.light}
                        </svg>
                    </div>
                    <div>
                        <h4 class="font-semibold text-lg">${zone.name}</h4>
                        <p class="text-sm ${zoneHasLights ? 'text-amber-400' : 'text-white/40'}">
                            ${zoneHasLights ? `${zoneOnCount} of ${zone.lights.length} on` : 'Off'}
                        </p>
                    </div>
                </div>
            </div>
            <div class="flex flex-wrap gap-3">
                ${zone.lights.map((id, idx) => {
                    const isOn = getLightState(id);
                    const lightNum = zone.lights.length > 1 ? idx + 1 : '';
                    return renderLightToggleBtn(id, lightNum ? `Light ${lightNum}` : 'Light', isOn);
                }).join('')}
            </div>
        </div>
    `;
}

// ============================================
// SECURITY ZONE CARD COMPONENT
// ============================================

export function renderSecurityZoneCard(zone, state, isBypassed = false, hasFault = false) {
    const triggered = state?.state === 'on';
    const lastChanged = state?.last_changed;
    const lastTriggeredText = formatLastTriggered(lastChanged, triggered);
    const iconPath = ZONE_ICONS[zone.icon] || ZONE_ICONS.motion;
    const colorScheme = getZoneColorScheme(triggered, lastChanged);

    // Override color scheme if fault or bypassed
    let displayScheme;
    if (hasFault) {
        displayScheme = {
            bg: 'red',
            text: 'red',
            dot: 'bg-red-400 animate-pulse',
            border: 'border-red-500/50',
            status: 'FAULT'
        };
    } else if (isBypassed) {
        displayScheme = {
            bg: 'amber',
            text: 'amber',
            dot: 'bg-amber-400/50',
            border: 'border-amber-500/30',
            status: 'Bypassed'
        };
    } else {
        displayScheme = colorScheme;
    }

    const faultBadge = hasFault ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#1a1a2e] flex items-center justify-center"><span class="text-[6px] text-white font-bold">!</span></div>' : '';

    return `
        <div class="zone-card glass-light rounded-xl p-3 flex flex-col transition-all hover:bg-white/8 ${displayScheme.border} ${triggered ? 'zone-triggered' : ''} ${isBypassed ? 'zone-bypassed' : ''} ${hasFault ? 'zone-fault' : ''}"
             data-zone-id="${zone.id}" data-zone-name="${zone.name}">
            <!-- Top row: Icon + Status + Bypass Toggle -->
            <div class="flex items-start justify-between mb-2">
                <div class="relative w-8 h-8 rounded-lg bg-${displayScheme.bg}-500/20 flex items-center justify-center ${isBypassed ? 'opacity-50' : ''}">
                    ${faultBadge}
                    <svg class="w-4 h-4 text-${displayScheme.bg}-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        ${iconPath}
                    </svg>
                </div>
                <div class="flex items-center gap-1.5">
                    <!-- Bypass Toggle -->
                    <button data-action="toggleZoneBypass" data-param-zone="${zone.id}" data-param-name="${zone.name}"
                        class="zone-bypass-btn w-6 h-6 rounded-md ${isBypassed ? 'bg-amber-500/30 border border-amber-500/50' : 'bg-white/5 hover:bg-amber-500/20 border border-transparent hover:border-amber-500/30'} flex items-center justify-center transition group"
                        title="${isBypassed ? 'Remove bypass' : 'Bypass this zone'}">
                        <svg class="w-3.5 h-3.5 ${isBypassed ? 'text-amber-400' : 'text-white/40 group-hover:text-amber-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isBypassed ? 'M5 13l4 4L19 7' : 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'}"/>
                        </svg>
                    </button>
                    ${zone.camera ? `
                        <button data-action="openFrigatePlayback" data-param-camera="${zone.camera}" data-param-time="${lastChanged}" class="w-6 h-6 rounded-md bg-white/5 hover:bg-violet-500/20 flex items-center justify-center transition group" title="View recording">
                            <svg class="w-3.5 h-3.5 text-white/40 group-hover:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                            </svg>
                        </button>
                    ` : ''}
                    <div class="w-2 h-2 rounded-full ${displayScheme.dot}"></div>
                </div>
            </div>

            <!-- Zone name -->
            <h4 class="text-xs font-semibold text-${displayScheme.text === 'slate' ? 'white/70' : displayScheme.text + '-400'} mb-0.5 truncate ${isBypassed ? 'line-through opacity-60' : ''}">${zone.name}</h4>
            <span class="text-[10px] text-${displayScheme.text === 'slate' ? 'white/30' : displayScheme.text + '-400/70'}">${displayScheme.status}</span>

            <!-- Last triggered -->
            <div class="mt-auto pt-2 border-t border-white/5">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1">
                        <svg class="w-2.5 h-2.5 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span class="text-[10px] text-white/25">${lastTriggeredText}</span>
                    </div>
                    ${zone.camera ? `
                        <svg class="w-2.5 h-2.5 text-violet-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// ============================================
// ACTIVITY TIMELINE ITEM COMPONENT
// ============================================

export function renderActivityTimelineItem(event) {
    const iconMap = {
        'motion': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>',
        'clear': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>',
        'door': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>',
        'arm': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>',
        'disarm': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>',
        'bypass': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>'
    };

    const colorMap = {
        'motion': 'cyan',
        'clear': 'slate',
        'door': 'violet',
        'arm': 'red',
        'disarm': 'emerald',
        'bypass': 'amber'
    };

    // Zone type badge colors
    const zoneTypeBadge = {
        'entry': { color: 'violet', label: 'Entry' },
        'interior': { color: 'blue', label: 'Int' },
        'exterior': { color: 'amber', label: 'Ext' },
        'system': { color: 'slate', label: '' }
    };

    const icon = iconMap[event.type] || iconMap.motion;
    const color = colorMap[event.type] || 'slate';
    const zoneBadge = zoneTypeBadge[event.zoneType] || zoneTypeBadge.system;
    const showBadge = event.zoneType && event.zoneType !== 'system';

    return `
        <div class="timeline-item flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-white/5 transition">
            <div class="w-7 h-7 rounded-lg bg-${color}-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg class="w-3.5 h-3.5 text-${color}-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${icon}
                </svg>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5 min-w-0">
                        <span class="text-xs font-medium text-white/80 truncate">${event.zone}</span>
                        ${showBadge ? `<span class="text-[8px] px-1.5 py-0.5 rounded bg-${zoneBadge.color}-500/20 text-${zoneBadge.color}-400">${zoneBadge.label}</span>` : ''}
                    </div>
                    <span class="text-[10px] text-white/30 flex-shrink-0">${event.time}</span>
                </div>
                <p class="text-[10px] text-white/40">${event.description}</p>
            </div>
        </div>
    `;
}

// ============================================
// FAMILY GEOFENCE STATUS COMPONENT
// ============================================

export function renderFamilyGeofenceItem(member) {
    const isHome = member.state === 'home';
    const stateColor = isHome ? 'emerald' : 'slate';
    const stateText = isHome ? 'Home' : member.state || 'Away';

    return `
        <div class="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/5">
            <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-${stateColor}-500/20 flex items-center justify-center text-[10px] font-bold text-${stateColor}-400">
                    ${member.name.charAt(0).toUpperCase()}
                </div>
                <span class="text-xs text-white/70">${member.name}</span>
            </div>
            <div class="flex items-center gap-1.5">
                <div class="w-1.5 h-1.5 rounded-full bg-${stateColor}-500 ${isHome ? 'animate-pulse' : ''}"></div>
                <span class="text-[10px] text-${stateColor}-400 font-medium">${stateText}</span>
            </div>
        </div>
    `;
}

// ============================================
// ALL LIGHTS GRID ITEM COMPONENT
// ============================================

export function renderAllLightsItem(room, entityId, name, isOn) {
    return `
        <button data-action="toggleEntity" data-param-entity="${entityId}"
            class="glass-light rounded-xl p-4 flex flex-col items-center gap-2 transition btn-control ${isOn ? 'glow-amber' : ''}">
            <div class="w-10 h-10 rounded-full ${isOn ? 'bg-amber-500/30' : 'bg-white/10'} flex items-center justify-center">
                <svg class="w-5 h-5 ${isOn ? 'text-amber-400' : 'text-white/40'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${ICONS.light}
                </svg>
            </div>
            <span class="text-xs font-medium text-center">${name}</span>
        </button>
    `;
}

// ============================================
// MASTER TOGGLE BUTTONS COMPONENT
// ============================================

export function renderMasterToggleButtons(roomId, allOn, someOn) {
    return `
        <button data-action="toggleAllRoomLights" data-param-room="${roomId}" data-param-turnon="true"
            class="master-toggle-btn ${allOn ? 'all-on' : 'all-off'}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                ${ICONS.light}
            </svg>
            All On
        </button>
        <button data-action="toggleAllRoomLights" data-param-room="${roomId}" data-param-turnon="false"
            class="master-toggle-btn ${!someOn ? 'all-on' : 'all-off'}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
            </svg>
            All Off
        </button>
    `;
}

// ============================================
// FRIGATE AUTH PROMPT COMPONENT
// ============================================

export function renderFrigateAuthPrompt(frigateUrl) {
    return `
        <div class="text-amber-400">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m11-6V8a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2z"/>
            </svg>
        </div>
        <span class="text-white/80 text-sm">Camera access requires login</span>
        <button onclick="window.open('${frigateUrl}', '_blank'); setTimeout(() => { document.getElementById('frigate-auth-prompt')?.remove(); window.dashboard.checkFrigateAuth(); }, 3000);"
                class="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-lg text-cyan-400 text-sm font-medium transition-all">
            Login
        </button>
        <button onclick="document.getElementById('frigate-auth-prompt')?.remove();" class="text-white/40 hover:text-white/60 ml-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>
    `;
}
