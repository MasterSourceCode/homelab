/**
 * Playwright Test: Guest Pass Cross-Browser Synchronization
 *
 * Tests that passes created in one browser appear in all others.
 * Opens 3 mobile browsers + 3 desktop browsers, creates passes, verifies sync.
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://192.168.x.x:8123/local/dashboard';
const HA_TOKEN = process.env.HA_TOKEN;

if (!HA_TOKEN) {
    console.error('ERROR: HA_TOKEN environment variable not set');
    process.exit(1);
}

const GUEST_NAMES = [
    'Mobile-Guest-1',
    'Mobile-Guest-2',
    'Mobile-Guest-3',
    'Desktop-Guest-1',
    'Desktop-Guest-2',
    'Desktop-Guest-3'
];

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupBrowser(browser, isMobile, index) {
    const contextOptions = isMobile ? {
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
    } : {
        viewport: { width: 1920, height: 1080 }
    };

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // Log console messages for debugging
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.text().includes('[GuestPass]')) {
            console.log(`  [Console] ${msg.text()}`);
        }
    });

    const url = isMobile ? `${BASE_URL}/mobile.html` : `${BASE_URL}/index.html`;
    const label = isMobile ? `Mobile-${index + 1}` : `Desktop-${index + 1}`;

    console.log(`[${label}] Opening ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Check if connect modal is visible
    const connectModal = await page.$('#connectModal');
    const isModalVisible = connectModal && await connectModal.isVisible();

    if (isModalVisible) {
        console.log(`[${label}] Authenticating...`);
        await page.fill('#haToken', HA_TOKEN);
        await page.click('[data-action="connectHA"]');
        await sleep(3000);
    } else {
        console.log(`[${label}] Already authenticated or no modal`);
    }

    // Wait for app to load
    await page.waitForSelector('#app:not(.hidden)', { timeout: 15000 }).catch(() => {
        console.log(`[${label}] App container check - may already be visible`);
    });

    console.log(`[${label}] Dashboard loaded`);

    return { context, page, label };
}

async function navigateToGuestPass(page, label, isMobile) {
    console.log(`[${label}] Navigating to Guest Pass view...`);

    if (isMobile) {
        // Mobile: Use JavaScript to navigate directly (avoids menu overlay issues)
        await page.evaluate(() => {
            // Close any open menus first
            const overlay = document.querySelector('#moreMenuOverlay');
            if (overlay) overlay.classList.add('hidden');

            // Navigate to guest-pass view
            if (window.mobile?.showView) {
                window.mobile.showView('guest-pass');
            } else {
                // Fallback: show the view directly
                document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
                const guestView = document.querySelector('#view-guest-pass');
                if (guestView) guestView.classList.remove('hidden');
            }
        });
    } else {
        // Desktop: Use JavaScript to navigate directly
        await page.evaluate(() => {
            if (window.dashboard?.showView) {
                window.dashboard.showView('guest-pass');
            }
        });
    }

    await sleep(2000);
    console.log(`[${label}] Guest Pass view should be open`);
}

async function createGuestPass(page, label, guestName, isMobile) {
    console.log(`[${label}] Creating pass for: ${guestName}`);

    // Set the preset to 'day' using JavaScript (more reliable)
    await page.evaluate((isMob) => {
        if (isMob) {
            // Mobile: click preset button
            const dayBtn = document.querySelector('[data-param-preset="day"]');
            if (dayBtn) dayBtn.click();
        } else {
            // Desktop
            if (window.dashboard?.setPassPreset) {
                window.dashboard.setPassPreset('day');
            }
        }
    }, isMobile);
    await sleep(500);

    // Fill guest name - different IDs for mobile vs desktop
    const nameInputSelector = isMobile ? '#guestMobileName' : '#guestPassName';
    const nameInput = await page.$(nameInputSelector);
    if (nameInput) {
        await nameInput.fill(guestName);
    } else {
        console.log(`[${label}] WARNING: Could not find guest name input (${nameInputSelector})`);
        return false;
    }

    // Ensure permissions are checked - different IDs for mobile vs desktop
    const permGateSelector = isMobile ? '#guestMobilePermGate' : '#permGate';
    const permGarageSelector = isMobile ? '#guestMobilePermGarage' : '#permGarage';

    const permGate = await page.$(permGateSelector);
    const permGarage = await page.$(permGarageSelector);
    if (permGate) await permGate.check();
    if (permGarage) await permGarage.check();

    // Click generate button
    const generateBtn = await page.$('[data-action="generateGuestPass"]');
    if (generateBtn) {
        await generateBtn.click();
        await sleep(2000);
        console.log(`[${label}] Pass created for ${guestName}`);

        // Close the modal if it appeared
        const closeBtn = await page.$('[data-action="closePassModal"], [data-action="closeGuestModal"]');
        if (closeBtn && await closeBtn.isVisible()) {
            await closeBtn.click();
            await sleep(500);
        }

        return true;
    } else {
        console.log(`[${label}] WARNING: Could not find generate button`);
        return false;
    }
}

async function getVisiblePasses(page, label, isMobile) {
    await sleep(1000);

    // Refresh the pass list
    await page.evaluate((isMob) => {
        if (isMob) {
            if (window.mobile?.renderGuestPasses) {
                window.mobile.renderGuestPasses();
            }
        } else {
            if (window.dashboard?.renderActivePasses) {
                window.dashboard.renderActivePasses();
            }
        }
    }, isMobile);

    await sleep(1000);

    // Get pass names from the active passes list
    const passes = await page.evaluate((isMob) => {
        // Try both selectors - mobile uses different ID
        const container = document.querySelector(isMob ? '#guestMobilePassesList' : '#activePassesList');
        if (!container) {
            console.log('Container not found, trying alternative...');
            return [];
        }

        const passCards = container.querySelectorAll('[data-pass-id]');
        return Array.from(passCards).map(card => {
            // Try different name selectors for mobile vs desktop
            const nameEl = card.querySelector('.font-semibold.text-white.text-lg') ||
                           card.querySelector('.guest-pass-name') ||
                           card.querySelector('[class*="name"]');
            return nameEl ? nameEl.textContent.trim() : null;
        }).filter(Boolean);
    }, isMobile);

    console.log(`[${label}] Visible passes: ${passes.length > 0 ? passes.join(', ') : 'none'}`);
    return passes;
}

async function syncFromServer(page, label) {
    console.log(`[${label}] Syncing from server...`);
    await page.evaluate(async () => {
        // Force reload passes from server
        if (window.dashboard?.syncFromServer) {
            await window.dashboard.syncFromServer();
        } else {
            // Manually trigger by loading from server
            const resp = await fetch('/local/dashboard/data/passes.json?t=' + Date.now());
            const data = await resp.json();
            localStorage.setItem('residence_guest_passes', JSON.stringify(data.passes || []));
            if (window.dashboard?.renderActivePasses) {
                window.dashboard.renderActivePasses();
            }
        }
    });
    await sleep(1500);
}

async function main() {
    console.log('='.repeat(60));
    console.log('Guest Pass Cross-Browser Sync Test');
    console.log('='.repeat(60));
    console.log('');

    const browser = await chromium.launch({
        headless: true,  // Headless mode (no display)
        slowMo: 50
    });

    const sessions = [];

    try {
        // Setup 3 mobile browsers
        console.log('\n--- Setting up Mobile Browsers ---\n');
        for (let i = 0; i < 3; i++) {
            const session = await setupBrowser(browser, true, i);
            session.isMobile = true;
            session.guestName = GUEST_NAMES[i];
            sessions.push(session);
            await sleep(1000);
        }

        // Setup 3 desktop browsers
        console.log('\n--- Setting up Desktop Browsers ---\n');
        for (let i = 0; i < 3; i++) {
            const session = await setupBrowser(browser, false, i);
            session.isMobile = false;
            session.guestName = GUEST_NAMES[i + 3];
            sessions.push(session);
            await sleep(1000);
        }

        // Navigate all to Guest Pass view
        console.log('\n--- Navigating to Guest Pass View ---\n');
        for (const session of sessions) {
            await navigateToGuestPass(session.page, session.label, session.isMobile);
        }

        await sleep(2000);

        // Create passes one by one
        console.log('\n--- Creating Passes ---\n');
        for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i];
            await createGuestPass(session.page, session.label, session.guestName, session.isMobile);

            // Check localStorage immediately after creation
            const localPasses = await session.page.evaluate(() => {
                const data = localStorage.getItem('residence_guest_passes');
                return data ? JSON.parse(data) : [];
            });
            console.log(`[${session.label}] localStorage passes after creation: ${localPasses.length}`);
            if (localPasses.length > 0) {
                console.log(`[${session.label}] Pass names: ${localPasses.map(p => p.name).join(', ')}`);
            }

            // Wait a bit for server sync
            await sleep(2000);

            // After each creation, sync all other browsers
            console.log(`\n--- Syncing all browsers after creating ${session.guestName} ---\n`);
            for (const otherSession of sessions) {
                if (otherSession !== session) {
                    await syncFromServer(otherSession.page, otherSession.label);
                }
            }

            await sleep(1000);
        }

        // Final verification - check all passes are visible in all browsers
        console.log('\n' + '='.repeat(60));
        console.log('FINAL VERIFICATION');
        console.log('='.repeat(60) + '\n');

        const results = [];
        for (const session of sessions) {
            await syncFromServer(session.page, session.label);
            const passes = await getVisiblePasses(session.page, session.label, session.isMobile);
            results.push({ label: session.label, passes });
        }

        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('RESULTS SUMMARY');
        console.log('='.repeat(60));
        console.log(`Expected passes: ${GUEST_NAMES.join(', ')}`);
        console.log('');

        let allPassed = true;
        for (const result of results) {
            const hasAll = GUEST_NAMES.every(name => result.passes.includes(name));
            const status = hasAll ? '✓ PASS' : '✗ FAIL';
            console.log(`${result.label}: ${status} (${result.passes.length}/${GUEST_NAMES.length} passes visible)`);
            if (!hasAll) {
                console.log(`  Missing: ${GUEST_NAMES.filter(n => !result.passes.includes(n)).join(', ')}`);
                allPassed = false;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED');
        console.log('='.repeat(60) + '\n');

        // Brief pause before cleanup
        console.log('Test complete. Cleaning up...');
        await sleep(2000);

    } catch (error) {
        console.error('Test failed with error:', error);
    } finally {
        // Cleanup
        for (const session of sessions) {
            await session.context.close();
        }
        await browser.close();
    }
}

main().catch(console.error);
