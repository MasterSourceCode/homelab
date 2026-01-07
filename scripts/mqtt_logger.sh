#!/bin/bash
# MQTT Logger for Frigate Events
# Logs all frigate/events messages with timestamps

LOG_DIR="/opt/homelab/logs"
LOG_FILE="$LOG_DIR/mqtt_frigate_events.log"
MQTT_USER="homeassistant"
MQTT_PASS="YOUR_MQTT_PASSWORD"

mkdir -p "$LOG_DIR"

echo "$(date -Iseconds) - MQTT Logger started" >> "$LOG_FILE"

# Connect to mosquitto with auth
exec mosquitto_sub -h 127.0.0.1 -p 1883 -u "$MQTT_USER" -P "$MQTT_PASS" -t "frigate/events" -F '%I | %t | %p' >> "$LOG_FILE" 2>&1
