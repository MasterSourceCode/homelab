# Smart Home Automation Platform

A comprehensive Docker-based smart home automation stack built on a mini PC, featuring Home Assistant, Frigate NVR with AI object detection, and advanced security automations.

## Features

- **Home Assistant** - Central automation hub
- **Frigate NVR** - AI-powered video surveillance with:
  - Person, car, dog, cat detection (YOLOv8s via OpenVINO)
  - License plate recognition (LPR)
  - Face recognition
  - Hardware-accelerated processing (Intel iGPU)
- **Custom Dashboard** - Mobile-optimized web interface
- **Security System Integration** - DSC alarm panel via Envisalink
- **Multi-camera Support** - Amcrest, Wyze, EZVIZ cameras
- **Automated Backups** - Daily backups to Backblaze B2

## Hardware

- Beelink N95 Mini PC (Intel N95, 4 cores, 8GB RAM)
- Intel UHD Graphics (hardware acceleration)
- 1TB SSD for recordings

## Stack

| Component | Purpose |
|-----------|---------|
| Home Assistant | Automation hub |
| Frigate | NVR with AI detection |
| Mosquitto | MQTT message broker |
| docker-wyze-bridge | Wyze camera RTSP streams |
| Nginx Proxy | CORS proxy for dashboard |

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/YOUR_USERNAME/homelab.git
cd homelab

# Copy example configs and fill in your values
cp .env.example .env
cp homeassistant/secrets.yaml.example homeassistant/secrets.yaml
```

### 2. Edit configuration files

Edit `.env` with your:
- Camera IPs and credentials
- MQTT credentials
- Wyze account details
- API keys

Edit `homeassistant/secrets.yaml` with your:
- Alarm codes
- Telegram bot token
- Other secrets

### 3. Start the stack

```bash
sudo docker compose up -d
```

### 4. Access services

| Service | URL |
|---------|-----|
| Home Assistant | http://localhost:8123 |
| Frigate UI | https://localhost:8971 |

## Project Structure

```
homelab/
├── docker-compose.yml      # Service definitions
├── .env.example            # Environment template
├── homeassistant/
│   ├── configuration.yaml  # HA config
│   ├── automations.yaml    # Automation rules
│   ├── secrets.yaml.example
│   └── www/dashboard/      # Custom dashboard
├── frigate/
│   └── config/config.yml   # Frigate config
├── mosquitto/
│   └── config/             # MQTT broker config
├── nginx-proxy/
│   └── nginx.conf          # CORS proxy config
├── scripts/
│   ├── backup-to-cloud.sh  # Automated backups
│   ├── restore-from-cloud.sh
│   └── system-monitor.py   # CPU management
└── CLAUDE.md               # Development context
```

## Security Notes

- All credentials stored in `.env` and `secrets.yaml` (gitignored)
- Frigate uses environment variable interpolation for camera URLs
- MQTT authentication required
- Trusted proxy configuration for internal network access

## Automations

The system includes 50+ automations for:
- Security alerts (person detection when armed)
- iOS critical notifications with camera snapshots
- Panic mode activation
- Automatic light control on alarm arm/disarm
- Service health monitoring
- CPU-based Frigate throttling

## Backup System

Automated daily backups to Backblaze B2:
- Change detection (only backs up when files change)
- 7-day local retention
- Includes: HA configs, dashboard, Frigate config, scripts

```bash
# Manual backup
sudo /opt/homelab/scripts/backup-to-cloud.sh --force

# Restore from cloud
sudo /opt/homelab/scripts/restore-from-cloud.sh
```

## Contributing

This is a personal homelab project, but feel free to:
- Open issues for questions
- Submit PRs for improvements
- Fork and adapt for your own setup

## License

MIT License - See [LICENSE](LICENSE) for details.

## Acknowledgments

- [Home Assistant](https://www.home-assistant.io/)
- [Frigate NVR](https://frigate.video/)
- [Blakeblackshear](https://github.com/blakeblackshear) for Frigate
