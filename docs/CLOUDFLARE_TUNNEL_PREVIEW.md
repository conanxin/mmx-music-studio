# Cloudflare Tunnel Temporary Preview

> Phase 4E-E | Last updated: 2026-06-08

---

## Why This

`music.conanxin.com` is blocked by Tencent Cloud's ICP recordal interception (mainland China regulation). While ICP filing is being processed, Cloudflare Tunnel provides a temporary public HTTPS URL for development and testing — **no ICP required**.

---

## Current Status

| Item | Value |
|------|-------|
| Local app | `http://127.0.0.1:8787` |
| Tunnel URL | `https://seniors-query-ryan-ave.trycloudflare.com` |
| Backend | mock |
| realGenerationEnabled | false |
| mockGenerationEnabled | true |
| Status | ✅ Active |

> ⚠️ Tunnel URL changes every time cloudflared restarts. Update accordingly.

---

## How to Start

### Step 1: Start the app (mock mode)

```bash
cd /home/ubuntu/projects/mmx-music-studio

PREVIEW_ACCESS_ENABLED=false \
REAL_GENERATION_ENABLED=false \
MOCK_GENERATION_ENABLED=true \
MINIMAX_BACKEND=mock \
HOST=127.0.0.1 \
PORT=8787 \
npm run start
```

### Step 2: Start Cloudflare Tunnel

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

Wait ~10 seconds. Output includes:

```
Your quick Tunnel has been created! Visit it at:
https://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.trycloudflare.com
```

### Step 3: Verify

```bash
curl -s https://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.trycloudflare.com/api/health
```

Expected: `{"ok":true, "backend":"mock", "realGenerationEnabled":false, ...}`

---

## What Works on the Tunnel

| Endpoint | Method | Status |
|----------|--------|--------|
| `/api/health` | GET | ✅ HTTP/2 200 |
| `/api/generate` | POST | ✅ Creates job, returns job ID |
| `/api/jobs/<id>` | GET | ✅ Returns job status |
| `/api/tracks` | GET | ✅ Returns track list |
| `/api/tracks/<id>/audio` | GET | ✅ Returns audio/wav (224KB mock) |
| `/api/tracks/<id>/download` | GET | ✅ Returns attachment download |
| Web UI | GET | ✅ HTML + React SPA |

---

## Security Notes

- **Backend: mock** — no real MiniMax API calls, no额度 consumption
- **realGenerationEnabled: false** — real generation is disabled
- **generationAccessEnabled: false** — generation access locked
- No API keys stored or transmitted
- Cloudflare handles HTTPS termination

---

## WeChat Mini Program DevTools Testing

1. Start Cloudflare Tunnel (Step 2 above)
2. Get the tunnel URL from cloudflared output
3. In WeChat DevTools → Settings → Local Settings:
   - Check "Do not verify legal domain, web-view, TLS version, or HTTPS certificate"
4. Set the backend URL to the tunnel URL in your weapp's `config.ts`
5. Test with mock backend only (no real generation)

---

## Limitations

- **URL changes on restart** — not suitable for permanent production
- **No uptime guarantee** (Cloudflare account-less tunnels)
- **ICP still required** for official WeChat Mini Program release
- **Not recommended for production** with real MiniMax keys

---

## Transition to Production

When ICP recordal is complete:

1. Update DNS A record for `music.conanxin.com` to point to server (if not already)
2. Restart Caddy: `systemctl restart caddy`
3. Verify: `curl -s https://music.conanxin.com/api/health`
4. Remove Cloudflare Tunnel process
5. Update WeChat Mini Program legal domain to `https://music.conanxin.com`
6. Configure WeChat backend: `https://music.conanxin.com`

---

## Stop Tunnel

```bash
pkill -f "cloudflared tunnel"
```

---

## Scripts

### `/tmp/run-cloudflared.sh` — Tunnel launcher (do not commit)

```bash
#!/bin/bash
cloudflared tunnel --url http://127.0.0.1:8787 > /tmp/cloudflared-tunnel.log 2>&1
```

### Log location

- App: `/tmp/mmx-cloudflare-tunnel-app.log`
- Tunnel: `/tmp/cloudflared-tunnel.log`
- Do not commit logs to git