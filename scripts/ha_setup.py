#!/usr/bin/env python3
"""
Home Assistant Automated Setup Script
Uses Playwright to configure Home Assistant via the web interface
"""

import asyncio
import sys
import time
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

# Configuration
HA_URL = "http://192.168.68.77:8123"
USERNAME = "nico"
PASSWORD = "Smart33Pant$@123"
DISPLAY_NAME = "Nico"

async def wait_for_ha_ready(page, timeout=120):
    """Wait for Home Assistant to be fully loaded"""
    print("Waiting for Home Assistant to be ready...")
    start = time.time()
    while time.time() - start < timeout:
        try:
            response = await page.goto(HA_URL, timeout=10000)
            if response and response.ok:
                await page.wait_for_load_state('networkidle', timeout=10000)
                return True
        except Exception:
            pass
        await asyncio.sleep(2)
    return False

async def login(page):
    """Login to Home Assistant"""
    print("\n=== Logging into Home Assistant ===")

    await page.goto(HA_URL)
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(3)

    # Check if we see the login form with "Welcome home!" text
    welcome_text = page.locator('text="Welcome home!"')
    if await welcome_text.count() > 0:
        print("Login form detected, logging in...")

        # Fill username - using the placeholder text
        username_input = page.locator('input').first
        await username_input.click()
        await username_input.fill(USERNAME)

        # Fill password - second input field
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

async def check_logged_in(page):
    """Check if we're logged into the dashboard"""
    try:
        # Look for the sidebar or main dashboard elements
        await page.wait_for_selector('ha-sidebar, home-assistant-main, .header', timeout=15000)
        return True
    except:
        return False

async def navigate_to_settings(page):
    """Navigate to Settings page"""
    print("Navigating to Settings...")
    await page.goto(f"{HA_URL}/config")
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(2)

async def navigate_to_integrations(page):
    """Navigate to Integrations page"""
    print("Navigating to Integrations...")
    await page.goto(f"{HA_URL}/config/integrations")
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(2)

async def add_mqtt_integration(page):
    """Add MQTT integration"""
    print("\n=== Setting up MQTT Integration ===")

    await page.goto(f"{HA_URL}/config/integrations")
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(3)

    # Click Add Integration button (the floating action button)
    add_btn = page.locator('ha-fab')
    if await add_btn.count() > 0:
        await add_btn.click()
        await asyncio.sleep(2)

        # Search for MQTT
        search_input = page.locator('search-input-outlined input, ha-search-field input')
        if await search_input.count() > 0:
            await search_input.fill("MQTT")
            await asyncio.sleep(2)

            # Click on MQTT in the results
            mqtt_item = page.locator('ha-list-item:has-text("MQTT")').first
            if await mqtt_item.count() > 0:
                await mqtt_item.click()
                await asyncio.sleep(2)

                print("MQTT dialog opened, filling details...")
                return True

    print("Could not find Add Integration button")
    return False

async def add_frigate_integration(page):
    """Navigate to add Frigate integration (requires HACS first)"""
    print("\n=== Frigate Integration ===")
    print("Note: Frigate integration requires HACS to be installed first")

    await page.goto(f"{HA_URL}/config/integrations")
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(2)

    return True

async def take_screenshot(page, name):
    """Take a screenshot for debugging"""
    try:
        await page.screenshot(path=f"/opt/homelab/screenshots/{name}.png")
        print(f"Screenshot saved: {name}.png")
    except Exception as e:
        print(f"Could not save screenshot: {e}")

async def explore_integrations(page):
    """Explore available integrations"""
    print("\n=== Exploring Integrations ===")

    await page.goto(f"{HA_URL}/config/integrations")
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(3)

    await take_screenshot(page, "integrations_page")

    # Try to click Add Integration
    add_btn = page.locator('ha-fab')
    if await add_btn.count() > 0:
        await add_btn.click()
        await asyncio.sleep(2)
        await take_screenshot(page, "add_integration_dialog")

async def explore_settings(page):
    """Explore the settings pages"""
    print("\n=== Exploring Settings ===")

    await page.goto(f"{HA_URL}/config")
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(3)
    await take_screenshot(page, "settings_page")

    # Check for updates
    await page.goto(f"{HA_URL}/config/updates")
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(2)
    await take_screenshot(page, "updates_page")

async def main():
    print("=" * 60)
    print("Home Assistant Automated Setup")
    print("=" * 60)

    async with async_playwright() as p:
        # Launch browser
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
            # Wait for HA to be ready
            if not await wait_for_ha_ready(page):
                print("ERROR: Home Assistant not responding")
                return 1

            print("Home Assistant is responding!")

            # Navigate to main page
            await page.goto(HA_URL)
            await page.wait_for_load_state('networkidle')
            await asyncio.sleep(3)

            current_url = page.url
            print(f"Current page: {current_url}")

            # Take initial screenshot
            await take_screenshot(page, "01_initial")

            # Login
            await login(page)
            await asyncio.sleep(3)

            # Take screenshot after login attempt
            await take_screenshot(page, "02_after_login")

            # Verify we're logged in
            if await check_logged_in(page):
                print("\n✓ Successfully logged into Home Assistant!")
                await take_screenshot(page, "03_dashboard")

                # Explore the interface
                await explore_settings(page)
                await explore_integrations(page)

            else:
                print("\n✗ Could not verify login - checking page state")
                await take_screenshot(page, "03_login_issue")
                current_url = page.url
                print(f"Current URL after login attempt: {current_url}")

            print("\n=== Basic Setup Complete ===")
            print(f"Access Home Assistant at: {HA_URL}")
            print(f"Username: {USERNAME}")

        except Exception as e:
            print(f"Error during setup: {e}")
            import traceback
            traceback.print_exc()
            await take_screenshot(page, "error")
            return 1
        finally:
            await browser.close()

    return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
