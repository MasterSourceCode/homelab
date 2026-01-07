#!/usr/bin/env python3
"""
HACS Setup Script
Adds HACS integration to Home Assistant via Playwright
"""

import asyncio
import sys
import time
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

# Configuration
HA_URL = "http://192.168.68.77:8123"
USERNAME = "nico"
PASSWORD = "Smart33Pant$@123"

async def take_screenshot(page, name):
    """Take a screenshot for debugging"""
    try:
        await page.screenshot(path=f"/opt/homelab/screenshots/{name}.png")
        print(f"Screenshot saved: {name}.png")
    except Exception as e:
        print(f"Could not save screenshot: {e}")

async def login(page):
    """Login to Home Assistant"""
    print("\n=== Logging into Home Assistant ===")

    await page.goto(HA_URL)
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(3)

    # Check if we see the login form
    welcome_text = page.locator('text="Welcome home!"')
    if await welcome_text.count() > 0:
        print("Login form detected, logging in...")

        # Fill username
        username_input = page.locator('input').first
        await username_input.click()
        await username_input.fill(USERNAME)

        # Fill password
        password_input = page.locator('input').nth(1)
        await password_input.click()
        await password_input.fill(PASSWORD)

        # Click Log in button
        login_btn = page.locator('text="Log in"')
        await login_btn.click()

        print("Login submitted, waiting for dashboard...")
        await asyncio.sleep(5)

    await page.wait_for_load_state('networkidle')
    return True

async def add_hacs_integration(page):
    """Add HACS integration"""
    print("\n=== Adding HACS Integration ===")

    # Navigate to integrations page
    await page.goto(f"{HA_URL}/config/integrations")
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(3)

    await take_screenshot(page, "hacs_01_integrations_page")

    # Click Add Integration button (the floating action button)
    print("Looking for Add Integration button...")
    add_btn = page.locator('ha-fab')
    if await add_btn.count() > 0:
        await add_btn.click()
        await asyncio.sleep(2)
        await take_screenshot(page, "hacs_02_add_dialog")

        # Search for HACS
        print("Searching for HACS...")
        search_input = page.locator('search-input-outlined input, vaadin-combo-box-light input, ha-search-field input, input[type="search"]').first
        if await search_input.count() > 0:
            await search_input.fill("HACS")
            await asyncio.sleep(2)
            await take_screenshot(page, "hacs_03_search_results")

            # Try to find and click HACS in the results
            hacs_options = [
                'ha-list-item:has-text("HACS")',
                'mwc-list-item:has-text("HACS")',
                'paper-item:has-text("HACS")',
                'div:has-text("HACS"):visible',
                'text="HACS"'
            ]

            for selector in hacs_options:
                hacs_item = page.locator(selector).first
                if await hacs_item.count() > 0:
                    try:
                        await hacs_item.click()
                        await asyncio.sleep(2)
                        await take_screenshot(page, "hacs_04_hacs_selected")
                        print("HACS selected!")
                        return await complete_hacs_setup(page)
                    except Exception as e:
                        print(f"Could not click selector {selector}: {e}")
                        continue

            print("Could not find HACS in search results")
        else:
            print("Could not find search input")
    else:
        print("Could not find Add Integration button")

    return False

async def complete_hacs_setup(page):
    """Complete the HACS setup dialog"""
    print("\n=== Completing HACS Setup ===")
    await asyncio.sleep(2)

    # HACS shows a dialog with checkboxes - click on the text labels instead
    # The checkboxes are ha-formfield with ha-checkbox inside
    checkbox_texts = [
        "I know how to access Home Assistant logs",
        "I know that there are no add-ons in HACS",
        "I know that everything inside HACS including HACS itself is custom and untested by Home Assistant",
        "I know that if I get issues with Home Assistant I should disable all my custom_components"
    ]

    for text in checkbox_texts:
        try:
            # Click on the ha-formfield containing this text
            formfield = page.locator(f'ha-formfield:has-text("{text}")')
            if await formfield.count() > 0:
                await formfield.click()
                print(f"Clicked: {text[:50]}...")
                await asyncio.sleep(0.3)
            else:
                # Try clicking directly on text
                label = page.locator(f'text="{text}"').first
                if await label.count() > 0:
                    await label.click()
                    print(f"Clicked text: {text[:50]}...")
                    await asyncio.sleep(0.3)
        except Exception as e:
            print(f"Could not click checkbox for: {text[:30]}... - {e}")

    await take_screenshot(page, "hacs_05_checkboxes_checked")
    await asyncio.sleep(1)

    # Click Submit button
    print("Clicking Submit button...")
    submit_btn = page.locator('mwc-button:has-text("Submit"), ha-button:has-text("Submit"), button:has-text("Submit")').first
    if await submit_btn.count() > 0:
        await submit_btn.click()
        await asyncio.sleep(3)
        await take_screenshot(page, "hacs_06_submitted")
        print("Submit clicked!")
    else:
        print("Could not find Submit button")

    await asyncio.sleep(2)
    await take_screenshot(page, "hacs_07_after_submit")

    # Check for GitHub authentication step
    # HACS uses device code flow for GitHub OAuth
    print("\nChecking for GitHub authentication...")

    # Look for the device code dialog
    page_content = await page.content()

    if "github.com/login/device" in page_content or "device" in page_content.lower():
        print("\n*** GitHub Device Authentication Required ***")

        # Try to find the device code
        code_elem = page.locator('code, .code, ha-textfield input, input[readonly]')
        if await code_elem.count() > 0:
            for i in range(await code_elem.count()):
                try:
                    code_text = await code_elem.nth(i).text_content()
                    if code_text and len(code_text) > 0:
                        print(f"Device code found: {code_text}")
                except:
                    pass

        # Look for the GitHub link
        github_link = page.locator('a[href*="github.com"]')
        if await github_link.count() > 0:
            href = await github_link.first.get_attribute('href')
            print(f"GitHub authorization URL: {href}")
        else:
            print("Visit: https://github.com/login/device")

        print("\nPlease authorize HACS on GitHub, then the setup will complete automatically.")

    return True

async def check_hacs_installed(page):
    """Check if HACS is already configured"""
    print("\n=== Checking for existing HACS installation ===")

    await page.goto(f"{HA_URL}/config/integrations")
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(3)

    # Look for HACS in the integrations list
    hacs_card = page.locator('ha-integration-card:has-text("HACS")')
    if await hacs_card.count() > 0:
        print("HACS is already installed!")
        return True

    return False

async def main():
    print("=" * 60)
    print("HACS Setup Script")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-gpu']
        )

        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            ignore_https_errors=True
        )

        page = await context.new_page()

        try:
            # Login first
            await login(page)
            await asyncio.sleep(3)

            # Check if HACS is already installed
            if await check_hacs_installed(page):
                print("\nHACS is already configured!")
                await take_screenshot(page, "hacs_already_installed")
            else:
                print("\nHACS not found, adding integration...")
                await add_hacs_integration(page)

            print("\n=== HACS Setup Script Complete ===")

        except Exception as e:
            print(f"Error during setup: {e}")
            import traceback
            traceback.print_exc()
            await take_screenshot(page, "hacs_error")
            return 1
        finally:
            await browser.close()

    return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
