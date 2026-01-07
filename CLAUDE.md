# Project: Smart Home Automation Platform

## Project Context
- Docker-based smart home on Beelink N95 Mini PC (4 cores, 8GB RAM, Intel UHD iGPU)
- Home Assistant + Frigate NVR + Google Gemini (limited use) + Native Face Recognition
- Production 24/7 system in Your City, Country
- Server IP: 192.168.x.x
- Address: YOUR_ADDRESS_HERE
- **Claude Code has sudo privileges** - use `sudo` for all operations

## Timezone Context
- **Host:** UTC | **HA container:** SAST (UTC+2) | **Frigate:** Unix epoch
- Correlation: HA 15:00 SAST = 13:00 UTC = Frigate epoch

## Network Access
| Type | URL |
|------|-----|
| Local | `http://192.168.x.x:8123` |
| Nabu Casa | `https://your-instance.ui.nabu.casa` |
| Dashboard | `http://192.168.x.x:8123/local/dashboard/index.html` |

## Tech Stack
| Component | Details |
|-----------|---------|
| Orchestration | Docker Compose (`sudo docker compose`) |
| Hub | Home Assistant 2025.12 |
| NVR | Frigate 0.16.3 with OpenVINO + YOLOv8s (Intel iGPU) |
| Cameras | Amcrest (RTSP), Wyze (docker-wyze-bridge), EZVIZ, Blink |
| AI | Google Generative AI - **5 req/min limit** (use sparingly) |
| Message Bus | Mosquitto MQTT (port 1883, auth required) |
| Alarm | DSC panel via Envisalink (192.168.x.x) |

## Critical Port Mappings
| Service | Port | Notes |
|---------|------|-------|
| Home Assistant | 8123 | Main interface |
| Frigate API | **5002** | Direct (wyze uses 5000) |
| Frigate CORS Proxy | **5003** | **Dashboard/notifications MUST use this** |
| Frigate UI | 8971 | HTTPS, login: admin/admin |
| MQTT | 1883 | Mosquitto (credentials in scripts) |

---

## Critical Rules

### Docker
- Use `sudo docker compose` (not `docker-compose`)
- Wyze-bridge MUST use `network_mode: host`
- Frigate requires `extra_hosts: host.docker.internal:host-gateway`
- Never remove `/dev/dri/renderD128` from Frigate (Intel iGPU)

### Frigate 0.16.x
- Use `model_type: yolo-generic` (NOT "yolov8")
- Use `retain.days` + `retain.mode` (not old recording format)
- Database migrations NOT backward compatible - always backup before upgrade
- **Face recognition:** NO `device`/`model_size` params (causes validation error)
- **LPR:** `license_plate` is NOT a trackable object - runs automatically on cars
- **Auth:** Use trusted_proxies, NOT `auth.enabled: false`

```yaml
auth:
  enabled: true
  trusted_proxies: [192.168.68.0/24, 172.16.0.0/12, 127.0.0.1]
```

### Frigate MQTT vs Storage
```yaml
objects:
  filters:
    person:
      min_score: 0.55    # Starts tracking → sends MQTT
      threshold: 0.75    # Must reach to STORE in database
```

### Home Assistant
- `input_text` max is 255 chars - breaks entire domain if exceeded
- Webhook automations need `local_only: false` for external access
- Jinja2 loops: use `namespace(found=false)` for boolean accumulation
- HA uses shadow DOM components - use JavaScript `evaluate()` to pierce

### Testing Constraints
- **NEVER** test critical notifications when wife is asleep (will wake household)
- Test security automations during daylight hours only
- Always validate YAML before reloading automations

---

## Security System (DSC Alarm)

### Key Entities
- **Alarm Panel:** `alarm_control_panel.alarm_partition_1`
- **Modes:** `armed_away`, `armed_home`, `armed_night`, `disarmed`
- **Panic:** `alarm_control_panel.alarm_trigger`
- **Detection Toggle:** `input_boolean.frigate_detection_paused`
- **Dog Mode:** `input_boolean.dog_mode` (skips person detection)
- **Guest Mode:** `input_boolean.guest_mode` (reduces alerts)

### Arming Modes
| Mode | Arms |
|------|------|
| Stay (Home) | Exterior + Entry only (walk around at night) |
| Away | All zones - perimeter + all interior |
| Night | Exterior + downstairs (excludes bedrooms for bathroom trips) |

### Zone Architecture
17 zones, 1 partition: Entry/Exit + Exterior (all modes) | Interior Down (Away, Night) | Bedrooms (Away only)

---

## Security Automations

### Person Detection Alerts (Armed State)
**CRITICAL:** Use Frigate confidence only - NO AI analysis needed for person detection

