#!/bin/bash
# Docker Compose Startup Script
# Ensures containers are created fresh with current .env values
# This prevents stale environment variables after system reboot

set -e

HOMELAB_DIR="/opt/homelab"
LOG_FILE="/var/log/homelab-startup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

cd "$HOMELAB_DIR"

log "Starting Docker Compose stack with fresh containers..."

# Wait for Docker to be fully ready
sleep 5

# Stop any containers that Docker may have auto-restarted with stale config
log "Stopping any auto-restarted containers..."
sudo docker compose down --remove-orphans 2>&1 | tee -a "$LOG_FILE" || true

sleep 3

# Force recreate containers to ensure fresh env vars from .env
# This is critical because Docker caches env vars in the container config
# and won't pick up .env changes on restart
sudo docker compose up -d --force-recreate 2>&1 | tee -a "$LOG_FILE"

log "Waiting for services to become healthy..."

# Wait for critical services
for service in mosquitto frigate homeassistant; do
    max_wait=120
    waited=0
    while [ $waited -lt $max_wait ]; do
        health=$(sudo docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "unknown")
        if [ "$health" = "healthy" ]; then
            log "$service is healthy"
            break
        fi
        sleep 5
        waited=$((waited + 5))
    done
    if [ $waited -ge $max_wait ]; then
        log "WARNING: $service did not become healthy within ${max_wait}s"
    fi
done

# Verify Frigate cameras have env vars
frigate_vars=$(sudo docker exec frigate env 2>/dev/null | grep -c "^FRIGATE_" || echo "0")
log "Frigate has $frigate_vars FRIGATE_* environment variables"

if [ "$frigate_vars" -lt 8 ]; then
    log "ERROR: Frigate missing environment variables, forcing recreate..."
    sudo docker compose up -d --force-recreate frigate 2>&1 | tee -a "$LOG_FILE"
fi

# Verify cameras are streaming
sleep 30
camera_status=$(curl -s http://localhost:5002/api/stats 2>/dev/null | jq -r '.cameras | to_entries[] | "\(.key)=\(.value.camera_fps // 0)"' 2>/dev/null || echo "API unavailable")
log "Camera status: $camera_status"

log "Startup complete"
