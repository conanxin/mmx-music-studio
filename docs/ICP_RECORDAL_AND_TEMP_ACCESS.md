# ICP Recordal and Temporary Access Guide

> Last updated: 2026-06-08 | Phase 4E-D

---

## Current Issue

`https://music.conanxin.com` resolves to Tencent Cloud mainland server `118.195.129.137`, but browser access is intercepted and redirected to:

```
dnspod.qcloud.com/static/webblock.html?d=music.conanxin.com
```

This is a Tencent Cloud / DNSPod web protection page shown when a domain is not ICP-recorded or not connected to a Tencent Cloud ICP recordal on the target server.

---

## Root Cause

**Mainland China cloud servers + custom domain = ICP recordal required.**

Any website hosted on a mainland Chinese cloud server (Tencent Cloud CVM, Lighthouse, etc.) must complete either:

1. **ICP filing (备案)** — filed through a mainland Chinese hosting provider, approved by MIIT
2. **Access recordal (接入备案)** — if domain already has ICP filing elsewhere, connect it to Tencent Cloud's system

Without this, Tencent Cloud's web protection intercepts all HTTP/HTTPS requests and shows the DNSPod block page — regardless of HTTPS certificate, Caddy configuration, or DNS settings.

---

## Technical Configuration Status

The HTTPS setup is **complete and working**:

| Component | Status |
|-----------|--------|
| DNS A record | ✅ `music.conanxin.com → 118.195.129.137` |
| Caddy HTTPS | ✅ Certificate obtained from Let's Encrypt |
| Caddy reverse proxy | ✅ `127.0.0.1:8787` → `music.conanxin.com:443` |
| Node.js server | ✅ Running on `127.0.0.1:8787` |
| TLS 1.2/1.3 | ✅ HTTP/2 200 from server-side curl |
| Tencent Cloud block | ❌ Browser-level interception |

**The code, certificates, and proxy are all correct. The block is a regulatory requirement, not a configuration error.**

---

## Long-term Fix: ICP Recordal

### Step-by-step Tencent Cloud ICP Filing

1. **Log in to Tencent Cloud console**
   - https://console.cloud.tencent.com/
   - Navigate to **Website Filing** (网站备案)

2. **Prepare materials**
   - Tencent Cloud account (verified)
   - Domain: `music.conanxin.com` (or parent `conanxin.com`)
   - Server: current CVM/Lighthouse instance ID
   - ID card (for individual filing) or business license (for enterprise)
   - SMS-capable mobile number (for verification code)
   - WeChat account (Tencent Cloud now requires WeChat for filing)

3. **Select filing type**
   - If `conanxin.com` already has ICP filing with another provider → choose **Access Recordal (接入备案)**
   - If no existing filing → choose **New ICP Filing (首次备案)**

4. **Submit through Tencent Cloud console**
   - Fill in domain, server, personal info
   - Upload ID photo / ID card scan
   - Tencent Cloud preliminary review: 1–3 business days
   - MIIT provincial bureau review: 7–20 business days (varies by province)

5. **After approval**
   - MIIT issues ICP filing number
   - Tencent Cloud updates recordal status
   - DNSPod block page removed automatically
   - `https://music.conanxin.com` becomes publicly accessible

### After ICP Approval — Keep These Configurations

```
- Caddy HTTPS on port 443
- music.conanxin.com Caddyfile config
- HTTPS redirect from HTTP
- WeChat legal domain list update
```

---

## WeChat Mini Program Impact

For WeChat Mini Program production deployment:

- **HTTPS required** ✅ (already configured)
- **Legal request domain** — `music.conanxin.com` after ICP approval
- **Legal downloadFile domain** — `music.conanxin.com` after ICP approval
- **Backend domain recordal** — Mini Program backend domain must be ICP-recorded in mainland China

If ICP filing is not completed, WeChat Mini Program cannot use `music.conanxin.com` as a backend domain.

