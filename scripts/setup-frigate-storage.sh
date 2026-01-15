#!/bin/bash
# Frigate Multi-Disk Storage Setup Script
# Run this AFTER the mobiledata migration completes successfully
#
# This script will:
# 1. Verify migration completed
# 2. Stop Frigate container
# 3. Format MobileData SSD as ext4
# 4. Configure mergerfs to pool both SSDs
# 5. Migrate existing Frigate recordings to new pool
# 6. Update docker-compose and fstab
# 7. Start Frigate
#
# Usage: sudo ./setup-frigate-storage.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
HIKVISION_UUID="24ab2d05-0011-4b73-abd9-aaf3c7f65518"  # /dev/sda1
MOBILEDATA_DEVICE="/dev/sdc"  # Will be reformatted
MOBILEDATA_PARTITION="/dev/sdc2"  # Current NTFS partition

SSD1_MOUNT="/mnt/frigate-ssd1"  # Hikvision
SSD2_MOUNT="/mnt/frigate-ssd2"  # MobileData (after format)
POOL_MOUNT="/mnt/frigate-pool"  # mergerfs pool
OLD_MOUNT="/mnt/frigate-recordings"

HOMELAB_DIR="/opt/homelab"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Frigate Multi-Disk Storage Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root (sudo)${NC}"
    exit 1
fi

# Step 1: Verify migration completed
echo -e "${YELLOW}Step 1: Verifying migration status...${NC}"

SOURCE_SIZE=$(du -sb /mnt/mobiledata/ 2>/dev/null | cut -f1)
DEST_SIZE=$(du -sb /mnt/seagate/mobiledata/ 2>/dev/null | cut -f1)

if [ -z "$SOURCE_SIZE" ] || [ -z "$DEST_SIZE" ]; then
    echo -e "${RED}Error: Cannot determine source/destination sizes${NC}"
    echo "Source: /mnt/mobiledata/"
    echo "Destination: /mnt/seagate/mobiledata/"
    exit 1
fi

# Allow 1% tolerance for filesystem overhead
TOLERANCE=$((SOURCE_SIZE / 100))
DIFF=$((SOURCE_SIZE - DEST_SIZE))
if [ $DIFF -lt 0 ]; then DIFF=$((-DIFF)); fi

if [ $DIFF -gt $TOLERANCE ]; then
    echo -e "${RED}Error: Migration appears incomplete${NC}"
    echo "Source size: $(numfmt --to=iec $SOURCE_SIZE)"
    echo "Destination size: $(numfmt --to=iec $DEST_SIZE)"
    echo "Difference: $(numfmt --to=iec $DIFF)"
    echo ""
    echo "Please wait for migration to complete or run verification manually:"
    echo "  du -sh /mnt/mobiledata/ /mnt/seagate/mobiledata/"
    exit 1
fi

echo -e "${GREEN}Migration verified - sizes match within tolerance${NC}"
echo "Source: $(numfmt --to=iec $SOURCE_SIZE)"
echo "Destination: $(numfmt --to=iec $DEST_SIZE)"
echo ""

# Prompt for confirmation
read -p "Continue with SSD reformatting? This will DESTROY data on /dev/sdc! (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

# Step 2: Stop Frigate
echo -e "${YELLOW}Step 2: Stopping Frigate container...${NC}"
cd "$HOMELAB_DIR"
docker compose stop frigate
echo -e "${GREEN}Frigate stopped${NC}"
echo ""

# Step 3: Unmount and format MobileData SSD
echo -e "${YELLOW}Step 3: Formatting MobileData SSD...${NC}"

# Unmount if mounted
if mountpoint -q /mnt/mobiledata; then
    echo "Unmounting /mnt/mobiledata..."
    umount /mnt/mobiledata
fi

# Wipe and create new partition table
echo "Creating new partition table on $MOBILEDATA_DEVICE..."
wipefs -a "$MOBILEDATA_DEVICE"

# Create single ext4 partition
echo "Creating ext4 partition..."
parted -s "$MOBILEDATA_DEVICE" mklabel gpt
parted -s "$MOBILEDATA_DEVICE" mkpart primary ext4 0% 100%

