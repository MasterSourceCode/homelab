/**
 * Family Dashboard - Integrated with main dashboard style
 * Location, battery, activity, steps & floors tracking
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    haUrl: localStorage.getItem('ha_url') || 'http://192.168.68.77:8123',
    wsUrl: null,
    token: localStorage.getItem('ha_token') || '',
    refreshRate: 5000,
    lowBatteryThreshold: 20,
    criticalBatteryThreshold: 10
};

// Family members with all available iPhone sensors
const FAMILY_MEMBERS = {
    tatiana: {
        name: 'Tatiana',
        color: '#ec4899',
        avatar: '/local/dashboard/Tatiana.png',
        sensors: {
            tracker: 'device_tracker.tatiana_iphone',
            battery: 'sensor.tatiana_iphone_battery_level',
            batteryState: 'sensor.tatiana_iphone_battery_state',
            steps: 'sensor.tatiana_iphone_steps',
            floorsUp: 'sensor.tatiana_iphone_floors_ascended',
            floorsDown: 'sensor.tatiana_iphone_floors_descended',
            distance: 'sensor.tatiana_iphone_distance',
            activity: 'sensor.tatiana_iphone_activity',
            focus: 'binary_sensor.tatiana_iphone_focus',
            location: 'sensor.tatiana_iphone_geocoded_location',
            ssid: 'sensor.tatiana_iphone_ssid',
            connectionType: 'sensor.tatiana_iphone_connection_type',
            storage: 'sensor.tatiana_iphone_storage'
        }
    },
    nico: {
        name: 'Nico',
        color: '#3b82f6',
        avatar: '/local/dashboard/Nico.jpeg',
        sensors: {
            tracker: 'device_tracker.nico',
            battery: 'sensor.nico_battery_level',
            batteryState: 'sensor.nico_battery_state',
            steps: 'sensor.nico_steps',
            floorsUp: 'sensor.nico_floors_ascended',
            floorsDown: 'sensor.nico_floors_descended',
            distance: 'sensor.nico_distance',
            activity: 'sensor.nico_activity',
            focus: 'binary_sensor.nico_focus',
            location: 'sensor.nico_geocoded_location',
            ssid: 'sensor.nico_ssid',
            connectionType: 'sensor.nico_connection_type',
            storage: 'sensor.nico_storage'
        }
    },
    alexandra: {
        name: 'Alexandra',
        color: '#a855f7',
        avatar: '/local/dashboard/Alexandra.png',
        sensors: {
            tracker: 'device_tracker.alexandra_iphone',
            battery: 'sensor.alexandra_iphone_battery_level',
            batteryState: 'sensor.alexandra_iphone_battery_state',
            steps: 'sensor.alexandra_iphone_steps',
            floorsUp: 'sensor.alexandra_iphone_floors_ascended',
            floorsDown: 'sensor.alexandra_iphone_floors_descended',
            distance: 'sensor.alexandra_iphone_distance',
            activity: 'sensor.alexandra_iphone_activity',
            focus: 'binary_sensor.alexandra_iphone_focus',
            location: 'sensor.alexandra_iphone_geocoded_location',
            ssid: 'sensor.alexandra_iphone_ssid',
            connectionType: 'sensor.alexandra_iphone_connection_type',
            storage: 'sensor.alexandra_iphone_storage'
        }
    },
    mila: {
        name: 'Mila',
        color: '#14b8a6',
        avatar: '/local/dashboard/Mila.png',
        sensors: {
            tracker: 'device_tracker.milas_iphone',
            battery: 'sensor.milas_iphone_battery_level',
            batteryState: 'sensor.milas_iphone_battery_state',
            steps: 'sensor.milas_iphone_steps',
            floorsUp: 'sensor.milas_iphone_floors_ascended',
            floorsDown: 'sensor.milas_iphone_floors_descended',
            distance: 'sensor.milas_iphone_distance',
            activity: 'sensor.milas_iphone_activity',
            focus: 'binary_sensor.milas_iphone_focus',
            location: 'sensor.milas_iphone_geocoded_location',
            ssid: 'sensor.milas_iphone_ssid',
            connectionType: 'sensor.milas_iphone_connection_type',
            storage: 'sensor.milas_iphone_storage'
        }
    }
};

// ============================================
// STATE
// ============================================

let ws = null;
let reconnectAttempts = 0;
let familyData = {};
let shownBatteryAlerts = new Set();

// ============================================
// CONNECTION
// ============================================

function connectHA() {
    const token = document.getElementById('haToken').value || CONFIG.token;

    if (!token) {
        showError('Please enter your access token');
        return;
    }

    CONFIG.token = token;

    // Build WebSocket URL based on current protocol
    // If on HTTPS (Nabu Casa), use wss:// with same origin
    // If on HTTP (local), use ws:// with configured haUrl
    if (window.location.protocol === 'https:') {
        CONFIG.wsUrl = window.location.origin.replace('https:', 'wss:') + '/api/websocket';
        CONFIG.haUrl = window.location.origin;
        console.log('[Family] Using secure WebSocket (Nabu Casa):', CONFIG.wsUrl);
    } else {
        CONFIG.wsUrl = CONFIG.haUrl.replace('http', 'ws') + '/api/websocket';
        console.log('[Family] Using local WebSocket:', CONFIG.wsUrl);
    }

    localStorage.setItem('ha_url', CONFIG.haUrl);
    localStorage.setItem('ha_token', token);

    initWebSocket();
}

function initWebSocket() {
    if (ws) ws.close();

    ws = new WebSocket(CONFIG.wsUrl);

    ws.onopen = () => {
        console.log('Connected to Home Assistant');
        updateConnectionStatus(true);
    };

    ws.onmessage = handleMessage;

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };

    ws.onclose = () => {
        console.log('Disconnected');
        updateConnectionStatus(false);
        scheduleReconnect();
    };
}

function handleMessage(event) {
    const data = JSON.parse(event.data);

    switch (data.type) {
        case 'auth_required':
            ws.send(JSON.stringify({ type: 'auth', access_token: CONFIG.token }));
            break;

        case 'auth_ok':
            reconnectAttempts = 0;
            hideModal();
            subscribeToEntities();
            break;

        case 'auth_invalid':
            showError('Invalid token');
            break;

        case 'result':
            if (data.id === 1 && data.result) {
                processStates(data.result);
            }
            break;

        case 'event':
            if (data.event?.event_type === 'state_changed') {
                handleStateChange(data.event.data);
            }
            break;
    }
}

function subscribeToEntities() {
    ws.send(JSON.stringify({ id: 1, type: 'get_states' }));
    ws.send(JSON.stringify({ id: 2, type: 'subscribe_events', event_type: 'state_changed' }));
}

function processStates(states) {
    const stateMap = {};
    states.forEach(s => stateMap[s.entity_id] = s);

    Object.entries(FAMILY_MEMBERS).forEach(([key, member]) => {
        const trackerState = stateMap[member.sensors.tracker]?.state || 'unknown';
        const batteryLevel = parseFloat(stateMap[member.sensors.battery]?.state) || 0;
        const batteryState = stateMap[member.sensors.batteryState]?.state || 'Unknown';
        const isCharging = batteryState === 'Charging' || batteryState === 'Full';
        const geoLocation = stateMap[member.sensors.location]?.state || '';
        const focusState = stateMap[member.sensors.focus]?.state || 'off';

        familyData[key] = {
            name: member.name,
            color: member.color,
            avatar: member.avatar,
            location: trackerState,
            isHome: trackerState === 'home',
            battery: batteryLevel,
            batteryState: batteryState,
            isCharging: isCharging,
            steps: parseInt(stateMap[member.sensors.steps]?.state) || 0,
            floorsUp: parseInt(stateMap[member.sensors.floorsUp]?.state) || 0,
            floorsDown: parseInt(stateMap[member.sensors.floorsDown]?.state) || 0,
            distance: parseFloat(stateMap[member.sensors.distance]?.state) || 0,
            activity: stateMap[member.sensors.activity]?.state || 'unknown',
            focus: focusState === 'on',
            geoLocation: geoLocation ? geoLocation.split('\n')[0] : '', // First line only
            fullAddress: geoLocation,
            ssid: stateMap[member.sensors.ssid]?.state || '',
            connectionType: stateMap[member.sensors.connectionType]?.state || '',
            storage: parseFloat(stateMap[member.sensors.storage]?.state) || 0
        };
    });

    updateUI();
    updateLastUpdate();
}

function handleStateChange(data) {
    const entityId = data.entity_id;
    const newState = data.new_state?.state;

    if (!newState || newState === 'unavailable' || newState === 'unknown') return;

    let updated = false;

    Object.entries(FAMILY_MEMBERS).forEach(([key, member]) => {
        Object.entries(member.sensors).forEach(([sensorType, sensorId]) => {
            if (sensorId === entityId && familyData[key]) {
                updated = true;
                switch (sensorType) {
                    case 'tracker':
                        familyData[key].location = newState;
                        familyData[key].isHome = newState === 'home';
                        break;
                    case 'battery':
                        familyData[key].battery = parseFloat(newState) || 0;
                        break;
                    case 'batteryState':
                        familyData[key].batteryState = newState;
                        familyData[key].isCharging = newState === 'Charging' || newState === 'Full';
                        break;
                    case 'steps':
                        familyData[key].steps = parseInt(newState) || 0;
                        break;
                    case 'floorsUp':
                        familyData[key].floorsUp = parseInt(newState) || 0;
                        break;
                    case 'floorsDown':
                        familyData[key].floorsDown = parseInt(newState) || 0;
                        break;
                    case 'distance':
                        familyData[key].distance = parseFloat(newState) || 0;
                        break;
                    case 'activity':
                        familyData[key].activity = newState;
                        break;
                    case 'focus':
                        familyData[key].focus = newState === 'on';
                        break;
                    case 'location':
                        familyData[key].geoLocation = newState ? newState.split('\n')[0] : '';
                        familyData[key].fullAddress = newState;
                        break;
                    case 'ssid':
                        familyData[key].ssid = newState;
                        break;
                    case 'connectionType':
                        familyData[key].connectionType = newState;
                        break;
                    case 'storage':
                        familyData[key].storage = parseFloat(newState) || 0;
                        break;
                }
            }
        });
    });

    if (updated) {
        updateUI();
        updateLastUpdate();
    }
}

// ============================================
// UI UPDATES
// ============================================

function updateUI() {
    updateClock();
    updateHomeStatus();
    updateFamilyCards();
    updateStepsLeaderboard();
    updateFloorsLeaderboard();
    updateDistanceLeaderboard();
    updateBatteryAlerts();
}

function updateClock() {
    const now = new Date();

    const timeEl = document.getElementById('timeDisplay');
    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    const dateEl = document.getElementById('dateDisplay');
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }
}

function updateHomeStatus() {
    const members = Object.values(familyData);
    const homeMembers = members.filter(m => m.isHome);

    // Update count
    const countEl = document.getElementById('homeCount');
    if (countEl) countEl.textContent = homeMembers.length;

    // Update names
    const namesEl = document.getElementById('homeNames');
    if (namesEl) {
        if (homeMembers.length === 0) {
            namesEl.textContent = 'Nobody home';
        } else if (homeMembers.length === members.length) {
            namesEl.textContent = 'Everyone is home';
        } else {
            namesEl.textContent = homeMembers.map(m => m.name).join(', ');
        }
    }

    // Update avatars
    const avatarsEl = document.getElementById('homeAvatars');
    if (avatarsEl) {
        avatarsEl.innerHTML = homeMembers.map(member => `
            <div class="w-10 h-10 rounded-full border-2 border-dark-800 overflow-hidden" style="box-shadow: 0 0 10px ${member.color}40">
                ${member.avatar
                    ? `<img src="${member.avatar}" alt="${member.name}" class="w-full h-full object-cover">`
                    : `<div class="w-full h-full flex items-center justify-center text-sm font-bold" style="background: ${member.color}">${member.name.charAt(0)}</div>`
                }
            </div>
        `).join('');
    }
}

function updateFamilyCards() {
    const container = document.getElementById('familyCards');
    if (!container) return;

    container.innerHTML = Object.entries(familyData).map(([key, member], index) => {
        const batteryColor = getBatteryColor(member.battery);
        const isLowBattery = member.battery > 0 && member.battery <= CONFIG.lowBatteryThreshold;
        const connectionIcon = getConnectionIcon(member.connectionType);
        const activityIcon = getActivityIcon(member.activity);
        const distanceKm = (member.distance / 1000).toFixed(1);

        return `
            <div class="family-card glass-light rounded-2xl p-4 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl relative overflow-hidden group"
                 style="border-left: 3px solid ${member.color}; animation: cardSlideIn 0.6s ease-out ${index * 0.1}s both;">

                <!-- Animated Background Glow -->
                <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                     style="background: radial-gradient(circle at 50% 0%, ${member.color}15, transparent 70%);"></div>

                <!-- Focus Mode Indicator -->
                ${member.focus ? `
                    <div class="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 animate-pulse">
                        <svg class="w-3 h-3 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                        </svg>
                        <span class="text-[10px] text-purple-400 font-medium">Focus</span>
                    </div>
                ` : ''}

                <!-- Header: Avatar + Name + Status -->
                <div class="flex items-center gap-3 mb-4 relative z-10">
                    <div class="relative">
                        <!-- Animated Ring -->
                        <div class="absolute inset-0 rounded-full animate-spin-slow"
                             style="background: conic-gradient(from 0deg, ${member.color}, transparent, ${member.color}); padding: 2px; opacity: ${member.isHome ? 0.6 : 0.3};">
                            <div class="w-full h-full rounded-full bg-dark-800"></div>
                        </div>
                        <div class="relative w-14 h-14 rounded-full overflow-hidden border-2 m-[2px]" style="border-color: ${member.color}">
                            ${member.avatar
                                ? `<img src="${member.avatar}" alt="${member.name}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110">`
                                : `<div class="w-full h-full flex items-center justify-center text-xl font-bold" style="background: ${member.color}">${member.name.charAt(0)}</div>`
                            }
                        </div>
                        <!-- Status Badge -->
                        <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-dark-700 flex items-center justify-center shadow-lg ${member.isHome ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-orange-500 shadow-orange-500/50'} animate-bounce-subtle">
                            ${member.isHome
                                ? '<svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>'
                                : '<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>'
                            }
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold truncate text-white/90">${member.name}</div>
                        <div class="text-sm text-white/40 truncate">${member.isHome ? 'Home' : (member.geoLocation || capitalizeFirst(member.location))}</div>
                        <!-- Connection Info -->
                        <div class="flex items-center gap-2 mt-1">
                            ${connectionIcon}
                            <span class="text-[10px] text-white/30">${member.ssid || member.connectionType || 'Offline'}</span>
                        </div>
                    </div>
                </div>

                <!-- Battery with Animated Fill -->
                <div class="mb-3 relative z-10">
                    <div class="flex items-center justify-between text-xs mb-1.5">
                        <span class="text-white/40 flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zm16 3h2"/>
                            </svg>
                            Battery
                        </span>
                        <span class="flex items-center gap-1.5 font-medium ${isLowBattery ? 'text-red-400 animate-pulse' : ''}" style="color: ${isLowBattery ? '' : batteryColor}">
                            ${member.isCharging ? '<svg class="w-3.5 h-3.5 animate-pulse text-green-400" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>' : ''}
                            ${Math.round(member.battery)}%
                        </span>
                    </div>
                    <div class="h-2 bg-white/10 rounded-full overflow-hidden shadow-inner">
                        <div class="h-full rounded-full transition-all duration-1000 ease-out relative ${isLowBattery ? 'animate-pulse' : ''}"
                             style="width: ${member.battery}%; background: linear-gradient(90deg, ${batteryColor}, ${batteryColor}dd);">
                            <!-- Shimmer Effect -->
                            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                        </div>
                    </div>
                </div>

                <!-- Activity & Stats Grid -->
                <div class="grid grid-cols-4 gap-1.5 text-center mb-3 relative z-10">
                    <div class="stat-box bg-white/5 rounded-lg p-2 hover:bg-white/10 transition-colors">
                        <div class="text-base font-bold text-amber-400 flex items-center justify-center gap-1">
                            <svg class="w-3 h-3 text-amber-400/60" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93s3.05-7.44 7-7.93v15.86z"/>
                            </svg>
                            ${formatNumber(member.steps)}
                        </div>
                        <div class="text-[9px] text-white/40 uppercase tracking-wide">Steps</div>
                    </div>
                    <div class="stat-box bg-white/5 rounded-lg p-2 hover:bg-white/10 transition-colors">
                        <div class="text-base font-bold text-emerald-400">${distanceKm}<span class="text-[10px] text-emerald-400/60">km</span></div>
                        <div class="text-[9px] text-white/40 uppercase tracking-wide">Distance</div>
                    </div>
                    <div class="stat-box bg-white/5 rounded-lg p-2 hover:bg-white/10 transition-colors">
                        <div class="text-base font-bold text-blue-400 flex items-center justify-center gap-0.5">
                            <svg class="w-2.5 h-2.5 text-blue-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                            </svg>
                            ${member.floorsUp}
                        </div>
                        <div class="text-[9px] text-white/40 uppercase tracking-wide">Up</div>
                    </div>
                    <div class="stat-box bg-white/5 rounded-lg p-2 hover:bg-white/10 transition-colors">
                        <div class="text-base font-bold text-orange-400 flex items-center justify-center gap-0.5">
                            <svg class="w-2.5 h-2.5 text-orange-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                            </svg>
                            ${member.floorsDown}
                        </div>
                        <div class="text-[9px] text-white/40 uppercase tracking-wide">Down</div>
                    </div>
                </div>

                <!-- Activity Status & Storage -->
                <div class="flex items-center justify-between text-xs relative z-10">
                    <div class="flex items-center gap-2">
                        ${activityIcon}
                        <span class="text-white/50">${member.activity || 'Unknown'}</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-white/30">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z"/>
                        </svg>
                        <span>${member.storage > 0 ? member.storage.toFixed(1) + ' GB free' : '--'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getConnectionIcon(type) {
    if (!type) return '<svg class="w-3 h-3 text-white/20" fill="currentColor" viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>';

    if (type === 'Wi-Fi') {
        return '<svg class="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>';
    } else if (type === 'Cellular') {
        return '<svg class="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M2 22h20V2z"/></svg>';
    }
    return '<svg class="w-3 h-3 text-white/30" fill="currentColor" viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>';
}

function getActivityIcon(activity) {
    if (!activity || activity === 'unknown') {
        return '<svg class="w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"/></svg>';
    }

    const lower = activity.toLowerCase();
    if (lower === 'stationary') {
        return '<svg class="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>';
    } else if (lower === 'walking') {
        return '<svg class="w-3.5 h-3.5 text-emerald-400 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>';
    } else if (lower === 'running') {
        return '<svg class="w-3.5 h-3.5 text-orange-400 animate-bounce" fill="currentColor" viewBox="0 0 24 24"><path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>';
    } else if (lower === 'cycling' || lower === 'automotive') {
        return '<svg class="w-3.5 h-3.5 text-cyan-400" fill="currentColor" viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>';
    }
    return '<svg class="w-3.5 h-3.5 text-purple-400" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>';
}

function updateStepsLeaderboard() {
    const container = document.getElementById('stepsLeaderboard');
    if (!container) return;

    const sorted = Object.values(familyData).sort((a, b) => b.steps - a.steps);
    const totalSteps = sorted.reduce((sum, m) => sum + m.steps, 0);

    // Update total
    const totalEl = document.getElementById('totalSteps');
    if (totalEl) totalEl.textContent = formatNumber(totalSteps);

    container.innerHTML = sorted.map((member, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
        const barWidth = sorted[0].steps > 0 ? (member.steps / sorted[0].steps) * 100 : 0;

        return `
            <div class="flex items-center gap-3 p-2 rounded-xl ${rank === 1 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-white/5'}">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${rank === 1 ? 'bg-amber-500 text-black' : rank === 2 ? 'bg-gray-400 text-black' : rank === 3 ? 'bg-orange-600 text-white' : 'bg-white/10 text-white/50'}">
                    ${medal}
                </div>
                <div class="w-8 h-8 rounded-full overflow-hidden border" style="border-color: ${member.color}">
                    ${member.avatar
                        ? `<img src="${member.avatar}" alt="${member.name}" class="w-full h-full object-cover">`
                        : `<div class="w-full h-full flex items-center justify-center text-xs font-bold" style="background: ${member.color}">${member.name.charAt(0)}</div>`
                    }
                </div>
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium">${member.name}</span>
                        <span class="text-sm font-bold" style="color: ${member.color}">${formatNumber(member.steps)}</span>
                    </div>
                    <div class="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all" style="width: ${barWidth}%; background: ${member.color}"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateFloorsLeaderboard() {
    const container = document.getElementById('floorsLeaderboard');
    if (!container) return;

    const sorted = Object.values(familyData).sort((a, b) => b.floorsUp - a.floorsUp);
    const totalFloors = sorted.reduce((sum, m) => sum + m.floorsUp, 0);

    // Update total
    const totalEl = document.getElementById('totalFloors');
    if (totalEl) totalEl.textContent = totalFloors;

    container.innerHTML = sorted.map((member, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
        const barWidth = sorted[0].floorsUp > 0 ? (member.floorsUp / sorted[0].floorsUp) * 100 : 0;

        return `
            <div class="flex items-center gap-3 p-2 rounded-xl transition-all duration-300 hover:scale-[1.01] ${rank === 1 ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-white/5'}">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ${rank === 1 ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white' : rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' : rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' : 'bg-white/10 text-white/50'}">
                    ${medal}
                </div>
                <div class="w-8 h-8 rounded-full overflow-hidden border-2 shadow-md" style="border-color: ${member.color}; box-shadow: 0 0 10px ${member.color}40;">
                    ${member.avatar
                        ? `<img src="${member.avatar}" alt="${member.name}" class="w-full h-full object-cover">`
                        : `<div class="w-full h-full flex items-center justify-center text-xs font-bold" style="background: ${member.color}">${member.name.charAt(0)}</div>`
                    }
                </div>
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium">${member.name}</span>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-white/40 flex items-center gap-0.5">
                                <svg class="w-3 h-3 text-orange-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                                </svg>
                                ${member.floorsDown}
                            </span>
                            <span class="text-sm font-bold flex items-center gap-0.5" style="color: ${member.color}">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                                </svg>
                                ${member.floorsUp}
                            </span>
                        </div>
                    </div>
                    <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-700" style="width: ${barWidth}%; background: linear-gradient(90deg, ${member.color}, ${member.color}aa);"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateDistanceLeaderboard() {
    const container = document.getElementById('distanceLeaderboard');
    if (!container) return;

    const sorted = Object.values(familyData).sort((a, b) => b.distance - a.distance);
    const totalDistance = sorted.reduce((sum, m) => sum + m.distance, 0);
    const totalKm = (totalDistance / 1000).toFixed(1);

    // Update total
    const totalEl = document.getElementById('totalDistance');
    if (totalEl) totalEl.textContent = totalKm + ' km';

    container.innerHTML = sorted.map((member, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
        const barWidth = sorted[0].distance > 0 ? (member.distance / sorted[0].distance) * 100 : 0;
        const distanceKm = (member.distance / 1000).toFixed(1);

        return `
            <div class="flex items-center gap-3 p-2 rounded-xl transition-all duration-300 hover:scale-[1.01] ${rank === 1 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5'}">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ${rank === 1 ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white' : rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' : rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' : 'bg-white/10 text-white/50'}">
                    ${medal}
                </div>
                <div class="w-8 h-8 rounded-full overflow-hidden border-2 shadow-md" style="border-color: ${member.color}; box-shadow: 0 0 10px ${member.color}40;">
                    ${member.avatar
                        ? `<img src="${member.avatar}" alt="${member.name}" class="w-full h-full object-cover">`
                        : `<div class="w-full h-full flex items-center justify-center text-xs font-bold" style="background: ${member.color}">${member.name.charAt(0)}</div>`
                    }
                </div>
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium">${member.name}</span>
                        <span class="text-sm font-bold" style="color: ${member.color}">${distanceKm} <span class="text-xs text-white/40">km</span></span>
                    </div>
                    <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-700" style="width: ${barWidth}%; background: linear-gradient(90deg, ${member.color}, ${member.color}aa);"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateBatteryAlerts() {
    const container = document.getElementById('batteryAlerts');
    if (!container) return;

    const lowBatteryMembers = Object.entries(familyData)
        .filter(([key, member]) => {
            // Only show if battery is low AND not charging
            return member.battery > 0 &&
                   member.battery <= CONFIG.lowBatteryThreshold &&
                   !member.isCharging;
        })
        .sort((a, b) => a[1].battery - b[1].battery);

    if (lowBatteryMembers.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = lowBatteryMembers.map(([key, member]) => {
        const isCritical = member.battery <= CONFIG.criticalBatteryThreshold;

        return `
            <div class="glass rounded-xl p-4 border ${isCritical ? 'border-red-500/50 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/5'} ${isCritical ? 'animate-pulse' : ''}">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl ${isCritical ? 'bg-red-500/20' : 'bg-amber-500/20'} flex items-center justify-center">
                        <svg class="w-6 h-6 ${isCritical ? 'text-red-400' : 'text-amber-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <div class="font-semibold ${isCritical ? 'text-red-400' : 'text-amber-400'}">
                            ${member.name}'s phone ${isCritical ? 'needs charging now!' : 'battery is low'}
                        </div>
                        <div class="text-sm text-white/60">
                            ${Math.round(member.battery)}% remaining - please plug in
                        </div>
                    </div>
                    <div class="w-10 h-10 rounded-full overflow-hidden border-2" style="border-color: ${member.color}">
                        ${member.avatar
                            ? `<img src="${member.avatar}" alt="${member.name}" class="w-full h-full object-cover">`
                            : `<div class="w-full h-full flex items-center justify-center font-bold" style="background: ${member.color}">${member.name.charAt(0)}</div>`
                        }
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateLastUpdate() {
    const el = document.getElementById('lastUpdate');
    if (el) {
        el.textContent = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }
}

// ============================================
// HELPERS
// ============================================

function formatNumber(num) {
    if (num >= 10000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toLocaleString();
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getBatteryColor(percent) {
    if (percent <= 10) return '#ef4444';
    if (percent <= 20) return '#f97316';
    if (percent <= 50) return '#eab308';
    return '#22c55e';
}

function updateConnectionStatus(connected) {
    const dot = document.getElementById('connDot');
    const status = document.getElementById('connStatus');

    if (connected) {
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-500 pulse-dot';
        if (status) status.textContent = 'Connected';
    } else {
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-red-500';
        if (status) status.textContent = 'Disconnected';
    }
}

function showError(message) {
    const errorEl = document.getElementById('errorMsg');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
}

function hideModal() {
    const modal = document.getElementById('connectModal');
    const app = document.getElementById('app');
    if (modal) modal.classList.add('hidden');
    if (app) app.classList.remove('hidden');
}

function scheduleReconnect() {
    reconnectAttempts++;
    const delay = Math.min(5000 * reconnectAttempts, 30000);
    console.log(`Reconnecting in ${delay}ms...`);
    setTimeout(initWebSocket, delay);
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Pre-fill saved token
    const tokenInput = document.getElementById('haToken');
    if (tokenInput) tokenInput.value = CONFIG.token;

    // Auto-connect if token exists
    if (CONFIG.token) {
        CONFIG.wsUrl = CONFIG.haUrl.replace('http', 'ws') + '/api/websocket';
        initWebSocket();
    }

    // Update clock every second
    setInterval(updateClock, 1000);
    updateClock();

    // Periodic full refresh
    setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ id: 1, type: 'get_states' }));
        }
    }, CONFIG.refreshRate);
});

// Global function for onclick
window.connectHA = connectHA;