---

## Temporary Development Access Options

### Option A: SSH Tunnel (Recommended for Development)

From your **local computer** (not the server):

```bash
ssh -L 8787:127.0.0.1:8787 ubuntu@118.195.129.137
```

Then open your local browser:

```
http://localhost:8787
```

This tunnels port 8787 through SSH to your local machine. All traffic is encrypted.

**Pros:** Secure, no exposure to public internet, works even behind NAT  
**Cons:** Requires SSH access, not accessible to others

### Option B: ngrok / Cloudflare Tunnel (No ICP Required)

On the server, install ngrok or use Cloudflare Tunnel:

```bash
# ngrok example (create free account at ngrok.com)
ngrok http 8787
```

This creates a public HTTPS URL (e.g., `https://random.ngrok.io`) that bypasses Tencent Cloud's block because the traffic goes through ngrok's servers, not directly to the Tencent Cloud IP.

**Pros:** Public URL, no ICP required, easy to share  
**Cons:** Third-party tunnel service, URL changes each session (unless paid)

### Option C: Cloudflare Tunnel (Zero Config)

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
./cloudflared tunnel --url http://localhost:8787
```

Get a `*.trycloudflare.com` URL instantly.

**Pros:** Free, no account needed for temporary use, HTTPS included  
**Cons:** URL changes each restart, third-party

### Option D: Move to Overseas / Hong Kong Server

If ICP filing is not feasible, deploy to a non-mainland server:

- **Hong Kong / Singapore / Tokyo** — Tencent Cloud international, or AWS/GCP
- No ICP required for overseas servers
- Same code, new deployment target
- `https://music.conanxin.com` can point to overseas IP after changing DNS A record

**Pros:** No ICP needed, public access, no block  
**Cons:** Higher latency for China users, potential regulatory issues if serving Chinese users

### Option E: Direct IP + Port (NOT Recommended for Production)

Start Node.js on `0.0.0.0:8787` and access `http://118.195.129.137:8787`.

- No ICP block on raw IP (port 8787 not blocked)
- No HTTPS (plain HTTP)
- Exposed without access control
- Only for very short local development testing

**Do NOT use for production or with real MiniMax keys.**

---

## What NOT to Do

- ❌ **Do not** try to bypass ICP block by using random high ports for production
- ❌ **Do not** expose real generation endpoint without access control and quota limits
- ❌ **Do not** publish or share MiniMax API keys on an unprotected endpoint
- ❌ **Do not** attempt to "whitelist" the domain in DNSPod without ICP filing — it won't work
- ❌ **Do not** disable Tencent Cloud security products to try to bypass the block — creates real security risks

---

## Transition Plan: After ICP Approval

Once ICP filing is approved:

1. **Verify public access**
   ```bash
   curl -s https://music.conanxin.com/api/health
   ```

2. **Update WeChat Mini Program legal domains**
   - Go to WeChat Mini Program console → Settings → General → Domain Settings
   - Add `https://music.conanxin.com` to request合法的域名

3. **Test full generation flow** (with `REAL_GENERATION_ENABLED=true` + `REAL_API_DAILY_ATTEMPT_LIMIT=1` guard)

4. **Update DNS if needed** — confirm A record still points to `118.195.129.137`

5. **Update GitHub Release** — document the HTTPS URL as the official demo URL

---

## Summary

| Item | Status |
|------|--------|
| HTTPS/TLS configured | ✅ Yes |
| Domain resolves correctly | ✅ Yes |
| Browser public access | ❌ Blocked by ICP requirement |
| Server-side curl works | ✅ Yes (bypasses block) |
| ICP filing needed | ✅ Yes (mainland server) |
| WeChat Mini Program ready | ⏳ Waiting for ICP |
| Code changes needed | ❌ No |

**Action required:** Complete ICP recordal OR move to overseas server OR use tunnel for temporary access.