#!/bin/bash
#
# Homelab Restore Script - Restore from Backblaze B2
# Downloads and extracts backup to recreate the environment
#
# Usage: ./restore-from-cloud.sh [backup-filename]
#   If no filename provided, lists available backups and prompts for selection
#

set -euo pipefail

# ============================================
# CONFIGURATION
# ============================================

HOMELAB_DIR="/opt/homelab"
BACKUP_DIR="${HOMELAB_DIR}/backups/local"
RESTORE_DIR="${HOMELAB_DIR}/backups/restore"
RCLONE_CONFIG="${HOMELAB_DIR}/backups/rclone.conf"
LOG_FILE="/var/log/homelab-restore.log"

# Backblaze B2 settings
B2_BUCKET="your-bucket-name"
B2_REMOTE="backblaze:${B2_BUCKET}"

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

list_cloud_backups() {
    log "Available backups in cloud:"
    echo ""
    echo "ID   Size       Date                Filename"
    echo "---  ---------  ------------------  -----------------------------------------"

    local i=1
    while IFS= read -r line; do
        local size=$(echo "$line" | awk '{print $1}')
        local file=$(echo "$line" | awk '{print $2}')
        local date=$(echo "$file" | sed 's/homelab-backup-//' | sed 's/.tar.gz//' | sed 's/_/ /')
        printf "[%d]  %-9s  %s  %s\n" "$i" "$(numfmt --to=iec $size)" "$date" "$file"
        ((i++))
    done < <(rclone --config="$RCLONE_CONFIG" ls "${B2_REMOTE}/" 2>/dev/null | sort -k2 -r)
    echo ""
}

get_backup_by_id() {
    local id=$1
    rclone --config="$RCLONE_CONFIG" ls "${B2_REMOTE}/" 2>/dev/null | sort -k2 -r | sed -n "${id}p" | awk '{print $2}'
}

download_backup() {
    local backup_name="$1"
    local local_path="${BACKUP_DIR}/${backup_name}"

    if [[ -f "$local_path" ]]; then
        log "Backup already exists locally: ${local_path}"
        echo "$local_path"
        return 0
    fi

    log "Downloading backup: ${backup_name}"
    mkdir -p "$BACKUP_DIR"

    if rclone --config="$RCLONE_CONFIG" copy "${B2_REMOTE}/${backup_name}" "$BACKUP_DIR/" -v 2>&1 | tee -a "$LOG_FILE"; then
        log "Download successful: ${backup_name}"
        echo "$local_path"
        return 0
    else
        log_error "Download failed: ${backup_name}"
        return 1
    fi
}

extract_backup() {
    local archive_path="$1"

    log "Extracting backup..."
    mkdir -p "$RESTORE_DIR"
    rm -rf "${RESTORE_DIR:?}/*"

    if tar -xzf "$archive_path" -C "$RESTORE_DIR"; then
        log "Extraction successful"
        return 0
    else
        log_error "Extraction failed"
        return 1
    fi
}

show_manifest() {
    local restore_path="$1"
    local manifest="${restore_path}/MANIFEST.txt"

    if [[ -f "$manifest" ]]; then
        echo ""
        echo "=========================================="
        cat "$manifest"
        echo "=========================================="
        echo ""
    fi
}

