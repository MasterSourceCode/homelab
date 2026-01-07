# Project: Smart Home Automation Platform

## Project Context
- Docker-based smart home on Beelink N95 Mini PC (4 cores, 8GB RAM, Intel UHD iGPU)
- Home Assistant + Frigate NVR + CompreFace + Double Take
- Production 24/7 system - **Claude Code has sudo privileges**
- Timezone: Host UTC | HA container SAST (UTC+2) | Frigate Unix epoch

## Tech Stack
| Component | Details |
|-----------|---------|
| Orchestration | Docker Compose (`sudo docker compose`) |
| Hub | Home Assistant 2025.12 |
| NVR | Frigate 0.16.3 + OpenVINO + YOLOv8s (Intel iGPU) |
| Cameras | Amcrest (RTSP), Wyze (docker-wyze-bridge), EZVIZ, Blink |
| Face Recognition | CompreFace + Double Take |
| AI | Google Generative AI - **5 req/min limit** |
| Message Bus | Mosquitto MQTT (1883, auth required) |
| Alarm | DSC panel via Envisalink |

## Critical Ports
| Service | Port | Notes |
|---------|------|-------|
| Home Assistant | 8123 | Main interface |
| Frigate API | **5002** | Remapped (wyze uses 5000) |
| Frigate CORS Proxy | **5003** | **Dashboard MUST use this** |
| Frigate UI | 8971 | HTTPS |
| MQTT | 1883 | Auth required |
| Double Take | 3000 | Face processing |
| CompreFace | 8000 | Face recognition API |

---

## Critical Rules

### Docker
- Use `sudo docker compose` (not `docker-compose`)
- Wyze-bridge and Scrypted MUST use `network_mode: host`
- Frigate requires `extra_hosts: host.docker.internal:host-gateway`
- Never remove `/dev/dri/renderD128` from Frigate (Intel iGPU)
- Service startup order: mosquitto → frigate → homeassistant

### Environment Variables
- All credentials stored in `.env` file (never committed)
- Docker Compose uses `${VAR}` syntax
- **Frigate config uses `{VAR}` syntax** (no dollar sign) for interpolation
- Reference `.env.example` for required variables

### Frigate 0.16.x
- Use `model_type: yolo-generic` (NOT "yolov8")
- Use `retain.days` + `retain.mode` (not old recording format)
- Database migrations NOT backward compatible - backup before upgrade
- Face recognition: NO `device`/`model_size` params (validation error)
- LPR: `license_plate` is NOT trackable - runs automatically on cars
- Auth: Use `trusted_proxies`, NOT `auth.enabled: false`

```yaml
# MQTT vs Storage thresholds
objects:
  filters:
    person:
      min_score: 0.55    # Starts tracking → MQTT
      threshold: 0.75    # Required to STORE
```

### Home Assistant
- `input_text` max 255 chars - breaks domain if exceeded
- Webhook automations need `local_only: false` for external access
- Jinja2: use `namespace(found=false)` for boolean accumulation
- Shadow DOM: use JavaScript `evaluate()` to pierce components

### Testing
- **NEVER** test critical notifications when household asleep
- Test security automations during daylight hours only
- Always validate YAML before reloading

---

## Security System (DSC Alarm)

### Key Entities
| Entity | Purpose |
|--------|---------|
| `alarm_control_panel.alarm_partition_1` | Main panel |
| `input_boolean.frigate_detection_paused` | Detection toggle |
| `input_boolean.dog_mode` | Skip person alerts |
| `input_boolean.guest_mode` | Reduce notifications |

### Arming Modes
- **Stay (Home):** Exterior + Entry only
- **Away:** All zones (perimeter + interior)
- **Night:** Exterior + downstairs (excludes bedrooms)

### Alert Pattern (Armed State)
```yaml
trigger:
  - platform: mqtt
    topic: frigate/events
variables:
  event_data: "{{ trigger.payload_json }}"
  event_type: "{{ event_data.type }}"
  label: "{{ event_data.after.label }}"
  top_score: "{{ event_data.after.top_score }}"
  event_id: "{{ event_data.after.id }}"
condition:
  - "{{ event_type == 'new' and label == 'person' }}"
  - "{{ top_score > 0.60 }}"
  - alarm is armed
```

### iOS Critical Notification
```yaml
data:
  push:
    sound: { name: default, critical: 1, volume: 1.0 }
    interruption-level: critical
  image: "http://SERVER:5003/api/events/{{ event_id }}/snapshot.jpg"
```

---

## MQTT Control

### Frigate Camera Control
```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -u "$USER" -P "$PASS" \
  -t "frigate/CAMERA/detect/set" -m "OFF"
```

