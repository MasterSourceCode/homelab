#!/bin/bash
#
# Homelab Backup Script - Backup to Backblaze B2
# Runs at 2am daily, only if changes detected
# Local retention: 7 days | Cloud retention: indefinite
#
# Usage: ./backup-to-cloud.sh [--force]
#   --force: Run backup even if no changes detected
#

set -euo pipefail

# ============================================
# CONFIGURATION
# ============================================

HOMELAB_DIR="/opt/homelab"
BACKUP_DIR="${HOMELAB_DIR}/backups/local"
RCLONE_CONFIG="${HOMELAB_DIR}/backups/rclone.conf"
CHECKSUM_FILE="${HOMELAB_DIR}/backups/.last-backup-checksum"
LOG_FILE="/var/log/homelab-backup.log"

# Backblaze B2 settings
B2_BUCKET="your-bucket-name"
B2_REMOTE="backblaze:${B2_BUCKET}"

# Retention settings
LOCAL_RETENTION_DAYS=7
MIN_FREE_SPACE_GB=10

# Timestamp format
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_STAMP=$(date +%Y-%m-%d)

# ============================================
# LOGGING
# ============================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$LOG_FILE" >&2
}

# ============================================
# FUNCTIONS
# ============================================

check_disk_space() {
    local free_gb=$(df -BG "$BACKUP_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')
    if (( free_gb < MIN_FREE_SPACE_GB )); then
        log_error "Insufficient disk space: ${free_gb}GB free, need ${MIN_FREE_SPACE_GB}GB minimum"
        return 1
    fi
    log "Disk space check passed: ${free_gb}GB free"
    return 0
}

calculate_checksum() {
    # Calculate checksum of all backed-up files to detect changes
    local checksum=""

    # HA config files
    for file in configuration.yaml automations.yaml scripts.yaml secrets.yaml scenes.yaml; do
        if [[ -f "${HOMELAB_DIR}/homeassistant/${file}" ]]; then
            checksum+=$(md5sum "${HOMELAB_DIR}/homeassistant/${file}" 2>/dev/null | awk '{print $1}')
        fi
    done

    # Frigate config
    if [[ -f "${HOMELAB_DIR}/frigate/config/config.yml" ]]; then
        checksum+=$(md5sum "${HOMELAB_DIR}/frigate/config/config.yml" | awk '{print $1}')
    fi

    # Docker compose
    if [[ -f "${HOMELAB_DIR}/docker-compose.yml" ]]; then
        checksum+=$(md5sum "${HOMELAB_DIR}/docker-compose.yml" | awk '{print $1}')
    fi

    # Environment file
    if [[ -f "${HOMELAB_DIR}/.env" ]]; then
        checksum+=$(md5sum "${HOMELAB_DIR}/.env" | awk '{print $1}')
    fi

    # Dashboard files (HTML, JS, CSS) - exclude node_modules and data
    for ext in html js css; do
        find "${HOMELAB_DIR}/homeassistant/www/dashboard" \
            -name "*.${ext}" \
            ! -path "*/node_modules/*" \
            ! -path "*/data/*" \
            -type f 2>/dev/null | sort | while read -r file; do
            checksum+=$(md5sum "$file" 2>/dev/null | awk '{print $1}')
        done
    done

    # Dashboard subdirectories (views, modals, src)
    for dir in views modals src css js images; do
        if [[ -d "${HOMELAB_DIR}/homeassistant/www/dashboard/${dir}" ]]; then
            checksum+=$(find "${HOMELAB_DIR}/homeassistant/www/dashboard/${dir}" -type f -exec md5sum {} \; 2>/dev/null | sort | md5sum | awk '{print $1}')
        fi
    done

    # Scripts
    checksum+=$(find "${HOMELAB_DIR}/scripts" -type f -exec md5sum {} \; 2>/dev/null | sort | md5sum | awk '{print $1}')

    # CLAUDE.md
    if [[ -f "${HOMELAB_DIR}/CLAUDE.md" ]]; then
        checksum+=$(md5sum "${HOMELAB_DIR}/CLAUDE.md" | awk '{print $1}')
    fi

    # Nginx and Mosquitto configs
    checksum+=$(find "${HOMELAB_DIR}/nginx-proxy" "${HOMELAB_DIR}/mosquitto/config" -type f -exec md5sum {} \; 2>/dev/null | sort | md5sum | awk '{print $1}')

    echo "$checksum" | md5sum | awk '{print $1}'
}

has_changes() {
    local current_checksum=$(calculate_checksum)

    if [[ -f "$CHECKSUM_FILE" ]]; then
        local last_checksum=$(cat "$CHECKSUM_FILE")
        if [[ "$current_checksum" == "$last_checksum" ]]; then
            log "No changes detected since last backup"
            return 1
        fi
    fi

    log "Changes detected - proceeding with backup"
    echo "$current_checksum" > "$CHECKSUM_FILE"
    return 0
}

create_backup() {
    local backup_name="homelab-backup-${TIMESTAMP}"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    local archive_path="${BACKUP_DIR}/${backup_name}.tar.gz"

    log "Creating backup: ${backup_name}"

    # Create temporary directory for backup
    mkdir -p "$backup_path"

    # ============================================
    # BACKUP HOME ASSISTANT CONFIG
    # ============================================
    log "  - Backing up Home Assistant configuration..."
    mkdir -p "${backup_path}/homeassistant"

    for file in configuration.yaml automations.yaml scripts.yaml secrets.yaml scenes.yaml; do
        if [[ -f "${HOMELAB_DIR}/homeassistant/${file}" ]]; then
            cp "${HOMELAB_DIR}/homeassistant/${file}" "${backup_path}/homeassistant/"
        fi
    done

    # ============================================
    # BACKUP DASHBOARD FILES
    # ============================================
    log "  - Backing up dashboard files..."
    mkdir -p "${backup_path}/homeassistant/www/dashboard"

    # Copy HTML files
    cp "${HOMELAB_DIR}/homeassistant/www/dashboard/"*.html "${backup_path}/homeassistant/www/dashboard/" 2>/dev/null || true

    # Copy JS files (root level)
    cp "${HOMELAB_DIR}/homeassistant/www/dashboard/"*.js "${backup_path}/homeassistant/www/dashboard/" 2>/dev/null || true

    # Copy JSON files (manifest.json, version.json, etc)
    cp "${HOMELAB_DIR}/homeassistant/www/dashboard/"*.json "${backup_path}/homeassistant/www/dashboard/" 2>/dev/null || true

    # Copy family photos (needed for family status display)
    cp "${HOMELAB_DIR}/homeassistant/www/dashboard/"*.png "${backup_path}/homeassistant/www/dashboard/" 2>/dev/null || true
    cp "${HOMELAB_DIR}/homeassistant/www/dashboard/"*.jpeg "${backup_path}/homeassistant/www/dashboard/" 2>/dev/null || true
    cp "${HOMELAB_DIR}/homeassistant/www/dashboard/"*.jpg "${backup_path}/homeassistant/www/dashboard/" 2>/dev/null || true

    # Copy utility scripts
    cp "${HOMELAB_DIR}/homeassistant/www/dashboard/"*.sh "${backup_path}/homeassistant/www/dashboard/" 2>/dev/null || true

    # Copy subdirectories (excluding node_modules, data)
    for dir in js css views modals src images; do
        if [[ -d "${HOMELAB_DIR}/homeassistant/www/dashboard/${dir}" ]]; then
            cp -r "${HOMELAB_DIR}/homeassistant/www/dashboard/${dir}" "${backup_path}/homeassistant/www/dashboard/"
        fi
    done

    # ============================================
    # BACKUP FRIGATE CONFIG
    # ============================================
    log "  - Backing up Frigate configuration..."
    mkdir -p "${backup_path}/frigate/config"
    cp "${HOMELAB_DIR}/frigate/config/config.yml" "${backup_path}/frigate/config/" 2>/dev/null || true
    cp "${HOMELAB_DIR}/frigate/config/go2rtc_homekit.yml" "${backup_path}/frigate/config/" 2>/dev/null || true

    # ============================================
    # BACKUP DOCKER COMPOSE & ENV
    # ============================================
    log "  - Backing up Docker configuration..."
    cp "${HOMELAB_DIR}/docker-compose.yml" "${backup_path}/"
    cp "${HOMELAB_DIR}/.env" "${backup_path}/" 2>/dev/null || true
    cp "${HOMELAB_DIR}/.gitignore" "${backup_path}/" 2>/dev/null || true

    # ============================================
    # BACKUP SUPPORTING CONFIGS
    # ============================================
    log "  - Backing up supporting configurations..."

    # Nginx proxy
    if [[ -d "${HOMELAB_DIR}/nginx-proxy" ]]; then
        cp -r "${HOMELAB_DIR}/nginx-proxy" "${backup_path}/"
    fi

    # Mosquitto config
    if [[ -d "${HOMELAB_DIR}/mosquitto/config" ]]; then
        mkdir -p "${backup_path}/mosquitto"
        cp -r "${HOMELAB_DIR}/mosquitto/config" "${backup_path}/mosquitto/"
    fi

    # ============================================
    # BACKUP SCRIPTS
    # ============================================
    log "  - Backing up scripts..."
    cp -r "${HOMELAB_DIR}/scripts" "${backup_path}/"

    # ============================================
    # BACKUP DOCUMENTATION
    # ============================================
    log "  - Backing up documentation..."
    cp "${HOMELAB_DIR}/CLAUDE.md" "${backup_path}/" 2>/dev/null || true
    cp "${HOMELAB_DIR}/README.md" "${backup_path}/" 2>/dev/null || true

    # ============================================
    # CREATE MANIFEST
    # ============================================
    log "  - Creating backup manifest..."
    cat > "${backup_path}/MANIFEST.txt" << EOF
Homelab Backup Manifest
=======================
Created: $(date '+%Y-%m-%d %H:%M:%S %Z')
Hostname: $(hostname)
Backup ID: ${backup_name}

Contents:
---------
- Home Assistant configuration (configuration.yaml, automations.yaml, scripts.yaml, secrets.yaml, scenes.yaml)
- Dashboard files (HTML, JS, CSS, views, modals, src, images)
- Frigate NVR configuration
- Docker Compose and environment files
- Nginx proxy configuration
- Mosquitto MQTT configuration
- System scripts
- Documentation (CLAUDE.md)

Restore Instructions:
---------------------
1. Extract this archive to /opt/homelab
2. Run: cd /opt/homelab && npm install (in dashboard directory)
3. Run: sudo docker compose up -d
4. Reload Home Assistant configuration

Note: Frigate models will be re-downloaded on first start.
EOF

    # ============================================
    # CREATE COMPRESSED ARCHIVE
    # ============================================
    log "  - Compressing backup..."
    tar -czf "$archive_path" -C "$BACKUP_DIR" "$backup_name"

    # Clean up uncompressed backup
    rm -rf "$backup_path"

    local size=$(du -h "$archive_path" | awk '{print $1}')
    log "Backup created: ${archive_path} (${size})"

    # Set global variable for return value (avoid log pollution in stdout)
    BACKUP_ARCHIVE_PATH="$archive_path"
}

upload_to_cloud() {
    local archive_path="$1"
    local archive_name=$(basename "$archive_path")

    log "Uploading to Backblaze B2: ${archive_name}"

    # Upload using rclone
    local upload_output
    if upload_output=$(rclone --config="$RCLONE_CONFIG" copy "$archive_path" "${B2_REMOTE}/" -v 2>&1); then
        echo "$upload_output" >> "$LOG_FILE"
        log "Upload successful: ${archive_name}"

        # Verify upload
        if rclone --config="$RCLONE_CONFIG" ls "${B2_REMOTE}/${archive_name}" &>/dev/null; then
            log "Upload verified: ${archive_name} exists in cloud"
            return 0
        else
            log_error "Upload verification failed: ${archive_name} not found in cloud"
            return 1
        fi
    else
        echo "$upload_output" >> "$LOG_FILE"
        log_error "Upload failed: ${archive_name}"
        return 1
    fi
}

cleanup_old_backups() {
    log "Cleaning up local backups older than ${LOCAL_RETENTION_DAYS} days..."

    local count=0
    while IFS= read -r -d '' file; do
        log "  - Removing old backup: $(basename "$file")"
        rm -f "$file"
        ((count++))
    done < <(find "$BACKUP_DIR" -name "homelab-backup-*.tar.gz" -mtime +${LOCAL_RETENTION_DAYS} -print0 2>/dev/null)

    if (( count > 0 )); then
        log "Removed ${count} old backup(s)"
    else
        log "No old backups to remove"
    fi

    # Also show current local backups
    local current_count=$(find "$BACKUP_DIR" -name "homelab-backup-*.tar.gz" 2>/dev/null | wc -l)
    log "Current local backups: ${current_count}"
}

list_cloud_backups() {
    log "Cloud backups in ${B2_BUCKET}:"
    rclone --config="$RCLONE_CONFIG" ls "${B2_REMOTE}/" 2>/dev/null | while read -r line; do
        log "  - $line"
    done
}

# ============================================
# MAIN
# ============================================

main() {
    local force=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --force)
                force=true
                shift
                ;;
            *)
                log_error "Unknown argument: $1"
                exit 1
                ;;
        esac
    done

    log "=========================================="
    log "Homelab Backup Starting"
    log "=========================================="

    # Ensure backup directory exists
    mkdir -p "$BACKUP_DIR"

    # Check disk space
    if ! check_disk_space; then
        exit 1
    fi

    # Check for changes (unless forced)
    if [[ "$force" == "false" ]]; then
        if ! has_changes; then
            log "Skipping backup - no changes since last run"
            cleanup_old_backups
            log "Backup process complete (no changes)"
            exit 0
        fi
    else
        log "Force flag set - bypassing change detection"
    fi

    # Create backup
    create_backup

    # Upload to cloud
    if upload_to_cloud "$BACKUP_ARCHIVE_PATH"; then
        log "Cloud upload successful"
    else
        log_error "Cloud upload failed - keeping local backup"
    fi

    # Cleanup old local backups
    cleanup_old_backups

    # List cloud backups
    list_cloud_backups

    log "=========================================="
    log "Backup process complete"
    log "=========================================="
}

# Run main function
main "$@"
