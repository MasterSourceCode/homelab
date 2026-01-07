#!/bin/bash
# Live tail of all debug logs for dog mode investigation
# Usage: ./tail_debug_logs.sh

echo "Tailing debug logs... Press Ctrl+C to stop"
echo "======================================="
echo ""

# Use multitail if available, otherwise parallel tail
if command -v multitail &> /dev/null; then
    multitail \
        -l "tail -F /opt/homelab/logs/mqtt_frigate_events.log" \
        -l "sudo docker logs -f homeassistant 2>&1 | grep --line-buffered -i 'dog_mode\|auto_disarm\|mqtt'" \
        -l "sudo docker logs -f frigate 2>&1 | grep --line-buffered -iE 'person|object'"
else
    # Fallback: interleaved output
    (
        tail -F /opt/homelab/logs/mqtt_frigate_events.log 2>/dev/null | sed 's/^/[MQTT] /' &
        sudo docker logs -f homeassistant 2>&1 | grep --line-buffered -i "dog_mode\|auto_disarm" | sed 's/^/[HA] /' &
        sudo docker logs -f frigate 2>&1 | grep --line-buffered -iE "person|object_processing" | sed 's/^/[FRIG] /' &
        wait
    )
fi
