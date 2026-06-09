#!/usr/bin/env bash
#
# scripts/install-systemd-service.sh
# Phase CLI-Debug-B: Install mmx-music-studio as a systemd service
#
# What it does:
#   - Copies deploy/systemd/mmx-music-studio.service to /etc/systemd/system/
#   - Runs systemctl daemon-reload
#   - Enables and starts the service
#   - Shows status and local health
#
# What it does NOT do:
#   - Does NOT write any API key or token
#   - Does NOT generate music
#   - Does NOT modify project source files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

UNIT_SRC="$PROJECT_ROOT/deploy/systemd/mmx-music-studio.service"
UNIT_DST="/etc/systemd/system/mmx-music-studio.service"

echo "== Installing mmx-music-studio systemd service =="
echo "Project: $PROJECT_ROOT"
echo "Unit  : $UNIT_SRC -> $UNIT_DST"
echo ""

# Check unit file exists
if [ ! -f "$UNIT_SRC" ]; then
    echo "ERROR: Missing unit file: $UNIT_SRC"
    exit 1
fi

# Check running as root (needed to write to /etc/systemd/system/)
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root (sudo)."
    echo "Usage: sudo bash scripts/install-systemd-service.sh"
    exit 1
fi

# Stop existing systemd service if running
echo "== Stopping existing systemd service (if any) =="
if systemctl is-active --quiet mmx-music-studio 2>/dev/null; then
    echo "Stopping mmx-music-studio systemd service..."
    sudo systemctl stop mmx-music-studio 2>/dev/null || true
    sleep 3
    echo "Service stopped."
else
    echo "No systemd service running — checking for manual processes..."
fi

# Also stop any manual tsx processes (in case service was not running but manual was)
echo "== Stopping existing manual tsx process (if any) =="
MANUAL_PIDS=$(pgrep -f "tsx server/index.ts" 2>/dev/null || true)
if [ -n "$MANUAL_PIDS" ]; then
    echo "Found manual tsx process(es) PIDs=$MANUAL_PIDS — killing to free port 8787"
    for PID in $MANUAL_PIDS; do
        kill -9 "$PID" 2>/dev/null || true
    done
    sleep 2
else
    echo "No manual tsx process found — port should be free"
fi
echo ""

# Install unit file
echo "== Installing systemd unit =="
cp "$UNIT_SRC" "$UNIT_DST"
chmod 644 "$UNIT_DST"
echo "Copied: $UNIT_SRC -> $UNIT_DST"
echo ""

# Reload systemd
echo "== Reloading systemd daemon =="
systemctl daemon-reload
echo "daemon-reload done"
echo ""

# Enable and start
echo "== Enabling and starting mmx-music-studio =="
systemctl enable mmx-music-studio
echo "enable done"
echo ""

systemctl restart mmx-music-studio
echo "restart done"
echo ""

# Wait for startup
echo "== Waiting 5s for server startup =="
sleep 5
echo ""

# Status
echo "== Service status =="
systemctl status mmx-music-studio --no-pager || true
echo ""

# Quick health check
echo "== Local health (http://127.0.0.1:8787/api/health) =="
HEALTH=$(curl -s --max-time 10 http://127.0.0.1:8787/api/health 2>/dev/null || echo '{"error":"no response"}')
echo "$HEALTH" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(f\"  backend: {d.get('backend','?')}\")
    print(f\"  realGenerationEnabled: {d.get('realGenerationEnabled','?')}\")
    print(f\"  mockGenerationEnabled: {d.get('mockGenerationEnabled','?')}\")
    print(f\"  remainingDailyGenerations: {d.get('remainingDailyGenerations','?')}\")
    print(f\"  outputDirReady: {d.get('outputDirReady','?')}\")
except:
    print('  (raw):', sys.stdin.read() if hasattr(sys.stdin,'read') else d)
" 2>/dev/null || echo "$HEALTH"
echo ""

# Journal sample
echo "== Recent journal entries =="
journalctl -u mmx-music-studio -n 20 --no-pager 2>/dev/null | sed -E 's/(Bearer )[A-Za-z0-9._-]{8,}/\1***/g' | sed -E 's/(Authorization: )[^\r\n]+/\1***/g' | tail -20 || true
echo ""

echo "SYSTEMD_SERVICE_INSTALL_DONE"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status mmx-music-studio"
echo "  sudo systemctl restart mmx-music-studio"
echo "  journalctl -u mmx-music-studio -f"