# Wait for partition to appear
sleep 2

# Format as ext4
NEW_PARTITION="${MOBILEDATA_DEVICE}1"
echo "Formatting $NEW_PARTITION as ext4..."
mkfs.ext4 -L "frigate-ssd2" "$NEW_PARTITION"

# Get new UUID
NEW_UUID=$(blkid -s UUID -o value "$NEW_PARTITION")
echo -e "${GREEN}MobileData SSD formatted. New UUID: $NEW_UUID${NC}"
echo ""

# Step 4: Set up mount points and mergerfs
echo -e "${YELLOW}Step 4: Configuring mount points...${NC}"

# Mount Hikvision SSD to new location
echo "Moving Hikvision mount from $OLD_MOUNT to $SSD1_MOUNT..."
if mountpoint -q "$OLD_MOUNT"; then
    umount "$OLD_MOUNT"
fi
mount UUID="$HIKVISION_UUID" "$SSD1_MOUNT"

# Mount new MobileData SSD
echo "Mounting new MobileData SSD to $SSD2_MOUNT..."
mount UUID="$NEW_UUID" "$SSD2_MOUNT"

# Create recording directory structure on SSD2
mkdir -p "$SSD2_MOUNT/recordings" "$SSD2_MOUNT/clips" "$SSD2_MOUNT/exports"
chown -R root:root "$SSD2_MOUNT"

# Start mergerfs pool
echo "Starting mergerfs pool..."
mergerfs -o defaults,allow_other,use_ino,category.create=mfs,moveonenospc=true,dropcacheonclose=true \
    "$SSD1_MOUNT:$SSD2_MOUNT" "$POOL_MOUNT"

echo -e "${GREEN}mergerfs pool created at $POOL_MOUNT${NC}"
df -h "$SSD1_MOUNT" "$SSD2_MOUNT" "$POOL_MOUNT"
echo ""

# Step 5: Update fstab
echo -e "${YELLOW}Step 5: Updating /etc/fstab...${NC}"

# Backup fstab
cp /etc/fstab /etc/fstab.backup.$(date +%Y%m%d_%H%M%S)

# Remove old frigate-recordings entry
sed -i '/frigate-recordings/d' /etc/fstab

# Add new entries
cat >> /etc/fstab << EOF

# Frigate Multi-Disk Storage (added $(date +%Y-%m-%d))
UUID=$HIKVISION_UUID $SSD1_MOUNT ext4 defaults,nofail 0 2
UUID=$NEW_UUID $SSD2_MOUNT ext4 defaults,nofail 0 2
$SSD1_MOUNT:$SSD2_MOUNT $POOL_MOUNT fuse.mergerfs defaults,allow_other,use_ino,category.create=mfs,moveonenospc=true,dropcacheonclose=true,nofail 0 0
EOF

echo -e "${GREEN}fstab updated${NC}"
echo ""

# Step 6: Update docker-compose
echo -e "${YELLOW}Step 6: Updating docker-compose.yml...${NC}"

# Update the Frigate volume mount
sed -i "s|$OLD_MOUNT:/media/frigate|$POOL_MOUNT:/media/frigate|g" "$HOMELAB_DIR/docker-compose.yml"

echo -e "${GREEN}docker-compose.yml updated${NC}"
echo ""

# Step 7: Start Frigate
echo -e "${YELLOW}Step 7: Starting Frigate...${NC}"
cd "$HOMELAB_DIR"
docker compose up -d frigate

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Storage Configuration:"
echo "  SSD1 (Hikvision): $SSD1_MOUNT (~954GB)"
echo "  SSD2 (MobileData): $SSD2_MOUNT (~466GB)"
echo "  Merged Pool: $POOL_MOUNT (~1.4TB total)"
echo ""
echo "mergerfs policy: mfs (most free space)"
echo "  - New files written to drive with most free space"
echo "  - Automatic failover if one drive fills up"
echo ""
echo "Verify with:"
echo "  df -h $POOL_MOUNT"
echo "  docker logs frigate --tail 50"
