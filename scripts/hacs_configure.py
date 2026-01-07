#!/usr/bin/env python3
"""Simple HACS configuration script"""

import asyncio
import sys
from playwright.async_api import async_playwright

HA_URL = "http://192.168.x.x:8123"
USERNAME = "person1"
PASSWORD = "YOUR_HA_PASSWORD"

async def main():
    print("Starting HACS configuration...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
        )

        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            ignore_https_errors=True
        )

        page = await context.new_page()
        page.set_default_timeout(60000)  # 60 second timeout

        try:
            # Go to login page
            print("Navigating to Home Assistant...")
            await page.goto(HA_URL, wait_until='domcontentloaded')
            await asyncio.sleep(5)

            # Login if needed
            if await page.locator('text="Welcome home!"').count() > 0:
                print("Logging in...")
                await page.locator('input').first.fill(USERNAME)
                await page.locator('input').nth(1).fill(PASSWORD)
                await page.locator('text="Log in"').click()
                await asyncio.sleep(5)

            # Navigate to integrations
            print("Going to integrations page...")
            await page.goto(f"{HA_URL}/config/integrations", wait_until='domcontentloaded')
            await asyncio.sleep(5)

            await page.screenshot(path="/opt/homelab/screenshots/hacs_config_01.png")
            print("Screenshot saved: hacs_config_01.png")

            # Click Add Integration
            print("Clicking Add Integration...")
            await page.locator('ha-fab').click()
            await asyncio.sleep(3)

            await page.screenshot(path="/opt/homelab/screenshots/hacs_config_02.png")
            print("Screenshot saved: hacs_config_02.png")

            # Search for HACS
            print("Searching for HACS...")
            search = page.locator('input').first
            await search.fill("HACS")
            await asyncio.sleep(3)

            await page.screenshot(path="/opt/homelab/screenshots/hacs_config_03.png")
            print("Screenshot saved: hacs_config_03.png")

            # Click HACS in results
            print("Selecting HACS...")
            await page.locator('text="HACS"').first.click()
            await asyncio.sleep(3)

            await page.screenshot(path="/opt/homelab/screenshots/hacs_config_04.png")
            print("Screenshot saved: hacs_config_04.png")

            # Check all the acknowledgment checkboxes by clicking on text labels
            print("Checking acknowledgments...")

            # Use JavaScript to check the checkboxes
            await page.evaluate('''() => {
                const checkboxes = document.querySelectorAll('ha-checkbox');
                checkboxes.forEach(cb => {
                    if (!cb.checked) {
                        cb.click();
                    }
                });
            }''')
            await asyncio.sleep(1)

            await page.screenshot(path="/opt/homelab/screenshots/hacs_config_05.png")
            print("Screenshot saved: hacs_config_05.png")

            # Click Submit
            print("Clicking Submit...")
            submit = page.locator('text="Submit"').first
            if await submit.count() > 0:
                await submit.click()
                await asyncio.sleep(5)

            await page.screenshot(path="/opt/homelab/screenshots/hacs_config_06.png")
            print("Screenshot saved: hacs_config_06.png")

            # Check for GitHub auth
            print("\nChecking for GitHub authentication dialog...")
            content = await page.content()
            if "github" in content.lower() or "device" in content.lower():
                print("\n" + "="*60)
                print("GitHub Authentication Required!")
                print("="*60)

                # Look for the link
                link = page.locator('a[href*="github"]')
                if await link.count() > 0:
                    href = await link.first.get_attribute('href')
                    print(f"\n1. Visit: {href}")
                else:
                    print("\n1. Visit: https://github.com/login/device")

                # Look for device code
                inputs = page.locator('input')
                for i in range(await inputs.count()):
                    val = await inputs.nth(i).input_value()
                    if val and len(val) >= 4 and len(val) <= 20:
                        print(f"2. Enter code: {val}")
                        break

                print("\n3. Authorize HACS on GitHub")
                print("4. Return here and the setup will complete")
                print("="*60)

            print("\nHACS configuration script complete!")

        except Exception as e:
            print(f"Error: {e}")
            await page.screenshot(path="/opt/homelab/screenshots/hacs_error.png")
            return 1
        finally:
            await browser.close()

    return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
