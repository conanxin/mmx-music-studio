# mmx-music-studio v0.3.0-alpha

**发布类型：** Alpha 预览版（Phase 4E 部署就绪 + Phase 5A/5B BYOK 预检）
**发布日期：** 2026-06-08
**仓库：** https://github.com/conanxin/mmx-music-studio

---

## Summary

v0.3.0-alpha freezes the HTTPS deployment readiness, ICP recordal documentation, Cloudflare Tunnel temporary preview, and BYOK API key mode preflight (Phase 5A + Phase 5B-A + Phase 5B-C).

**This is a development preview.** Do not use in production without understanding the known limitations.

---

## Highlights

- **Web main app** with mock / CLI / API runtime modes — all smoke tests pass
- **Job Queue** — background async processing + Web polling UI
- **Job History Admin** — stats, filter, detail, cancel, delete, retry
- **Access Control / Rate Limit / Daily Quota** — layered protection
- **Audit Logging + PIN Brute-force Guard** — Phase 4F security hardening
- **BYOK API Key Mode** — backend core, UI, smoke tests, documentation complete
- **BYOK Real Test Preflight** — Phase 5B-A pre-check without real API calls
- **Real API Attempt Guard** — Phase 5B-C daily limit before any real API call
- **HTTPS domain deployment** — Caddy + Let's Encrypt, `music.conanxin.com` technically ready
- **ICP recordal guide** — Tencent Cloud mainland server requires ICP filing
- **Cloudflare Tunnel temporary HTTPS preview** — no ICP required for dev
- **WeChat Mini Program scaffold** — mock API, audio playback, download adapters

---

## Current Preview

**Cloudflare Tunnel (temporary, changes on restart):**
```
https://seniors-query-ryan-ave.trycloudflare.com
```

To start your own tunnel:
```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

**Local development:**
```bash
npm install
PREVIEW_ACCESS_ENABLED=false REAL_GENERATION_ENABLED=false MOCK_GENERATION_ENABLED=true MINIMAX_BACKEND=mock npm run start
# Open http://localhost:8787
```

---

## Production Domain Status

**`https://music.conanxin.com` — HTTPS technical chain is complete:**
- Caddy reverse proxy: ✅ configured
- Let's Encrypt certificate: ✅ obtained
- DNS A record: ✅ pointing to 118.195.129.137
- Public browser access: ❌ blocked by Tencent Cloud webblock

**Root cause:** Mainland China cloud server requires ICP recordal before custom domain is accessible. This is a regulatory requirement, not a configuration error.

**Solution:** Complete ICP filing / Tencent Cloud access recordal (estimated 7–20 business days).

---

## Safety Defaults

| Setting | Value |
|---------|-------|
| backend | mock |
| realGenerationEnabled | false |
| mockGenerationEnabled | true |
| BYOK key storage | memory only |
| .env committed | no |
| real audio committed | no |
| quota/audit logs committed | no |

**No real MiniMax API calls, no quota consumption in default mode.**

---

## Known Limitations

- **BYOK real MiniMax API test** — pending (waiting for ICP or Cloudflare Tunnel dev phase)
- **ICP recordal** — required for `music.conanxin.com` public access; Cloudflare Tunnel is temporary workaround
- **WeChat legal domain formal setup** — pending ICP filing
- **Multi-user auth** — not implemented (single-user self-hosted)
- **Cloudflare Tunnel** — for temporary development preview only; URL changes on restart, no uptime guarantee

---

## Security

- Real generation disabled by default
- BYOK key is memory-only, never written to disk
- No `.env` file committed to git
- No real generated audio committed to git
- No quota/audit runtime JSON committed to git
- Secret scan: CLEAN (no real keys/tokens/PINs in codebase)

---

## Repository

https://github.com/conanxin/mmx-music-studio

For full documentation, see:
- [docs/ICP_RECORDAL_AND_TEMP_ACCESS.md](docs/ICP_RECORDAL_AND_TEMP_ACCESS.md)
- [docs/CLOUDFLARE_TUNNEL_PREVIEW.md](docs/CLOUDFLARE_TUNNEL_PREVIEW.md)
- [docs/BYOK_MODE.md](docs/BYOK_MODE.md)
- [CHANGELOG.md](CHANGELOG.md)