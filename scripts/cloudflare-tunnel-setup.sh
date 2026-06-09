#!/usr/bin/env bash
# scripts/cloudflare-tunnel-setup.sh
# Cloudflare Tunnel setup helper for mmx-music-studio
#
# Usage:
#   export CLOUDFLARE_TUNNEL_TOKEN='<token from Cloudflare dashboard>'
#   bash scripts/cloudflare-tunnel-setup.sh
#
# Without a token, prints next steps without failing.

set -euo pipefail

HOSTNAME="${HOSTNAME:-music.conanxin.com}"
SERVICE_URL="${SERVICE_URL:-http://127.0.0.1:8787}"

echo "============================================================"
echo "  Cloudflare Tunnel Setup Helper"
echo "============================================================"
echo "Hostname: $HOSTNAME"
echo "Service:  $SERVICE_URL"
echo ""

# ── App health check ─────────────────────────────────────────
echo "== App health =="
if curl -s --max-time 5 "$SERVICE_URL/api/health" > /dev/null 2>&1; then
  echo "  ✓ App is reachable at $SERVICE_URL"
else
  echo "  ✗ App is NOT reachable at $SERVICE_URL"
  echo "  Start mmx-music-studio first:"
  echo "    npm run start"
  exit 1
fi

# ── cloudflared check ────────────────────────────────────────
echo ""
echo "== cloudflared =="
if command -v cloudflared > /dev/null 2>&1; then
  echo "  ✓ cloudflared found:"
  cloudflared --version
else
  echo "  ✗ cloudflared is NOT installed."
  echo ""
  echo "  Install cloudflared on Ubuntu/Debian:"
  echo "    curl -L https://github.com/cloudflare/cloudflared/releases/download/2024.6.2/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb"
  echo "    sudo dpkg -i /tmp/cloudflared.deb"
  echo ""
  echo "  Or use Cloudflare's apt repo:"
  echo "    curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-archive-keyring.gpg"
  echo "    echo 'deb [signed-by=/usr/share/keyrings/cloudflare-archive-keyring.gpg] https://pkg.cloudflare.com/cloudflared main' | sudo tee /etc/apt/sources.list.d/cloudflared.list"
  echo "    sudo apt update && sudo apt install cloudflared"
  echo ""
  exit 2
fi

# ── Token provided ───────────────────────────────────────────
echo ""
echo "== Tunnel service =="
if [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
  echo "  Token provided (not shown for security)."
  echo "  Installing cloudflared as a systemd service..."

  # Check if already installed
  if systemctl is-active --quiet cloudflared 2>/dev/null; then
    echo "  ✓ cloudflared service is already running."
    sudo systemctl status cloudflared --no-pager || true
  else
    echo "  Installing service..."
    sudo cloudflared service install "$CLOUDFLARE_TUNNEL_TOKEN" 2>&1 || {
      echo "  ✗ Installation failed. Check the token and try again."
      exit 3
    }
    sudo systemctl enable --now cloudflared
    sleep 2
    sudo systemctl status cloudflared --no-pager || true
  fi

  echo ""
  echo "  ✓ Cloudflare Tunnel service installed."
  echo ""
  echo "  Next: configure public hostname in Cloudflare Zero Trust dashboard"
  echo "  - Go to: Networks > Tunnels > mmx-music-studio"
  echo "  - Add public hostname: $HOSTNAME → $SERVICE_URL"
  echo ""
  echo "CLOUDFLARE_TUNNEL_SERVICE_INSTALLED"
else
  echo "  No CLOUDFLARE_TUNNEL_TOKEN env variable set."
  echo ""
  echo "  To create and configure a tunnel:"
  echo ""
  echo "  1. Open Cloudflare Zero Trust: https://one.dash.cloudflare.com/"
  echo "  2. Go to Networks > Tunnels"
  echo "  3. Click 'Create a tunnel' → choose 'Cloudflared'"
  echo "  4. Name: mmx-music-studio"
  echo "  5. Copy the Linux install command (contains the token)"
  echo "  6. On VPS, run:"
  echo ""
  echo "     export CLOUDFLARE_TUNNEL_TOKEN='<token-from-dashboard>'"
  echo "     bash scripts/cloudflare-tunnel-setup.sh"
  echo ""
  echo "  7. In the same dashboard, add public hostname:"
  echo "     Hostname: $HOSTNAME"
  echo "     Service:  $SERVICE_URL"
  echo ""
  echo "CLOUDFLARE_TUNNEL_WAITING_FOR_TOKEN"
fi