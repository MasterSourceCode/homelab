/**
 * Media Portal Module v3
 * Intelligent library with TMDB integration
 * - Currently Watching: Scraped shows only
 * - Library: New releases (last 3 months, rating > 8)
 */

import { state } from './state.js';
import { callService } from './api.js';
import { FIRE_TV_DEVICES, DEFAULT_FIRE_TV, STREAMING_SERVICES, CINEMA_MODE_LIGHTS, MEDIA_CONFIG, NETFLIX_IDS } from './config.js';

// ============================================
// STATE
// ============================================

let watchlistData = null;
let selectedShowId = null;
let selectedSeason = 1;
let selectedEpisode = 1;
let deviceDropdownOpen = false;
let currentView = 'all'; // 'all', 'movies', 'series'

// ============================================
// DOM HELPERS
// ============================================

const $ = id => document.getElementById(id);
const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };
const setHTML = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
const show = id => { const el = $(id); if (el) el.classList.remove('hidden'); };
const hide = id => { const el = $(id); if (el) el.classList.add('hidden'); };
const toggleClass = (el, cls, add) => { if (el) el.classList.toggle(cls, add); };

// ============================================
// INITIALIZATION
// ============================================

export async function initMediaPortal() {
    await loadWatchlist();
    renderContinueWatching();
    renderLibrary();
    updateDeviceStatus();

    // Auto-select the Living Room Fire TV
    if (!state.mediaState?.selectedDevice) {
        selectDevice(DEFAULT_FIRE_TV);
    }
}

export async function loadWatchlist() {
    try {
        const response = await fetch(MEDIA_CONFIG.watchlistPath + '?t=' + Date.now());
        if (response.ok) {
            watchlistData = await response.json();
            console.log('Loaded watchlist v' + watchlistData.version);
        }
    } catch (error) {
        console.error('Failed to load watchlist:', error);
        watchlistData = { currentlyWatching: [], library: { movies: [], series: [] } };
    }
}

// ============================================
// CONTINUE WATCHING (Scraped Shows Only)
// ============================================

function renderContinueWatching() {
    const container = $('continueWatchingRow');
    const section = $('continueWatchingSection');
    if (!container) return;

    const watching = watchlistData?.currentlyWatching || [];

    // Show all Continue Watching items (not just those with progress)
    const inProgress = watching
        .sort((a, b) => new Date(b.lastWatched || 0) - new Date(a.lastWatched || 0));

    if (inProgress.length === 0) {
        if (section) section.classList.add('hidden');
        return;
    }

    if (section) section.classList.remove('hidden');

    container.innerHTML = inProgress.map(show => {
        const service = STREAMING_SERVICES[show.service] || STREAMING_SERVICES.unknown;
        const episodeText = show.type === 'series'
            ? `S${show.currentSeason}:E${show.currentEpisode}`
            : show.progress > 0 ? `${Math.round(show.progress)}% watched` : 'Start watching';

        return `
            <div class="media-continue-card">
                <div class="media-continue-image" onclick="window.dashboard.openShowDetail('${show.id}')">
                    <img src="${show.backdropUrl || show.posterUrl}" alt="${show.title}"
                        onerror="this.src='${show.posterUrl}'">

                    <!-- Service badge -->
                    <div class="media-continue-service" style="background: ${service.color}">
                        ${service.name}
                    </div>

                    <div class="media-continue-overlay">
                        <div class="media-continue-info">
                            <div class="media-continue-play">
                                <svg fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                            <div class="media-continue-text">
                                <h4>${show.title}</h4>
                                <p>${episodeText}</p>
                            </div>
                        </div>
                    </div>
                    <div class="media-continue-progress">
                        <div class="media-continue-progress-fill" style="width: ${show.progress || 0}%"></div>
                    </div>
                </div>

                <!-- Quick Resume Button -->
                <button onclick="event.stopPropagation(); window.dashboard.quickResume('${show.id}')"
                    class="media-quick-resume" title="Quick Resume ${show.title}">
                    <svg fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>
            </div>
        `;
    }).join('');
}

// ============================================
// NEW RELEASES (Popular + Top Rated)
// ============================================

function renderLibrary() {
    renderLibraryTabs();
    renderLibraryContent();
}

