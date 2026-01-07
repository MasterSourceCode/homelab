/**
 * Google Calendar API Module
 * Handles OAuth and CRUD operations for calendar events
 */

import { GOOGLE_OAUTH_CONFIG, FAMILY_MEMBERS, CALENDAR_ID } from './google-oauth-config.js';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

// ============================================
// TOKEN MANAGEMENT
// ============================================

export function getStoredTokens() {
    const stored = localStorage.getItem('google_calendar_tokens');
    return stored ? JSON.parse(stored) : null;
}

export function isAuthenticated() {
    const tokens = getStoredTokens();
    return tokens && tokens.access_token;
}

export function isTokenExpired() {
    const tokens = getStoredTokens();
    if (!tokens) return true;
    // Consider expired 5 minutes before actual expiry
    return Date.now() > (tokens.expires_at - 300000);
}

export async function refreshAccessToken() {
    const tokens = getStoredTokens();
    if (!tokens?.refresh_token) {
        throw new Error('No refresh token available');
    }

    const response = await fetch(GOOGLE_OAUTH_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            refresh_token: tokens.refresh_token,
            client_id: GOOGLE_OAUTH_CONFIG.clientId,
            client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
            grant_type: 'refresh_token'
        })
    });

    if (!response.ok) {
        localStorage.removeItem('google_calendar_tokens');
        throw new Error('Failed to refresh token');
    }

    const newTokens = await response.json();

    const updatedTokens = {
        ...tokens,
        access_token: newTokens.access_token,
        expires_at: Date.now() + (newTokens.expires_in * 1000)
    };

    localStorage.setItem('google_calendar_tokens', JSON.stringify(updatedTokens));
    return updatedTokens;
}

async function getValidAccessToken() {
    if (!isAuthenticated()) {
        throw new Error('Not authenticated');
    }

    if (isTokenExpired()) {
        const tokens = await refreshAccessToken();
        return tokens.access_token;
    }

    return getStoredTokens().access_token;
}

// ============================================
// AUTHENTICATION FLOW
// ============================================

export function initiateOAuthFlow() {
    // Store current URL to return after auth
    localStorage.setItem('oauth_return_url', window.location.href);

    const params = new URLSearchParams({
        client_id: GOOGLE_OAUTH_CONFIG.clientId,
        redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
        response_type: 'code',
        scope: GOOGLE_OAUTH_CONFIG.scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent'
    });

    window.location.href = `${GOOGLE_OAUTH_CONFIG.authEndpoint}?${params}`;
}

export function logout() {
    localStorage.removeItem('google_calendar_tokens');
}

// ============================================
// CALENDAR API CALLS
// ============================================

async function apiRequest(endpoint, options = {}) {
    const accessToken = await getValidAccessToken();

    const response = await fetch(`${CALENDAR_API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `API Error: ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return null;
    }

    return response.json();
}

// ============================================
// EVENT OPERATIONS
// ============================================

/**
 * List events from calendar
 */
export async function listEvents(timeMin, timeMax) {
    const params = new URLSearchParams({
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250'
    });

    return apiRequest(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`);
}

/**
 * Get a single event
 */
export async function getEvent(eventId) {
    return apiRequest(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}`);
}

/**
 * Create a new event
 */
export async function createEvent(eventData) {
    const event = formatEventForApi(eventData);

    return apiRequest(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events`, {
        method: 'POST',
        body: JSON.stringify(event)
    });
}

/**
 * Update an existing event
 */
export async function updateEvent(eventId, eventData) {
    const event = formatEventForApi(eventData);

    return apiRequest(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify(event)
    });
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId) {
    return apiRequest(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}`, {
        method: 'DELETE'
    });
}

// ============================================
// EVENT FORMATTING
// ============================================

function formatEventForApi(eventData) {
    const event = {
        summary: eventData.title,
        description: eventData.description || '',
        location: eventData.location || ''
    };

    // Add family member to description as a tag
    if (eventData.assignee && eventData.assignee !== 'everyone') {
        const member = FAMILY_MEMBERS[eventData.assignee];
        if (member) {
            event.description = `[${member.name}] ${event.description}`;
        }
    }

    // Set color based on family member
    if (eventData.assignee && FAMILY_MEMBERS[eventData.assignee]) {
        event.colorId = FAMILY_MEMBERS[eventData.assignee].colorId;
    }

    // Handle all-day vs timed events
    if (eventData.allDay) {
        event.start = { date: eventData.startDate };
        event.end = { date: eventData.endDate || eventData.startDate };
    } else {
        event.start = {
            dateTime: eventData.startDateTime,
            timeZone: 'Africa/Johannesburg'
        };
        event.end = {
            dateTime: eventData.endDateTime,
            timeZone: 'Africa/Johannesburg'
        };
    }

    return event;
}

/**
 * Parse event from API format to our format
 */
export function parseEventFromApi(event) {
    // Try to extract assignee from description
    let assignee = 'everyone';
    let description = event.description || '';

    const memberMatch = description.match(/^\[(\w+)\]\s*/);
    if (memberMatch) {
        const memberName = memberMatch[1].toLowerCase();
        if (FAMILY_MEMBERS[memberName]) {
            assignee = memberName;
            description = description.replace(memberMatch[0], '');
        } else {
            // Check by display name
            for (const [key, member] of Object.entries(FAMILY_MEMBERS)) {
                if (member.name.toLowerCase() === memberName) {
                    assignee = key;
                    description = description.replace(memberMatch[0], '');
                    break;
                }
            }
        }
    }

    // Also check colorId to determine assignee
    if (event.colorId) {
        for (const [key, member] of Object.entries(FAMILY_MEMBERS)) {
            if (member.colorId === event.colorId) {
                assignee = key;
                break;
            }
        }
    }

    const isAllDay = !event.start.dateTime;

    return {
        id: event.id,
        title: event.summary || 'Untitled',
        description: description,
        location: event.location || '',
        assignee: assignee,
        allDay: isAllDay,
        startDate: isAllDay ? event.start.date : null,
        endDate: isAllDay ? event.end.date : null,
        startDateTime: !isAllDay ? event.start.dateTime : null,
        endDateTime: !isAllDay ? event.end.dateTime : null,
        colorId: event.colorId,
        htmlLink: event.htmlLink
    };
}

// ============================================
// FAMILY MEMBER HELPERS
// ============================================

export function getFamilyMemberByColorId(colorId) {
    for (const [key, member] of Object.entries(FAMILY_MEMBERS)) {
        if (member.colorId === colorId) {
            return { key, ...member };
        }
    }
    return { key: 'everyone', ...FAMILY_MEMBERS.everyone };
}

export function getFamilyMembers() {
    return FAMILY_MEMBERS;
}
