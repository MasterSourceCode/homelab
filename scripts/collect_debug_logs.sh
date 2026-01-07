#!/bin/bash
# Debug Log Collector for Dog Mode Investigation
# Gathers MQTT, HA automation, and Frigate detection logs

LOG_DIR="/opt/homelab/logs"
OUTPUT_FILE="$LOG_DIR/debug_report_$(date +%Y%m%d_%H%M%S).txt"

echo "=======================================" | tee "$OUTPUT_FILE"
echo "DEBUG LOG REPORT - $(date)" | tee -a "$OUTPUT_FILE"
echo "=======================================" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# MQTT Events Log
echo "=== MQTT FRIGATE EVENTS (last 100 lines) ===" | tee -a "$OUTPUT_FILE"
tail -100 "$LOG_DIR/mqtt_frigate_events.log" 2>/dev/null | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# HA Dog Mode Automation Logs
echo "=== HOME ASSISTANT DOG MODE LOGS ===" | tee -a "$OUTPUT_FILE"
sudo docker logs homeassistant 2>&1 | grep -i "dog_mode\|auto_disarm" | tail -100 | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# HA MQTT Subscription Logs
echo "=== HOME ASSISTANT MQTT DEBUG ===" | tee -a "$OUTPUT_FILE"
sudo docker logs homeassistant 2>&1 | grep -i "mqtt.*subscription\|mqtt.*message" | tail -50 | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Frigate Detection Logs
echo "=== FRIGATE DETECTION LOGS ===" | tee -a "$OUTPUT_FILE"
sudo docker logs frigate 2>&1 | grep -iE "person|object_processing|events.maintainer" | tail -100 | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Frigate Events API (last 20)
echo "=== FRIGATE STORED EVENTS (last 20) ===" | tee -a "$OUTPUT_FILE"
curl -s "http://localhost:5002/api/events?limit=20" | python3 -c "
import sys, json
from datetime import datetime
try:
    data = json.load(sys.stdin)
    for e in data:
        ts = datetime.utcfromtimestamp(e['start_time']).strftime('%Y-%m-%d %H:%M:%S UTC')
        score = e.get('data',{}).get('score','N/A') if isinstance(e.get('data'), dict) else 'N/A'
        print(f'{ts} | {e[\"camera\"]:15} | {e[\"label\"]:8} | score: {score}')
except Exception as ex:
    print(f'Error: {ex}')
" 2>&1 | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Current States
echo "=== CURRENT SECURITY STATES ===" | tee -a "$OUTPUT_FILE"
echo "dog_mode: checking..." | tee -a "$OUTPUT_FILE"
echo "alarm_state: checking..." | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

echo "=======================================" | tee -a "$OUTPUT_FILE"
echo "Report saved to: $OUTPUT_FILE"
echo "======================================="
