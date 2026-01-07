/**
 * Command Center 2.0 - AI Camera Hub
 * Frigate NVR Integration with AI Event Analysis
 * Enhanced with Timeline Graph and Camera Health
 */

// Import state to access camera entities
import { state as appState } from './state.js';

const SurveillanceDashboard = (function() {
    // Network detection
    function isLocalNetwork() {
        const host = window.location.hostname;
        return host.startsWith('192.168.') ||
               host.startsWith('10.') ||
               host.startsWith('172.') ||
               host === 'localhost' ||
               host === '127.0.0.1';
    }

    // Configuration with network-aware URLs
    const LOCAL_API = 'http://192.168.68.77:5003/api';
    const LOCAL_UI = 'http://192.168.68.77:8971';
    const EXTERNAL_UI = 'https://your-frigate-domain.com';

    // Home Assistant proxy configuration for Nabu Casa access
    const FRIGATE_CLIENT_ID = 'frigate';

    /**
     * Get the Home Assistant base URL
     */
    function getHaBaseUrl() {
        if (window.location.hostname.includes('nabu.casa')) {
            return window.location.origin;
        }
        if (window.location.port === '8123') {
            return window.location.origin;
        }
        return 'http://192.168.68.77:8123';
    }

    /**
     * Check if we're accessing through Home Assistant (Nabu Casa)
     */
    function isHaAccess() {
        return window.location.hostname.includes('nabu.casa') ||
               window.location.port === '8123';
    }

    function getApiBase() {
        return LOCAL_API; // Only used for local access now
    }

    function getUiBase() {
        return isLocalNetwork() ? LOCAL_UI : EXTERNAL_UI;
    }

    /**
     * Get URL for live camera snapshot
     * For external access, uses the camera entity's entity_picture (signed URL)
     */
    function getCameraSnapshotUrl(cameraId, height = 180) {
        if (isLocalNetwork()) {
            // Direct Frigate API for local (fastest)
            return `${LOCAL_API}/${cameraId}/latest.jpg?h=${height}&_t=${Date.now()}`;
        }

        // For external access, try to get the signed entity_picture URL from state
        const entityId = `camera.${cameraId}`;
        const cameraEntity = appState.getEntity(entityId);

        if (cameraEntity && cameraEntity.attributes?.entity_picture) {
            // entity_picture contains a signed URL like /api/camera_proxy/camera.xxx?token=xxx
            const signedPath = cameraEntity.attributes.entity_picture;
            // Add cache buster but preserve the signed token
            const separator = signedPath.includes('?') ? '&' : '?';
            return `${getHaBaseUrl()}${signedPath}${separator}_t=${Date.now()}`;
        }

        // Fallback to camera proxy (may not work without auth)
        console.warn(`[Surveillance] No entity_picture for ${entityId}, using fallback`);
        return `${getHaBaseUrl()}/api/camera_proxy/${entityId}?_t=${Date.now()}`;
    }

    /**
     * Get URL for event thumbnail
     * Uses Frigate integration's notification proxy for external access
     */
    function getEventThumbnailUrl(eventId) {
        if (isLocalNetwork()) {
            return `${LOCAL_API}/events/${eventId}/thumbnail.jpg`;
        }
        // Use Frigate integration's notification proxy (works via Nabu Casa for recent events)
        return `${getHaBaseUrl()}/api/frigate/${FRIGATE_CLIENT_ID}/notifications/${eventId}/thumbnail.jpg`;
    }

    /**
     * Get URL for event snapshot (full resolution)
     */
    function getEventSnapshotUrl(eventId) {
        if (isLocalNetwork()) {
            return `${LOCAL_API}/events/${eventId}/snapshot.jpg`;
        }
        return `${getHaBaseUrl()}/api/frigate/${FRIGATE_CLIENT_ID}/notifications/${eventId}/snapshot.jpg`;
    }

    /**
     * Get URL for event clip
     */
    function getEventClipUrl(eventId) {
        if (isLocalNetwork()) {
            return `${LOCAL_API}/events/${eventId}/clip.mp4`;
        }
        return `${getHaBaseUrl()}/api/frigate/${FRIGATE_CLIENT_ID}/notifications/${eventId}/clip.mp4`;
    }

    const CONFIG = {
        refreshInterval: 30000, // 30 seconds
        snapshotRefreshInterval: 5000, // 5 seconds for live feeds
        timelineSlots: 24, // Number of time slots in timeline
        cameras: [
            { id: 'front_door', name: 'Front Door', color: '#f43f5e' },
            { id: 'backyard', name: 'Backyard', color: '#22c55e' },
            { id: 'wyze_garage', name: 'Garage', color: '#fbbf24' },
            { id: 'ezviz_indoor', name: 'Indoor', color: '#3b82f6' }
        ]
    };

    // State
    let state = {
        events: [],
        selectedEvent: null,
        filters: {
            time: '1h',
            object: 'all',
            cameras: [] // empty = all cameras
        },
        aiAnalysis: {}, // eventId -> AI analysis text
        isLoading: false,
        snapshotIntervals: {},
        refreshIntervalId: null,
        cameraStats: {} // camera health stats
    };

    // DOM Elements
    const elements = {};

    /**
     * Initialize the dashboard
     */
    function init() {
        console.log('[Surveillance] Initializing Command Center 2.0...');
        console.log(`[Surveillance] Network: ${isLocalNetwork() ? 'LOCAL' : 'EXTERNAL'}`);
        console.log(`[Surveillance] HA Access: ${isHaAccess() ? 'YES (Nabu Casa/HA)' : 'NO'}`);
        console.log(`[Surveillance] HA Base URL: ${getHaBaseUrl()}`);
        console.log(`[Surveillance] Events API: ${isLocalNetwork() ? LOCAL_API : (isHaAccess() ? getHaBaseUrl() + '/api/frigate/' + FRIGATE_CLIENT_ID : EXTERNAL_API)}`);

        cacheElements();
        renderCameraGrid();
        renderCameraFilters();
        renderCameraHealth();
        loadEvents();
        loadCameraStats();
        startAutoRefresh();
    }

    /**
     * Cache DOM elements
     */
    function cacheElements() {
        elements.cameraGrid = document.getElementById('survCameraGrid');
        elements.cameraFilter = document.getElementById('survCameraFilter');
        elements.cameraHealth = document.getElementById('survCameraHealth');
        elements.eventList = document.getElementById('survEventList');
        elements.eventCount = document.getElementById('survEventCount');
        elements.detailEmpty = document.getElementById('survDetailEmpty');
        elements.detailContent = document.getElementById('survDetailContent');
        elements.detailSnapshot = document.getElementById('survDetailSnapshot');
        elements.detailLabel = document.getElementById('survDetailLabel');
        elements.detailConfidence = document.getElementById('survDetailConfidence');
        elements.detailTime = document.getElementById('survDetailTime');
        elements.aiText = document.getElementById('survAiText');
        elements.lastUpdate = document.getElementById('survLastUpdate');
        elements.todayEvents = document.getElementById('survTodayEvents');
        elements.personCount = document.getElementById('survPersonCount');
        elements.vehicleCount = document.getElementById('survVehicleCount');
        elements.aiAnalyzed = document.getElementById('survAiAnalyzed');
        elements.cameraCount = document.getElementById('survCameraCount');
        elements.videoModal = document.getElementById('survVideoModal');
        elements.videoPlayer = document.getElementById('survVideoPlayer');
        elements.refreshIcon = document.getElementById('survRefreshIcon');
        elements.timelineBars = document.getElementById('survTimelineBars');
        elements.timelineLabels = document.getElementById('survTimelineLabels');
        elements.timelineScrubber = document.getElementById('survTimelineScrubber');
    }

    /**
     * Render the live camera grid
     */
    function renderCameraGrid() {
        if (!elements.cameraGrid) return;

        elements.cameraGrid.innerHTML = CONFIG.cameras.map(cam => `
            <div class="surv-camera-tile" onclick="window.surveillance.openCamera('${cam.id}')" data-camera="${cam.id}">
                <img src="${getCameraSnapshotUrl(cam.id, 180)}" alt="${cam.name}" onerror="this.onerror=null; this.style.opacity='0.3';">
                <div class="camera-status" id="cam-status-${cam.id}"></div>
                <div class="camera-detection hidden" id="cam-detect-${cam.id}"></div>
                <div class="camera-label">${cam.name}</div>
                <div class="camera-expand">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                    </svg>
                </div>
            </div>
        `).join('');

        if (elements.cameraCount) {
            elements.cameraCount.textContent = `${CONFIG.cameras.length} CAM`;
        }
        startSnapshotRefresh();
    }

    /**
     * Render camera health indicators
     */
    function renderCameraHealth() {
        if (!elements.cameraHealth) return;

        elements.cameraHealth.innerHTML = CONFIG.cameras.map(cam => `
            <div class="surv-health-item" data-camera="${cam.id}">
                <div class="surv-health-dot online" id="health-dot-${cam.id}"></div>
                <span class="surv-health-name">${cam.name}</span>
                <span class="surv-health-fps" id="health-fps-${cam.id}">--fps</span>
            </div>
        `).join('');
    }

    /**
     * Load camera stats from Frigate API
     * Note: Stats are only available for local access
     */
    async function loadCameraStats() {
        try {
            if (!isLocalNetwork()) {
                // Stats not available externally
                return;
            }

            const response = await fetch(`${LOCAL_API}/stats`);
            if (!response.ok) return;
            const stats = await response.json();
            state.cameraStats = stats;

            // Update health indicators
            CONFIG.cameras.forEach(cam => {
                const camStats = stats.cameras?.[cam.id];
                const dotEl = document.getElementById(`health-dot-${cam.id}`);
                const fpsEl = document.getElementById(`health-fps-${cam.id}`);

                if (camStats && dotEl && fpsEl) {
                    const fps = camStats.camera_fps || 0;
                    const isOnline = fps > 0;

                    dotEl.className = `surv-health-dot ${isOnline ? 'online' : 'offline'}`;
                    fpsEl.textContent = `${Math.round(fps)}fps`;
                } else if (dotEl) {
                    dotEl.className = 'surv-health-dot warning';
                }
            });
        } catch (e) {
            console.warn('[Surveillance] Failed to load camera stats:', e);
        }
    }

    /**
     * Render timeline graph
     */
    function renderTimelineGraph() {
        if (!elements.timelineBars || !elements.timelineLabels) return;

        const timeMap = {
            '1h': 3600,
            '6h': 21600,
            '24h': 86400,
            '7d': 604800
        };
        const duration = timeMap[state.filters.time] || 3600;
        const now = Date.now() / 1000;
        const slotDuration = duration / CONFIG.timelineSlots;

        // Group events by time slot
        const slots = Array(CONFIG.timelineSlots).fill(null).map(() => ({
            person: 0, car: 0, dog: 0, cat: 0, motion: 0
        }));

        state.events.forEach(event => {
            const age = now - event.start_time;
            const slotIndex = Math.floor(age / slotDuration);
            if (slotIndex >= 0 && slotIndex < CONFIG.timelineSlots) {
                const reversedIndex = CONFIG.timelineSlots - 1 - slotIndex;
                const label = event.label || 'motion';
                if (slots[reversedIndex][label] !== undefined) {
                    slots[reversedIndex][label]++;
                }
            }
        });

        // Find max for scaling
        const maxCount = Math.max(1, ...slots.map(s =>
            Math.max(s.person, s.car, s.dog + s.cat)
        ));

        // Render bars
        elements.timelineBars.innerHTML = slots.map((slot, i) => {
            const height = Math.max(
                (slot.person / maxCount) * 100,
                (slot.car / maxCount) * 100,
                ((slot.dog + slot.cat) / maxCount) * 100
            );
            const total = slot.person + slot.car + slot.dog + slot.cat;

            // Determine dominant type
            let type = 'motion';
            if (slot.person > 0) type = 'person';
            else if (slot.car > 0) type = 'car';
            else if (slot.dog + slot.cat > 0) type = 'dog';

            return `<div class="surv-timeline-bar ${type}"
                        style="height: ${Math.max(2, height)}%"
                        data-count="${total > 0 ? total : ''}"
                        onclick="window.surveillance.filterByTimeSlot(${i})"></div>`;
        }).join('');

        // Render time labels
        const labelCount = 5;
        const labels = [];
        for (let i = 0; i < labelCount; i++) {
            const slotIndex = Math.floor(i * (CONFIG.timelineSlots - 1) / (labelCount - 1));
            const age = (CONFIG.timelineSlots - 1 - slotIndex) * slotDuration;
            labels.push(formatTimeLabel(age, duration));
        }
        elements.timelineLabels.innerHTML = labels.map(l =>
            `<span class="surv-timeline-label">${l}</span>`
        ).join('');
    }

    /**
     * Format time label for timeline
     */
    function formatTimeLabel(ageSeconds, totalDuration) {
        if (ageSeconds === 0) return 'Now';
        if (totalDuration <= 3600) {
            return `${Math.round(ageSeconds / 60)}m`;
        } else if (totalDuration <= 86400) {
            return `${Math.round(ageSeconds / 3600)}h`;
        } else {
            return `${Math.round(ageSeconds / 86400)}d`;
        }
    }

    /**
     * Filter by clicking timeline slot
     */
    function filterByTimeSlot(slotIndex) {
        // Future: could filter events to specific time range
        console.log('[Surveillance] Timeline slot clicked:', slotIndex);
    }

    /**
     * Open camera in full-screen view
     */
    function openCamera(cameraId) {
        const camera = CONFIG.cameras.find(c => c.id === cameraId);
        if (!camera) return;

        state.fullscreenCamera = cameraId;

        // Create or get the camera modal
        let modal = document.getElementById('survCameraModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'survCameraModal';
            modal.className = 'fixed inset-0 z-50 hidden';
            modal.innerHTML = `
                <div class="absolute inset-0 bg-black/95 backdrop-blur-md" onclick="window.surveillance.closeCamera()"></div>
                <div class="absolute inset-4 flex flex-col">
                    <!-- Header -->
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-4">
                            <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/40">
                                <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                <span class="text-xs font-medium text-red-400">LIVE</span>
                            </div>
                            <h3 id="survCameraModalTitle" class="text-xl font-light text-white"></h3>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="window.surveillance.openCameraInFrigate()" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/70 hover:text-white transition flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                Open in Frigate
                            </button>
                            <button onclick="window.surveillance.closeCamera()" class="w-10 h-10 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/50 flex items-center justify-center transition">
                                <svg class="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <!-- Camera Feed -->
                    <div class="flex-1 flex items-center justify-center">
                        <div class="relative w-full max-w-6xl rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10">
                            <img id="survCameraModalImg" class="w-full h-auto" src="" alt="Live Camera Feed">
                            <div id="survCameraModalLoading" class="absolute inset-0 flex items-center justify-center bg-black/50">
                                <svg class="w-12 h-12 animate-spin text-rose-400" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                            </div>
                            <!-- Camera info overlay -->
                            <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                                <div class="flex items-center justify-between">
                                    <div id="survCameraModalInfo" class="text-sm text-white/60"></div>
                                    <div id="survCameraModalTime" class="text-sm font-mono text-white/40"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Camera Selector -->
                    <div class="flex items-center justify-center gap-2 mt-4">
                        ${CONFIG.cameras.map(c => `
                            <button onclick="window.surveillance.switchCamera('${c.id}')"
                                    class="surv-cam-switch px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/60 hover:text-white transition"
                                    data-camera="${c.id}">
                                ${c.name}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Show modal and start updating
        modal.classList.remove('hidden');
        document.getElementById('survCameraModalTitle').textContent = camera.name;
        updateFullscreenCamera(cameraId);
        startFullscreenRefresh();

        // Highlight active camera button
        modal.querySelectorAll('.surv-cam-switch').forEach(btn => {
            btn.classList.toggle('bg-rose-500/20', btn.dataset.camera === cameraId);
            btn.classList.toggle('border-rose-500/40', btn.dataset.camera === cameraId);
            btn.classList.toggle('text-rose-400', btn.dataset.camera === cameraId);
        });
    }

    /**
     * Update fullscreen camera image
     */
    function updateFullscreenCamera(cameraId) {
        const img = document.getElementById('survCameraModalImg');
        const loading = document.getElementById('survCameraModalLoading');
        const info = document.getElementById('survCameraModalInfo');
        const time = document.getElementById('survCameraModalTime');

        if (!img) return;

        // High resolution snapshot
        const newSrc = getCameraSnapshotUrl(cameraId, 1080);

        const tempImg = new Image();
        tempImg.onload = () => {
            img.src = newSrc;
            if (loading) loading.classList.add('hidden');
        };
        tempImg.onerror = () => {
            if (loading) loading.classList.add('hidden');
        };
        tempImg.src = newSrc;

        if (info) info.textContent = `${cameraId.replace(/_/g, ' ').toUpperCase()} • 1080p`;
        if (time) time.textContent = new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    /**
     * Start fullscreen camera refresh
     */
    function startFullscreenRefresh() {
        stopFullscreenRefresh();
        state.fullscreenRefreshId = setInterval(() => {
            if (state.fullscreenCamera) {
                updateFullscreenCamera(state.fullscreenCamera);
            }
        }, 1000); // Refresh every second for smooth live view
    }

    /**
     * Stop fullscreen camera refresh
     */
    function stopFullscreenRefresh() {
        if (state.fullscreenRefreshId) {
            clearInterval(state.fullscreenRefreshId);
            state.fullscreenRefreshId = null;
        }
    }

    /**
     * Switch to a different camera in fullscreen view
     */
    function switchCamera(cameraId) {
        const camera = CONFIG.cameras.find(c => c.id === cameraId);
        if (!camera) return;

        state.fullscreenCamera = cameraId;
        document.getElementById('survCameraModalTitle').textContent = camera.name;
        document.getElementById('survCameraModalLoading').classList.remove('hidden');
        updateFullscreenCamera(cameraId);

        // Update active button
        const modal = document.getElementById('survCameraModal');
        modal.querySelectorAll('.surv-cam-switch').forEach(btn => {
            btn.classList.toggle('bg-rose-500/20', btn.dataset.camera === cameraId);
            btn.classList.toggle('border-rose-500/40', btn.dataset.camera === cameraId);
            btn.classList.toggle('text-rose-400', btn.dataset.camera === cameraId);
        });
    }

    /**
     * Close fullscreen camera view
     */
    function closeCamera() {
        stopFullscreenRefresh();
        state.fullscreenCamera = null;
        const modal = document.getElementById('survCameraModal');
        if (modal) modal.classList.add('hidden');
    }

    /**
     * Open current camera in Frigate UI
     */
    function openCameraInFrigate() {
        if (state.fullscreenCamera) {
            window.open(`${getUiBase()}/#/cameras/${state.fullscreenCamera}`, '_blank');
        }
    }

    /**
     * Render camera filter chips
     */
    function renderCameraFilters() {
        if (!elements.cameraFilter) return;

        const allActive = state.filters.cameras.length === 0;

        elements.cameraFilter.innerHTML = `
            <button class="surv-cam-chip ${allActive ? 'active' : ''}" onclick="window.surveillance.filterByCamera('all')">
                <span class="chip-dot"></span>
                All
            </button>
            ${CONFIG.cameras.map(cam => `
                <button class="surv-cam-chip ${state.filters.cameras.includes(cam.id) ? 'active' : ''}"
                        onclick="window.surveillance.filterByCamera('${cam.id}')"
                        style="${state.filters.cameras.includes(cam.id) ? `--chip-color: ${cam.color}` : ''}">
                    <span class="chip-dot" style="background: ${cam.color}"></span>
                    ${cam.name}
                </button>
            `).join('')}
        `;
    }

    /**
     * Start refreshing camera snapshots
     */
    function startSnapshotRefresh() {
        // Clear existing intervals
        Object.values(state.snapshotIntervals).forEach(clearInterval);
        state.snapshotIntervals = {};

        CONFIG.cameras.forEach(cam => {
            state.snapshotIntervals[cam.id] = setInterval(() => {
                const img = elements.cameraGrid?.querySelector(`[data-camera="${cam.id}"] img`);
                if (img) {
                    img.src = getCameraSnapshotUrl(cam.id, 180);
                }
            }, CONFIG.snapshotRefreshInterval);
        });
    }

    /**
     * Stop snapshot refresh (when view is hidden)
     */
    function stopSnapshotRefresh() {
        Object.values(state.snapshotIntervals).forEach(clearInterval);
        state.snapshotIntervals = {};
    }

    /**
     * Load events from Frigate API
     * Note: Events list is only available for local access
     * The Frigate HA integration doesn't expose the events endpoint
     */
    async function loadEvents() {
        state.isLoading = true;
        updateLoadingState();

        try {
            const params = buildEventParams();
            let events = [];

            if (isLocalNetwork()) {
                // Direct Frigate API for local access
                const response = await fetch(`${LOCAL_API}/events?${params}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                events = await response.json();
            } else {
                // External access: Events list not available through HA integration
                // Show a helpful message instead
                console.log('[Surveillance] Events list not available for external access');
                state.externalAccessLimited = true;
                events = [];
            }

            state.events = events;

            // Load AI analysis from localStorage (persisted from notifications)
            loadAiAnalysis();

            renderEvents();
            updateStats();
            updateLastRefresh();
            renderTimelineGraph();
            loadCameraStats();

        } catch (error) {
            console.error('[Surveillance] Failed to load events:', error);
            showError('Unable to connect to Frigate');
        } finally {
            state.isLoading = false;
            updateLoadingState();
        }
    }

    /**
     * Build query parameters for events API
     */
    function buildEventParams() {
        const params = new URLSearchParams();

        // Time filter
        const now = Date.now() / 1000;
        const timeMap = {
            '1h': 3600,
            '6h': 21600,
            '24h': 86400,
            '7d': 604800
        };
        const after = now - (timeMap[state.filters.time] || 3600);
        params.set('after', Math.floor(after));

        // Object filter
        if (state.filters.object !== 'all') {
            params.set('label', state.filters.object);
        }

        // Camera filter
        if (state.filters.cameras.length > 0) {
            params.set('cameras', state.filters.cameras.join(','));
        }

        // Limit
        params.set('limit', '100');
        params.set('include_thumbnails', '0');

        return params.toString();
    }

    /**
     * Render events in the timeline
     */
    function renderEvents() {
        if (!elements.eventList) return;

        // Show special message for external access
        if (state.externalAccessLimited) {
            elements.eventList.innerHTML = `
                <div class="surv-empty-state">
                    <svg class="w-16 h-16 text-amber-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <span class="text-sm text-amber-400/80">Remote Access Mode</span>
                    <span class="text-xs text-white/40 mt-1 text-center px-4">Event history not available externally.<br>Live camera feeds are shown above.</span>
                </div>
            `;
            elements.eventCount.textContent = 'Remote';
            return;
        }

        if (state.events.length === 0) {
            elements.eventList.innerHTML = `
                <div class="surv-empty-state">
                    <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span class="text-sm">No events found</span>
                    <span class="text-xs text-white/20 mt-1">Try adjusting your filters</span>
                </div>
            `;
            elements.eventCount.textContent = '0 events';
            return;
        }

        elements.eventList.innerHTML = state.events.map(event => renderEventCard(event)).join('');
        elements.eventCount.textContent = `${state.events.length} events`;
    }

    /**
     * Render a single event card
     */
    function renderEventCard(event) {
        const hasAi = state.aiAnalysis[event.id] ? true : false;
        const camera = CONFIG.cameras.find(c => c.id === event.camera) || { name: event.camera };
        const time = formatEventTime(event.start_time);
        const label = event.label || 'motion';
        // Frigate API returns score in data object or as top_score
        // Try multiple possible score locations
        const score = event.data?.score || event.data?.top_score || event.top_score || event.score || 0;
        const confidence = score ? Math.round(score * 100) : '--';
        const isSelected = state.selectedEvent?.id === event.id;

        return `
            <div class="surv-event-card ${isSelected ? 'selected' : ''} ${hasAi ? 'has-ai' : ''}"
                 onclick="window.surveillance.selectEvent('${event.id}')">
                <div class="surv-event-thumb">
                    <img src="${getEventThumbnailUrl(event.id)}" alt=""
                         onerror="this.onerror=null; this.style.opacity='0.3';">
                </div>
                <div class="surv-event-info">
                    <div class="surv-event-title">
                        <span class="event-label ${label}">${label}</span>
                        <span class="text-white/50">${confidence}%</span>
                    </div>
                    <div class="surv-event-meta">
                        <span class="camera-name">${camera.name}</span>
                        ${event.zones?.length ? `<span>• ${event.zones.join(', ')}</span>` : ''}
                    </div>
                    ${hasAi ? `
                        <div class="surv-event-ai">
                            <svg fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                            </svg>
                            <span>AI</span>
                        </div>
                    ` : ''}
                </div>
                <div class="surv-event-time">${time}</div>
            </div>
        `;
    }

    /**
     * Format event timestamp
     */
    function formatEventTime(timestamp) {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;

        return date.toLocaleDateString('en-ZA', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Select an event and show details
     */
    function selectEvent(eventId) {
        const event = state.events.find(e => e.id === eventId);
        if (!event) return;

        state.selectedEvent = event;

        // Update selection in list
        elements.eventList.querySelectorAll('.surv-event-card').forEach(card => {
            card.classList.toggle('selected', card.onclick.toString().includes(eventId));
        });

        // Show detail panel
        elements.detailEmpty.classList.add('hidden');
        elements.detailContent.classList.remove('hidden');

        // Update detail content
        elements.detailSnapshot.src = getEventSnapshotUrl(event.id);

        const label = event.label || 'motion';
        elements.detailLabel.innerHTML = `
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                ${getObjectIcon(label)}
            </svg>
            <span>${label}</span>
        `;
        elements.detailLabel.className = `absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-white text-[10px] font-medium flex items-center gap-1 ${getLabelBgClass(label)}`;

        // Get score from multiple possible locations
        const score = event.data?.score || event.data?.top_score || event.top_score || event.score || 0;
        const confidence = score ? Math.round(score * 100) : '--';
        elements.detailConfidence.textContent = `${confidence}%`;

        const eventDate = new Date(event.start_time * 1000);
        elements.detailTime.textContent = eventDate.toLocaleString('en-ZA', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Show AI analysis if available
        const aiText = state.aiAnalysis[event.id];
        if (aiText) {
            elements.aiText.textContent = aiText;
            elements.aiText.classList.remove('text-white/40');
        } else {
            elements.aiText.textContent = 'No AI analysis available for this event. AI analysis is generated when automations are triggered.';
            elements.aiText.classList.add('text-white/40');
        }
    }

    /**
     * Get icon SVG path for object type
     */
    function getObjectIcon(label) {
        const icons = {
            person: '<path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>',
            car: '<path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z M5 4h10l2 5v7H3V9l2-5z"/>',
            dog: '<path d="M4 8a4 4 0 014-4h4a4 4 0 014 4v8H4V8z"/>',
            cat: '<path d="M6 2a2 2 0 00-2 2v1a2 2 0 002 2h1v2H4a2 2 0 00-2 2v5a2 2 0 002 2h12a2 2 0 002-2v-5a2 2 0 00-2-2h-3V7h1a2 2 0 002-2V4a2 2 0 00-2-2H6z"/>'
        };
        return icons[label] || icons.person;
    }

    /**
     * Get label background class
     */
    function getLabelBgClass(label) {
        const classes = {
            person: 'bg-rose-500/80',
            car: 'bg-blue-500/80',
            dog: 'bg-amber-500/80',
            cat: 'bg-green-500/80'
        };
        return classes[label] || 'bg-rose-500/80';
    }

    /**
     * Play event video clip
     */
    function playClip() {
        if (!state.selectedEvent) return;

        const clipUrl = getEventClipUrl(state.selectedEvent.id);
        const videoSource = elements.videoPlayer.querySelector('source');
        videoSource.src = clipUrl;
        elements.videoPlayer.load();
        elements.videoModal.classList.remove('hidden');
    }

    /**
     * Close video modal
     */
    function closeVideoModal() {
        elements.videoModal.classList.add('hidden');
        elements.videoPlayer.pause();
    }

    /**
     * Open event in Frigate UI
     */
    function openInFrigate() {
        if (!state.selectedEvent) return;
        window.open(`${getUiBase()}/events?id=${state.selectedEvent.id}`, '_blank');
    }

    /**
     * Download event clip
     */
    function downloadClip() {
        if (!state.selectedEvent) return;
        const clipUrl = getEventClipUrl(state.selectedEvent.id);
        const a = document.createElement('a');
        a.href = clipUrl;
        a.download = `frigate_${state.selectedEvent.camera}_${state.selectedEvent.id}.mp4`;
        a.click();
    }

    /**
     * Set time filter
     */
    function setTimeFilter(time) {
        state.filters.time = time;

        // Update button states
        document.querySelectorAll('.surv-time-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.time === time);
        });

        loadEvents();
    }

    /**
     * Set object type filter
     */
    function setObjectFilter(obj) {
        state.filters.object = obj;

        // Update button states
        document.querySelectorAll('.surv-obj-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.obj === obj);
        });

        loadEvents();
    }

    /**
     * Filter by camera
     */
    function filterByCamera(cameraId) {
        if (cameraId === 'all') {
            state.filters.cameras = [];
        } else {
            const idx = state.filters.cameras.indexOf(cameraId);
            if (idx >= 0) {
                state.filters.cameras.splice(idx, 1);
            } else {
                state.filters.cameras.push(cameraId);
            }
        }

        renderCameraFilters();
        loadEvents();
    }

    /**
     * Manual refresh
     */
    function refresh() {
        loadEvents();
    }

    /**
     * Start auto-refresh
     */
    function startAutoRefresh() {
        stopAutoRefresh();
        state.refreshIntervalId = setInterval(loadEvents, CONFIG.refreshInterval);
    }

    /**
     * Stop auto-refresh
     */
    function stopAutoRefresh() {
        if (state.refreshIntervalId) {
            clearInterval(state.refreshIntervalId);
            state.refreshIntervalId = null;
        }
    }

    /**
     * Update loading state
     */
    function updateLoadingState() {
        const container = document.getElementById('view-surveillance');
        if (container) {
            container.classList.toggle('surv-refreshing', state.isLoading);
        }
    }

    /**
     * Update last refresh timestamp
     */
    function updateLastRefresh() {
        if (elements.lastUpdate) {
            const now = new Date();
            elements.lastUpdate.textContent = `Updated ${now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`;
        }
    }

    /**
     * Update statistics
     */
    function updateStats() {
        if (!state.events.length) {
            if (elements.todayEvents) elements.todayEvents.textContent = '0';
            if (elements.personCount) elements.personCount.textContent = '0';
            if (elements.vehicleCount) elements.vehicleCount.textContent = '0';
            if (elements.aiAnalyzed) elements.aiAnalyzed.textContent = '0';
            return;
        }

        // Today's events (in current filter window)
        if (elements.todayEvents) elements.todayEvents.textContent = state.events.length;

        // Person detections
        const personEvents = state.events.filter(e => e.label === 'person');
        if (elements.personCount) elements.personCount.textContent = personEvents.length;

        // Vehicle detections
        const vehicleEvents = state.events.filter(e => e.label === 'car');
        if (elements.vehicleCount) elements.vehicleCount.textContent = vehicleEvents.length;

        // AI analyzed
        const aiCount = Object.keys(state.aiAnalysis).filter(id =>
            state.events.some(e => e.id === id)
        ).length;
        if (elements.aiAnalyzed) elements.aiAnalyzed.textContent = aiCount;
    }

    /**
     * Show error message
     */
    function showError(message) {
        if (elements.eventList) {
            elements.eventList.innerHTML = `
                <div class="surv-empty-state">
                    <svg class="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <span class="text-sm text-red-400">${message}</span>
                    <button onclick="window.surveillance.refresh()" class="mt-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs">
                        Retry
                    </button>
                </div>
            `;
        }
        if (elements.lastUpdate) {
            elements.lastUpdate.textContent = 'Connection error';
            elements.lastUpdate.classList.add('text-red-400');
        }
    }

    /**
     * Load AI analysis from localStorage
     * AI analysis is stored when notifications are received
     */
    function loadAiAnalysis() {
        try {
            const stored = localStorage.getItem('surveillance_ai_analysis');
            if (stored) {
                state.aiAnalysis = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('[Surveillance] Failed to load AI analysis:', e);
        }
    }

    /**
     * Save AI analysis to localStorage
     */
    function saveAiAnalysis(eventId, analysis) {
        state.aiAnalysis[eventId] = analysis;
        try {
            localStorage.setItem('surveillance_ai_analysis', JSON.stringify(state.aiAnalysis));
        } catch (e) {
            console.warn('[Surveillance] Failed to save AI analysis:', e);
        }
    }

    /**
     * Called when view is shown
     */
    function onViewShow() {
        console.log('[Surveillance] View shown, starting updates...');
        startSnapshotRefresh();
        startAutoRefresh();
        loadEvents();
        loadCameraStats();
        renderTimelineGraph();
    }

    /**
     * Called when view is hidden
     */
    function onViewHide() {
        console.log('[Surveillance] View hidden, stopping updates...');
        stopSnapshotRefresh();
        stopAutoRefresh();
    }

    // Public API
    return {
        init,
        refresh,
        setTimeFilter,
        setObjectFilter,
        filterByCamera,
        filterByTimeSlot,
        selectEvent,
        playClip,
        closeVideoModal,
        openInFrigate,
        downloadClip,
        saveAiAnalysis,
        onViewShow,
        onViewHide,
        openCamera,
        closeCamera,
        switchCamera,
        openCameraInFrigate
    };
})();

// Expose to global scope for onclick handlers
window.surveillance = SurveillanceDashboard;

// Initialize when surveillance view is loaded dynamically
window.addEventListener('viewLoaded', (e) => {
    if (e.detail?.viewName === 'surveillance') {
        console.log('[Surveillance] View loaded, initializing...');
        SurveillanceDashboard.init();
    }
});

// Also check if view already exists (legacy/fallback)
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('view-surveillance')) {
        SurveillanceDashboard.init();
    }
});
