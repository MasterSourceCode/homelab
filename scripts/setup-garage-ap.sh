#!/bin/bash
# ============================================
# Garage WiFi Access Point Setup Script
# For Alfa AWUS1900 + Deye Inverter
# ============================================

set -e

# Configuration
AP_SSID="GarageNet"
AP_PASSWORD="YOUR_AP_PASSWORD"
AP_CHANNEL=6
DEYE_IP="192.168.68.122"

echo "============================================"
echo "Garage WiFi AP Setup for Deye Inverter"
echo "============================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run with sudo: sudo $0"
    exit 1
fi

# Step 1: Check for Alfa adapter
echo "[1/6] Checking for Alfa AWUS1900..."
if lsusb | grep -qi "0bda:8813"; then
    echo "  ✓ Alfa AWUS1900 detected!"
else
    echo "  ✗ Alfa AWUS1900 not detected!"
    echo "    Please plug in the Alfa adapter and try again."
    echo ""
    echo "    Expected USB ID: 0bda:8813 (Realtek RTL8814AU)"
    lsusb | grep -i realtek || true
    exit 1
fi

# Step 2: Install driver if needed
echo ""
echo "[2/6] Checking/Installing RTL8814AU driver..."
if lsmod | grep -q 8814au; then
    echo "  ✓ Driver already loaded!"
else
    echo "  Installing driver from source..."
    apt update
    apt install -y dkms git build-essential linux-headers-$(uname -r)

    if [ -d "/tmp/8814au" ]; then
        rm -rf /tmp/8814au
    fi

    git clone https://github.com/morrownr/8814au.git /tmp/8814au
    cd /tmp/8814au
    ./install-driver.sh NoPrompt

    # Wait for driver to load
    sleep 3

    if lsmod | grep -q 8814au; then
        echo "  ✓ Driver installed successfully!"
    else
        echo "  ✗ Driver installation failed. Please reboot and try again."
        exit 1
    fi
fi

# Step 3: Find the Alfa interface
echo ""
echo "[3/6] Finding Alfa wireless interface..."
ALFA_IF=""
for iface in /sys/class/net/wl*; do
    if [ -d "$iface" ]; then
        ifname=$(basename "$iface")
        driver=$(readlink "$iface/device/driver" 2>/dev/null | xargs basename 2>/dev/null)
        if [ "$driver" = "rtl8814au" ] || [ "$driver" = "8814au" ]; then
            ALFA_IF="$ifname"
            break
        fi
    fi
done

# If not found by driver, use the non-Intel one
if [ -z "$ALFA_IF" ]; then
    for iface in /sys/class/net/wl*; do
        ifname=$(basename "$iface")
        if [ "$ifname" != "wlp2s0" ]; then
            ALFA_IF="$ifname"
            break
        fi
    done
fi

if [ -z "$ALFA_IF" ]; then
    echo "  ✗ Could not find Alfa interface!"
    echo "    Available interfaces:"
    ip link show | grep -E "^[0-9]+: wl"
    exit 1
fi
echo "  ✓ Found Alfa interface: $ALFA_IF"

# Step 4: Install hostapd and dnsmasq
echo ""
echo "[4/6] Installing hostapd and dnsmasq..."
apt install -y hostapd dnsmasq
systemctl stop hostapd 2>/dev/null || true
systemctl stop dnsmasq 2>/dev/null || true

# Step 5: Configure the Access Point
echo ""
echo "[5/6] Configuring Access Point..."

# Backup existing configs
[ -f /etc/hostapd/hostapd.conf ] && cp /etc/hostapd/hostapd.conf /etc/hostapd/hostapd.conf.backup
[ -f /etc/dnsmasq.conf ] && cp /etc/dnsmasq.conf /etc/dnsmasq.conf.backup

# Configure hostapd
cat > /etc/hostapd/hostapd.conf << HOSTAPD_EOF
# Garage AP Configuration for Deye Inverter
interface=$ALFA_IF
driver=nl80211
ssid=$AP_SSID
hw_mode=g
channel=$AP_CHANNEL
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=$AP_PASSWORD
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP

# Allow the Deye to connect
# MAC: xx:xx:xx:xx:xx:xx
HOSTAPD_EOF

# Point hostapd to config
echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' > /etc/default/hostapd

# Configure static IP for AP interface
cat > /etc/network/interfaces.d/garage-ap << NETCONF_EOF
# Garage AP interface
auto $ALFA_IF
iface $ALFA_IF inet static
    address 192.168.100.1
    netmask 255.255.255.0
NETCONF_EOF

# Configure dnsmasq for DHCP
cat > /etc/dnsmasq.d/garage-ap.conf << DNSMASQ_EOF
# Garage AP DHCP Configuration
interface=$ALFA_IF
dhcp-range=192.168.100.10,192.168.100.50,255.255.255.0,24h
# Reserve IP for Deye inverter
dhcp-host=xx:xx:xx:xx:xx:xx,192.168.100.122
DNSMASQ_EOF

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-garage-ap.conf
sysctl -p /etc/sysctl.d/99-garage-ap.conf

# Configure iptables for NAT
iptables -t nat -A POSTROUTING -o enp1s0 -j MASQUERADE
iptables -A FORWARD -i $ALFA_IF -o enp1s0 -j ACCEPT
iptables -A FORWARD -i enp1s0 -o $ALFA_IF -m state --state RELATED,ESTABLISHED -j ACCEPT

# Save iptables rules
apt install -y iptables-persistent
netfilter-persistent save

# Step 6: Start services
echo ""
echo "[6/6] Starting Access Point..."

# Bring up interface with static IP
ip addr flush dev $ALFA_IF
ip addr add 192.168.100.1/24 dev $ALFA_IF
ip link set $ALFA_IF up

# Unmask and enable services
systemctl unmask hostapd
systemctl enable hostapd
systemctl enable dnsmasq

# Start services
systemctl restart dnsmasq
systemctl restart hostapd

# Verify
sleep 3
if systemctl is-active --quiet hostapd; then
    echo ""
    echo "============================================"
    echo "  ✓ ACCESS POINT IS RUNNING!"
    echo "============================================"
    echo ""
    echo "  SSID:     $AP_SSID"
    echo "  Password: $AP_PASSWORD"
    echo "  AP IP:    192.168.100.1"
    echo "  Deye IP:  192.168.100.122 (reserved)"
    echo ""
    echo "  Next steps:"
    echo "  1. On Deye inverter WiFi settings, connect to '$AP_SSID'"
    echo "  2. Update Home Assistant solarman config:"
    echo "     - Change host from 192.168.68.122 to 192.168.100.122"
    echo ""
else
    echo ""
    echo "  ✗ Failed to start hostapd!"
    echo "    Check logs: journalctl -u hostapd -n 50"
    systemctl status hostapd
    exit 1
fi
