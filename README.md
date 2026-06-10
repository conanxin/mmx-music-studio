# MiniMax 音乐创作台 / mmx-music-studio

[![GitHub Repo](https://img.shields.io/badge/GitHub-mmx--music--studio-blue?logo=github)](https://github.com/conanxin/mmx-music-studio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Phase](https://img.shields.io/badge/Phase-v0.4.23--alpha-red.svg)](https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.23-alpha)
[![CI](https://github.com/conanxin/mmx-music-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/conanxin/mmx-music-studio/actions/workflows/ci.yml)

**开源、自托管、BYOK 的 MiniMax 音乐生成网站**

> ⚠️ **免责声明**：这是一个非官方的开源项目，与 MiniMax 无任何关联。

---

## 快速开始

### Docker（推荐，最快）

```bash
git clone https://github.com/conanxin/mmx-music-studio.git && cd mmx-music-studio
docker compose up -d
# 访问 http://localhost:8787
```

> 默认安全模式，无需 API Key，不消耗额度。

### 本地开发

```bash
npm install
npm run dev:full
# Web: http://localhost:5174
# API:  http://localhost:8787
```

### 生产构建

```bash
npm install
npm run build
npm run start
# API: http://localhost:8787
# 前端: dist/（需配置 Nginx 托管）
```

---

## 微信小程序（Phase 3D+）

> 🚧 **开发中** — Phase 3D: DevTools 导入 + 真机预览准备

### 微信开发者工具导入

```bash
# 1. 编译小程序
npm run weapp:build

# 2. 导入微信开发者工具
# 项目目录选择：apps/weapp/
# AppID：测试号（touristappid）

# 3. 开发阶段设置
# 详情 → 本地设置 → 勾选「不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」
```

### dist 打包下载

```bash
bash scripts/package-weapp-dist.sh
# 输出：/tmp/mmx-music-studio-weapp-dist.zip
```

详细文档：[docs/WEAPP_DEVTOOLS_IMPORT.md](docs/WEAPP_DEVTOOLS_IMPORT.md)

#### Phase 3E — HTTPS 域名与合法域名配置

> 当前阶段：Phase 5B-A BYOK 预检完成，Phase 5B-B 待用户确认执行真实测试

**配置模板**：
- `deploy/Caddyfile.example` — Caddy HTTPS 反代（自动 SSL，推荐）
- `deploy/nginx.mmx-music-studio.conf.example` — Nginx HTTPS 反代（手动 SSL）

**文档**：
- [docs/WEAPP_DOMAIN_HTTPS_GUIDE.md](docs/WEAPP_DOMAIN_HTTPS_GUIDE.md) — 微信合法域名配置总览
- [docs/CADDY_DEPLOYMENT.md](docs/CADDY_DEPLOYMENT.md) — Caddy 部署指南
- [docs/NGINX_DEPLOYMENT.md](docs/NGINX_DEPLOYMENT.md) — Nginx 部署指南

**域名就绪检查**：
```bash
DOMAIN=music.yourdomain.com bash scripts/weapp-domain-readiness-check.sh
```

**当前 API Base**：
- 开发：`http://118.195.129.137:8787`（仅开发者工具调试）
- 生产占位符：`https://music.conanxin.com`（用户提供域名后替换）

**正式发布要求**：
- HTTPS 域名（必须）
- 微信公众平台配置 request 合法域名
- 微信公众平台配置 downloadFile 合法域名
- 小程序不存储 MiniMax key

---

**Version:** `v0.4.2-alpha` · [Release Notes](https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.2-alpha)

> **推荐主链路**：Web + MMX CLI backend（`backend=cli`）。与 Telegram 生成链路一致，稳定性已验证。

## Current Status

### Generation Backends

| Backend | Status | Notes |
|---------|--------|-------|
| Mock generation | ✅ PASS | Safe local preview |
| MMX CLI backend | ✅ **Recommended** | Same route as Telegram |
| BYOK API Adapter | ✅ Verified once / Experimental | Real `direct_audio` success; not production-ready |
| Real generation in CI | ❌ Disabled | CI uses mock / guards only |

### Studio and Library

| Area | Status | Notes |
|------|--------|-------|
| Studio player handoff | ✅ PASS | Job track handoff fixed |
| Studio cold-start hydration | ✅ PASS | Loads latest playable track |
| Studio generation flow polish | ✅ PASS | Phase messages, success/error cards, prompt guidance |
| Public landing / onboarding | ✅ PASS | Hero, quick-start, status card, mobile polish |
| Audio duration display | ✅ PASS | Reads HTMLAudioElement metadata |
| Download endpoint | ✅ PASS | MP3 download supported |
| Library sharing / export | ✅ PASS | Share link, Markdown export, URL deep-link, share button |
| Prompt template composer | ✅ PASS | 4 groups: scene/mood/instrument/use, apply to textarea |
| Custom prompt templates | ✅ localStorage | `mmx-studio:prompt-templates`, max 20, browser-local only |
| Playback queue | ✅ PASS | App-level queue state, prev/next buttons, audio ended → next, Library plays filtered list, detail drawer add-to-queue, queue panel with remove/clear |
| Playback queue persistence | ✅ PASS | Queue survives page refresh via localStorage (`mmx-studio:playback-queue:v1`), mode saved |
| Playback modes | ✅ PASS | sequence / repeat-all / repeat-one / shuffle toggle button, mode label in queue panel |
| Playback progress memory | ✅ PASS | Throttled 5s save to localStorage, progress restored on track reload |
| Async API polling | ✅ Design | `pollingEndpointConfigured: false`, `MINIMAX_API_ASYNC_POLLING_REQUIRED`, Studio error card, 3 async fixtures |

**Product Polish releases:**
- **Phase Product Polish-P** — Library interaction polish and final UX consistency: active filter chips (来源 / 集合 / 标签 / 搜索) with per-chip × remove buttons, per-filter clear handlers (single filter clear without affecting others), search match hints on each track card (matching 标题 / Prompt / 歌词 / 模式 / 来源 / 标签 / 备注, max 3), batch operation scope hints (批量操作将作用于已选择的 N 首作品 / 请选择作品后再执行批量操作), timeline action filters a11y polish (role=group, aria-label, per-chip title), accessibility polish across batch toggle / track checkbox / filter chips / drawer buttons, mobile polish (activeFilterChip wrap, match hint ellipsis, batchScopeHint role=status), no `/api/generate` calls, no server upload, no schema migration
- **Phase Product Polish-N** — Annotation timeline, batch note editing, and Library polish: per-track 标注时间线 (collapse: 5, expand: 300 via 查看全部 / 收起), action badges (添加标签 / 删除标签 / 批量添加标签 / 批量删除标签 / 更新备注 / 合并导入 / 覆盖导入), Library-wide 标注历史总览 折叠面板 (最近 20 条 + filter chips: 全部 / 标签变更 / 备注变更 / 导入), batch note editor in batch toolbar (覆盖备注 / 追加到备注, 500-char cap, records `note_updated` history with all selected trackIds), mobile CSS (historyFilterRow horizontal scroll, batch note full-width), no `/api/generate` calls, no server upload, no schema migration, smoke test 51/51 PASS
- **Phase Product-Polish-M** — Collection links and annotation history: `mmx-studio:annotation-history:v1` (cap 300, 7 action types), batch remove tag (case-insensitive), collection URL state `?q=&source=&collection=&tag=` via `history.replaceState`, share link button copies current filter URL, drawer `最近标注历史` last 5 actions per track, `LibraryLocalBackupV1.annotationHistory` field with backward compat for v1.0 backups, collection Markdown/JSON export include `collectionUrl` + `filters`, mobile CSS, smoke test
- **Phase Deploy-CF-C** — Cloudflare Access for Ops and Status (✅ **verified 2026-06-10**): protects `/ops`, `/ops/*`, `/api/status`, `/api/debug/*` at the Cloudflare edge; keeps `/`, `/library`, `/studio`, `/api/health` public; `/api/generate` remains owned by the server-side Launch Guard; Access is configured in the Cloudflare Dashboard (Zero Trust → Access), not in app code; `docs/deploy/CLOUDFLARE_ACCESS_OPS.md` documents the operator policy, rollback and verification table; `scripts/deploy-cf-c-access-smoke-test.sh` returns `DEPLOY_CF_C_ACCESS_PENDING` before Dashboard config and `DEPLOY_CF_C_ACCESS_SMOKE_PASS` after — current state PASS, `/ops` and `/api/status` return `302` to Cloudflare Access login
- **Phase Product-Polish-L** — Collections export, library batch actions, and annotation backup: `libraryBackup.ts` (LibraryLocalBackupV1 model + validate/merge/replace), Library batch mode (checkbox per card, select-all/clear, batch add tag with 12-tag / 24-char cap), collection export Markdown/JSON (filtered / selected / smart-collection labeled), local backup panel (export/import localStorage JSON with merge or replace), mobile adaptation, smoke test
- **Phase Product-Polish-K** — Tags, notes, and smart collections: localStorage annotation (tags + note per track), Library drawer editor (tag chips + note textarea, save button), smart collection filters (有标签/有备注/最近生成/CLI生成/API生成), tag filter chips with count, card annotation display (3 chips + overflow + note icon), annotation search (tags + note), Markdown export with Tags/Notes, mobile adaptation
- **Phase Product-Polish-I** — Playback queue persistence: localStorage queue/mode restore on mount, 4 playback modes (sequence / repeat-all / repeat-one / shuffle), throttled progress save/restore, queue item click-to-jump, queue panel mode label
- **Phase Product Polish-H** — Playback queue: App-level playbackQueue state, prev/next buttons, audio ended → next track, Library plays current filtered list, detail drawer add-to-queue, queue panel with remove/clear, mobile responsive
- **Phase Product Polish-G** — Global mini player: App-level currentPlayingTrack state, fixed bottom player in Layout, Library and Studio play actions unified
- **Phase Product Polish-E** — Library sharing / Markdown export / URL deep-link / mobile drawer polish

### CI and Safety

| Area | Status | Notes |
|------|--------|-------|
| GitHub Actions CI | ✅ PASS | Web/server/weapp gates |
| WeApp build in CI | ✅ PASS | Blocking gate restored |
| Secret scan | ✅ PASS | `scripts/ci-secret-scan.py` |
| BYOK key storage | ✅ Memory only | No disk persistence |
| API Adapter real BYOK call | ✅ One succeeded | `direct_audio` response kind |
| Public Generation Guardrails | ✅ PASS | Phase Launch Guard-A — global pause, per-source daily limit, cooldown |
| Public Ops Monitoring | ✅ PASS | Phase Ops-Monitor-A — `/api/health` + `/api/status`, job queue/storage aggregates |
| Storage Management | ✅ Phase Storage-A | `storage-a-inventory-report.sh`, `storage-a-retention-dry-run.sh`, `storage-a-backup-manifest.sh`, no auto-deletion |

### Public Generation Guardrails

Public alpha deployments use lightweight generation guardrails to protect the server and quota:

- `PUBLIC_GENERATION_GUARD_ENABLED` — enable/disable guard logic
- `PUBLIC_GENERATION_ENABLED` — global pause for public generation (Library/playback unaffected)
- `PER_SOURCE_DAILY_GENERATION_LIMIT` — per-source daily generation cap (default: 5)
- `GENERATION_COOLDOWN_SECONDS` — minimum interval between generations from same source (default: 30s)

Source identification uses SHA256 hashing (via `cf-connecting-ip` / `x-forwarded-for` / `remoteAddress`) — raw IPs are never stored.

These guardrails are for public alpha protection. They are not a replacement for accounts, billing, or full abuse-prevention infrastructure.

### Deployment

| Area | Status | Notes |
|------|--------|-------|
| HTTPS | ✅ PASS | Cloudflare Tunnel `https://music.conanxin.com` |
| Public URL | ✅ PASS | `https://music.conanxin.com` — no SSH Tunnel needed |
| systemd service | ✅ PASS | `mmx-music-studio.service`, active/enabled |
| Cloudflare Tunnel | ✅ PASS | 4 San Jose connections, boot-persistent |
| systemd service | ✅ PASS | `mmx-music-studio.service`, active/enabled, `Restart=always` |

**完整状态与换电脑继续开发指南**：[docs/DEVELOPMENT_HANDOFF.md](docs/DEVELOPMENT_HANDOFF.md)

## Release

**v0.4.23-alpha**：Phase Release v0.4.23-alpha — Library UX polish and timeline clarity release (commit `bde4cff` + release prep, tag `v0.4.23-alpha`)

**v0.4.22-alpha**：Phase Release v0.4.22-alpha — Annotation timeline and batch notes release (commit `f3ab915` + release prep, tag `v0.4.22-alpha`)

**Phase Product Polish-O**：Library final polish, timeline refinements, and UX consistency (commit pending — Current view summary, Clear all filters, Better empty states, Batch toolbar grouping, Drawer hierarchy polish, Timeline readability polish, Local-only export / backup clarification, Mobile polish 639/390)

### Current Status (v0.4.23-alpha)

- Current view summary: PASS
- Clear all filters: PASS
- Better empty states: PASS
- Batch toolbar grouping: PASS
- Drawer hierarchy polish: PASS
- Timeline readability polish: PASS
- Mobile Library polish: PASS
- Active filter chips: PASS
- Per-filter clear buttons: PASS
- Search match hints: PASS
- Batch operation scope hints: PASS
- Timeline action filters: PASS
- Accessibility polish: PASS
- Interaction polish mobile: PASS
- Cloudflare Access for Ops: PASS
- Public URL: https://music.conanxin.com
- Recommended backend: CLI


### Current Status (v0.4.22-alpha)

| Capability | Status |
|------------|--------|
| Annotation timeline: PASS | ✅ (Library drawer per-track 5-default / expand-to-300 timeline with 7 action badges) |
| Library-wide history: PASS | ✅ (`LibraryHistoryPanel`, 20 latest events, 4 filter chips, collapsible, no 清空 button) |
| Batch note editing: PASS | ✅ (overwrite + append modes, 500-char cap, `note_updated` history) |
| Product Polish-P smoke: PASS | ✅ |
| Product Polish-N smoke: PASS | ✅ (55/55) |
| Release workflow fix: PASS | ✅ (commit `9662754`, `--verify-tag` removed; manual fallback documented) |
| Cloudflare Access for Ops: PASS | ✅ (HTTP 302 → Access login) |
| `/ops` protected: PASS | ✅ |
| `/api/status` protected: PASS | ✅ |
| `/` public: PASS | ✅ (HTTP 200) |
| `/library` public: PASS | ✅ (HTTP 200) |
| `/api/health` public: PASS | ✅ (HTTP 200, JSON `ok:true`) |
| `/api/generate` still owned by Launch Guard | ✅ Confirmed (no Access double-layer) |
| Public URL: https://music.conanxin.com | ✅ |
| Recommended backend: CLI | ✅ |

**v0.4.21-alpha**：Phase Release v0.4.21-alpha — Protected Ops and release automation closeout (commits `b4d39b3` + `d0acc1f` + release prep, tag `v0.4.21-alpha`)

### Current Status (v0.4.21-alpha)

| Capability | Status |
|------------|--------|
| Cloudflare Access for Ops: PASS | ✅ |
| `/ops` protected: PASS | ✅ (HTTP 302 → Access login) |
| `/ops/*` protected: PASS | ✅ |
| `/api/status` protected: PASS | ✅ (HTTP 302 → Access login) |
| `/api/debug/*` protected: PASS | ✅ |
| `/` public: PASS | ✅ (HTTP 200) |
| `/library` public: PASS | ✅ (HTTP 200) |
| `/studio` public: PASS | ✅ (HTTP 200) |
| `/api/health` public: PASS | ✅ (HTTP 200, JSON `ok:true`) |
| `/api/generate` still owned by Launch Guard | ✅ Confirmed (no Access double-layer) |
| Release workflow: PASS | ✅ (`.github/workflows/release.yml` active) |
| Release workflow backfill: PASS | ✅ (v0.4.18/19/20 3/3 success) |
| Deploy-CF-C smoke test: PASS | ✅ (12/12, exit 0) |
| `docs/deploy/CLOUDFLARE_ACCESS_OPS.md` | ✅ Created + verification table |
| Public URL: https://music.conanxin.com | ✅ Verified |
| Recommended backend: CLI | ✅ |

**v0.4.20-alpha**：Phase Release v0.4.20-alpha — Collection links and annotation history release (commit `a05f60a`, tag `v0.4.20-alpha`)

### Current Status (v0.4.20-alpha)

| Capability | Status |
|------------|--------|
| Collection links | ✅ PASS |
| URL query filters (`q` / `source` / `collection` / `tag`) | ✅ PASS |
| Batch remove tag | ✅ PASS |
| Annotation history | ✅ PASS |
| Backup `annotationHistory` extension | ✅ PASS |
| Markdown / JSON export `collectionUrl` + `filters` | ✅ PASS |
| localStorage key `mmx-studio:annotation-history:v1` | ✅ PASS (cap 300) |
| `LibraryLocalBackupV1` v1.0 backward compat | ✅ PASS |
| 7 history action types | ✅ PASS |
| Drawer history list (last 5 per track) | ✅ PASS |
| Product-Polish-M smoke test (82/82) | ✅ PASS |

**Phase Deploy-CF-C — Cloudflare Access for Ops and Status (✅ verified 2026-06-10, see [docs/deploy/CLOUDFLARE_ACCESS_OPS.md](docs/deploy/CLOUDFLARE_ACCESS_OPS.md))**

| Capability | Status |
|------------|--------|
| Cloudflare Access app config (Dashboard `MMX Music Studio Ops`) | ✅ Enabled |
| `docs/deploy/CLOUDFLARE_ACCESS_OPS.md` | ✅ Created + verification table |
| `scripts/deploy-cf-c-access-smoke-test.sh` | ✅ PASS (12/12, exit 0) |
| `/`, `/library`, `/studio` remain public | ✅ Verified (HTTP 200) |
| `/api/health` remains public | ✅ Verified (HTTP 200 + JSON `ok:true`) |
| `/api/generate` still owned by Launch Guard (NOT moved to Access) | ✅ Confirmed |
| Protected paths: `/ops`, `/ops/*`, `/api/status`, `/api/debug/*` | ✅ Live (HTTP 302 → Cloudflare Access login) |

**v0.4.20-alpha**：Phase Product-Polish-M — Collection sharing, tag cleanup, and annotation history release (annotation history `mmx-studio:annotation-history:v1` cap 300, batch remove tag, collection URL `?q=&source=&collection=&tag=` via `history.replaceState`, drawer history list, share link button, backup v1.0 now includes annotationHistory, collection export with collectionUrl+filters, mobile CSS, smoke test 67/67)

**v0.4.19-alpha**：Phase Product-Polish-L — Collections export, library batch actions, and annotation backup release (`libraryBackup.ts` with LibraryLocalBackupV1 model, batch mode, collection MD/JSON export, local backup panel with merge/replace, mobile adaptation, smoke test)

**v0.4.18-alpha**：Phase Product-Polish-K — Tags, notes, and smart collections release (trackAnnotations.ts, Library annotation editor, tag chips, smart collections, tag filter, enhanced search, Markdown export tags/notes, localStorage browser-only)

**v0.4.17-alpha**：Phase Ops-Monitor-B — Read-only operations panel release (`/ops` page, service/Launch Guard/job queue/storage summary cards, copyable diagnostics, manual refresh, 30s auto-refresh, mobile layout, Ops-Monitor-B smoke test)

**v0.4.16-alpha**：Phase Storage-A — Storage management and retention dry-run release (`server/storage-maintenance.ts`, inventory/retention-dry-run/backup-manifest scripts, `docs/STORAGE_POLICY.md`, dry-run only, no auto-deletion)

**v0.4.15-alpha**：Phase Ops-Monitor-A — Public runtime diagnostics release (`GET /api/status`, job queue/storage aggregates, public-safe runtime status summary, ops monitoring docs)

**v0.4.14-alpha**：Phase Launch Guard-A — Protected public generation release (global pause, per-source daily limit, generation cooldown, hashed source guard state, `/api/health` guard fields)

**v0.4.13-alpha**：Phase Product Polish-J — Public launch readiness and trust UX release

**v0.4.12-alpha**：API Adapter async polling readiness + Product Polish-J public launch readiness

**v0.4.11-alpha**：Phase Product Polish-I — Playback queue persistence and playback modes

**v0.4.10-alpha**：Phase Product Polish-H — Playback queue and continuous playback

**v0.4.9-alpha**：Phase Product Polish-G — Global mini player and playback continuity

**v0.4.8-alpha**：Phase Product Polish-F — Prompt templates and style presets

**v0.4.6-alpha**：Stable public deployment release — Cloudflare Tunnel public access verified (`https://music.conanxin.com`); Node server installed as `mmx-music-studio.service` (enabled at boot, `Restart=always`, 50/day limit); CLI backend diagnostics (`cli-backend-diagnostics.sh` 13 checks, `cli-backend-readiness-smoke-test.sh` 26 checks); systemd helpers (unit file, install script, smoke test); README/handoff/deployment docs updated to reflect systemd-managed deployment.

**v0.4.6-alpha**：Stable public deployment release — Cloudflare Tunnel public access verified (`https://music.conanxin.com`); Node server installed as `mmx-music-studio.service` (enabled at boot, `Restart=always`, 50/day limit); CLI backend diagnostics (`cli-backend-diagnostics.sh` 13 checks, `cli-backend-readiness-smoke-test.sh` 26 checks); systemd helpers (unit file, install script, smoke test); README/handoff/deployment docs updated to reflect systemd-managed deployment.

**v0.4.5-alpha**：Public landing and onboarding polish

**v0.4.4-alpha**：Studio generation flow polish — 4-step phase messages, prompt guidance, success/error cards with recovery actions, mobile state card polish. No generation logic changes. CLI backend remains recommended default. [Release Notes](docs/release/RELEASE_NOTES_v0.4.4-alpha.md)

**v0.4.3-alpha**：Public UX polish release — Studio prompt example chips; productized runtime mode labels; API warnings gated to API backend; Library full-text search; browser-local favorites; track detail drawer with copy; mobile bottom-sheet detail view; Cloudflare Tunnel public URL verified; README table rendering fixed. CLI backend remains recommended default.

**v0.4.2-alpha**：BYOK API Adapter real-call verified — one controlled real generation succeeded (`direct_audio` response, `job_1780992991977_c9eaaa0c`, `track_1780993112817_yg4g4m`); Studio BYOK submit diagnostics fixed; daily quota guard respects `dailyQuotaEnabled`; API Adapter marked "experimental, one real success". CLI backend remains recommended default.

**v0.4.1-alpha**：[Release Notes](docs/release/RELEASE_NOTES_v0.4.1-alpha.md) | [GitHub Release](https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.1-alpha) | Web CLI 主链路稳定版，Studio 播放器修复

**v0.4.0-alpha**：[Release Notes](docs/release/RELEASE_NOTES_v0.4.0-alpha.md) | [GitHub Release](https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.0-alpha) | BYOK Safety + WeChat BYOK Strategy

**v0.2.0-alpha**：[Release Notes](docs/release/RELEASE_NOTES_v0.2.0-alpha.md) | [GitHub Release](https://github.com/conanxin/mmx-music-studio/releases/tag/v0.2.0-alpha)



---

## 三种运行模式

| 模式 | 真实生成 | 额度消耗 | 用途 |
|------|----------|----------|------|
| [Demo Preview（安全预览）](docs/RUNTIME_MODES.md#1-demo-preview安全预览模式) | ❌ | ❌ | 公开演示，给别人看 UI |
| [Private Real（私有真实生成）](docs/RUNTIME_MODES.md#2-private-real私有真实生成) | ✅ | ✅ | 个人自用，需 mmx auth login |
| [Production Locked（生产锁定）](docs/RUNTIME_MODES.md#3-production-locked生产锁定模式) | ❌ | ❌ | 公网发布前，需访问保护 |

> ⚠️ 真实生成会消耗 MiniMax Token Plan 额度。公网部署前请确保已开启访问保护。

详见 [docs/RUNTIME_MODES.md](docs/RUNTIME_MODES.md)。

### 快速启动

```bash
# 安全预览（默认）
bash scripts/run-demo-preview.sh

# 私有真实生成（会消耗额度）
bash scripts/run-private-real.sh

# 生产锁定（需先设置 PIN）
bash scripts/run-production-locked.sh
```

### 正式发布前检查

```bash
npm run production:check
```

---

## 功能规划

- 🎵 **纯音乐 / BGM** — 文字描述生成背景音乐
- 🎤 **自动写歌词并生成歌曲** — 输入主题，自动写词+作曲
- ✍️ **歌词成歌** — 提供自己的歌词，生成完整歌曲
- 🔄 **参考音频 Cover / 改编** — 上传参考音频进行风格改编
- ▶️ **在线试听** — 波形播放器，无需下载即可播放
- 💾 **下载 MP3** — 一键保存高质量 MP3 文件
- 📚 **作品库** — 历史作品管理，随时回听

---

## 后端模式

| 模式 | 真实生成 | 额度消耗 | 用途 |
|------|----------|----------|------|
| `mock` | ❌ | ❌ | 默认安全模式，本地模拟 |
| `cli` | ✅ | ✅ | 需服务器 `mmx` 已登录（推荐） |
| `api` | ✅ | ✅ | 需 `MINIMAX_API_KEY` 环境变量（实验性） |

详见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

---

## 安全默认值

默认配置为**安全模式**，不消耗额度：

```bash
REAL_GENERATION_ENABLED=false  # 不调用真实 API
MOCK_GENERATION_ENABLED=true   # 使用本地模拟
MINIMAX_BACKEND=mock           # 后端模式
```

真实生成需要显式开启（⚠️ 会消耗 MiniMax Token Plan 额度）。

---

## Online Preview

**Live preview**: https://music.conanxin.com

> **Cloudflare Tunnel** — public traffic routes through Cloudflare Tunnel to `http://127.0.0.1:8787`. No SSH Tunnel needed for normal access. App remains bound to `127.0.0.1:8787`. SSH Tunnel remains a fallback/debug path.

> ⚠️ **当前为真实生成模式（MMX CLI）** — 此预览后端使用 `MINIMAX_BACKEND=cli` + `REAL_GENERATION_ENABLED=true`，会真实调用 MiniMax mmx CLI 并消耗 Token Plan 额度。
>
> 如需安全模拟模式，请使用 Docker 部署：
> ```bash
> docker compose up -d
> ```
> 或手动设置：
> ```bash
> REAL_GENERATION_ENABLED=false MOCK_GENERATION_ENABLED=true MINIMAX_BACKEND=mock npm run start
> ```

### Public Preview API Base

生产预览默认使用 **same-origin API**：

- 打开 `http://<server-ip>:8787` 时，前端自动请求 `http://<server-ip>:8787/api/*`
- **不要**在生产构建中写死 `VITE_API_BASE_URL=http://localhost:8787`（会导致浏览器向用户本机 localhost 发请求）
- 本地开发如果需要可设置 `VITE_API_BASE_URL=http://localhost:8787`
- 不要在环境变量中写入任何真实 Key

---

## 技术栈

- React 18 + TypeScript
- Vite 5（构建工具）
- React Router v6（路由）
- CSS Modules（样式）
- Node.js 22 + tsx（API Server）
- Docker + Docker Compose（容器化）

---

## 项目结构

```
mmx-music-studio/
├── src/                     # Web 前端（React）
├── server/                  # API Server（TypeScript + tsx）
├── packages/
│   ├── core/               # 平台无关核心逻辑
│   ├── adapters/           # 平台适配器（API/CLI/Mock）
│   └── ui-tokens/          # UI 设计令牌
├── scripts/
│   ├── release-check.sh    # 发布前检查（必跑）
│   ├── manifest-audit.ts   # manifest 审计
│   └── manifest-fix.ts     # manifest 修复
├── docs/                    # 项目文档
├── storage/tracks/          # 生成的音频（git 忽略）
├── Dockerfile               # 多阶段构建镜像
├── docker-compose.yml       # Docker Compose 部署
└── .dockerignore
```

---

## 界面预览

截图位于 `docs/screenshots/`，包含创作台/作品库/设置页的移动端和桌面端截图。

| 资源 | 路径 |
|------|------|
| 设计评审页 | `docs/screenshots/review.html` |
| 截图拼贴图 | `docs/screenshots/contact-sheet.png` |
| 截图源文件 | `docs/screenshots/*.png` |

---

## 微信小程序准备

项目从第一天起就考虑了微信小程序迁移：

- 业务逻辑全在 `packages/core`（平台无关）
- API 调用通过 `packages/adapters` 适配
- UI 组件小程序端用 Taro / uni-app 接入
- 不依赖浏览器专有 API

详见 [docs/MINIPROGRAM-READY.md](docs/MINIPROGRAM-READY.md)

---

## Roadmap

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | UI 原型 + 项目文档 | ✅ 完成 |
| Phase 2A–F | Mock / API / CLI / Docker / 发布准备 | ✅ 完成 |
| Phase 3A–E | 微信小程序接入（Taro v4, mock API, HTTPS 就绪） | ✅ 完成 |
| Phase 4A | 三种运行模式 + 生产发布检查 + Systemd 部署 | ✅ 完成 |
| **Phase 4B** | **生成任务队列（后台异步处理 + Web 轮询 UI）** | ✅ 完成 |
| **Phase 4C** | **访问鉴权 + 速率限制 + 每日额度保护** | ✅ 完成 |
| **Phase 4D** | **任务历史管理后台（统计/筛选/详情/取消/删除/重试）** | ✅ 完成 |
| Phase 4E | 域名 HTTPS 正式实装 + 备案方案 | ✅ PASS |
| Phase 4E-A | HTTPS 域名预检与方案准备 | ✅ 完成 |
| Phase 4E-B | Caddy HTTPS 实际安装部署 | ✅ 完成 |
| Phase 4E-C | HTTPS 部署收口 | ✅ 完成 |
| Phase 4E-D | ICP 备案拦截文档 | ✅ 完成 |
| Phase 4E-E | Cloudflare Tunnel 临时预览 | ✅ 完成 |
| **Phase 5A** | **BYOK API Key 模式（用户自携 Key，无登录）** | ✅ 完成 |
| **Phase 5B-A** | **BYOK 真实测试预检（不调用真实 API）** | ✅ 完成 |
| **Phase 5B-C** | **Real API Attempt Guard（调用前计数，超限拦截）** | ✅ 完成 |
| **Phase CLI-Debug-A** | **MMX CLI 主链路体检与稳定化（diagnostics + smoke test）** | ✅ PASS |
| Phase 5B-B | BYOK 受控真实 API 测试（需用户确认） | 📋 规划 |
| Phase 5C | 小程序 BYOK 策略 | 📋 规划 |
| Phase 6 | 正式 Release v0.4.0-alpha | 📋 规划 |

---

## 安全原则

### 默认安全模式

默认 `REAL_GENERATION_ENABLED=false`，即使配置了 `MINIMAX_API_KEY` 也不会调用真实 MiniMax API，而是使用本地 Mock 生成。所有 smoke test 均在此模式下运行，**不消耗额度**。

### 真实生成模式

需要显式开启（⚠️ 会消耗 MiniMax Token Plan 额度）：

```bash
REAL_GENERATION_ENABLED=true
MINIMAX_BACKEND=cli   # 推荐：使用 mmx CLI（需先 mmx auth login）
# 或
MINIMAX_BACKEND=api   # 实验性：直接调用 MiniMax API
MINIMAX_API_KEY=***
```

### 安全预览模式（Safe Preview Mode）

安全预览模式不依赖单一 `demoMode` 字段，而是由以下三个条件共同保证：

| 条件 | 说明 |
|------|------|
| `REAL_GENERATION_ENABLED=false` | 禁止调用 MiniMax |
| `MINIMAX_BACKEND=mock` | 使用本地模拟后端 |
| `MOCK_GENERATION_ENABLED=true` | 本地模拟生成可用 |

只要这三个条件同时满足，无论 `PUBLIC_DEMO_MODE` 是什么值，都是安全预览模式：

```bash
# 安全预览模式（默认）
REAL_GENERATION_ENABLED=false
MINIMAX_BACKEND=mock
MOCK_GENERATION_ENABLED=true
PUBLIC_DEMO_MODE=true # 可选，仅作为额外保护层

# 安全预览模式（不设置 PUBLIC_DEMO_MODE 也安全）
REAL_GENERATION_ENABLED=false
MINIMAX_BACKEND=mock
MOCK_GENERATION_ENABLED=true
# PUBLIC_DEMO_MODE 未设置
```

CLI Adapter 推荐原因：不通过 HTTP 直连 MiniMax，由 mmx CLI 管理认证和请求。

### CLI Backend 运维命令

```bash
# 运行时诊断（检查 health、mmx、storage，不生成音乐）
bash scripts/cli-backend-diagnostics.sh

# 静态 smoke test（检查代码完整性，不调 API）
bash scripts/cli-backend-readiness-smoke-test.sh

# 快速健康检查（轻量）
curl -s http://127.0.0.1:8787/api/health | python3 -m json.tool
```

### systemd Service

项目已将 Web Server 注册为 systemd 服务，支持崩溃自动重启和开机自启。

**安装（首次）：**
```bash
sudo bash scripts/install-systemd-service.sh
```

**常用运维命令：**
```bash
sudo systemctl status mmx-music-studio          # 查看状态
sudo systemctl restart mmx-music-studio          # 重启服务
sudo systemctl stop mmx-music-studio            # 停止服务
journalctl -u mmx-music-studio -f               # 实时日志
journalctl -u mmx-music-studio -n 50            # 最近 50 条日志
```

**配置：**
- Service name: `mmx-music-studio`
- 绑定地址: `127.0.0.1:8787`（Cloudflare Tunnel 转发至此）
- Backend: `cli`（MMX CLI 主链路）
- 每日生成上限: 50 次（`DAILY_GENERATION_LIMIT=50`）
- 崩溃后自动重启: `Restart=always`
- Unit 文件: `deploy/systemd/mmx-music-studio.service`

**注意事项：**
- 不在项目中存储任何 API key 或 Cloudflare token
- mmx CLI 认证凭据在 `~/.mmx/config.json`（服务器本地）

### 访问保护（Preview Access Gate）

公网部署时推荐开启 PIN 访问保护：

```bash
PREVIEW_ACCESS_ENABLED=true
PREVIEW_ACCESS_PIN=<your_preview_pin>
```

| 环境变量 | 说明 |
|----------|------|
| `PREVIEW_ACCESS_ENABLED` | `true` 开启 PIN 保护 |
| `PREVIEW_ACCESS_PIN` | 访问码（由部署者设置） |
| `PREVIEW_ACCESS_SECRET` | 可选，自定义 cookie 签名密钥 |

特点：
- PIN 只从环境变量读取，不写入代码/git
- 验证成功后设置 HttpOnly cookie（24小时有效）
- API `/api/tracks`、`/api/generate` 等在未解锁时返回 401
- `/api/health` 公开可访问，不泄露敏感信息
- 这是安全预览保护，不是多用户鉴权

详见 [docs/SECURITY.md](docs/SECURITY.md)

---

## 开源协议

MIT License — 可自由使用、修改、分发，包括商业用途，但需保留原作者署名和版权声明。

---

**Unofficial open-source project. Not affiliated with MiniMax.**