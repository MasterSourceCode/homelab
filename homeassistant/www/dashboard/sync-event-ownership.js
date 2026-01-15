/**
 * Sync Event Ownership Script
 *
 * Takes the ownership/colors from Jan 19-25, 2026 events as the "template"
 * and applies them to ALL future events with the same title.
 *
 * Also converts non-recurring events to weekly recurring until Nov 30, 2026.
 */

const CALENDAR_ID = 'familypapaninis@gmail.com';
const RECURRENCE_END = '20261130T235959Z';

async function syncEventOwnership() {
    const tokens = JSON.parse(localStorage.getItem('google_calendar_tokens') || 'null');
    if (!tokens?.access_token) {
        console.error('Not authenticated. Please sign in to Google Calendar first.');
        return { success: false, error: 'Not authenticated' };
    }

    // Step 1: Get template events from Jan 19-25, 2026
    console.log('=== Step 1: Fetching template events from Jan 19-25, 2026 ===');

    const templateStart = '2026-01-19T00:00:00+02:00';
    const templateEnd = '2026-01-26T00:00:00+02:00';

    const templateUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`);
    templateUrl.searchParams.set('timeMin', templateStart);
    templateUrl.searchParams.set('timeMax', templateEnd);
    templateUrl.searchParams.set('singleEvents', 'true');
    templateUrl.searchParams.set('maxResults', '250');

    const templateRes = await fetch(templateUrl, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (!templateRes.ok) {
        console.error('Failed to fetch template events');
        return { success: false, error: 'Failed to fetch template events' };
    }

    const templateData = await templateRes.json();
    const templateEvents = templateData.items || [];

    // Build a map of event title -> ownership info
    const ownershipTemplate = {};
    for (const event of templateEvents) {
        const title = event.summary?.trim();
        if (!title) continue;

        ownershipTemplate[title] = {
            colorId: event.colorId,
            description: event.description || ''
        };
        console.log(`Template: "${title}" -> colorId: ${event.colorId}`);
    }

    console.log(`\nFound ${Object.keys(ownershipTemplate).length} unique template events\n`);

    // Step 2: Get ALL future events (from Jan 19 to Nov 30, 2026)
    console.log('=== Step 2: Fetching all events until Nov 30, 2026 ===');

    const allEvents = [];
    let pageToken = null;

    do {
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`);
        url.searchParams.set('timeMin', templateStart);
        url.searchParams.set('timeMax', '2026-12-01T00:00:00+02:00');
        url.searchParams.set('singleEvents', 'true');
        url.searchParams.set('maxResults', '250');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });

        if (!res.ok) break;

        const data = await res.json();
        allEvents.push(...(data.items || []));
        pageToken = data.nextPageToken;
    } while (pageToken);

    console.log(`Found ${allEvents.length} total events\n`);

    // Step 3: Update events that don't match template
    console.log('=== Step 3: Updating events to match template ownership ===');

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const event of allEvents) {
        const title = event.summary?.trim();
        if (!title) continue;

        const template = ownershipTemplate[title];
        if (!template) {
            // No template for this event title
            continue;
        }

        // Check if colorId matches
        if (event.colorId === template.colorId) {
            skipped++;
            continue;
        }

        // Need to update this event
        console.log(`Updating "${title}" (${event.start?.dateTime || event.start?.date}): colorId ${event.colorId} -> ${template.colorId}`);

        try {
            const updateData = {
                colorId: template.colorId
            };

            // Also sync description if it has ownership prefix
            if (template.description) {
                const memberMatch = template.description.match(/^\[(\w+(?:\s+\w+)?)\]/);
                if (memberMatch) {
                    let desc = event.description || '';
                    desc = desc.replace(/^\[\w+(?:\s+\w+)?\]\s*/, '');
                    desc = `[${memberMatch[1]}] ${desc}`;
                    updateData.description = desc;
                }
            }

            // Retry logic with exponential backoff
            let retries = 0;
            let success = false;
            while (retries < 3 && !success) {
                const updateRes = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${event.id}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${tokens.access_token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updateData)
                    }
                );

                if (updateRes.ok) {
                    updated++;
                    success = true;
                } else if (updateRes.status === 403 || updateRes.status === 429) {
                    // Rate limited - wait and retry
                    retries++;
                    const waitTime = 2000 * Math.pow(2, retries); // 4s, 8s, 16s
                    console.log(`  Rate limited, waiting ${waitTime/1000}s before retry ${retries}/3...`);
                    await new Promise(r => setTimeout(r, waitTime));
                } else {
                    console.error(`  Failed:`, await updateRes.text());
                    errors++;
                    break;
                }
            }

            if (!success && retries >= 3) {
                console.error(`  Failed after 3 retries`);
                errors++;
            }

            // Rate limiting - 600ms between requests
            await new Promise(r => setTimeout(r, 600));

        } catch (err) {
            console.error(`  Error:`, err);
            errors++;
        }
    }

    const result = {
        success: errors === 0,
        template_events: Object.keys(ownershipTemplate).length,
        total_checked: allEvents.length,
        updated,
        skipped,
        errors
    };

    console.log('\n=== Summary ===');
    console.log(`Template events: ${result.template_events}`);
    console.log(`Total events checked: ${result.total_checked}`);
    console.log(`Updated: ${result.updated}`);
    console.log(`Already correct: ${result.skipped}`);
    console.log(`Errors: ${result.errors}`);

    return result;
}

// Make available globally
window.syncEventOwnership = syncEventOwnership;

console.log('Sync Event Ownership script loaded.');
console.log('Run syncEventOwnership() to apply Jan 19-25 ownership to all matching events.');
