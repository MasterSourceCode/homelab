#!/bin/bash
# Frigate Health Check Script
# Checks if cameras are returning valid frames vs error placeholder
# Returns 0 if healthy, 1 if unhealthy

FRIGATE_API="http://localhost:5002/api"
CAMERAS="front_door backyard wyze_garage ezviz_indoor"
ERROR_PLACEHOLDER_SIZE=51868  # Size of Frigate's "No frames received" error image
UNHEALTHY_COUNT=0
TOTAL_CAMERAS=0

for camera in $CAMERAS; do
    TOTAL_CAMERAS=$((TOTAL_CAMERAS + 1))

    # Get image and check size
    SIZE=$(curl -s -o /dev/null -w "%{size_download}" "${FRIGATE_API}/${camera}/latest.jpg" 2>/dev/null)

    if [ "$SIZE" = "$ERROR_PLACEHOLDER_SIZE" ]; then
        echo "UNHEALTHY: $camera returning error placeholder (size: $SIZE)"
        UNHEALTHY_COUNT=$((UNHEALTHY_COUNT + 1))
    elif [ "$SIZE" -lt 1000 ]; then
        echo "UNHEALTHY: $camera returned invalid response (size: $SIZE)"
        UNHEALTHY_COUNT=$((UNHEALTHY_COUNT + 1))
    else
        echo "HEALTHY: $camera (size: $SIZE)"
    fi
done

echo ""
echo "Summary: $((TOTAL_CAMERAS - UNHEALTHY_COUNT))/$TOTAL_CAMERAS cameras healthy"

# Return unhealthy if all cameras are down
if [ "$UNHEALTHY_COUNT" -eq "$TOTAL_CAMERAS" ]; then
    echo "CRITICAL: All cameras unhealthy!"
    exit 1
elif [ "$UNHEALTHY_COUNT" -gt 0 ]; then
    echo "WARNING: Some cameras unhealthy"
    exit 2
else
    echo "OK: All cameras healthy"
    exit 0
fi
