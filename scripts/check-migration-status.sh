#!/bin/bash
# Check MobileData migration status
# Usage: ./check-migration-status.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}MobileData Migration Status${NC}"
echo "==============================="
echo ""

# Check if rsync is still running
RSYNC_PID=$(pgrep -f "rsync.*mobiledata")
if [ -n "$RSYNC_PID" ]; then
    echo -e "Status: ${YELLOW}RUNNING${NC} (PID: $RSYNC_PID)"
else
    echo -e "Status: ${GREEN}COMPLETED or NOT RUNNING${NC}"
fi
echo ""

# Size comparison
echo "Data Sizes:"
SOURCE=$(du -sh /mnt/mobiledata/ 2>/dev/null | cut -f1)
DEST=$(du -sh /mnt/seagate/mobiledata/ 2>/dev/null | cut -f1)
echo "  Source (/mnt/mobiledata/):         $SOURCE"
echo "  Destination (/mnt/seagate/mobiledata/): $DEST"
echo ""

# File count comparison
echo "File Counts:"
SOURCE_COUNT=$(find /mnt/mobiledata/ -type f 2>/dev/null | wc -l)
DEST_COUNT=$(find /mnt/seagate/mobiledata/ -type f 2>/dev/null | wc -l)
echo "  Source files:      $SOURCE_COUNT"
echo "  Destination files: $DEST_COUNT"
echo ""

if [ "$SOURCE_COUNT" -eq "$DEST_COUNT" ] && [ -z "$RSYNC_PID" ]; then
    echo -e "${GREEN}Migration appears COMPLETE!${NC}"
    echo ""
    echo "Next step: Run the Frigate storage setup script:"
    echo "  sudo /opt/homelab/scripts/setup-frigate-storage.sh"
else
    echo -e "${YELLOW}Migration still in progress...${NC}"
    REMAINING=$((SOURCE_COUNT - DEST_COUNT))
    echo "Files remaining: ~$REMAINING"
fi
