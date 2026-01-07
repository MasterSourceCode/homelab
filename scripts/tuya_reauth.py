#!/usr/bin/env python3
"""
Automate Tuya re-authentication in Home Assistant using Playwright
"""
import asyncio
import sys
from playwright.async_api import async_playwright

HA_URL = "http://192.168.x.x:8123"
HA_USER = "Person1"
HA_PASSWORD = "YOUR_HA_PASSWORD"
TUYA_EMAIL = "person1@igovernance.co.za"
TUYA_PASSWORD = "wTNkWGZNd-_37Ua"

async def reauth_tuya():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await context.new_page()

        print("1. Navigating to Home Assistant...")
        await page.goto(HA_URL)
        await page.wait_for_load_state("networkidle", timeout=15000)

        # HA Login
        if "auth" in page.url:
            print("2. Logging into HA...")
            await page.wait_for_timeout(2000)

            await page.evaluate(f'''() => {{
                function findInputs(root) {{
                    let inputs = [];
                    const elements = root.querySelectorAll('*');
                    elements.forEach(el => {{
                        if (el.shadowRoot) inputs = inputs.concat(findInputs(el.shadowRoot));
                        if (el.tagName === 'INPUT') inputs.push(el);
                    }});
                    return inputs;
                }}
                const inputs = findInputs(document);
                if (inputs.length >= 2) {{
                    inputs[0].value = "{HA_USER}";
                    inputs[0].dispatchEvent(new Event('input', {{ bubbles: true }}));
                    inputs[1].value = "{HA_PASSWORD}";
                    inputs[1].dispatchEvent(new Event('input', {{ bubbles: true }}));
                }}
            }}''')

            await page.keyboard.press("Enter")
            await page.wait_for_timeout(4000)

            if "auth" in page.url:
                print("   ERROR: HA login failed")
                await browser.close()
                return False
            print("   HA login successful!")

        # Navigate to Tuya integration
        print("3. Navigating to Tuya integration...")
        await page.goto(f"{HA_URL}/config/integrations/integration/tuya")
        await page.wait_for_timeout(3000)
        await page.screenshot(path="/tmp/tuya_page.png")

        # Click the 3-dot menu on the failed entry (right side)
        print("4. Clicking 3-dot menu on failed entry...")
        # The 3-dot menu is at approximately x=1205, y=290 based on screenshot
        # Use coordinate click on the right side of the entry
        await page.mouse.click(1205, 290)
        await page.wait_for_timeout(1000)
        await page.screenshot(path="/tmp/tuya_menu_opened.png")

        # Try Reload first, then System options if needed
        print("5. Trying Reload...")
        try:
            await page.click("text=Reload", timeout=3000)
            print("   Clicked Reload")
            await page.wait_for_timeout(5000)
            await page.screenshot(path="/tmp/tuya_after_reload.png")
        except Exception as e:
            print(f"   Reload failed: {e}")
            # Try System options
            print("   Trying System options...")
            try:
                await page.click("text=System options", timeout=3000)
                await page.wait_for_timeout(1000)
                await page.screenshot(path="/tmp/tuya_system_options.png")
                # Look for reconfigure here
                await page.click("text=Reconfigure", timeout=3000)
                print("   Clicked Reconfigure from System options")
            except:
                await page.screenshot(path="/tmp/tuya_no_reconfig.png")
                print("   Could not find reconfigure option")

        await page.wait_for_timeout(3000)
        await page.screenshot(path="/tmp/tuya_after_reconfig.png")

        # Now look for the Tuya OAuth page (should be in an iframe or new content)
        print("6. Looking for Tuya login form...")

        # Check for iframe with tuya domain
        frames = page.frames
        tuya_frame = None
        for frame in frames:
            if "tuya" in frame.url.lower() and "192.168" not in frame.url:
                tuya_frame = frame
                print(f"   Found Tuya OAuth frame: {frame.url[:60]}...")
                break

        if tuya_frame:
            # Fill the Tuya login form
            await tuya_frame.wait_for_timeout(2000)

            # Look for inputs in the Tuya frame
            inputs = await tuya_frame.query_selector_all("input")
            print(f"   Found {len(inputs)} inputs in Tuya frame")

            for inp in inputs:
                inp_type = await inp.get_attribute("type")
                if inp_type in ["text", "email", None]:
                    await inp.fill(TUYA_EMAIL)
                    print(f"   Filled email")
                elif inp_type == "password":
                    await inp.fill(TUYA_PASSWORD)
                    print(f"   Filled password")

            # Click login button
            btn = await tuya_frame.query_selector("button")
            if btn:
                await btn.click()
                print("   Clicked Tuya login button")
                await page.wait_for_timeout(5000)
        else:
            print("   No Tuya OAuth frame found")
            # Maybe it's a popup or in the main page
            await page.screenshot(path="/tmp/tuya_no_oauth.png")

        await page.screenshot(path="/tmp/tuya_final.png")
        print("\n7. Done! Screenshots saved to /tmp/tuya_*.png")

        await page.wait_for_timeout(2000)
        await browser.close()
        return True

if __name__ == "__main__":
    result = asyncio.run(reauth_tuya())
    sys.exit(0 if result else 1)
