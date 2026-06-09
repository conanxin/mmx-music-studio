# mmx-music-studio v0.4.6-alpha

## What is this release?

This release stabilizes the public deployment path for mmx-music-studio. The app is now publicly reachable through Cloudflare Tunnel and runs as a systemd service on the VPS, so it no longer depend on an active SSH session or a manually started Node process.

## Highlights

### Stable public URL
- **https://music.conanxin.com** — live and verified
- Cloudflare Tunnel routes public traffic to `http://127.0.0.1:8787`
- SSH Tunnel is now a fallback / debug option only

### Node server installed as systemd service
- Service name: `mmx-music-studio`
- `enabled` at boot — survives server reboots
- `Restart=always` — auto-restarts on crash
- Daily generation limit: 50/day
- Backend: `cli` (recommended default)

### CLI backend diagnostics added
- `scripts/cli-backend-diagnostics.sh` — runtime health checks (13 checks)
- `scripts/cli-backend-readiness-smoke-test.sh` — static smoke test (26 checks)
- mmx binary: `/home/ubuntu/.npm-global/bin/mmx` v1.0.16
- Spawn-based auth (not exec), 240s timeout, proxy env vars cleared

### systemd helpers added
- `deploy/systemd/mmx-music-studio.service` — unit file template
- `scripts/install-systemd-service.sh` — installation script
- `scripts/systemd-service-smoke-test.sh` — static validation (17 checks)

## Current runtime

| Item | Value |
|------|-------|
| Public URL | https://music.conanxin.com |
| Local service | http://127.0.0.1:8787 |
| Backend | `cli` (recommended default) |
| Daily generation limit | 50/day |
| Cloudflare Tunnel | `active (running)` |
| systemd service | `active` and `enabled` |
| mmx CLI | v1.0.16, spawn-based |

## Useful operations

```bash
# Check service status
sudo systemctl status mmx-music-studio

# Restart service
sudo systemctl restart mmx-music-studio

# Follow logs
journalctl -u mmx-music-studio -f

# Run CLI diagnostics
bash scripts/cli-backend-diagnostics.sh

# Run full diagnostics
bash scripts/cli-backend-readiness-smoke-test.sh
bash scripts/systemd-service-smoke-test.sh
```

## Known limitations

- **Cloudflare Access** is not enabled yet — public URL is unauthenticated
- **mmx auth expiration** still requires monitoring; auth can expire after extended use
- **CLI metadata enrichment** can still be improved (future work)
- **BYOK API Adapter async task polling** remains future work

## Upgrade notes

This release does not introduce new generation logic or change the data model. Upgrade from v0.4.5-alpha by pulling the latest code and restarting the systemd service:

```bash
cd /home/ubuntu/projects/mmx-music-studio
git pull origin master
sudo systemctl restart mmx-music-studio
```

No migration required.