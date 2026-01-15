/**
 * Calendar Cleanup Script
 *
 * This script:
 * 1. Deletes OLD recurring events that have duplicates with wrong colors
 * 2. Fixes colors on standalone events that are still wrong
 * 3. Makes standalone events into weekly recurring until Nov 30, 2026
 * 4. Updates colors on recurring-only events that have wrong colors
 *
 * Run in browser console after signing in to Google Calendar.
 */

const CALENDAR_ID = 'familypapaninis@gmail.com';
const RECURRENCE_END = '20261130T235959Z';

// IDs of old recurring events to delete (have duplicates)
const RECURRING_TO_DELETE = [
    '7nfaqe232pkmqgr4e171qib7m7',  // Ballet
    '7v3jeaj7hfvkbo61oil2gn9veq',  // Ballet
    '20g1gqeesso1g4n25bh0m0qg8r',  // Ballet Academy
    '3bjc7q3f9eor2nkdi2ap51b8pn',  // Band - Mila
    '467deln8hocamfemqopb7rqatr',  // Chess - Mila
    'v7gpub962tgg6nn9jgds1vgu80',  // Chess Practice - Mila
    '1ddehijqhqom03etvre0r6m9ru',  // Choir
    '309ci8qi13ciq1usdb91kvlf9g',  // First Team Chess Match - Alexandra
    '6cff0qslsmlil6drn5b7dg7ie8',  // First Team Chess Practice - Alexandra
    '0qdjcosc70nqlr2spdbspl3999',  // Greek Dancing
    '103ooac5d3teeft7ckophdjjmf',  // Gymnastics
    '5294j039dh7lujnd5u69oavlo5',  // Horseriding
    '4ph0levl29sjkn4uagnlvrs2d0',  // MUN
    '0i1n1of9a12jbpfs64kc3hke04',  // MUN & Debating - Mila
    '4j8f6cvmt1khige0j8725th7eb',  // Masters Swimming - Tatiana
    's9oclo6hkhdhjve15pm3rsj7m0',  // Public Speaking - Alexandra
    '6is6dlvq6fp96bqve1eube17no',  // Public Speaking - Mila
    '1au7g20hbuuf4ga773k4mlmojk',  // Tennis Practice - Mila
    'itkn5lg3i00gf1fh8ioafqv3no',  // Tennis Practice - Mila
    '44urhc6tqing2m3tu1scrgjn2p',  // Wits Maths
];

// Correct color mapping
const CORRECT_COLORS = {
    'mila': '2',      // Green
    'alexandra': '9', // Blue
    'tatiana': '6',   // Orange
    'nico': '8',      // Grey
    'both_girls': '4', // Pink
    'parents': '10',  // Dark
    'everyone': '11', // Red
};

function getCorrectColor(eventName) {
    const name = eventName.toLowerCase();
    if (name.includes('alexandra')) return '9';
    if (name.includes('mila')) return '2';
    if (name.includes('tatiana')) return '6';
    if (name.includes('nico')) return '8';
    // Shared activities - Both Girls
    if (['greek dancing', 'wits maths'].includes(eventName.toLowerCase().trim())) return '4';
    // Other shared - default to Both Girls
    if (['ballet', 'ballet academy', 'choir', 'horseriding ', 'gymnastics', 'mun'].includes(eventName.toLowerCase().trim())) return '4';
    return null; // Unknown
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function apiCall(url, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
        const res = await fetch(url, options);
        if (res.ok) return { ok: true, data: await res.json().catch(() => ({})) };
        if (res.status === 403 || res.status === 429) {
            const wait = 2000 * Math.pow(2, i + 1);
            console.log(`  Rate limited, waiting ${wait/1000}s...`);
            await sleep(wait);
            continue;
        }
        return { ok: false, status: res.status, error: await res.text() };
    }
    return { ok: false, error: 'Max retries exceeded' };
}