function renderLibraryTabs() {
    const tabsContainer = $('libraryTabs');
    if (!tabsContainer) return;

    const movies = watchlistData?.newReleases?.movies || [];
    const series = watchlistData?.newReleases?.series || [];

    tabsContainer.innerHTML = `
        <button onclick="window.dashboard.setLibraryView('all')"
            class="library-tab ${currentView === 'all' ? 'active' : ''}">
            All <span class="tab-count">${movies.length + series.length}</span>
        </button>
        <button onclick="window.dashboard.setLibraryView('movies')"
            class="library-tab ${currentView === 'movies' ? 'active' : ''}">
            Movies <span class="tab-count">${movies.length}</span>
        </button>
        <button onclick="window.dashboard.setLibraryView('series')"
            class="library-tab ${currentView === 'series' ? 'active' : ''}">
            Series <span class="tab-count">${series.length}</span>
        </button>
    `;
}

export function setLibraryView(view) {
    currentView = view;
    renderLibraryTabs();
    renderLibraryContent();
}

function renderLibraryContent() {
    const container = $('mediaPosterGrid');
    if (!container) return;

    const movies = watchlistData?.newReleases?.movies || [];
    const series = watchlistData?.newReleases?.series || [];

    let items = [];
    if (currentView === 'all') {
        items = [...movies, ...series].sort((a, b) =>
            parseFloat(b.imdbRating || 0) - parseFloat(a.imdbRating || 0)
        );
    } else if (currentView === 'movies') {
        items = movies;
    } else {
        items = series;
    }

    if (items.length === 0) {
        container.innerHTML = `
            <div class="media-empty-state">
                <svg class="w-16 h-16 text-white/20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/>
                </svg>
                <p class="text-white/40">No ${currentView === 'movies' ? 'movies' : 'series'} found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => renderPosterCard(item)).join('');
}

function renderPosterCard(item) {
    const service = STREAMING_SERVICES[item.service] || { icon: '?', color: '#666', name: 'Unknown' };
    const rating = item.imdbRating || '?';
    const isMovie = item.type === 'movie';
    const seasonInfo = !isMovie && item.latestSeason ? `S${item.latestSeason}` : '';
    const runtime = isMovie && item.runtime ? formatRuntime(item.runtime) : '';

    return `
        <div onclick="window.dashboard.openShowDetail('${item.id}')" class="media-poster-card">
            <div class="media-poster-image">
                <img src="${item.posterUrl}" alt="${item.title}" loading="lazy"
                    onerror="this.parentElement.classList.add('loading'); this.style.opacity='0'">

                <!-- Service badge (top-left) -->
                <div class="media-service-badge" style="background: ${service.color}">
                    ${service.icon}
                </div>

                <!-- Rating badge (top-right) -->
                <div class="media-rating-badge ${parseFloat(rating) >= 7.5 ? 'high' : parseFloat(rating) >= 6 ? 'medium' : ''}">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    ${rating}
                </div>

                <!-- Play overlay -->
                <div class="media-poster-overlay">
                    <div class="media-play-icon">
                        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <div class="media-poster-info">
                        <span class="media-poster-genre">${item.genres?.[0] || ''}</span>
                        ${runtime ? `<span class="media-poster-runtime">${runtime}</span>` : ''}
                        ${seasonInfo ? `<span class="media-poster-seasons">${seasonInfo}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="media-poster-title">${item.title}</div>
            <div class="media-poster-meta">
                <span>${item.year}</span>
                ${item.genres?.[0] ? `<span class="dot"></span><span>${item.genres[0]}</span>` : ''}
                ${isMovie && item.director ? `<span class="dot"></span><span class="director">${item.director}</span>` : ''}
            </div>
        </div>
    `;
}

function formatRuntime(minutes) {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ============================================
// DEVICE MANAGEMENT
// ============================================

export function toggleDeviceDropdown() {
    deviceDropdownOpen = !deviceDropdownOpen;
    const dropdown = $('mediaDeviceDropdown');
    if (dropdown) {
        toggleClass(dropdown, 'hidden', !deviceDropdownOpen);
    }

    if (deviceDropdownOpen) {
        setTimeout(() => {
            document.addEventListener('click', closeDeviceDropdownOutside, { once: true });
        }, 0);
    }
}

function closeDeviceDropdownOutside(e) {
    const dropdown = $('mediaDeviceDropdown');
    const btn = $('mediaDeviceBtn');
    if (dropdown && !dropdown.contains(e.target) && !btn?.contains(e.target)) {
        deviceDropdownOpen = false;
        dropdown.classList.add('hidden');
    }
}

export function selectDevice(deviceId) {
    const device = FIRE_TV_DEVICES[deviceId];
    if (!device) return;

    if (!state.mediaState) state.mediaState = {};
    state.mediaState.selectedDevice = deviceId;

    setText('selectedDeviceName', device.name);

    document.querySelectorAll('.media-device-option').forEach(el => {
        toggleClass(el, 'selected', el.dataset.device === deviceId);
    });

    deviceDropdownOpen = false;
    hide('mediaDeviceDropdown');

    updateDeviceStatus();
}

export function updateDeviceStatus() {
    Object.entries(FIRE_TV_DEVICES).forEach(([id, device]) => {
        const entityState = state.getEntity(device.entityId);
        const statusEl = $(`device-status-${id}`);
        const dotEl = $(`device-dot-${id}`);

        if (statusEl && dotEl) {
            if (entityState?.state === 'on' || entityState?.state === 'playing') {
                statusEl.textContent = entityState.state === 'playing' ? 'Playing' : 'Ready';
                dotEl.className = 'w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0';
            } else if (entityState?.state === 'idle' || entityState?.state === 'standby' || entityState?.state === 'paused') {
                statusEl.textContent = 'Standby';
                dotEl.className = 'w-2 h-2 rounded-full bg-amber-500 flex-shrink-0';
            } else {
                statusEl.textContent = entityState?.state || 'Offline';
                dotEl.className = 'w-2 h-2 rounded-full bg-white/30 flex-shrink-0';
            }
        }
    });
}

// ============================================
// SHOW DETAIL MODAL
// ============================================

export function openShowDetail(showId) {
    // Find show in currentlyWatching or newReleases
    let show = findShowById(showId);
    if (!show) return;

    selectedShowId = showId;
    selectedSeason = show.currentSeason || show.latestSeason || 1;
    selectedEpisode = show.currentEpisode || 1;

    // Update backdrop
    const backdrop = $('mediaBackdrop');
    if (backdrop) {
        backdrop.style.backgroundImage = `url('${show.backdropUrl || show.posterUrl}')`;
        backdrop.classList.add('active');
    }

    // Update hero image
    const hero = $('mediaDetailHero');
    if (hero) {
        hero.style.backgroundImage = `url('${show.backdropUrl || show.posterUrl}')`;
    }

    // Update info
    setText('mediaDetailTitle', show.title);
    setText('mediaDetailYear', show.year);
    setText('mediaDetailRating', show.rating || 'NR');
    setText('mediaDetailDuration', formatDuration(show));
    setText('mediaDetailImdbScore', show.imdbRating || '?');

    // Tagline
    const taglineEl = $('mediaDetailTagline');
    if (taglineEl) {
        taglineEl.textContent = show.tagline || '';
        toggleClass(taglineEl, 'hidden', !show.tagline);
    }

    // Overview
    const overviewEl = $('mediaDetailOverview');
    if (overviewEl) {
        overviewEl.textContent = show.overview || '';
    }

    // Service badge
    const service = STREAMING_SERVICES[show.service];
    const serviceBadge = $('mediaDetailService');
    if (serviceBadge && service) {
        serviceBadge.style.background = service.color;
        serviceBadge.textContent = service.name;
    }

    // Genres
    const genresEl = $('mediaDetailGenres');
    if (genresEl && show.genres) {
        genresEl.innerHTML = show.genres.map(g => `
            <span class="media-genre-tag">${g}</span>
        `).join('');
    }

    // Director/Creators
    const directorEl = $('mediaDetailDirector');
    if (directorEl) {
        if (show.type === 'movie' && show.director) {
            directorEl.innerHTML = `<span class="credit-label">Director:</span> <span class="credit-value">${show.director}</span>`;
            directorEl.classList.remove('hidden');
        } else if (show.type === 'series' && show.creators?.length > 0) {
            directorEl.innerHTML = `<span class="credit-label">Created by:</span> <span class="credit-value">${show.creators.join(', ')}</span>`;
            directorEl.classList.remove('hidden');
        } else {
            directorEl.classList.add('hidden');
        }
    }

    // Cast
    const castEl = $('mediaDetailCast');
    if (castEl && show.cast?.length > 0) {
        castEl.innerHTML = `<span class="credit-label">Starring:</span> <span class="credit-value">${show.cast.slice(0, 4).join(', ')}</span>`;
        castEl.classList.remove('hidden');
    } else if (castEl) {
        castEl.classList.add('hidden');
    }

    // Trailer button
    const trailerBtn = $('mediaTrailerBtn');
    if (trailerBtn) {
        if (show.trailerKey) {
            trailerBtn.classList.remove('hidden');
            trailerBtn.dataset.trailerKey = show.trailerKey;
        } else {
            trailerBtn.classList.add('hidden');
        }
    }

    // Episode section (series only)
    const episodeSection = $('mediaEpisodeSection');
    if (show.type === 'series' && show.seasons?.length > 0) {
        if (episodeSection) episodeSection.classList.remove('hidden');
        renderSeasonSelector(show);
        renderEpisodeGrid(show, selectedSeason);
    } else {
        if (episodeSection) episodeSection.classList.add('hidden');
    }

    // Update play button
    updatePlayButton(show);

    // Show modal
    const modal = $('mediaDetailModal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

export function closeShowDetail() {
    const modal = $('mediaDetailModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }

    const backdrop = $('mediaBackdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
    }

    selectedShowId = null;
}

function renderSeasonSelector(show) {
    const selector = $('mediaSeasonSelect');
    if (!selector || !show.seasons) return;

    selector.innerHTML = show.seasons.map(s => `
        <option value="${s.season}" ${s.season === selectedSeason ? 'selected' : ''}>
            Season ${s.season}
        </option>
    `).join('');
}

export function selectSeason(seasonNum) {
    selectedSeason = parseInt(seasonNum);
    const show = findShowById(selectedShowId);
    if (show) {
        renderEpisodeGrid(show, selectedSeason);
    }
}

function renderEpisodeGrid(show, seasonNum) {
    const grid = $('mediaEpisodeGrid');
    if (!grid || !show.seasons) return;

    const season = show.seasons.find(s => s.season === seasonNum);
    if (!season?.episodes) return;

    grid.innerHTML = season.episodes.map(ep => {
        const isSelected = ep.episode === selectedEpisode && seasonNum === selectedSeason;
        const hasProgress = ep.progress > 0 && ep.progress < 100;

        return `
            <div onclick="window.dashboard.selectEpisode(${seasonNum}, ${ep.episode})"
                class="media-episode-card ${isSelected ? 'selected' : ''} ${ep.watched ? 'watched' : ''}">
                <div class="media-episode-header">
                    <span class="media-episode-number">E${ep.episode}</span>
                    ${ep.watched ? `
                        <svg class="media-episode-check" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                    ` : ''}
                </div>
                <div class="media-episode-title">${ep.title}</div>
                <div class="media-episode-duration">${ep.duration}m</div>
                ${hasProgress ? `
                    <div class="media-episode-progress">
                        <div class="media-episode-progress-fill" style="width: ${ep.progress}%"></div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

export function selectEpisode(season, episode) {
    selectedSeason = season;
    selectedEpisode = episode;

    const show = findShowById(selectedShowId);
    if (show) {
        if (show.currentSeason !== undefined) {
            show.currentSeason = season;
            show.currentEpisode = episode;
        }
        renderEpisodeGrid(show, season);
        updatePlayButton(show);
    }
}

function updatePlayButton(show) {
    const text = $('mediaPlayBtnText');
    if (!text) return;

    if (show.type === 'series') {
        const ep = getCurrentEpisode(show);
        if (ep?.progress > 0 && ep.progress < 100) {
            text.textContent = `Resume S${selectedSeason}:E${selectedEpisode}`;
        } else {
            text.textContent = `Play S${selectedSeason}:E${selectedEpisode}`;
        }
    } else {
        text.textContent = show.progress > 0 && show.progress < 100 ? 'Resume' : 'Play';
    }
}

function getCurrentEpisode(show) {
    if (show.type !== 'series' || !show.seasons) return null;
    const season = show.seasons.find(s => s.season === selectedSeason);
    return season?.episodes?.find(e => e.episode === selectedEpisode);
}

function findShowById(showId) {
    let show = watchlistData?.currentlyWatching?.find(s => s.id === showId);
    if (!show) show = watchlistData?.newReleases?.movies?.find(s => s.id === showId);
    if (!show) show = watchlistData?.newReleases?.series?.find(s => s.id === showId);
    return show;
}

function formatDuration(show) {
    if (show.type === 'series') {
        const totalSeasons = show.totalSeasons || show.seasons?.length || 0;
        return `${totalSeasons} Season${totalSeasons !== 1 ? 's' : ''}`;
    }
    if (!show.duration) return '';
    const hours = Math.floor(show.duration / 60);
    const mins = show.duration % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

// ============================================
// CINEMA MODE
// ============================================

export function toggleCinemaMode() {
    if (!state.mediaState) state.mediaState = {};
    const isActive = state.mediaState.cinemaModeActive;

    if (isActive) {
        exitCinemaMode();
    } else {
        enterCinemaMode();
    }
}

function enterCinemaMode() {
    const previousStates = {};
    CINEMA_MODE_LIGHTS.forEach(entityId => {
        const entity = state.getEntity(entityId);
        previousStates[entityId] = entity?.state;
    });
    state.mediaState.previousLightStates = previousStates;

    CINEMA_MODE_LIGHTS.forEach(entityId => {
        const entity = state.getEntity(entityId);
        if (entity?.state === 'on') {
            const domain = entityId.split('.')[0];
            callService(domain, 'turn_off', { entity_id: entityId });
        }
    });

    state.mediaState.cinemaModeActive = true;
    updateCinemaModeUI(true);
}

function exitCinemaMode() {
    const previousStates = state.mediaState?.previousLightStates || {};
    Object.entries(previousStates).forEach(([entityId, wasOn]) => {
        if (wasOn === 'on') {
            const domain = entityId.split('.')[0];
            callService(domain, 'turn_on', { entity_id: entityId });
        }
    });

    state.mediaState.cinemaModeActive = false;
    updateCinemaModeUI(false);
}

function updateCinemaModeUI(active) {
    const btn = $('mediaCinemaBtn');
    const indicator = $('mediaCinemaIndicator');
    const view = $('view-media');

    if (btn) toggleClass(btn, 'active', active);

    if (indicator) {
        indicator.className = active
            ? 'w-2 h-2 rounded-full bg-amber-500 animate-pulse'
            : 'w-2 h-2 rounded-full bg-white/30';
    }

    if (view) toggleClass(view, 'cinema-active', active);
}

// ============================================
// PLAYBACK CONTROL
// ============================================

export async function playMedia() {
    const deviceId = state.mediaState?.selectedDevice;
    const show = findShowById(selectedShowId);

    if (!deviceId) {
        toggleDeviceDropdown();
        return;
    }

    if (!show) return;

    const device = FIRE_TV_DEVICES[deviceId];
    const service = STREAMING_SERVICES[show.service] || STREAMING_SERVICES.unknown;

    if (!device) return;

    try {
        // Enable Cinema Mode if configured
        if (watchlistData?.preferences?.cinemaModeEnabled && !state.mediaState?.cinemaModeActive) {
            enterCinemaMode();
        }

        // Wake/Power on the Fire TV
        await wakeFireTV(device.entityId);
        await delay(2000);

        // For WP Watchlist Pro - use automated navigation
        if (show.service === 'watchlist_pro') {
            await playViaWatchlistPro(device.entityId, show);
        }
        // For Netflix, use deep linking
        else if (show.service === 'netflix' && service.episodeDeepLink) {
            const netflixId = show.netflixId || NETFLIX_IDS[show.id];
            if (netflixId) {
                const command = service.episodeDeepLink
                    .replace('{netflixId}', netflixId)
                    .replace('{season}', selectedSeason)
                    .replace('{episode}', selectedEpisode);
                console.log('Netflix deep link:', command);
                await launchApp(device.entityId, command);
            }
        }
        // Fall back to basic app launch
        else if (service.launchIntent) {
            await launchApp(device.entityId, service.launchIntent);
        }

        // Update watch data
        show.lastWatched = new Date().toISOString();
        if (show.currentSeason !== undefined) {
            show.currentSeason = selectedSeason;
            show.currentEpisode = selectedEpisode;
        }

        closeShowDetail();

    } catch (error) {
        console.error('Playback failed:', error);
    }
}

// Simple ADB playback for WP Watchlist Pro
// Workflow: force close → open app → scroll down 3x → click → play
async function playViaWatchlistPro(entityId, show) {
    console.log('Starting WP Watchlist Pro via ADB:', show.title);

    try {
        // Step 1: Force close the app
        await sendAdbCommand(entityId, 'am force-stop com.vod.watchlist.tvapp');
        await delay(1000);

        // Step 2: Open the app
        await sendAdbCommand(entityId, 'am start -n com.vod.watchlist.tvapp/.home.HomeActivity');
        await delay(3000); // Wait for app to load

        // Step 3: Scroll down 3 times to navigate to content
        for (let i = 0; i < 3; i++) {
            await sendAdbCommand(entityId, 'input keyevent KEYCODE_DPAD_DOWN');
            await delay(300);
        }

        // Step 4: Click to select
        await sendAdbCommand(entityId, 'input keyevent KEYCODE_DPAD_CENTER');
        await delay(1500);

        // Step 5: Click play
        await sendAdbCommand(entityId, 'input keyevent KEYCODE_DPAD_CENTER');

        console.log('WP Watchlist Pro: Navigation complete');
    } catch (error) {
        console.error('WP Watchlist Pro ADB error:', error);
    }
}

async function sendAdbCommand(entityId, command) {
    return callService('androidtv', 'adb_command', {
        entity_id: entityId,
        command: command
    });
}

async function wakeFireTV(entityId) {
    const currentState = state.getEntity(entityId);

    if (!currentState || currentState.state === 'off' || currentState.state === 'standby') {
        callService('media_player', 'turn_on', { entity_id: entityId });
        await delay(3000);
    }
}

async function launchApp(entityId, launchIntent) {
    callService('androidtv', 'adb_command', {
        entity_id: entityId,
        command: launchIntent
    });
}

// ============================================
// UTILITIES
// ============================================

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function addNewShow() {
    console.log('Add new show - refreshing library');
    alert('Library refreshes automatically daily. Shows appear when new high-rated content is released.');
}

export function playTrailer() {
    const trailerBtn = $('mediaTrailerBtn');
    const trailerKey = trailerBtn?.dataset.trailerKey;

    if (trailerKey) {
        // Open YouTube trailer in new tab
        window.open(`https://www.youtube.com/watch?v=${trailerKey}`, '_blank');
    }
}

// Quick Resume - directly launch playback without opening detail modal
export async function quickResume(showId) {
    const show = findShowById(showId);
    if (!show) {
        console.error('Show not found:', showId);
        return;
    }

    const deviceId = selectedDevice || DEFAULT_FIRE_TV;
    const device = FIRE_TV_DEVICES[deviceId];
    const service = STREAMING_SERVICES[show.service] || STREAMING_SERVICES.unknown;

    if (!device) return;

    console.log(`Quick Resume: ${show.title} via ${service.name}`);

    try {
        // Wake Fire TV
        await wakeFireTV(device.entityId);
        await delay(2000);

        // Enable Cinema Mode if configured
        if (watchlistData?.preferences?.cinemaModeEnabled && !state.mediaState?.cinemaModeActive) {
            enterCinemaMode();
        }

        // Route to appropriate service
        if (show.service === 'watchlist_pro') {
            await resumeWatchlistPro(device.entityId);
        } else if (show.service === 'netflix') {
            // For Netflix, try deep link to resume
            const netflixId = show.netflixId || NETFLIX_IDS[show.id];
            if (netflixId && service.episodeDeepLink) {
                const command = service.episodeDeepLink
                    .replace('{netflixId}', netflixId)
                    .replace('{season}', show.currentSeason || 1)
                    .replace('{episode}', show.currentEpisode || 1);
                await launchApp(device.entityId, command);
            } else {
                await launchApp(device.entityId, service.launchIntent);
            }
        } else if (service.launchIntent) {
            await launchApp(device.entityId, service.launchIntent);
        }

        // Update last watched
        show.lastWatched = new Date().toISOString();

    } catch (error) {
        console.error('Quick Resume failed:', error);
    }
}

// Resume WP Watchlist Pro - optimized for Continue Watching
async function resumeWatchlistPro(entityId) {
    console.log('Resuming WP Watchlist Pro...');

    try {
        // Step 1: Force close to ensure clean state
        await sendAdbCommand(entityId, 'am force-stop com.vod.watchlist.tvapp');
        await delay(1000);

        // Step 2: Open the app
        await sendAdbCommand(entityId, 'am start -n com.vod.watchlist.tvapp/.home.HomeActivity');
        await delay(4000); // Wait for app to fully load

        // Step 3: Navigate to Continue Watching (usually first row)
        // Press DOWN once to ensure focus is on content row (not top menu)
        await sendAdbCommand(entityId, 'input keyevent KEYCODE_DPAD_DOWN');
        await delay(500);

        // Step 4: Select the first item (most recently watched)
        await sendAdbCommand(entityId, 'input keyevent KEYCODE_DPAD_CENTER');
        await delay(2000);

        // Step 5: Press play/enter to resume
        await sendAdbCommand(entityId, 'input keyevent KEYCODE_DPAD_CENTER');

        console.log('WP Watchlist Pro: Resume initiated');
    } catch (error) {
        console.error('WP Watchlist Pro resume error:', error);
    }
}

// Note: All functions are exported at their declarations above
