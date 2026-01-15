/**
 * Make Events Weekly Recurring Script
 *
 * This script takes all events from Jan 19-25, 2026 and makes them
 * weekly recurring until Nov 30, 2026, preserving their ownership/color.
 *
 * Run this from the browser console while on the dashboard.
 */

const CALENDAR_ID = 'familypapaninis@gmail.com';
const RECURRENCE_END = '20261130T235959Z'; // Nov 30, 2026

async function makeEventsRecurring() {
    const tokens = JSON.parse(localStorage.getItem('google_calendar_tokens') || 'null');
    if (!tokens?.access_token) {
        console.error('Not authenticated. Please sign in to Google Calendar first.');
        return { success: false, error: 'Not authenticated' };
    }

    console.log('Finding events from Jan 19-25, 2026...');

    // Date range: Jan 19-25, 2026 (SAST timezone)
    const startDate = '2026-01-19T00:00:00+02:00';
    const endDate = '2026-01-26T00:00:00+02:00'; // Exclusive

    // Fetch events in the date range
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`);
    url.searchParams.set('timeMin', startDate);
    url.searchParams.set('timeMax', endDate);
    url.searchParams.set('singleEvents', 'true'); // Get individual instances
    url.searchParams.set('maxResults', '250');

    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (!res.ok) {
        console.error('Failed to fetch events:', await res.text());
        return { success: false, error: 'Failed to fetch events' };
    }

    const data = await res.json();
    const events = data.items || [];

    console.log(`Found ${events.length} events in Jan 19-25 range`);

    let made_recurring = 0;
    let already_recurring = 0;
    let errors = 0;

    for (const event of events) {
        try {
            // Skip if already recurring
            if (event.recurringEventId) {
                console.log(`Skipping "${event.summary}" - already a recurring instance`);
                already_recurring++;
                continue;
            }

            if (event.recurrence && event.recurrence.length > 0) {
                console.log(`Skipping "${event.summary}" - already has recurrence rule`);
                already_recurring++;
                continue;
            }

            console.log(`Making "${event.summary}" weekly recurring until Nov 30, 2026...`);

            // Add weekly recurrence until Nov 30, 2026
            event.recurrence = [`RRULE:FREQ=WEEKLY;UNTIL=${RECURRENCE_END}`];

            // Update the event
            const updateRes = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${event.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${tokens.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(event)
                }
            );

            if (updateRes.ok) {
                made_recurring++;
                console.log(`  ✓ Made "${event.summary}" weekly recurring`);
            } else {
                const errorText = await updateRes.text();
                console.error(`  ✗ Failed to update "${event.summary}":`, errorText);
                errors++;
            }

            // Rate limiting
            await new Promise(r => setTimeout(r, 200));

        } catch (err) {
            console.error(`Error processing "${event.summary}":`, err);
            errors++;
        }
    }

    const result = {
        success: errors === 0,
        total_found: events.length,
        made_recurring,
        already_recurring,
        errors
    };

    console.log('\n=== Summary ===');
    console.log(`Total events found: ${result.total_found}`);
    console.log(`Made recurring: ${result.made_recurring}`);
    console.log(`Already recurring: ${result.already_recurring}`);
    console.log(`Errors: ${result.errors}`);

    return result;
}

// Make available globally
window.makeEventsRecurring = makeEventsRecurring;

console.log('Make Events Recurring script loaded.');
console.log('Run makeEventsRecurring() in the console to make Jan 19-25 events weekly recurring.');