async function cleanupCalendar() {
    const tokens = JSON.parse(localStorage.getItem('google_calendar_tokens') || 'null');
    if (!tokens?.access_token) {
        console.error('Not authenticated. Please sign in first.');
        return { success: false, error: 'Not authenticated' };
    }

    const results = {
        deleted: 0,
        delete_errors: 0,
        color_fixed: 0,
        color_errors: 0,
        made_recurring: 0,
        recurring_errors: 0,
    };

    // Step 1: Delete old recurring events
    console.log('=== Step 1: Deleting old recurring events with duplicates ===');
    for (const eventId of RECURRING_TO_DELETE) {
        console.log(`Deleting ${eventId}...`);
        const res = await apiCall(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}`,
            {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            }
        );
        if (res.ok || res.status === 404 || res.status === 410) {
            results.deleted++;
            console.log(`  ✓ Deleted`);
        } else {
            results.delete_errors++;
            console.error(`  ✗ Error:`, res.error);
        }
        await sleep(600);
    }

    console.log(`\nDeleted: ${results.deleted}, Errors: ${results.delete_errors}\n`);

    // Step 2: Fetch standalone events and fix colors + make recurring
    console.log('=== Step 2: Processing standalone events ===');

    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`);
    url.searchParams.set('timeMin', '2026-01-19T00:00:00+02:00');
    url.searchParams.set('timeMax', '2026-01-26T00:00:00+02:00');
    url.searchParams.set('singleEvents', 'false');
    url.searchParams.set('maxResults', '100');

    const fetchRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (!fetchRes.ok) {
        console.error('Failed to fetch events');
        return results;
    }

    const data = await fetchRes.json();
    const events = data.items || [];

    // Filter to standalone events only
    const standaloneEvents = events.filter(e => !e.recurrence || e.recurrence.length === 0);
    console.log(`Found ${standaloneEvents.length} standalone events to process\n`);

    for (const event of standaloneEvents) {
        const name = event.summary || 'Unknown';
        const currentColor = event.colorId;
        const correctColor = getCorrectColor(name);

        console.log(`Processing: ${name}`);

        // Determine the day of week for recurrence rule
        const startDate = new Date(event.start.dateTime || event.start.date);
        const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const dayOfWeek = days[startDate.getDay()];

        // Build update payload
        const updateData = {
            recurrence: [`RRULE:FREQ=WEEKLY;UNTIL=${RECURRENCE_END};BYDAY=${dayOfWeek}`]
        };

        // Fix color if needed
        if (correctColor && currentColor !== correctColor) {
            updateData.colorId = correctColor;
            console.log(`  Fixing color: ${currentColor} -> ${correctColor}`);
        }

        // Use PUT to update the event (including adding recurrence)
        const fullEvent = { ...event, ...updateData };
        delete fullEvent.recurringEventId; // Remove if present

        const updateRes = await apiCall(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${event.id}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(fullEvent)
            }
        );

        if (updateRes.ok) {
            results.made_recurring++;
            if (updateData.colorId) results.color_fixed++;
            console.log(`  ✓ Made recurring until Nov 30, 2026`);
        } else {
            results.recurring_errors++;
            console.error(`  ✗ Error:`, updateRes.error);
        }

        await sleep(600);
    }

    // Step 3: Update recurring-only events with wrong colors
    console.log('\n=== Step 3: Updating recurring-only events with wrong colors ===');

    const recurringToFix = [
        { id: '5bmergthnse27i7m229rpj78p0', name: 'Bouzouki (Advanced) - Mila', newColor: '2' },
        { id: 'okll41a9b8gqb8ahsusjsam91k', name: 'Debating (Seniors) - Alexandra', newColor: '9' },
    ];

    for (const item of recurringToFix) {
        console.log(`Updating ${item.name} color to ${item.newColor}...`);
        const patchRes = await apiCall(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${item.id}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ colorId: item.newColor })
            }
        );

        if (patchRes.ok) {
            results.color_fixed++;
            console.log(`  ✓ Updated`);
        } else {
            results.color_errors++;
            console.error(`  ✗ Error:`, patchRes.error);
        }
        await sleep(600);
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Old recurring deleted: ${results.deleted}`);
    console.log(`Delete errors: ${results.delete_errors}`);
    console.log(`Colors fixed: ${results.color_fixed}`);
    console.log(`Color errors: ${results.color_errors}`);
    console.log(`Made recurring: ${results.made_recurring}`);
    console.log(`Recurring errors: ${results.recurring_errors}`);

    return results;
}

window.cleanupCalendar = cleanupCalendar;

console.log('Calendar Cleanup script loaded.');
console.log('Run cleanupCalendar() to:');
console.log('  1. Delete 20 old recurring events with duplicates');
console.log('  2. Fix colors and make standalone events recurring');
console.log('  3. Update 2 recurring-only events with wrong colors');