**Pattern:**
```yaml
trigger:
  - platform: mqtt
    topic: frigate/events
variables:
  event_data: "{{ trigger.payload_json }}"
  camera: "{{ event_data.after.camera }}"
  label: "{{ event_data.after.label }}"
  event_type: "{{ event_data.type }}"
  event_id: "{{ event_data.after.id }}"
  top_score: "{{ event_data.after.top_score }}"
  confidence_pct: "{{ (top_score * 100) | round(0) | int }}"
condition:
  - "{{ event_type == 'new' and label == 'person' }}"
  - "{{ top_score > 0.60 }}"  # 60% confidence threshold
  - alarm is armed (any mode)
  - dog_mode is off
action:
  # Dual notifications - BOTH phones
  - service: notify.mobile_app_person2_phone
  - service: notify.mobile_app_person1_phone
```

**Snapshot URL:** `http://192.168.x.x:5003/api/events/{{ event_id }}/snapshot.jpg` (use CORS proxy 5003)

### Critical iOS Notifications
**Pattern for maximum alert priority:**
```yaml
- service: notify.mobile_app_person1_phone
  data:
    title: "🚨 PERSON DETECTED: {{ camera_name }}"
    message: "Alarm is ARMED. Frigate detected person ({{ confidence_pct }}% confidence)"
    data:
      push:
        sound:
          name: default
          critical: 1
          volume: 1.0
        interruption-level: critical
      image: "http://192.168.x.x:5003/api/events/{{ event_id }}/snapshot.jpg"
      actions:
        - action: "PANIC_MODE"
          title: "🚨 PANIC"
          destructive: true
        - action: "VIEW_CAMERAS"
          title: "View Cameras"
        - action: "CALL_SECURITY"
          title: "Call Security"
          uri: "tel:10111"
```

### PANIC Mode Response
**Trigger:** iOS notification action `PANIC_MODE`
**Actions (all simultaneous):**
1. `alarm_control_panel.alarm_trigger` - Activate alarm panic
2. Turn ON ALL 18 lights (including main bedroom)
3. Cross-notify both phones with critical alerts
4. Send WhatsApp share notification with pre-filled emergency message
5. Log panic activation to logbook

**WhatsApp Integration:**
```yaml
- action: "URI"
  title: "Share to WhatsApp"
  uri: "whatsapp://send?text={{ emergency_text | urlencode }}"
```
**Emergency message:** "Please help active intruder, YOUR_ADDRESS_HERE"

### Protected Lights Pattern
- **Main Bedroom:** `switch.sonoff_1001e80ff3_1/2/3` - OFF during lockdown, ON during panic
- **All Others:** 15 switches - OFF during lockdown, ON during panic
- Total: 18 light switches

### Alarm Armed Lockdown
**Trigger:** Alarm armed (any mode)
**Actions:**
- Turn OFF 15 lights (exclude main bedroom)
- Turn OFF geyser: `switch.sonoff_10018908af`
- Turn OFF pool pump: `switch.sonoff_10017f2d90_1`

### Notification Action Handling
**Pattern:**
```yaml
trigger:
  - platform: event
    event_type: mobile_app_notification_action
    event_data:
      action: "PANIC_MODE"
```

### AI Analysis (Use Sparingly)
**When to use:** Non-person objects, ambiguous detections, NOT for person detection
**Pattern (if needed):**
```yaml
- service: ai_task.generate_data
  continue_on_error: true  # CRITICAL - always include
  data:
    task_name: "Security Analysis"
    instructions: "MUST start with: THREAT: or SAFE:"
    entity_id: ai_task.google_ai_task
    attachments:
      - media_content_type: image/jpeg
        media_content_id: media-source://media_source/local/snapshots/{{ camera }}.jpg
  response_variable: ai_analysis
```
**Rate limit:** 5 req/min - use throttling

---

## MQTT Control Patterns

### Direct Frigate Camera Control
**Enable/disable detection per camera:**
```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -u "homeassistant" -P "<password>" \
  -t "frigate/front_door/detect/set" -m "OFF"
```
**In Python:** Use `subprocess.run(['mosquitto_pub', '-h', '127.0.0.1', ...])`

### Input Boolean Control via MQTT
```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -u "homeassistant" -P "<password>" \
  -t "homeassistant/input_boolean/frigate_detection_paused/set" -m "ON"
```

### Subscribe to Frigate Events
```bash
mosquitto_sub -h 127.0.0.1 -p 1883 -u "homeassistant" -P "<password>" \
  -t "frigate/events" -v
```

### Frigate Cameras (MQTT topic names)
- `front_door`, `backyard`, `wyze_garage`, `ezviz_indoor`

---

## Automation Patterns

### Throttling (Prevent Alert Spam)
**Use in all motion/detection automations:**
```yaml
- condition: template
  value_template: >
    {{ state_attr(this.entity_id, 'last_triggered') is none or
       (now() - state_attr(this.entity_id, 'last_triggered')).total_seconds() > 60 }}
```

