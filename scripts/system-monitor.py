#!/usr/bin/env python3
"""
System Monitor Service - Lightweight background monitor for auto-management
Polls system metrics once per minute and takes automated actions.

Current Monitors:
- CPU Auto-throttle: Pauses Frigate AI when CPU >80% for 10min, resumes when <70% for 20min
"""

import time
import psutil
import subprocess
import logging
import json
from datetime import datetime

# ============================================
# CONFIGURATION
# ============================================

# MQTT Settings
MQTT_HOST = "127.0.0.1"
MQTT_PORT = "1883"
MQTT_USER = "homeassistant"
MQTT_PASS = "YOUR_MQTT_PASSWORD"

# CPU Monitor Settings
CPU_HIGH_THRESHOLD = 80      # Pause detection when CPU above this
CPU_LOW_THRESHOLD = 70       # Resume detection when CPU below this
CPU_HIGH_MINUTES = 10        # Minutes above threshold before pausing
CPU_LOW_MINUTES = 20         # Minutes below threshold before resuming
POLL_INTERVAL = 60           # Poll every 60 seconds

# ============================================
# STATE
# ============================================

class MonitorState:
    """Lightweight state tracker for monitors"""
    def __init__(self):
        self.cpu_high_count = 0
        self.cpu_low_count = 0
        self.frigate_paused = False
        self.last_action_time = None

state = MonitorState()

# ============================================
# LOGGING
# ============================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Also log to file if possible
try:
    file_handler = logging.FileHandler('/opt/homelab/logs/system-monitor.log')
    file_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
    logger.addHandler(file_handler)
except Exception as e:
    logger.warning(f"Could not add file handler: {e}")

# ============================================
# MQTT CONTROL
# ============================================

def mqtt_publish(topic, payload):
    """Publish MQTT message via mosquitto_pub"""
    try:
        cmd = [
            'mosquitto_pub',
            '-h', MQTT_HOST,
            '-p', MQTT_PORT,
            '-u', MQTT_USER,
            '-P', MQTT_PASS,
            '-t', topic,
            '-m', payload
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=5, text=True)
        return result.returncode == 0
    except Exception as e:
        logger.error(f"MQTT publish failed: {e}")
        return False

def call_ha_service_mqtt(entity_id, command):
    """Call HA service via MQTT (for input_boolean)"""
    topic = f"homeassistant/input_boolean/{entity_id.split('.')[-1]}/set"
    return mqtt_publish(topic, command)

def get_frigate_state():
    """Get current Frigate detection state from cached state"""
    # We track state internally - no need to query HA constantly
    return state.frigate_paused

def pause_frigate():
    """Pause Frigate detection to save CPU - sends MQTT commands directly to all cameras"""
    cameras = ['front_door', 'backyard', 'wyze_garage', 'ezviz_indoor']
    success = True

    for camera in cameras:
        topic = f"frigate/{camera}/detect/set"
        if not mqtt_publish(topic, 'OFF'):
            success = False

    # Also set the HA boolean for dashboard sync
    call_ha_service_mqtt('input_boolean.frigate_detection_paused', 'ON')

    if success:
        state.frigate_paused = True
        state.last_action_time = datetime.now()
        logger.warning("🔴 PAUSED Frigate detection on all cameras (CPU overload)")
    return success

def resume_frigate():
    """Resume Frigate detection - sends MQTT commands directly to all cameras"""
    cameras = ['front_door', 'backyard', 'wyze_garage', 'ezviz_indoor']
    success = True

    for camera in cameras:
        topic = f"frigate/{camera}/detect/set"
        if not mqtt_publish(topic, 'ON'):
            success = False

    # Also set the HA boolean for dashboard sync
    call_ha_service_mqtt('input_boolean.frigate_detection_paused', 'OFF')

    if success:
        state.frigate_paused = False
        state.last_action_time = datetime.now()
        logger.info("🟢 RESUMED Frigate detection on all cameras (CPU normal)")
    return success

# ============================================
# MONITORS
# ============================================

def check_cpu():
    """
    CPU Auto-throttle Monitor
    - Pauses Frigate when CPU >80% for 10 consecutive minutes
    - Resumes when CPU <70% for 20 consecutive minutes
    """
    cpu_percent = psutil.cpu_percent(interval=1)

    if cpu_percent > CPU_HIGH_THRESHOLD:
        state.cpu_high_count += 1
        state.cpu_low_count = 0  # Reset low counter

        if state.cpu_high_count >= CPU_HIGH_MINUTES and not state.frigate_paused:
            logger.warning(f"CPU high for {CPU_HIGH_MINUTES} min ({cpu_percent:.1f}%), pausing Frigate")
            pause_frigate()
            state.cpu_high_count = 0  # Reset to avoid repeated triggers

    elif cpu_percent < CPU_LOW_THRESHOLD:
        state.cpu_low_count += 1
        state.cpu_high_count = 0  # Reset high counter

        if state.cpu_low_count >= CPU_LOW_MINUTES and state.frigate_paused:
            logger.info(f"CPU normal for {CPU_LOW_MINUTES} min ({cpu_percent:.1f}%), resuming Frigate")
            resume_frigate()
            state.cpu_low_count = 0  # Reset to avoid repeated triggers

    else:
        # Between thresholds - maintain current state
        state.cpu_high_count = max(0, state.cpu_high_count - 1)  # Slow decay
        state.cpu_low_count = max(0, state.cpu_low_count - 1)

    # Log status every 5 minutes
    if (state.cpu_high_count + state.cpu_low_count) % 5 == 0:
        status = "PAUSED" if state.frigate_paused else "ACTIVE"
        logger.info(f"CPU: {cpu_percent:.1f}% | Frigate: {status} | High:{state.cpu_high_count} Low:{state.cpu_low_count}")

# ============================================
# MAIN LOOP
# ============================================

def run_monitors():
    """Main monitoring loop - runs all checks once per minute"""
    logger.info("🚀 System Monitor started")
    logger.info(f"CPU thresholds: Pause >{CPU_HIGH_THRESHOLD}% for {CPU_HIGH_MINUTES}min, Resume <{CPU_LOW_THRESHOLD}% for {CPU_LOW_MINUTES}min")

    while True:
        try:
            # Run all monitors
            check_cpu()

            # Add future monitors here:
            # check_memory()
            # check_disk()
            # check_temperature()

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            logger.info("Monitor stopped by user")
            break
        except Exception as e:
            logger.error(f"Monitor error: {e}", exc_info=True)
            time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    run_monitors()
