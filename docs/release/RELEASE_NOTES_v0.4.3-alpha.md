# mmx-music-studio v0.4.3-alpha

**Release date:** 2026-06-09
**Type:** Public UX polish release

---

## What is this release?

This release focuses on polishing the public user experience after the project became available at **https://music.conanxin.com** via Cloudflare Tunnel.

It keeps the **Web + MMX CLI backend** as the recommended main path, while improving both the Studio creation flow and the Library management experience.

---

## Highlights

### Public URL verified through Cloudflare Tunnel

- **https://music.conanxin.com** — no SSH Tunnel required for normal access
- App service bound to `127.0.0.1:8787` (not exposed on public ports)
- 4/4 Cloudflare Tunnel connections registered to San Jose edge nodes
- SSH Tunnel remains available as a fallback / debug path

### Studio creation experience polished

- **Prompt example chips** — 6 clickable inspiration chips below the prompt textarea: 深夜编程 / 适合晚上编程的 Lo-fi / 夏日海边放松音乐 / 轻柔钢琴测试音乐 / 电影感氛围配乐 / 周一通勤听的轻快电子乐. Clicking a chip appends it to the prompt without triggering generation.
- **Productized runtime mode labels** — status bar shows `MMX CLI 模式` / `BYOK API 模式` / `API 实验模式` / `本地预览` instead of raw technical strings
- **API warnings gated to API backend** — `⚠️ 会消耗额度` / `真实测试剩余 N 次` warnings are hidden when `backend === 'cli'`, reducing noise for CLI users
- **Mobile chip layout** — chips scale down gracefully on 390px screens

### Library upgraded into a more useful music workspace

- **Search** — full-text search across title, prompt, lyrics, source, and mode; combines with source filters; shows result count
- **Source filters + Favorites tab** — five tabs: 全部 / MMX CLI / MiniMax API / 示例 / 收藏; Favorites tab shows a count badge when items are starred
- **Browser-local favorites** — star/unstar tracks; persisted to `localStorage` under key `mmx-studio:favorites`; no server-side storage required
- **Track detail drawer** — right-side panel showing: title, source tag, mode, creation time, duration (seconds + ms), audio format, MIME type, Track ID with copy button, prompt, lyrics; action buttons: 播放 / 下载 / 复制提示词
- **Copy prompt / Copy Track ID** — one-click copy with 2-second toast confirmation
- **Mobile bottom-sheet detail view** — detail drawer becomes a bottom sheet (slides up from bottom) on 390px screens

### README rendering fixed

- All `||` double-pipe table row prefixes replaced with `|` single-pipe
- Long single table split into 4 focused tables: Generation Backends / Studio and Library / CI and Safety / Deployment
- GitHub Markdown table rendering confirmed working

### Cloudflare Tunnel deployment documented

- `docs/CLOUDFLARE_TUNNEL_DEPLOYMENT.md` — dashboard-managed tunnel steps, verification commands, token security notes
- `scripts/cloudflare-tunnel-setup.sh` — helper script for service installation
- Public hostname `music.conanxin.com` verified live

---

## Backend status

### Recommended default (CLI backend)

```
MINIMAX_BACKEND=cli
REAL_GENERATION_ENABLED=true
MOCK_GENERATION_ENABLED=false
GENERATION_ACCESS_ENABLED=false
DAILY_QUOTA_ENABLED=true
DAILY_GENERATION_LIMIT=20
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=3
```

### BYOK API Adapter

- One controlled real BYOK API call was verified in v0.4.2-alpha
- Still **experimental** for production-style usage
- Async task polling (`task_id` response) remains unconfirmed — Phase API-Debug-E pending

---

## Verified

| Check | Result |
|-------|--------|
| GitHub Actions CI | ✅ success |
| Web build | ✅ 268 KB JS + 54 KB CSS |
| Server typecheck | ✅ |
| WeApp build | ✅ |
| Secret scan | ✅ CLEAN (238 files) |
| Product Polish-A smoke | ✅ 13/13 PASS |
| Product Polish-B smoke | ✅ 15/15 PASS |
| README render smoke | ✅ PASS |
| Public health via CF Tunnel | ✅ `backend: cli` |

---

## Known limitations

- **Cloudflare Access is not enabled** — `music.conanxin.com` is currently open to the public internet. Add Cloudflare Access or another auth layer before production use.
- **Favorites are browser-local only** — clearing browser data erases favorites
- **Async API task polling unconfirmed** — `task_id` response handling not yet live-tested
- **This is still an alpha-stage self-hosted tool**

---

## Upgrade from v0.4.2-alpha

No database migration or configuration changes required. Pull the latest commit or extract the release zip on top of your existing deployment.

```bash
# If using the CLI backend, simply restart the server
npm run start
```

---

## Files changed vs v0.4.2-alpha

```
src/features/studio/Studio.tsx        — prompt example chips, productized labels, API warnings gated
src/features/studio/Studio.module.css — example chip styles, mobile chip fixes
src/features/library/Library.tsx      — search, favorites, detail drawer, copy functions
src/features/library/Library.module.css — search/favorites/detail drawer/bottom-sheet CSS
scripts/product-polish-smoke-test.sh  — new
scripts/product-polish-b-smoke-test.sh — new
README.md                              — tables fixed, status updated, public URL
docs/CLOUDFLARE_TUNNEL_DEPLOYMENT.md  — new
docs/DEVELOPMENT_HANDOFF.md            — public URL updated
```