### Dual Notification Pattern
**Always notify both phones for critical alerts:**
```yaml
- service: notify.mobile_app_person2_phone
  data: { ... }
- service: notify.mobile_app_person1_phone
  data: { ... }
```

### Mode Configuration
**Use `mode: queued` for critical automations to prevent lost events:**
```yaml
mode: queued
max: 5
```

---

## Dashboard Development

### Version Bump (MANDATORY after ANY change)
```bash
cd /opt/homelab/homeassistant/www/dashboard && ./bump-version.sh "description"
```
**Mobile cache fix:** Close app 10 seconds, reopen

### Architecture
```
User clicks data-action="foo" → event-handler.js routes to dashboard.foo()
→ main.js exposes foo from views.js → views.js delegates to controller
```

### Key Rules
- Single source of truth: `js/view-registry.js` defines all views/modals
- No inline onclick: Use `data-action="actionName"` with `data-param-*` attributes
- No window globals: Functions via `window.dashboard` (desktop) or `window.mobile` (mobile)
- State checks: Always verify `state.authenticated` and `state.entities` before actions
- Dynamic imports: Use in controllers to avoid circular dependencies

### Adding New Actions
1. Add action handler in `js/event-handler.js` actionHandlers object
2. Export function from `js/views.js` (delegate to controller if complex)
3. Import and expose on dashboard object in `js/main.js`
4. Add HTML element with `data-action="yourAction"` and `data-param-*` attributes

### Browser Constraints
- `crypto.subtle` requires HTTPS - use fallback on HTTP
- Dashboard API: use CORS proxy (5003), not direct (5002)
- Share links: use Nabu Casa URL, not local IP

---

## Integration Recovery

### Tuya (Gate Switch)
- **Problem:** Tokens expire after 2 hours; fails if HA starts before internet
- **Config Entry ID:** `01JTRTH40N3R9W9VVVG7847Z38`
- **Auto-fix:** `automation.system_tuya_auto_reload_on_startup` (90s after HA start)
- **Manual fix:** `python3 /opt/homelab/scripts/tuya_reauth.py`
- **Gate:** `cover.gate_switch_door_1` (Tuya) powered by `switch.sonoff_100258f6fb_1` (GatePlug)
- **Recovery:** `auto_recovery_gate_switch_power_cycle` power cycles GatePlug if unavailable

### Sonoff/eWeLink
- Cloud-dependent; expect 503/504/529 errors after router restarts
- Reconnection: 1-5 minutes after network outage
- Format: `switch.sonoff_<mac_last_10_chars>_<channel>`

---

## Auto CPU Management Service

**Service:** `homelab-monitor.service` | **Script:** `/opt/homelab/scripts/system-monitor.py`

### What It Does
Polls CPU every 60 seconds, auto-pauses Frigate detection when overloaded

### Thresholds
- **Pause:** CPU >80% for 10 consecutive minutes → pauses Frigate (saves 60-70% CPU)
- **Resume:** CPU <70% for 20 consecutive minutes → resumes Frigate
- **Method:** Direct MQTT to all cameras + syncs dashboard toggle

### Commands
```bash
sudo systemctl status homelab-monitor
sudo systemctl restart homelab-monitor
sudo journalctl -u homelab-monitor -f
```

### Resource Usage
- **CPU:** <0.1% (Nice=10, CPUQuota=5%)
- **Memory:** ~8MB (MemoryMax=50M)

### Adding Monitors
1. Edit `/opt/homelab/scripts/system-monitor.py`
2. Add check function (e.g., `def check_memory()`)
3. Call in `run_monitors()` loop
4. Use existing MQTT functions
5. Restart service

---

## Backup System (Backblaze B2)

**Timer:** `homelab-backup.timer` (2am daily) | **Script:** `/opt/homelab/scripts/backup-to-cloud.sh`

### What Gets Backed Up
- Home Assistant configs (configuration.yaml, automations.yaml, scripts.yaml, secrets.yaml, scenes.yaml)
- Dashboard files (HTML, JS, CSS, views, modals, src, images)
- Frigate configuration
- Docker Compose and environment files
- Nginx proxy and Mosquitto configs
- System scripts and documentation

### How It Works
1. Calculates MD5 checksum of all config files
2. Compares with last backup checksum - **skips if no changes**
3. Creates compressed tar.gz archive
4. Uploads to Backblaze B2 bucket `hahomelab`
5. Cleans up local backups older than 7 days

### Commands
```bash
# Check backup status
sudo systemctl status homelab-backup.timer
sudo systemctl list-timers homelab-backup.timer

# View backup logs
sudo tail -50 /var/log/homelab-backup.log

# Manual backup (force even if no changes)
sudo /opt/homelab/scripts/backup-to-cloud.sh --force

# List cloud backups
rclone --config=/opt/homelab/backups/rclone.conf ls backblaze:hahomelab/
```

