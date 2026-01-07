#!/bin/bash
# Frigate Cloudflare Quick Tunnel
# Logs the tunnel URL to files for easy access

LOG_FILE="/opt/homelab/cloudflared/tunnel-url.txt"
DASHBOARD_FILE="/opt/homelab/homeassistant/www/dashboard/frigate-url.txt"
mkdir -p /opt/homelab/cloudflared

# Run cloudflared and capture the URL
cloudflared tunnel --url http://localhost:5002 2>&1 | while read line; do
    echo "$line"
    # Extract and save the tunnel URL
    if echo "$line" | grep -q "trycloudflare.com"; then
        URL=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com')
        if [ -n "$URL" ]; then
            echo "$URL" > "$LOG_FILE"
            echo "$URL" > "$DASHBOARD_FILE"
            echo "Tunnel URL saved: $URL"
        fi
    fi
done