### Cameras (MQTT topics)
`front_door`, `backyard`, `wyze_garage`, `ezviz_indoor`

---

## Automation Patterns

### Throttling (Prevent Spam)
```yaml
condition:
  - condition: template
    value_template: >
      {{ (now() - state_attr(this.entity_id, 'last_triggered')).total_seconds() > 60 }}
```

### Critical Automations
```yaml
mode: queued
max: 5
```

---

## Dashboard Development

### Version Bump (MANDATORY)
```bash
cd /opt/homelab/homeassistant/www/dashboard && ./bump-version.sh "description"
```
Mobile cache fix: Close app 10 seconds, reopen

### Architecture
```
data-action="foo" → event-handler.js → dashboard.foo() → views.js → controller
```

### Rules
- Single source of truth: `js/view-registry.js`
- No inline onclick: Use `data-action` with `data-param-*`
- No window globals: Use `window.dashboard` or `window.mobile`
- Always verify `state.authenticated` and `state.entities`
- Browser: `crypto.subtle` requires HTTPS, use CORS proxy (5003)

---

## Integration Recovery

### Tuya (Gate)
- Tokens expire 2 hours; fails if HA starts before internet
- Auto-fix: `automation.system_tuya_auto_reload_on_startup` (90s delay)
- Manual: `python3 /opt/homelab/scripts/tuya_reauth.py`
- Recovery: `auto_recovery_gate_switch_power_cycle` power cycles GatePlug

### Sonoff/eWeLink
- Cloud-dependent; expect 503/504/529 after router restarts
- Reconnection: 1-5 minutes after network outage

---

## Background Services

### CPU Monitor (`homelab-monitor.service`)
- Polls CPU every 60s, auto-pauses Frigate when overloaded
- Pause: >80% for 10min | Resume: <70% for 20min
- Script: `/opt/homelab/scripts/system-monitor.py`

### Backup (`homelab-backup.timer`)
- Runs 2am daily to Backblaze B2
- Skips if no changes (MD5 checksum)
- Script: `/opt/homelab/scripts/backup-to-cloud.sh`
- Restore: `/opt/homelab/scripts/restore-from-cloud.sh`

```bash
# Commands
sudo systemctl status homelab-monitor
sudo /opt/homelab/scripts/backup-to-cloud.sh --force
```

---

## Git/GitHub (Public Repo)

### Whitelist .gitignore Pattern
Repository uses whitelist approach: ignores everything (`*`), explicitly includes needed files with `!pattern`.

### Sanitization Requirements
Before pushing to public repo, verify NO:
- Real passwords/API keys (use `YOUR_*_PASSWORD` placeholders)
- Personal names (use Person1, Person2, etc.)
- Physical addresses
- Real device IPs (use `192.168.x.x`)
- Personal email addresses
- Location-identifying strings in entity IDs or localStorage keys

### Push Workflow
```bash
git add -A && git commit -m "message" && git push origin main
# If sanitization fix needed:
git commit --amend && git push --force origin main
```

---

## Debugging

```bash
# Docker
sudo docker compose logs -f SERVICE
sudo docker compose restart SERVICE

# Frigate API
curl -s http://localhost:5002/api/stats | jq '.detectors'
curl -s "http://localhost:5002/api/events?limit=20&labels=person"

# YAML validation
sudo docker exec homeassistant python3 -c \
  "import yaml; yaml.safe_load(open('/config/automations.yaml')); print('Valid')"

# After config changes
sudo docker compose restart frigate homeassistant
sudo docker restart frigate-proxy  # If CORS issues
```

---

## Known Issues
| Problem | Solution |
|---------|----------|
| Tuya "Failed to set up" | Wait 90s (auto-reload) or run `tuya_reauth.py` |
| Sonoff cloud errors | Wait 1-5 min; check router |
| Gate unavailable | Auto-recovery power cycles GatePlug |
| Frigate validation error | Remove unsupported params |
| Wyze IOTC_ER_TIMEOUT | Ensure `network_mode: host` |
| CORS errors | Use port 5003, restart frigate-proxy |
| Mobile stale content | Run `bump-version.sh`, close app 10s |

---

## File Locations
| Path | Purpose |
|------|---------|
| `docker-compose.yml` | All services |
| `.env` | Credentials (not committed) |
| `.env.example` | Credential template |
| `frigate/config/config.yml` | Frigate + go2rtc config |
| `homeassistant/automations.yaml` | All automations |
| `homeassistant/www/dashboard/` | Custom dashboard |
| `scripts/system-monitor.py` | CPU auto-management |
| `scripts/backup-to-cloud.sh` | Backup script |
| `backups/rclone.conf` | Backblaze credentials |