### Restore from Cloud
```bash
# Interactive restore - lists available backups
sudo /opt/homelab/scripts/restore-from-cloud.sh

# Restore specific backup
sudo /opt/homelab/scripts/restore-from-cloud.sh homelab-backup-20260107_131817.tar.gz
```

### Configuration Files
| File | Purpose |
|------|---------|
| `backups/rclone.conf` | Backblaze B2 credentials |
| `backups/.last-backup-checksum` | Change detection state |
| `backups/local/` | Local backup archives |
| `backups/restore/` | Extracted restore files |

### Retention Policy
- **Local:** 7 days (auto-cleanup)
- **Cloud:** Indefinite (manage in Backblaze console)
- **Pre-restore:** Backup created before each restore

---

## Validation & Testing

### YAML Validation (Before Reload)
```bash
sudo docker exec homeassistant python3 -c \
  "import yaml; yaml.safe_load(open('/config/automations.yaml')); print('✓ Valid')"
```

### Count Automations
```bash
sudo docker exec homeassistant python3 -c \
  "import yaml; data = yaml.safe_load(open('/config/automations.yaml')); print(f'{len(data)} automations')"
```

### Reload Automations
```bash
sudo docker restart homeassistant
```

### Check Specific Automation
```bash
sudo docker exec homeassistant python3 -c \
  "import yaml; data = yaml.safe_load(open('/config/automations.yaml')); \
   print('Found' if [a for a in data if a.get('id') == 'automation_id'] else 'Missing')"
```

---

## Family Member Sensors
| Person | Pattern | Example |
|--------|---------|---------|
| Person 1 | Short name | `sensor.person1_steps` |
| Person 2 | `_iphone_` suffix | `sensor.person2_iphone_steps` |
| Person 3 | `_iphone_` suffix | `sensor.person3_iphone_steps` |
| Person 4 | `person4s_iphone_` | `sensor.person4s_iphone_steps` |

---

## Key Entities Reference

### Cameras (Frigate)
`camera.front_door`, `camera.backyard`, `camera.wyze_garage`, `camera.ezviz_indoor`

### Cameras (Blink)
- **Powered:** `camera.front_door_2`, `camera.garagecam`
- **Battery:** `camera.poolcam`, `camera.tvcam`, `camera.kitchencam`, `camera.scullery`, `camera.upstairscam`

### Covers
- **Gate:** `cover.gate_switch_door_1` (Tuya - needs internet)
- **Garage:** `cover.smart_garage_door_2311083729366461070548e1e9e12926_garage`

### Switches (Critical)
- **Geyser:** `switch.sonoff_10018908af`
- **Pool Pump:** `switch.sonoff_10017f2d90_1`
- **Gate Plug:** `switch.sonoff_100258f6fb_1`
- **Main Bedroom:** `switch.sonoff_1001e80ff3_1/2/3` (protected lights)

### Mobile App Services
- `notify.mobile_app_person2_phone`
- `notify.mobile_app_person1_phone`

---

## Debugging Commands

```bash
# Docker
sudo docker compose restart <service>
sudo docker compose logs -f <service>

# Frigate API
curl -s http://localhost:5002/api/stats | jq '.detectors'
curl -s "http://localhost:5002/api/events?limit=20&labels=person"

# After config changes
sudo docker compose restart frigate homeassistant
sudo docker restart frigate-proxy  # If CORS issues
```

---

## Known Issues & Solutions
| Problem | Solution |
|---------|----------|
| Tuya "Failed to set up" after restart | Wait 90s (auto-reload) or run `scripts/tuya_reauth.py` |
| Sonoff cloud errors (503/504/529) | Wait 1-5 min; check router |
| Gate unavailable | Auto-recovery power cycles GatePlug |
| Frigate crash loop | Check `docker logs frigate` - likely config error |
| Frigate validation error | Remove unsupported params (`face_recognition.device`) |
| Wyze IOTC_ER_TIMEOUT | Ensure `network_mode: host` |
| CORS errors | Use port 5003, restart frigate-proxy |
| Mobile stale content | Run `bump-version.sh`, close app 10s, reopen |

---

## File Locations
| Path | Purpose |
|------|---------|
| `docker-compose.yml` | All services |
| `frigate/config/config.yml` | Frigate + go2rtc + LPR + face recognition |
| `homeassistant/configuration.yaml` | HA config |
| `homeassistant/automations.yaml` | Automations (59 total) |
| `homeassistant/www/dashboard/` | Custom dashboard |
| `nginx-proxy/nginx.conf` | CORS proxy config |
| `scripts/system-monitor.py` | Auto CPU management |
| `scripts/tuya_reauth.py` | Tuya re-authentication |
| `/etc/systemd/system/homelab-monitor.service` | System monitor service |
