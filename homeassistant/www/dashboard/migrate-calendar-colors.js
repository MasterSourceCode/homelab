/**
 * Calendar Color Migration Script
 *
 * This script updates all existing Google Calendar events to use the new pastel color scheme.
 *
 * New Color Mapping:
 * - Nico: Grey (colorId 8 - Graphite)
 * - Tatiana: Orange (colorId 6 - Tangerine)
 * - Alexandra: Blue (colorId 9 - Blueberry)
 * - Mila: Green (colorId 2 - Sage)
 * - Both Girls: Pink (colorId 4 - Flamingo)
 * - Parents: Dark (colorId 11 - Tomato)
 *
 * Run this from the browser console while on the dashboard, or use the migrate button.
 */

const CALENDAR_ID = 'familypapaninis@gmail.com';

// Old colorId → member mapping (to determine who the event belongs to)
const OLD_COLOR_TO_MEMBER = {
    '1': 'nico',      // Old blue
    '2': 'mila',      // Old green
    '3': 'alexandra', // Old purple
    '4': 'tatiana',   // Old pink (was Tatiana)
    '5': 'everyone',  // Old yellow
    '6': 'tatiana',   // Old orange (repurpose - now Tatiana's)
    '7': 'mila',      // Old teal
    '8': 'nico',      // Old grey
    '9': 'alexandra', // Old bold blue (was Nico, now Alexandra)
    '10': 'mila',     // Old bold green
    '11': 'everyone'  // Old red
};

// New member → colorId mapping
const MEMBER_TO_NEW_COLOR = {
    'nico': '8',       // Graphite (Grey)
    'tatiana': '6',    // Tangerine (Orange)
    'alexandra': '9',  // Blueberry (Blue)
    'mila': '2',       // Sage (Green)
    'bothGirls': '4',  // Flamingo (Pink)
    'everyone': '11'   // Tomato (Dark identifier)
};

// Description tag → member mapping
const DESCRIPTION_TO_MEMBER = {
    'nico': 'nico',
    'tatiana': 'tatiana',
    'alexandra': 'alexandra',
    'mila': 'mila',
    'both girls': 'bothGirls',
    'bothgirls': 'bothGirls',
    'everyone': 'everyone',
    'parents': 'everyone'
};

async function migrateCalendarColors() {
    const tokens = JSON.parse(localStorage.getItem('google_calendar_tokens') || 'null');
    if (!tokens?.access_token) {
        console.error('Not authenticated. Please sign in to Google Calendar first.');
        return { success: false, error: 'Not authenticated' };
    }

    console.log('Starting calendar color migration...');

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let pageToken = null;

    do {
        // Fetch events (paginated)
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`);
        url.searchParams.set('maxResults', '250');
        url.searchParams.set('singleEvents', 'false'); // Get recurring event masters
        if (pageToken) {
            url.searchParams.set('pageToken', pageToken);
        }

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });

        if (!res.ok) {
            console.error('Failed to fetch events:', await res.text());
            return { success: false, error: 'Failed to fetch events' };
        }

        const data = await res.json();
        console.log(`Processing ${data.items?.length || 0} events...`);

        for (const event of (data.items || [])) {
            try {
                // Determine the member from description or colorId
                let member = null;

                // First check description for [MemberName] tag
                const description = event.description || '';
                const memberMatch = description.match(/^\[(\w+(?:\s+\w+)?)\]/i);
                if (memberMatch) {
                    const tagName = memberMatch[1].toLowerCase();
                    member = DESCRIPTION_TO_MEMBER[tagName];
                }

                // If no description tag, use colorId mapping
                if (!member && event.colorId) {
                    member = OLD_COLOR_TO_MEMBER[event.colorId];
                }

                // Default to 'everyone' if no assignment found
                if (!member) {
                    member = 'everyone';
                }

                // Get new colorId for this member
                const newColorId = MEMBER_TO_NEW_COLOR[member];

                // Skip if already correct
                if (event.colorId === newColorId) {
                    skipped++;
                    continue;
                }

                // Update the event
                console.log(`Updating "${event.summary}" (${event.id}): ${member} → colorId ${newColorId}`);

                const updateRes = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${event.id}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${tokens.access_token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ colorId: newColorId })
                    }
                );

                if (updateRes.ok) {
                    updated++;
                } else {
                    console.error(`Failed to update "${event.summary}":`, await updateRes.text());
                    errors++;
                }

                // Rate limiting - Google API has 10 requests/second limit
                await new Promise(r => setTimeout(r, 150));

            } catch (err) {
                console.error(`Error processing event "${event.summary}":`, err);
                errors++;
            }
        }

        pageToken = data.nextPageToken;

    } while (pageToken);

    const result = { success: true, updated, skipped, errors };
    console.log('Migration complete:', result);
    return result;
}

// Make available globally
window.migrateCalendarColors = migrateCalendarColors;

// Export for module use
if (typeof module !== 'undefined') {
    module.exports = { migrateCalendarColors };
}

console.log('Calendar color migration script loaded.');
console.log('Run migrateCalendarColors() in the console to migrate all events to the new color scheme.');