restore_files() {
    local restore_path="$1"
    local backup_name=$(basename "$restore_path")

    log "Starting restore process..."

    # Check what's in the restore directory
    local extract_dir
    if [[ -d "${restore_path}/${backup_name}" ]]; then
        extract_dir="${restore_path}/${backup_name}"
    else
        # Find the actual extracted directory
        extract_dir=$(find "$restore_path" -maxdepth 1 -type d -name "homelab-backup-*" | head -1)
        if [[ -z "$extract_dir" ]]; then
            extract_dir="$restore_path"
        fi
    fi

    show_manifest "$extract_dir"

    echo "This will restore files to: ${HOMELAB_DIR}"
    echo ""
    echo "The following will be restored:"
    echo "  - Home Assistant configuration files"
    echo "  - Dashboard files (HTML, JS, CSS)"
    echo "  - Frigate configuration"
    echo "  - Docker Compose and environment files"
    echo "  - Supporting configurations (Nginx, MQTT)"
    echo "  - System scripts"
    echo ""
    read -p "Continue with restore? (yes/no): " confirm

    if [[ "$confirm" != "yes" ]]; then
        log "Restore cancelled by user"
        return 1
    fi

    # Stop services first
    log "Stopping Docker services..."
    cd "$HOMELAB_DIR"
    sudo docker compose down 2>/dev/null || true

    # Backup current configs before restore
    local pre_restore_backup="${HOMELAB_DIR}/backups/pre-restore-$(date +%Y%m%d_%H%M%S)"
    log "Creating pre-restore backup: ${pre_restore_backup}"
    mkdir -p "$pre_restore_backup"

    # Copy current critical files
    cp -r "${HOMELAB_DIR}/homeassistant"/*.yaml "$pre_restore_backup/" 2>/dev/null || true
    cp "${HOMELAB_DIR}/docker-compose.yml" "$pre_restore_backup/" 2>/dev/null || true
    cp "${HOMELAB_DIR}/.env" "$pre_restore_backup/" 2>/dev/null || true

    # Restore files
    log "Restoring Home Assistant configuration..."
    cp "${extract_dir}/homeassistant/"*.yaml "${HOMELAB_DIR}/homeassistant/" 2>/dev/null || true

    log "Restoring dashboard files..."
    if [[ -d "${extract_dir}/homeassistant/www/dashboard" ]]; then
        # Backup node_modules if exists
        if [[ -d "${HOMELAB_DIR}/homeassistant/www/dashboard/node_modules" ]]; then
            mv "${HOMELAB_DIR}/homeassistant/www/dashboard/node_modules" /tmp/dashboard_node_modules_backup
        fi

        # Restore dashboard (excluding data directory)
        rsync -av --exclude='data' --exclude='node_modules' \
            "${extract_dir}/homeassistant/www/dashboard/" \
            "${HOMELAB_DIR}/homeassistant/www/dashboard/"

        # Restore node_modules if we backed it up
        if [[ -d /tmp/dashboard_node_modules_backup ]]; then
            mv /tmp/dashboard_node_modules_backup "${HOMELAB_DIR}/homeassistant/www/dashboard/node_modules"
        fi
    fi

    log "Restoring Frigate configuration..."
    cp "${extract_dir}/frigate/config/"*.yml "${HOMELAB_DIR}/frigate/config/" 2>/dev/null || true

    log "Restoring Docker configuration..."
    cp "${extract_dir}/docker-compose.yml" "${HOMELAB_DIR}/" 2>/dev/null || true
    cp "${extract_dir}/.env" "${HOMELAB_DIR}/" 2>/dev/null || true
    cp "${extract_dir}/.gitignore" "${HOMELAB_DIR}/" 2>/dev/null || true

    log "Restoring supporting configurations..."
    if [[ -d "${extract_dir}/nginx-proxy" ]]; then
        cp -r "${extract_dir}/nginx-proxy/"* "${HOMELAB_DIR}/nginx-proxy/" 2>/dev/null || true
    fi
    if [[ -d "${extract_dir}/mosquitto/config" ]]; then
        cp -r "${extract_dir}/mosquitto/config/"* "${HOMELAB_DIR}/mosquitto/config/" 2>/dev/null || true
    fi

    log "Restoring scripts..."
    if [[ -d "${extract_dir}/scripts" ]]; then
        cp -r "${extract_dir}/scripts/"* "${HOMELAB_DIR}/scripts/" 2>/dev/null || true
        chmod +x "${HOMELAB_DIR}/scripts/"*.sh 2>/dev/null || true
        chmod +x "${HOMELAB_DIR}/scripts/"*.py 2>/dev/null || true
    fi

    log "Restoring documentation..."
    cp "${extract_dir}/CLAUDE.md" "${HOMELAB_DIR}/" 2>/dev/null || true
    cp "${extract_dir}/README.md" "${HOMELAB_DIR}/" 2>/dev/null || true

    log "Restore complete!"
    echo ""
    echo "=========================================="
    echo "RESTORE COMPLETE"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "1. Review restored files in ${HOMELAB_DIR}"
    echo "2. Check secrets.yaml and .env for any credentials that need updating"
    echo "3. Start services: cd ${HOMELAB_DIR} && sudo docker compose up -d"
    echo "4. If dashboard node_modules is missing, run: cd ${HOMELAB_DIR}/homeassistant/www/dashboard && npm install"
    echo ""
    echo "Pre-restore backup saved to: ${pre_restore_backup}"
    echo ""
}

# ============================================
# MAIN
# ============================================

main() {
    local backup_name="${1:-}"

    log "=========================================="
    log "Homelab Restore Starting"
    log "=========================================="

    # If no backup specified, list available and prompt
    if [[ -z "$backup_name" ]]; then
        list_cloud_backups

        read -p "Enter backup ID to restore (or 'q' to quit): " selection

        if [[ "$selection" == "q" ]]; then
            log "Restore cancelled"
            exit 0
        fi

        backup_name=$(get_backup_by_id "$selection")

        if [[ -z "$backup_name" ]]; then
            log_error "Invalid selection"
            exit 1
        fi
    fi

    log "Selected backup: ${backup_name}"

    # Download backup
    local local_path
    local_path=$(download_backup "$backup_name")

    if [[ ! -f "$local_path" ]]; then
        log_error "Failed to get backup file"
        exit 1
    fi

    # Extract backup
    extract_backup "$local_path"

    # Find extracted directory
    local extract_dir="${RESTORE_DIR}/$(basename "$backup_name" .tar.gz)"
    if [[ ! -d "$extract_dir" ]]; then
        extract_dir=$(find "$RESTORE_DIR" -maxdepth 1 -type d -name "homelab-backup-*" | head -1)
    fi

    # Restore files
    restore_files "$RESTORE_DIR"

    log "=========================================="
    log "Restore process complete"
    log "=========================================="
}

# Run main function
main "$@"
