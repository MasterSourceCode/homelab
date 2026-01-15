/**
 * Verify Calendar Colors Script
 *
 * Inspects all events and reports on color/ownership distribution.
 * Run this in the browser console to see the current state.
 */

const CALENDAR_ID = 'familypapaninis@gmail.com';

// Color ID to owner mapping (based on your setup)
const COLOR_NAMES = {
    '2': 'Mila (Green)',
    '4': 'Both Girls (Pink)',
    '6': 'Tatiana (Orange)',
    '8': 'Nico (Grey)',
    '9': 'Alexandra (Blue)',
    '10': 'Parents (Dark)',
    '11': 'Everyone (Red)',
    undefined: 'No color set'
};

async function verifyCalendarColors() {
    const tokens = JSON.parse(localStorage.getItem('google_calendar_tokens') || 'null');
    if (!tokens?.access_token) {
        console.error('Not authenticated. Please sign in to Google Calendar first.');
        return;
    }

    console.log('=== Fetching all events from Jan 19 to Nov 30, 2026 ===\n');

    const allEvents = [];
    let pageToken = null;

    do {
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`);
        url.searchParams.set('timeMin', '2026-01-19T00:00:00+02:00');
        url.searchParams.set('timeMax', '2026-12-01T00:00:00+02:00');
        url.searchParams.set('singleEvents', 'true');
        url.searchParams.set('maxResults', '250');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });

        if (!res.ok) {
            console.error('Failed to fetch:', await res.text());
            break;
        }

        const data = await res.json();
        allEvents.push(...(data.items || []));
        pageToken = data.nextPageToken;
    } while (pageToken);

    console.log(`Total events fetched: ${allEvents.length}\n`);

    // Group by event title and analyze colors
    const byTitle = {};
    for (const event of allEvents) {
        const title = event.summary?.trim() || '(no title)';
        if (!byTitle[title]) {
            byTitle[title] = { colors: {}, events: [] };
        }
        const colorId = event.colorId || 'undefined';
        byTitle[title].colors[colorId] = (byTitle[title].colors[colorId] || 0) + 1;
        byTitle[title].events.push({
            date: event.start?.dateTime || event.start?.date,
            colorId: event.colorId
        });
    }

    // Report
    console.log('=== Events by Title ===\n');

    const inconsistent = [];
    const consistent = [];

    for (const [title, data] of Object.entries(byTitle).sort((a, b) => a[0].localeCompare(b[0]))) {
        const colorKeys = Object.keys(data.colors);
        const isConsistent = colorKeys.length === 1;
        const colorSummary = colorKeys.map(c => `${COLOR_NAMES[c] || 'Color ' + c}: ${data.colors[c]}`).join(', ');

        if (isConsistent) {
            consistent.push({ title, colorSummary, count: data.events.length });
        } else {
            inconsistent.push({ title, colorSummary, count: data.events.length, data });
        }
    }

    console.log(`✅ CONSISTENT (${consistent.length} event types):`);
    console.log('─'.repeat(60));
    for (const item of consistent) {
        console.log(`  "${item.title}" (${item.count} events) - ${item.colorSummary}`);
    }

    if (inconsistent.length > 0) {
        console.log(`\n⚠️ INCONSISTENT (${inconsistent.length} event types):`);
        console.log('─'.repeat(60));
        for (const item of inconsistent) {
            console.log(`  "${item.title}" (${item.count} events) - ${item.colorSummary}`);
            // Show first few mismatched dates
            const firstMismatch = item.data.events.find(e => e.colorId !== item.data.events[0].colorId);
            if (firstMismatch) {
                console.log(`    First mismatch at: ${firstMismatch.date}`);
            }
        }
    }

    // Summary by color
    console.log('\n=== Summary by Owner ===');
    console.log('─'.repeat(60));
    const colorTotals = {};
    for (const event of allEvents) {
        const colorId = event.colorId || 'undefined';
        colorTotals[colorId] = (colorTotals[colorId] || 0) + 1;
    }
    for (const [colorId, count] of Object.entries(colorTotals).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${COLOR_NAMES[colorId] || 'Color ' + colorId}: ${count} events`);
    }

    return {
        total: allEvents.length,
        consistent: consistent.length,
        inconsistent: inconsistent.length,
        byColor: colorTotals,
        inconsistentDetails: inconsistent
    };
}

window.verifyCalendarColors = verifyCalendarColors;

console.log('Verify Calendar Colors script loaded.');
console.log('Run verifyCalendarColors() to inspect all event colors.');
