#!/bin/bash
# Mount encrypted private vault
# Usage: vault-mount.sh [mount|unmount|status]

VAULT_FILE="/mnt/seagate/.private_vault.img"
VAULT_NAME="private_vault"
MOUNT_POINT="/mnt/private_vault"
PASSWORD='Smart33Pant$@4073815393'

case "$1" in
    mount)
        if [ -e "/dev/mapper/$VAULT_NAME" ]; then
            echo "Vault already open"
        else
            echo -n "$PASSWORD" | cryptsetup luksOpen "$VAULT_FILE" "$VAULT_NAME" -
            echo "Vault opened"
        fi

        if ! mountpoint -q "$MOUNT_POINT"; then
            mkdir -p "$MOUNT_POINT"
            mount "/dev/mapper/$VAULT_NAME" "$MOUNT_POINT"
            chmod 777 "$MOUNT_POINT"
            echo "Vault mounted at $MOUNT_POINT"
        else
            echo "Already mounted at $MOUNT_POINT"
        fi
        ;;

    unmount)
        if mountpoint -q "$MOUNT_POINT"; then
            umount "$MOUNT_POINT"
            echo "Unmounted $MOUNT_POINT"
        fi

        if [ -e "/dev/mapper/$VAULT_NAME" ]; then
            cryptsetup luksClose "$VAULT_NAME"
            echo "Vault closed"
        fi
        ;;

    status)
        echo "Vault file: $VAULT_FILE"
        if [ -e "/dev/mapper/$VAULT_NAME" ]; then
            echo "Vault: OPEN"
            if mountpoint -q "$MOUNT_POINT"; then
                echo "Mount: MOUNTED at $MOUNT_POINT"
                df -h "$MOUNT_POINT"
            else
                echo "Mount: NOT MOUNTED"
            fi
        else
            echo "Vault: CLOSED"
        fi
        ;;

    *)
        echo "Usage: $0 {mount|unmount|status}"
        exit 1
        ;;
esac
