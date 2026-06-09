# Cloudflare Tunnel Deployment

## Goal

Expose the local mmx-music-studio service running on the VPS at `http://127.0.0.1:8787` through a stable Cloudflare hostname, for example:

```
https://music.conanxin.com
```

This removes the need for an SSH tunnel for day-to-day access.

## Current recommended service configuration

The Node.js server should continue to listen locally only:

```bash
HOST=127.0.0.1
PORT=8787
```

Cloudflare Tunnel forwards public traffic to `http://127.0.0.1:8787`. The server never needs to expose a public port.

## Recommended mode: Cloudflare Dashboard managed tunnel

### Step 1: Create the tunnel in Cloudflare Zero Trust

1. Open [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
2. Go to **Networks → Tunnels**
3. Click **Create a tunnel**
4. Choose **Cloudflared** as the connector type
5. Name the tunnel: `mmx-music-studio`
6. Copy the Linux install command — it looks like:

```bash
sudo cloudflared service install <YOUR_TUNNEL_TOKEN>
```

**Important:** Do not paste the token into chat or commit it anywhere.

### Step 2: Configure the public hostname

In the same tunnel configuration page, add a public hostname:

| Field | Value |
|-------|-------|
| **Hostname** | `music.conanxin.com` (or your subdomain) |
| **Service** | `http://127.0.0.1:8787` |

Save and deploy.

### Step 3: Install and run on the VPS

On your VPS, run the install command from the Cloudflare dashboard:

```bash
sudo cloudflared service install <YOUR_TUNNEL_TOKEN>
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
```

Or use the helper script (see below).

## Verification

```bash
# Check the app is running locally
curl -s http://127.0.0.1:8787/api/health

# Check cloudflared is running
systemctl status cloudflared --no-pager

# Check the public hostname
curl -I https://music.conanxin.com
```

## How Cloudflare Tunnel works

- cloudflared runs on the VPS and creates an outbound connection to Cloudflare's edge
- No inbound firewall port needs to be opened for the application
- Cloudflare edge receives public traffic and routes it through the tunnel to `127.0.0.1:8787`
- TLS termination happens at Cloudflare edge; internal traffic is HTTP

## Security notes for production

- For now this is a development/stable-access deployment path
- For production public use, add **Cloudflare Access** (zero-trust auth) or other authentication
- Keep Node.js bound to `127.0.0.1:8787` — never expose it directly to the internet
- Cloudflare Tunnel uses outbound connections from the VPS; the server firewall only needs to allow outgoing connections to `cloudflare.com`

## Helper script

Use `scripts/cloudflare-tunnel-setup.sh` for automated setup:

```bash
# Set token first (from Cloudflare dashboard)
export CLOUDFLARE_TUNNEL_TOKEN='<your-token>'

# Run setup
bash scripts/cloudflare-tunnel-setup.sh
```

Without a token, the script prints the next steps without failing.