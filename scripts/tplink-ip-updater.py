#!/opt/homelab/venv/bin/python3
"""
TP-Link IP Auto-Updater for Home Assistant

Discovers TP-Link devices on the network and updates Home Assistant's
config_entries with current IPs. Run on startup to handle DHCP changes.

Requires: python-kasa (pip install python-kasa)
"""

import asyncio
import json
import subprocess
import sys
import time
from pathlib import Path

# Configuration
HA_CONFIG_PATH = Path("/opt/homelab/homeassistant/.storage/core.config_entries")
LOG_FILE = Path("/var/log/tplink-ip-updater.log")

# Known devices by MAC address (lowercase, with colons)
KNOWN_DEVICES = {
    "14:eb:b6:fa:cb:c5": "Mila Bedroom Light",
    "28:87:ba:db:0a:0b": "Main Bedroom Light",
    "fc:ee:28:05:8a:fb": "Garage Switch",  # From ARP table
    "14:eb:b6:fa:96:a8": "Garage Switch",  # From HA config (may be different)
}


def log(message: str):
    """Log to file and stdout."""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message}"
    print(line)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


async def discover_tplink_devices(timeout: int = 10) -> dict:
    """Discover TP-Link devices on the network using python-kasa."""
    try:
        from kasa import Discover

        log(f"Discovering TP-Link devices (timeout: {timeout}s)...")
        devices = await Discover.discover(timeout=timeout)

        result = {}
        for ip, dev in devices.items():
            try:
                await dev.update()
                mac = dev.mac.lower().replace("-", ":")
                result[mac] = {
                    "ip": ip,
                    "alias": dev.alias,
                    "model": dev.model,
                }
                log(f"  Found: {dev.alias} ({dev.model}) at {ip} - MAC: {mac}")
            except Exception as e:
                log(f"  Error getting info from {ip}: {e}")

        return result
    except ImportError:
        log("ERROR: python-kasa not installed. Run: pip install python-kasa")
        return {}
    except Exception as e:
        log(f"ERROR during discovery: {e}")
        return {}


def update_config_entries(discovered: dict) -> bool:
    """Update HA config_entries with discovered IPs."""
    if not HA_CONFIG_PATH.exists():
        log(f"ERROR: Config file not found: {HA_CONFIG_PATH}")
        return False

    try:
        with open(HA_CONFIG_PATH) as f:
            config = json.load(f)
    except Exception as e:
        log(f"ERROR reading config: {e}")
        return False

    updated = False
    entries = config.get("data", {}).get("entries", [])

    for entry in entries:
        if entry.get("domain") != "tplink":
            continue

        unique_id = entry.get("unique_id", "").lower()
        current_ip = entry.get("data", {}).get("host", "")
        title = entry.get("title", "Unknown")

        if unique_id in discovered:
            new_ip = discovered[unique_id]["ip"]
            if new_ip != current_ip:
                log(f"Updating {title}: {current_ip} -> {new_ip}")
                entry["data"]["host"] = new_ip
                updated = True
            else:
                log(f"No change for {title}: {current_ip}")
        else:
            log(f"WARNING: {title} (MAC: {unique_id}) not discovered on network")

    if updated:
        try:
            # Backup original
            backup_path = HA_CONFIG_PATH.with_suffix(".backup")
            with open(backup_path, "w") as f:
                with open(HA_CONFIG_PATH) as orig:
                    f.write(orig.read())

            # Write updated config
            with open(HA_CONFIG_PATH, "w") as f:
                json.dump(config, f, indent=2)

            log(f"Config updated successfully (backup: {backup_path})")
            return True
        except Exception as e:
            log(f"ERROR writing config: {e}")
            return False
    else:
        log("No IP changes needed")
        return False


def get_tplink_entry_ids() -> list:
    """Get TP-Link config entry IDs for reloading."""
    try:
        with open(HA_CONFIG_PATH) as f:
            config = json.load(f)
        return [e["entry_id"] for e in config.get("data", {}).get("entries", [])
                if e.get("domain") == "tplink"]
    except Exception:
        return []


async def wait_for_ha(timeout: int = 180) -> bool:
    """Wait for Home Assistant to be ready."""
    import urllib.request
    import urllib.error

    log(f"Waiting for Home Assistant to be ready (max {timeout}s)...")
    start = time.time()

    while time.time() - start < timeout:
        try:
            req = urllib.request.Request("http://localhost:8123/api/", method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status in (200, 401):  # 401 = needs auth but HA is up
                    log("Home Assistant is ready")
                    return True
        except Exception:
            pass
        await asyncio.sleep(5)

    log("WARNING: Home Assistant not ready within timeout")
    return False


async def reload_tplink_integration(entry_ids: list):
    """Reload TP-Link integration entries via HA API."""
    import urllib.request
    import urllib.error

    if not entry_ids:
        log("No TP-Link entries to reload")
        return

    # Wait for HA to be fully up
    if not await wait_for_ha():
        log("Skipping reload - HA not available")
        return

    # Give HA a few more seconds to fully initialize integrations
    await asyncio.sleep(10)

    for entry_id in entry_ids:
        try:
            # Use config entry reload endpoint
            url = f"http://localhost:8123/api/config/config_entries/entry/{entry_id}/reload"
            req = urllib.request.Request(url, method="POST")
            req.add_header("Content-Type", "application/json")

            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status == 200:
                    log(f"Reloaded TP-Link entry {entry_id}")
                else:
                    log(f"Reload returned status {resp.status}")
        except urllib.error.HTTPError as e:
            if e.code == 401:
                log("HA API requires auth - integration will use new IPs on next restart")
            else:
                log(f"Failed to reload entry {entry_id}: {e}")
        except Exception as e:
            log(f"Error reloading {entry_id}: {e}")

    log("TP-Link reload complete (changes will apply on next HA restart if API auth required)")


async def main():
    """Main entry point."""
    log("=" * 50)
    log("TP-Link IP Auto-Updater starting")

    # Short wait for network interfaces
    await asyncio.sleep(5)

    # Discover devices (runs in parallel with HA startup)
    discovered = await discover_tplink_devices(timeout=15)

    if not discovered:
        log("No TP-Link devices discovered. Will retry on next boot.")
        log("=" * 50)
        return  # Don't exit with error - don't block anything

    log(f"Discovered {len(discovered)} device(s)")

    # Get entry IDs before updating config
    entry_ids = get_tplink_entry_ids()

    # Update config if needed
    if update_config_entries(discovered):
        # Reload integration (waits for HA, doesn't block boot)
        await reload_tplink_integration(entry_ids)
    else:
        log("IPs unchanged - no reload needed")

    log("TP-Link IP Auto-Updater complete")
    log("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
