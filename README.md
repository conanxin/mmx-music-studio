# MiniMax 音乐创作台 / mmx-music-studio

[![GitHub Repo](https://img.shields.io/badge/GitHub-mmx--music--studio-blue?logo=github)](https://github.com/conanxin/mmx-music-studio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Phase](https://img.shields.io/badge/Phase-v0.5.0--public--lite--byok-red.svg)](https://github.com/conanxin/mmx-music-studio/releases/tag/v0.5.0-public-lite-byok)
[![CI](https://github.com/conanxin/mmx-music-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/conanxin/mmx-music-studio/actions/workflows/ci.yml)

**开源、自托管、BYOK 的 MiniMax 音乐生成网站**

> ⚠️ **免责声明**：这是一个非官方的开源项目，与 MiniMax 无任何关联。

---

## Current Status: Public-Lite BYOK queued generation

Public-Lite BYOK queued generation is available for small-scale alpha use, and the production site now includes a Demo Ready Pack for first-time users.

- Current release: v0.5.0-public-lite-byok — Public-Lite BYOK demo release ([release note](docs/launch/V0_5_0_PUBLIC_LITE_BYOK_RELEASE.md)).
- Current version posture: 5 人内轻量公开 BYOK 排队生成版.
- Current stage: alpha, not a broad public launch.
- Access model: lightweight public mode for up to 5 active users.
- Generation model: users provide their own MiniMax API Key.
- Key handling: API Keys are temporarily kept in server memory during the queued job, then deleted after completion, failure, cancellation, or TTL expiry. They are not written to disk, browser storage, the Library, manifest, logs, or Git.
- Queue behavior: generation tasks run through a single-worker queue, one generation at a time.
- Usage: open Studio, pick a template or write a music prompt, enter your own MiniMax API Key, complete Turnstile when required, then submit and wait in the queue.
- Cost model: MiniMax generation costs are charged to the user's own MiniMax API Key/account; server hosting costs are covered by the site maintainer.
- Scope: no public sign-up, no account system, no admin dashboard, and no 5-way concurrent MiniMax generation.

The Studio page now presents this as a single BYOK music creation flow instead of an engineering test panel. It includes a three-step guide, five one-click prompt templates, and clearer player/Library actions after generation.

---

## Current Demo

- Online site: https://music.conanxin.com/
- Studio: https://music.conanxin.com/studio
- Release note: [docs/launch/V0_5_0_PUBLIC_LITE_BYOK_RELEASE.md](docs/launch/V0_5_0_PUBLIC_LITE_BYOK_RELEASE.md)
- Share copy: [docs/launch/SHARE_COPY_PUBLIC_LITE_BYOK.md](docs/launch/SHARE_COPY_PUBLIC_LITE_BYOK.md)
- Feedback checklist: [docs/launch/FEEDBACK_CHECKLIST_PUBLIC_LITE_BYOK.md](docs/launch/FEEDBACK_CHECKLIST_PUBLIC_LITE_BYOK.md)

This demo is for small-circle feedback. Users provide their own MiniMax API Key; MiniMax usage costs are paid by that user account, while server hosting is maintained by the site owner.

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

Windows / Codex Desktop fallback:

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev
```

Use `http://localhost:5174` for the Vite dev UI, or `http://localhost:8787` for the API/server-hosted build path after `npm run build`.

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

**Current release**: v0.4.33-alpha — Public-Lite Studio productization

| Phase Deploy-CF-D: Turnstile gate added for `/api/generate/byok` (server-side Siteverify, default non-blocking). |
| Phase Deploy-CF-E: Front-end Turnstile widget runtime integration. `turnstileSiteKey` exposed by `/api/health`; secret never returned. Token not persisted, not logged, not displayed. |
| Phase H1-Hotfix-A: subset-reducer silent-drop in Studio setHealthInfo fixed (4-place field wiring sync, smoke #25-28). |
| Phase H1-Hotfix-C: redacted Turnstile Siteverify diagnostics added (env-gated, no token / secret / apiKey log). |
| Phase H1-Hotfix-D: client-side `action: 'byok-generate'` metadata added (widget → Cloudflare → server contract). |
| Phase H1-Hotfix-E: real Turnstile credentials for dry-run E2E (real secret never in chat; mode 600 drop-in; lex-sort order audit). |
| Phase H1 closeout: `PUBLIC_BYOK_ENABLED=false` restored; `turnstile-debug.conf` removed; real site/secret kept. |
| Phase BYOK-H2A: dry-run pilot plan (plan doc only, no runtime change). |
| Phase BYOK-H2B: success-path `[byok-turnstile-ok]` redacted logging for dry-run pilot observability. |
| Phase BYOK-H2C: real dry-run pilot executed — **H2C_DRY_RUN_PILOT_PASS_ROLLED_BACK**. 4/4 testers PASS, 4 success-path logs, 0 failure during pilot, 0 leak, 0 live call, 0 music; production rolled back to safe default. Evidence: [`docs/launch/BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md`](docs/launch/BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md). |
| Phase BYOK-H2D: dry-run UX/copy polish (no env change, no live, no music). |
| Phase BYOK-H3A: controlled live pilot planning (no env change, no live, no music, no public launch). H3B execution is a separate phase requiring explicit operator approval. |
| Phase BYOK-H3B-PREFLIGHT: controlled live pilot pre-flight runbook (no env change, no live, no music, no public launch). H3B execution is still NOT authorised; approval phrase `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` required. See [`docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md`](docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md). |
| Phase BYOK-H3B-DRILL: dry-run rollback drill recorded (safe-default rewrite only; no live, no music, no public launch; `/api/generate/byok` returns `byok_generation_disabled`; `/ops` and `/api/status` still Cloudflare Access protected). Evidence: [`docs/launch/H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md`](docs/launch/H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md). H3B execution still requires `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`. |
| Phase BYOK-H3B-GONO: Go/No-Go review (no env change, no live, no music, no public launch). Decision: **NO-GO for H3B live execution** because explicit operator approval phrase `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` has not been received. Tester cohort and pilot window are not finalized. H3B execution instructions are not yet authorized to be written. Review: [`docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_20260613.md`](docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_20260613.md). |
| Phase BYOK-H3B-COHORT: tester cohort + pilot window planning (no env change, no live, no music, no public launch). Anonymous slots T1-T5 (3 required, 2 optional), all currently `pending_consent`. Pilot window: `not scheduled`. Tester consent checklist + tester-facing message draft recorded. No PII committed to repo. Decision remains **NO-GO for H3B live execution** until tester cohort + pilot window + approval phrase are all satisfied. Plan: [`docs/launch/BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md`](docs/launch/BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md). |
| Phase BYOK-H3B-CODE-FOLLOWUP: live gate hardening (centralised phrase + server-side one-shot guard, 5+1 new health fields). No env change, no live, no music, no public launch. [code-followup evidence: `docs/launch/BYOK_H3B_CODE_FOLLOWUP_20260613.md`]. |
| Phase BYOK-H3B-LIVE-T1-MICROPILOT: first controlled live attempt (window locked, gate verified, T1 only, rolled back). [evidence: `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_20260613.md`] |
| Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-2: second controlled live attempt (T1 reported single submit, server-side observed only `byok_fake_relay_ok`/fake path, no live provider call, unconditional rollback). [evidence: `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY2_20260613.md`] |
| Phase BYOK-H3B-OBSERVABILITY-FOLLOWUP: redacted submit-received telemetry + 9 new health counters (boolean/enum/requestId/ISO only). Closes the `byok_fake_relay_ok` observability gap. No env change, no live, no music, no public launch. [smoke: `scripts/byok-h3b-observability-followup-smoke-test.sh`] |
-- `/api/generate/byok` live/direct path now supports Turnstile verification.
- `TURNSTILE_BYOK_REQUIRED=true` (post-H1 closeout — production-safe default; was `false` pre-H1).
- This is **not** a broad public BYOK launch.
- Default mode remains disabled / dry-run.
- Broad public BYOK launch requires Turnstile configured + operator verification + valid-token E2E PASS on production.
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
- **Phase Release v0.4.25-alpha** — Storage-B0 operator cleanup dry-run and safety design release: read-only storage cleanup dry-run (`storage-b-operator-cleanup-dry-run.sh`, optional `--retention-days` / `--json`, `destructive: false` footer), confirmation guard (`storage-b-confirmation-guard.sh` requires `STORAGE_B_CONFIRMATION=CONFIRM_STORAGE_B_CLEANUP` env var, case-sensitive, never deletes by itself), design doc (`docs/storage/STORAGE_B_OPERATOR_CLEANUP_DESIGN.md` — candidate categories, never-delete list, required report, rollback note), `storage-b-smoke-test.sh` 59/59 PASS (file presence / executable / static safety / runtime behavior / design doc content / documentation records), Product Polish-N handoff doc drift fixed (smoke 55/55 PASS restored), no `/api/generate` calls, no server schema change, no cleanup executed, current inventory reports 0 candidates, 0 reclaimable bytes
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
| Operator-Confirmed Cleanup (Dry-Run) | ✅ Phase Storage-B0 | `storage-b-operator-cleanup-dry-run.sh` (read-only), `storage-b-confirmation-guard.sh` (rejects without `STORAGE_B_CONFIRMATION=CONFIRM_STORAGE_B_CLEANUP`), `docs/storage/STORAGE_B_OPERATOR_CLEANUP_DESIGN.md`; **B0 does NOT delete any file** — confirmation-gated B1 will be a separate phase |

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

## Latest Release: v0.4.33-alpha

- **Public-Lite Studio productization**: PASS
- **BYOK queued generation product flow**: PASS
- **Vite dev `/api/*` proxy smoke**: PASS
- **Windows / Codex Desktop `npm run dev:full` startup**: PASS
- **Production observation**: stable for 24 hours
- **Broad public launch**: not enabled

完整 release notes 见 [`docs/release/RELEASE_NOTES_v0.4.33-alpha.md`](docs/release/RELEASE_NOTES_v0.4.33-alpha.md).

**关键口径**:

> v0.4.33-alpha 发布 Public-Lite Studio 产品化收口；仍是 alpha，不是 broad public launch，用户使用自己的 MiniMax API Key。

## Phase BYOK-H2A: Dry-Run Pilot Planning (current focus)

> **Status: PLANNING ONLY. Production env unchanged. Live gate stays closed. No broad public launch.**

| Field | Value |
|---|---|
| **Phase** | BYOK-H2A |
| **Type** | Planning only (no pilot execution in this commit) |
| **Env change in this phase** | None. `PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false` |
| **Real MiniMax call** | None |
| **Music generated** | None |
| **Real user apiKey** | None |
| **Broad public BYOK launch** | Not enabled |
| **H1 valid-token browser E2E** | PASS (predecessor phase) |
| **Plan doc** | [docs/launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md](docs/launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md) |
| **Smoke test** | `bash scripts/byok-h2-dry-run-pilot-planning-smoke-test.sh` (25/25 PASS) |

What H2A delivers:

- A complete **dry-run pilot plan** (3–5 trusted testers, Chinese instructions, feedback template, monitoring checklist, rollback plan, Go/No-Go gates for H3).
- A **smoke test** that asserts the plan is structurally correct and does not claim BYOK is now live.
- **No production env change.**
- **No code change.** This commit adds docs + smoke only.
- **No release tag.** The v0.4.31-alpha tag stays at `ee6a8a1`.

What H2A does **not** deliver:

- Pilot execution (that's H2C, separate phase, requires operator approval).
- Live call (that's H3, separate phase, requires operator approval + cost ceiling + circuit breaker).
- A new release tag.

Recommended H2 improvement (for H2B, separate commit):

- Add a symmetric success-path redacted log line `[byok-turnstile-ok]` in `server/index.ts` so the operator can grep for the dry-run success path in the journal. Without H2B, H2C must rely on UI evidence + server response for the success signal.

Final wording:

> "BYOK-H2A prepares the dry-run pilot plan for BYOK. It does not enable BYOK live generation or broad public launch."

## Phase BYOK-H2B: Success-Path Redacted Turnstile Log (current focus)

> **Status: OBSERVABILITY HOTFIX. Production env unchanged. Live gate stays closed. No broad public launch.**

| Field | Value |
|---|---|
| **Phase** | BYOK-H2B |
| **Type** | Observability hotfix (success-path log only) |
| **Env change in this phase** | None. `PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false` |
| **Real MiniMax call** | None |
| **Music generated** | None |
| **Real user apiKey** | None |
| **Broad public BYOK launch** | Not enabled |
| **H2A dry-run pilot planning** | PASS_WITH_KNOWN_VALIDATION_EXCEPTION (predecessor) |
| **Smoke test** | `bash scripts/byok-h2b-success-log-smoke-test.sh` (18/18 PASS) |

What H2B delivers:

- A symmetric **success-path redacted log** `[byok-turnstile-ok]` in `server/index.ts`, mirroring the failure-path `[byok-turnstile-debug]`.
- Both logs are gated by the same `TURNSTILE_DEBUG_REDACTED=true` runtime flag, and only fire when `verifyTurnstileToken()` populates the `redacted` block.
- **No production env change.** **No release tag.** The v0.4.31-alpha tag stays at `ee6a8a1`.
- H2C dry-run pilot can now confirm Turnstile success in the journal without relying on UI screenshots.

What H2B does **not** deliver:

- BYOK live generation (still disabled).
- Pilot execution (H2C, requires operator approval).
- A new release tag.

Success-path log fields (all redacted):

- `requestId` (e.g. `byok_421450bf6804`)
- `tokenLength` (numeric, e.g. `417`)
- `tokenSha256_8` (8-char hex fingerprint of the token)
- `cloudflareSuccess` (`true` for this path)
- `cloudflareErrorCodes` (empty list for this path)
- `hostname`, `action`, `cdata` (from Cloudflare Siteverify response)
- `outcome=turnstile_ok`

Forbid­den fields (must NEVER appear):

- Raw token
- `TURNSTILE_SECRET_KEY`
- User apiKey
- Authorization header
- Full request body (lyrics / prompt)
- Provider raw response

Recommended pilot flow (for H2C):

1. Set `TURNSTILE_DEBUG_REDACTED=true` in the temporary `byok-test.conf` drop-in (operator runs `read -s` to read the value, no chat exposure).
2. Restart service.
3. Pilot testers complete Turnstile + submit fake key. Operator greps the journal: `journalctl -u mmx-music-studio --since "1 hour ago" | grep -E "byok-turnstile-(ok|debug)"`.
4. After pilot ends, set `TURNSTILE_DEBUG_REDACTED=""` (empty) to silence logs.
5. Restore `PUBLIC_BYOK_ENABLED=false` and `BYOK_DRY_RUN_ONLY=true` (the closeout contract from H1).

Final wording:

> "BYOK-H2B adds success-path redacted Turnstile logging for dry-run pilot observability. It does not enable BYOK live generation or broad public launch."

## Release

**v0.4.23-alpha**：Phase Release v0.4.23-alpha — Library UX polish and timeline clarity release (commit `bde4cff` + release prep, tag `v0.4.23-alpha`)

**v0.4.22-alpha**：Phase Release v0.4.22-alpha — Annotation timeline and batch notes release (commit `f3ab915` + release prep, tag `v0.4.22-alpha`)

**Phase Product Polish-O**：Library final polish, timeline refinements, and UX consistency (commit pending — Current view summary, Clear all filters, Better empty states, Batch toolbar grouping, Drawer hierarchy polish, Timeline readability polish, Local-only export / backup clarification, Mobile polish 639/390)

### Current Status (v0.4.25-alpha)

- Storage-B0 dry-run: PASS
- Confirmation guard: PASS
- destructive=false: PASS
- Storage candidates: 0
- Product Polish-N smoke restored: PASS
- Storage-B smoke: PASS
- Product Polish-P smoke: PASS
- Cloudflare Access for Ops: PASS
- Public URL: https://music.conanxin.com
- Recommended backend: CLI

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

## Phase BYOK-B: Controlled BYOK relay test (in progress)

> **BYOK-B 已完成受控 fake/live relay 测试结构,但真实 MiniMax live call 仍未执行。**

BYOK-B builds on BYOK-A by adding a `fake / live` switch under three
gating env flags and a dedicated provider adapter. The endpoint
`POST /api/generate/byok` now responds to a richer mode matrix:

| Mode | Response | Provider call |
| --- | --- | --- |
| disabled (`PUBLIC_BYOK_ENABLED=false`) | `403 byok_generation_disabled` | none |
| dry-run (`BYOK_DRY_RUN_ONLY=true`) | `200 byok_dry_run_only` | none |
| fake relay | `200 byok_fake_relay_ok` | none (deterministic) |
| live not enabled | `403 byok_live_not_enabled` | none |
| live confirmation missing | `403 byok_live_confirmation_required` | none |
| live enabled (all 3 keys) | `200 byok_live_relay_ok` | mmx spawn with user key |
| provider error | `502 byok_provider_error*` (redacted) | mmx spawn attempt, redacted |

Live mode requires **all three** env flags to be set at config load:

- `PUBLIC_BYOK_ENABLED=true`
- `BYOK_LIVE_ENABLED=true`
- `BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST`

The confirmation phrase is the public constant
`CONFIRM_BYOK_LIVE_RELAY_TEST`. It is **not** a secret. Its purpose is
to force the operator to opt-in at process start, not to authenticate
the user.

In live mode the user-supplied `apiKey` is injected into the child
`mmx` process environment as `MINIMAX_API_KEY=<userKey>`. The site
operator's `MINIMAX_API_KEY` is explicitly stripped from the child env
in `server/adapters/minimax-api/byok.ts`. Provider stdout, stderr, and
error messages are run through `redactCliOutput` before being surfaced
to the route layer.

UI status codes handled by `ByokPanel.tsx`:

- `byok_dry_run_only` -- "BYOK 安全链路已就绪，但当前仍为 dry-run"
- `byok_fake_relay_ok` -- "BYOK relay 测试通过（fake 模式）"
- `byok_live_relay_ok` -- "BYOK relay 测试通过（live 模式）"
- `byok_live_not_enabled` -- "真实 BYOK 生成尚未启用"
- `byok_live_confirmation_required` -- "真实 BYOK 生成需要显式确认"
- `byok_provider_error*` -- "MiniMax 返回错误，已隐藏敏感信息"

The password input is cleared from component state immediately after
submit, and is never written to `localStorage` / `sessionStorage` /
`IndexedDB` / URL query.

### What BYOK-B does **not** do

- It does **not** call the real MiniMax provider automatically. The
  default behavior of the endpoint is `byok_dry_run_only`.
- It does **not** launch a public live BYOK generation flow. There is
  no automatic "user enters Key, gets music" path. A real live call
  requires an operator to set the three env flags above.
- It does **not** replace Phase 5A's admin BYOK path. It only adds a
  separate public route at `/api/generate/byok` that does not touch
  the existing `/api/generate` handler.

### Final wording (do not weaken)

- Do not claim "user can paste a Key and generate for real today".
- Do not claim "BYOK public launch is open".
- Do not claim "a live MiniMax call has been verified".
- The strongest correct claim is: **"BYOK-B 已完成受控 fake/live relay 测试结构，但真实 MiniMax live call 仍未执行。"**

### Phase BYOK-C: Single Live Call Verification Protocol

- **Status**: `PROTOCOL_READY_NO_LIVE_CALL` (this run)
- **Operator confirmation**: not provided in this run
- **Live call executed**: **no**
- **Music generated**: **no**
- **User key used**: **no**
- **Site operator key used**: **no**
- **broad public BYOK launch**: **no**
- 详细报告见 [`docs/security/BYOK_SINGLE_LIVE_CALL_TEST_REPORT.md`](docs/security/BYOK_SINGLE_LIVE_CALL_TEST_REPORT.md)
- 协议验证通过 `scripts/byok-c-smoke-test.sh` (35 assertions, smoke 不触发 live call)

**关键口径**: BYOK-C 已完成单次 live call 的可审计协议与 smoke test,但本轮未提供 operator confirmation,因此未执行真实 MiniMax live call。下一次 operator 给出 `CONFIRM_BYOK_C_SINGLE_LIVE_CALL` 短语后,才能执行真实 live call。

A true broad public BYOK launch should consider `Phase Deploy-CF-D`
Turnstile / abuse control before enabling `BYOK_LIVE_ENABLED=true` for
the public route.

Design documents:
[`docs/security/BYOK_PUBLIC_GENERATION_DESIGN.md`](docs/security/BYOK_PUBLIC_GENERATION_DESIGN.md),
[`docs/security/BYOK_LIVE_RELAY_TEST_DESIGN.md`](docs/security/BYOK_LIVE_RELAY_TEST_DESIGN.md).



---

## 三种运行模式

| 模式 | 真实生成 | 额度消耗 | 用途 |
|------|----------|----------|------|
| [Demo Preview（安全预览）](docs/RUNTIME_MODES.md#1-demo-preview安全预览模式) | ❌ | ❌ | 公开演示，给别人看 UI |
| [Private Real（私有真实生成）](docs/RUNTIME_MODES.md#2-private-real私有真实生成) | ✅ | ✅ | 个人自用，需 mmx auth login |
| [Production Locked（生产锁定）](docs/RUNTIME_MODES.md#3-production-locked生产锁定模式) | ❌ | ❌ | 公网发布前，需访问保护 |

> ⚠️ 真实生成会消耗 MiniMax Token Plan 额度。公网部署前请确保已开启访问保护。

详见 [docs/RUNTIME_MODES.md](docs/RUNTIME_MODES.md)。

### Phase BYOK-C-Hotfix: Disable unsafe CLI live path

- **Status**: **LIVE PATH DISABLED**
- **What**: BYOK live preflight 尝试中发现关键安全 bug — mmx CLI 忽略 `MINIMAX_API_KEY` env var，fallback 到 `~/.mmx/config.json` 使用站点运营者 key。placeholder key 测试时意外生成了真实 MP3（已删除）。
- **Action taken**:
  - BYOK live path 已 fail-closed（返回 `byok_live_provider_path_disabled`）
  - 删除 `runMmxChild` / `spawn` import / env injection 代码
  - BYOK-C report 和 BYOK-B design doc 已记录 bug 和根因
  - 未使用真实 user key，未泄露 operator key
- **Current availability**:
  - ✅ fake mode: 可用（确定性测试路径）
  - ✅ dry-run mode: 可用（安全默认）
  - ❌ live mode: **不可用**，直到 BYOK-C2（direct HTTPS API relay）完成
- **Do NOT claim**: BYOK live 生成已可用 / 用户填 Key 就能真实生成 / 已 broad public launch
- **Next**: BYOK-C2 direct HTTPS API relay design（per-request `Authorization` header，无 CLI spawn）

### Phase BYOK-E: Official API Schema Validation

- **Status**: **VERIFIED**
- **What**: Verified official MiniMax music generation API schema from mmx-cli v1.0.16 source code
- **Verified**:
  - Endpoint: `POST https://api.minimaxi.com/v1/music_generation`
  - Auth: `Authorization: Bearer <api_key>`
  - Models: `music-2.6`, `music-2.5+`, `music-2.5`, `music-cover`
  - Request/response/error schema fully documented
- **Decision**: **BYOK-F is UNBLOCKED** — all required fields verified from official source
- **Next**: BYOK-F Direct API Implementation

### Phase BYOK-D: Direct HTTPS API Relay Design (v0.4.28-alpha)

- **Status**: **DESIGN ONLY** (no live calls)
- **What**: 设计 direct HTTPS provider call 架构，替代 CLI live path
- **BYOK live**: DISABLED（design only，不执行真实调用）
- **BYOK fake/dry-run**: 仍可用
- **Design doc**: `docs/security/BYOK_DIRECT_API_RELAY_DESIGN.md`
- **Adapter skeleton**: `server/adapters/minimax-api/byok-direct.ts`
- **Key principles**:
  - 不使用 CLI spawn
  - 不使用 `MINIMAX_API_KEY` env injection
  - 不使用 `--api-key` flag（会暴露 key 到 process argv）
  - 未来使用 per-request `Authorization` header
  - user key 永不存储、永不记录、永不返回
  - provider error 全部 redact
- **Blocked until**: 官方 MiniMax music generation API endpoint/schema 验证完成
- **Release**: v0.4.28-alpha
- **Next**: BYOK-E Official API Schema Validation → Deploy-CF-D Turnstile

### Phase BYOK-F: Direct HTTPS API Relay Implementation

- **Status**: **IMPLEMENTED**
- **What**: 实现 gated direct HTTPS API relay path
- **BYOK live**: DISABLED by default（需要显式 env gate + operator confirmation）
- **BYOK fake/dry-run**: 仍可用
- **Adapter**: `server/adapters/minimax-api/byok-direct.ts`
- **Endpoint gates**:
  - `BYOK_DIRECT_LIVE_ENABLED=true`
  - `BYOK_DIRECT_LIVE_CONFIRMATION=CONFIRM_BYOK_DIRECT_LIVE_TEST`
- **Key principles**:
  - 不使用 CLI spawn
  - 不使用 `MINIMAX_API_KEY` env injection
  - 不使用 `--api-key` flag
  - 使用 per-request `Authorization: Bearer` header
  - user key 永不存储、永不记录、永不返回
  - provider error 全部 redact
- **Release**: v0.4.28-alpha (design) → BYOK-F commit
- **Next**: BYOK-G Single Direct Live Call Verification

### Phase BYOK-G: Single Direct Live Call Verification

- **Status**: **LIVE CALL SUCCESS**
- **What**: 执行一次 operator-approved direct HTTPS BYOK live call
- **Live call**: **已执行**（1 次，使用 user-provided MiniMax API Key）
- **Result**: **SUCCESS** — provider returned base64 audio, HTTP 200, status_code 0
- **Music generated**: **yes**（~2.8MB, ~92s, stereo, 44.1kHz, 256kbps MP3）
- **Key persistence**: **no**
- **Raw response in repo**: **no**（仅 redacted summary）
- **CLI used**: **no**
- **Site operator key used**: **no**
- **Report**: `docs/security/BYOK_DIRECT_SINGLE_LIVE_CALL_REPORT.md`
- **Safety**: Live env 已恢复默认（disabled / dry-run）
- **Next**: Release v0.4.31-alpha — Turnstile widget runtime for BYOK

**v0.4.31-alpha**：Phase Release v0.4.31-alpha — Turnstile widget runtime for BYOK release (commit `89e5f9c` + release prep, tag `v0.4.31-alpha`)

- Deploy-CF-E adds frontend Cloudflare Turnstile widget runtime integration for BYOK.
- It does not enable broad public BYOK launch by itself.
- `ByokPanel.tsx` dynamically loads `https://challenges.cloudflare.com/turnstile/v0/api.js` and renders a per-instance widget via `window.turnstile.render(...)`.
- `callback` / `expired-callback` / `error-callback` lifecycles drive `turnstileToken` state.
- `turnstileToken` is sent with `POST /api/generate/byok` only when the panel is enabled and a fresh token is present.
- Widget is reset and token cleared after submit to enforce single-use.
- `Studio.tsx` passes `turnstileSiteKey` / `turnstileByokRequired` / `turnstileSecretKeyConfigured` from `healthInfo` into `<ByokPanel />`.
- `/api/health` exposes the public `turnstileSiteKey` (booleans from v0.4.30-alpha remain). The `TURNSTILE_SECRET_KEY` is **never** returned.
- Server-side `Siteverify` gate from Deploy-CF-D is unchanged and remains the source of truth.
- Token is never written to `localStorage` / `sessionStorage` / IndexedDB / URL query, and is never displayed in the DOM or `console.log`'d.
- Front-end does not import or reference `TURNSTILE_SECRET_KEY`.
- `TURNSTILE_BYOK_REQUIRED=false` by default.
- New smoke test: `scripts/deploy-cf-e-turnstile-widget-smoke-test.sh` — **23/23 PASS**.
- No new live call was executed.
- No music was generated.
- No Turnstile secret, key, env, runtime storage, logs, audio, or tsconfig was committed.
- valid-token E2E verification is **deferred** until v0.4.31-alpha is deployed to production with real Turnstile site/secret keys configured outside the repository.
- BYOK-H small public launch planning is **blocked** until valid-token E2E verification passes on production.

**v0.4.30-alpha**：Phase Release v0.4.30-alpha — Turnstile gate for BYOK release (commit `b3d1095` + release prep, tag `v0.4.30-alpha`)

- Deploy-CF-D adds a server-side Turnstile gate for BYOK generation.
- It does not enable broad public BYOK launch by itself.
- `/api/generate/byok` live/direct path now supports Turnstile verification.
- `TURNSTILE_BYOK_REQUIRED=false` by default.
- No new live call was executed.
- No music was generated.
- No Turnstile secret, key, env, runtime storage, logs, audio, or tsconfig was committed.
- Next step is configuring real Turnstile site/secret keys outside the repo and verifying them before BYOK-H public launch.

**v0.4.29-alpha**：Phase Release v0.4.29-alpha — BYOK direct live verification release (commit `7d45e12` + release prep, tag `v0.4.29-alpha`)

- BYOK-G completed one operator-approved direct HTTPS live call successfully.
- Confirmed the direct relay path can call `POST https://api.minimaxi.com/v1/music_generation`.
- Confirmed provider success response (HTTP 200, status_code 0, data.audio base64).
- Confirmed no CLI usage, no site operator key usage, user key not persisted, no raw provider response recorded.
- Defaults restored to disabled / dry-run.
- Added BYOK-G smoke coverage (21/21 PASS).

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

BYOK-H3B-WINDOW-LOCK — Tester cohort and pilot window locked

- Window-lock evidence: `docs/launch/BYOK_H3B_WINDOW_LOCK_20260613.md`
- Approval phrase: RECEIVED
- Tester cohort: T1–T5 CONFIRMED anonymous slots only, no PII in repo
- Pilot window: 2026-06-13T04:45:04+08:00 → 2026-06-13T05:15:04+08:00 (Asia/Shanghai)
- Decision: GO for authoring separate H3B execution instructions, but NOT live execution from this document alone.

BYOK-H3B-EXEC-INSTRUCTIONS — H3B execution instructions recorded

- Instructions: `docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md`
- This is the execution instructions document; **it does not itself execute BYOK live generation**.
- Final pre-flight checks: current time within window, production safe default, Turnstile configured, Access protection, rollback drill evidence, window-lock evidence, T1–T5 confirmed, operator online, boundary compliance, pre-stage banned-pattern audit.
- Live-enabling plan, one-tester-at-a-time sequence (T1, T2, T3, T4 optional, T5 optional), monitoring checklist, circuit breaker, rollback after pilot, and stop conditions are all recorded.
- No tester PII. No key persistence. No broad public launch.
- Operator may proceed to H3B live execution **only after** re-confirming the window is still valid and re-running the pre-flight checks.

### BYOK-H3B-OBSERVABILITY-FOLLOWUP-HOTFIX (2026-06-13)

Fixes an uncaught TypeError (`Cannot read properties of undefined
(reading 'length')`) discovered during a safe-default production probe:

- Three safe helpers added in `server/index.ts`:
  `safeString` / `safeStringLength` / `safeHeaderString`.
- Header probe rewritten as
  `safeHeaderString(req.headers['x-turnstile-token']).length > 0`.
- Body `apiKey` probe rewritten as `safeStringLength(body.apiKey) > 0`.
- `SUBMIT_OBSERVABILITY_EMPTY` initial state no longer carries
  `stage='received' / outcome='allowed'` — empty strings prevent
  misleading `/api/health` output before any real submit.
- New enum value `ByokSubmitStage = 'unhandled_error'` reserved for
  future top-level catch paths.

Re-verified under safe default: `byok_generation_disabled` returned,
`byokSubmitsReceived` 0 → 2, `byokLastSubmitStage=killswitch_off`,
no uncaught TypeError, no MiniMax call, no music, no secret leak.
BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-3 — single-T1 controlled submit + unconditional rollback

* Evidence: docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY3_20260613.md
* Smoke: scripts/byok-h3b-live-t1-micropilot-retry3-smoke-test.sh (38/38 PASS)
* Window: 2026-06-13 07:39:45 → 08:39:45 (Asia/Shanghai)
* WINDOW_ID: h3b-20260613-t1-retry3-073945
* Hardened live gate ON; one-shot guard = 1 attempt / window; submit observability ON
* T1 submitted twice (counter 0→4); both reached server, both `modeCandidate=live`,
  both blocked at `audio_quota_rejected` (not `byok_live_attempt_limit_reached`)
* No MiniMax call (`byokLiveAttemptsUsed=0`, `realApiAttemptsUsed=0`)
* No music generated (`dailyGenerationUsed=0`, generated audio count = 0)
* T2/T3/T4/T5 not run
* Unconditional rollback to safe default at 07:48:06; post-rollback
  `byok_generation_disabled` confirmed
* Final口径: BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-3 executed at most one
  controlled BYOK live generation for T1 using the hardened live gate,
  one-shot guard, and submit observability, then restored safe default.
  It does not broaden public launch.
BYOK-H3B-AUDIO-QUOTA-FOLLOWUP — gate ordering and live audio cap

* Status: code + docs + 1 new smoke + validation PASS; production still safe default.
* What changed: confirmed BYOK-live requests now skip the public launch
  guard and use a dedicated `BYOK_LIVE_MAX_AUDIO_PER_WINDOW` (default 1)
  audio cap, window-scoped to the same id as the one-shot attempt guard.
* What does NOT change: public/fake/dry-run traffic still hits the launch
  guard exactly as before. No live call, no MiniMax, no music generation.
* New health fields: `byokLiveAudioCapEnabled`, `byokLiveMaxAudioPerWindow`,
  `byokLiveAudioUsed`, `byokLiveAudioRemaining` (booleans/numbers only).
* New observability stages: `audio_quota_bypassed_for_byok_live`,
  `byok_live_audio_cap_reached`, `live_attempt_consumed`.
* Root cause of retry-3: the launch guard fired before the live-attempt
  guard, blocking confirmed live requests with `per_source_daily_limit_exceeded`.
  Follow-up plan: docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY3_20260613.md §11.
* Gate order: see docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md §4c.
* This phase does not execute BYOK live generation or broaden public launch.

BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-4 — one-shot T1 live micropilot (controlled)

* Status: code + docs + 1 new smoke (scripts/byok-h3b-live-t1-micropilot-retry4-smoke-test.sh, 40/40 PASS).
* Commit: pending (this phase).
* Evidence: docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY4_20260613.md.
* Outcome: T1 attempted ONCE (1 unique requestId `byok_8d3713433de8`).
  * `byokSubmitsReceived` 0 → 3 (`received` + `live_attempt_consumed` + `fake_relay_ok`).
  * `byokLiveAttemptsUsed` 0 → 1 (one-shot guard consumed the slot).
  * `byokLiveAudioUsed` 0 → 0 (no real audio produced; audio cap not exceeded).
  * `dailyGenerationUsed` 0 (no quota consumed).
  * `realApiAttemptsUsed` 0 (no MiniMax call).
  * Generated audio count: 0.
  * Final stage: `fake_relay_ok` (adapter demoted the call to fake relay after live gate allowed it; the live gate enforces slot + audio cap, not the actual provider selection).
  * This does NOT execute BYOK live generation. The gate-ordering fix from `da4b16e` is verified end-to-end (live path no longer blocked by public quota), but the actual MiniMax call is not made because the API adapter does not yet route to the live provider under these conditions.
* Rollback: completed (PID 701159 → 705613, env restored to safe default).
  * Post-rollback POST returned `code: "byok_generation_disabled"`.
  * Post-rollback health: `publicByokEnabled=false`, `byokLiveEnabled=false`, `byokLiveConfirmationConfigured=false`, `byokLiveAudioCapEnabled=true`, `byokLiveMaxAudioPerWindow=1`.
  * `byokLiveAudioUsed` and `byokLiveAttemptsUsed` reset to 0 (in-memory by design).
* This phase does NOT call MiniMax, does NOT generate music, does NOT broaden public launch.
* Next phase recommendation: investigate why the live gate allows the call but the API adapter routes to fake relay (separate from gate ordering — this is a provider-selection issue). Until that is fixed, no future pilot will reach MiniMax.
* Final口径: BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-4 executes at most one controlled BYOK live generation for T1 using the hardened live gate, one-shot guard, BYOK-live audio cap, and submit observability, then restores safe default. It does not broaden public launch.

BYOK-H3B-PROVIDER-SELECTION-FOLLOWUP — adapter alignment

* Root cause: retry-4 reached the server, passed the live gate, but the
  adapter's provider selection fell back to `byok_fake_relay_ok` because
  `adapterMode` only switched to `'live'` when `requestedMode === 'live'`,
  missing requests that named `'direct-live'` (or that satisfied the
  gate but were demoted by the route's direct-live early-return).
* Fix: new `isConfirmedByokLiveProviderPath(env, userApiKey)` helper
  checks every gate condition (publicByok, dry-run, liveEnabled,
  liveConfirmation, liveWindowId, directLiveEnabled,
  directLiveConfirmation, user apiKey). The route now uses this
  helper and forwards the env snapshot to `generateByokMusic`.
* `generateByokMusic` adds a confirmed-live branch that delegates to
  the HTTPS direct adapter (`generateByokDirectMusic`) so the live
  call actually reaches MiniMax. Unconfirmed-live path remains
  fail-closed (`byok_live_provider_path_disabled`).
* Fake relay preserved for dry-run / fake / disabled / missing-gate.
* No MiniMax call in this phase. No live pilot executed. No broad
  public launch.
* Smoke: scripts/byok-h3b-provider-selection-followup-smoke-test.sh — 27/27 PASS.

BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-5 — controlled live pilot attempt

* Window: h3b-20260613-t1-retry5-091635
* Direct confirmation: CONFIRM_BYOK_DIRECT_LIVE_TEST (read from code constant)
* Health live gate: all true before submit
* T1 submitted once, one-shot guard consumed slot (byokLiveAttemptsUsed=1)
* Provider result: fake_relay_ok (not live_relay_ok)
* Root cause: client request sent mode='fake' (default), not mode='live' or
  mode='direct-live'. The server correctly honored the client's mode choice.
* No MiniMax call. No audio generated. realApiAttemptsUsed=0.
* Rollback verified. Post-rollback byok_generation_disabled confirmed.
* No secret/key/token/PII/audio/log committed.
* Smoke: scripts/byok-h3b-live-t1-micropilot-retry5-smoke-test.sh — 26/26 PASS.

BYOK-H3B-FRONTEND-MODE-FOLLOWUP — frontend mode fix + server defensive block

* Retry-5 root cause: the BYOK client submit handler (`ByokPanel.tsx`) did
  not send an explicit `mode` field. The body had a comment saying "The
  body never carries the explicit 'mode' — the route always defaults to
  'fake' for safety". When T1 submitted, the server-side live gate was
  fully open but the request still landed on the fake path because the
  client silently defaulted to `mode='fake'`.
* Frontend fix: `HealthInfo` now exposes 4 live gate fields; `Studio.tsx`
  passes them through to `<ByokPanel>`; `ByokPanel` computes
  `isByokLiveReady` (true only when all 5 conditions hold); submit
  handler now sends `mode: isByokLiveReady ? 'direct-live' : 'fake'`.
  Button copy + status badge switch between dry-run and live-ready.
* Server defense: `server/index.ts` adds a guard that runs before the
  adapter call. When `requestedMode === 'fake' && isLiveGateSatisfied`,
  it returns `code: byok_live_mode_required` (HTTP 400) and records
  `stage: live_mode_required`, `outcome: blocked_live_mode_required`
  into submit observability. This is a no-op when the live gate is
  closed, so the safe-default fake relay still runs unchanged.
* This phase does not open live, does not call MiniMax, does not
  generate music, does not broaden public launch. Production env
  remains safe default. Live window remains LOCKED. The
  `byok_live_mode_required` block is server-side gate logic, not a
  client command to "go live".
* Smoke: `scripts/byok-h3b-frontend-mode-followup-smoke-test.sh`
  (39/39 PASS, `BYOK_H3B_FRONTEND_MODE_FOLLOWUP_SMOKE_PASS`).

BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-6 — controlled live pilot attempt after frontend mode fix

* Window: `h3b-20260613-t1-retry6-121526` (Asia/Shanghai, 60 min)
* Deployed commit: `5971185e1354c3de3c32b244f9e1304abe2b86be` (frontend mode fix)
* Bundle: `dist/assets/index-DVNLT3kN.js`
* Direct confirmation: `CONFIRM_BYOK_DIRECT_LIVE_TEST` (read from code constant)
* Stage-level approval: `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`
* Health live gate: all 16/16 checks PASS before submit (`publicByokEnabled`, `byokLiveEnabled`, `byokLiveConfirmationConfigured`, attempt/audio counters, turnstile, realGeneration)
* T1 notification sent (Telegram `message_id: 15648`, `chat_id: 1540208324`)
* T1 did not submit during the 5-7 min monitor window (7 polls, `byokSubmitsReceived=0` throughout)
* Provider result: NO_SERVER_SUBMIT_OBSERVED (T1 did not hit submit)
* `byokLiveAttemptsUsed=0`, `byokLiveAudioUsed=0`, `realApiAttemptsUsed=0` — slot preserved, cap preserved
* No MiniMax call. No audio generated. Live gate expired unused.
* Rollback verified: post-rollback POST returned `code: byok_generation_disabled`; health endpoint shows `publicByokEnabled=false`, `byokLiveEnabled=false`
* No secret/key/token/PII/audio/log/runtime committed. Guard file + tsbuildinfo intentionally NOT staged.
* This phase exercises the FRONTEND-MODE-FOLLOWUP fix at the protocol level (T1 didn't trigger the live submit path; only the server-side `byok_live_mode_required` guard is exercised via code review + existing smokes).
* Evidence: `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY6_20260613.md` (171 lines)
* Smoke: `scripts/byok-h3b-live-t1-micropilot-retry6-smoke-test.sh` — 43/43 PASS, `BYOK_H3B_LIVE_T1_MICROPILOT_RETRY6_SMOKE_PASS`.

BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-7 — T1 submitted, frontend direct-live verified, one-shot guard bounded, silent consume observed

* Window: `h3b-20260613-t1-retry7-125556` (Asia/Shanghai, 60 min, 12:55:56 → 13:55:56 +08:00)
* Deployed commit: `1fbc61b` (master HEAD)
* Stage-level approval: `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT`
* Health live gate: all 17/17 checks PASS before submit
* T1 submitted 6 times, violating the single-submit rule
* Frontend direct-live fix verified: `byokLastSubmitModeCandidate=live` (frontend payload's `mode: "direct-live"` reached server and was routed to the live path)
* One-shot guard verified: first request `byok_03867c9a057e` consumed the slot (`byokLiveAttemptsUsed 0 → 1`); submits 2–6 all rejected with `blocked_live_attempt_limit`
* `byokLiveAudioUsed=0`, `realApiAttemptsUsed=0` — no MiniMax call, no audio generated, no real API attempt
* Provider result: no MiniMax call observed
* Generated audio count: 0
* NEW issue (unresolved): first consumed live attempt produced no terminal `live_relay_ok` / `provider_error` / `live_relay_failed` stage. Final health `byokLastSubmitStage` was overwritten to `live_attempt_blocked` by later submits, hiding the first request's terminal stage. Required follow-up: `BYOK-H3B-SILENT-CONSUME-FOLLOWUP`
* Rollback verified: post-rollback POST returned `code: byok_generation_disabled`; safe default env restored (`PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_LIVE_ENABLED=false`, `BYOK_LIVE_CONFIRMATION=`, `BYOK_LIVE_WINDOW_ID=`)
* Health endpoint leak scan: clean
* No secret/key/token/PII/audio/log/runtime committed. Guard file + tsbuildinfo intentionally NOT staged.
* T2–T5 not executed. No broad public launch.
* Evidence: `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY7_20260613.md`
* Smoke: `scripts/byok-h3b-live-t1-micropilot-retry7-smoke-test.sh` — 20/20 PASS, `BYOK_H3B_LIVE_T1_MICROPILOT_RETRY7_SMOKE_PASS`.
* Next: `BYOK-H3B-SILENT-CONSUME-FOLLOWUP` before Retry-8. No T2–T5.

### BYOK-H3B-SILENT-CONSUME-FOLLOWUP (resolved)

The silent-consume gap surfaced in
`docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY7_20260613.md` is now closed:

* `server/adapters/minimax-api/byok.ts` adds a submit-trace ring buffer
  (default 32, max 256) and a silent-consume guard that increments
  `silentConsumeCount` when a `liveAttemptConsumed: true` stage is not
  followed by a stage in `BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME` for
  the same `requestId`. A synthetic `live_attempt_consumed_without_terminal_stage`
  trace entry is emitted on detection.
* `server/index.ts` imports the three new accessors, exposes
  `byokSubmitTraceCount` / `byokSubmitTraceRecent` / `byokSilentConsumeCount`
  on `/api/health`, and marks `live_attempt_consumed` as
  `liveAttemptConsumed: true, terminal: false, responseCode: 'in_progress'`.
* Trace payloads are booleans, enums, ISO timestamps, and `requestId` only
  — no raw key, token, prompt, lyrics, or provider response.
* This phase does **not** open live, does not call MiniMax, does not
  generate music, does not use a real MiniMax user key, and does not
  broaden the public launch gate.
* Smoke: `scripts/byok-h3b-silent-consume-followup-smoke-test.sh` —
  38/38 PASS, `BYOK_H3B_SILENT_CONSUME_FOLLOWUP_SMOKE_PASS`.
* Next: Retry-8 only after the new health trace fields are observed live,
  with `byokSubmitTraceRecent` showing a clean consume → terminal pairing
  for the first submit in the window. No T2–T5 until `live_relay_ok` is
  observed.

### BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-8 (silent consume reproduced → rollback)

Retry-8 opened the hardened live gate under window
`h3b-20260613-t1-retry8-165539` (Asia/Shanghai, 60 min) and T1 submitted
once with `mode: "direct-live"`. The trace ring buffer captured the live
attempt (`byok_0bf283b70815` → `received` →
`audio_quota_bypassed_for_byok_live` → `live_attempt_consumed`,
`terminal: false, liveAttemptConsumed: true`) but no terminal stage was
recorded afterwards — `byokSilentConsumeCount` stayed `0` because the
current guard requires a *subsequent* `recordByokSubmit` call to land,
which it never did. Per the strict spec, this is a silent-consume
reproduction and an unconditional rollback to safe default was executed.
T1's second submit was correctly blocked by the live-attempt cap with
`responseCode: blocked_live_attempt_limit`. The post-rollback probe
returned `code: byok_generation_disabled`. No real MiniMax call landed,
no audio was generated, no public launch was broadened.

* Evidence: `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY8_20260613.md`
* Smoke: `scripts/byok-h3b-live-t1-micropilot-retry8-smoke-test.sh` —
  27/27 PASS, `BYOK_H3B_LIVE_T1_MICROPILOT_RETRY8_SMOKE_PASS`.
* Next: harden the post-`consumeByokLiveAttempt()` code path so every
  exit is captured by a `recordByokSubmit(terminal: true, …)` call (or
  add a periodic reaper for stale `liveAttemptConsumedByRequest`
  entries). Retry-9 only after that fix is live and a successful T1
  `live_relay_ok` is observed end-to-end. No T2–T5.

### BYOK-H3B-POST-CONSUME-HARDENING (lightweight, post-Retry-8)

Closes the silent-consume gap reproduced in Retry-8 (requestId
`byok_0bf283b70815` → `live_attempt_consumed` with `terminal: false` and
no follow-up event). The fix is a **post-consume timeout reaper** in
`server/adapters/minimax-api/byok.ts`:

* `pendingConsumedAttempts` map tracks every open live-attempt consume
  (requestId, createdAt ISO, timer handle). No raw data — booleans,
  enums, timestamps, requestId only.
* `recordByokSubmit({ liveAttemptConsumed: true, terminal: false })`
  schedules a `setTimeout(BYOK_SILENT_CONSUME_TIMEOUT_MS)` (default
  30s, clamped to [5s, 5min]).
* Timer expiry → synthetic `live_attempt_consumed_without_terminal_stage`
  trace entry + `byokSilentConsumeCount += 1`.
* Natural terminal stage arrival → timer cleared, pending entry
  removed.
* `_resetByokSubmitObservabilityForTests` clears all pending timers and
  the map.
* `getByokPendingConsumedAttemptCount()` exported; surfaced on
  `/api/health` as `byokPendingConsumedAttempts` (diagnostic only).
* `server/index.ts` only adds one import + one health field. Live
  execution gate, provider selection, and production env are
  unchanged.
* This phase does **not** call MiniMax, does not generate music, does
  not use a real MiniMax user key, and does not broaden the public
  launch gate.
* Smoke: `scripts/byok-h3b-post-consume-hardening-smoke-test.sh` —
  `BYOK_H3B_POST_CONSUME_HARDENING_SMOKE_PASS`.
* Next: Retry-9 only after this commit CI is green. Inspect
  `byokSubmitTraceRecent` for every T1 submit; a `liveAttemptConsumed:
  true` row not followed within `BYOK_SILENT_CONSUME_TIMEOUT_MS` ms by
  a `terminal: true` row will be auto-replaced by a
  `live_attempt_consumed_without_terminal_stage` synthetic row, and
  `byokSilentConsumeCount` will increment. No T2–T5 until
  `live_relay_ok` is observed end-to-end.

### BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-9 (reaper verified → rollback)

Retry-9 closed the silent-consume observability gap surfaced by
Retry-8. The hardened live gate was opened under window
`h3b-20260613-t1-retry9-175611` (Asia/Shanghai, 2026-06-13 17:56:11 →
18:56:11). T1 submitted once with `mode: "direct-live"`. The trace ring
buffer captured the same silent-consume pattern that Retry-8 hit
(requestId `byok_3c7cc9cc4e96`), but this time the post-consume
reaper fired at 18:02:49.452Z — exactly 30.001s after the consume
(`BYOK_SILENT_CONSUME_TIMEOUT_MS=30000`) — and emitted the synthetic
terminal stage `live_attempt_consumed_without_terminal_stage` with
`responseCode: silent_consume_detected`. `byokSilentConsumeCount`
incremented from 0 to 1. `byokPendingConsumedAttempts` cleared.

The **reaper works as designed**. The post-consume code defect that
causes the consume to land without a natural terminal is a separate
issue (the `direct_live_confirmation_mismatch` rejection exits the
handler before recording). Per the strict spec, unconditional rollback
to safe default was executed at 2026-06-13T18:04:30+08:00, post-rollback
`POST /api/generate/byok` returned `code=byok_generation_disabled`,
no real MiniMax API call landed (`realApiAttemptsUsed=0`), no audio
generated (`byokLiveAudioUsed=0`), no public launch broadened. The
evidence lives in
`docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY9_20260613.md`. Smoke:
`scripts/byok-h3b-live-t1-micropilot-retry9-smoke-test.sh` —
`BYOK_H3B_LIVE_T1_MICROPILOT_RETRY9_SMOKE_PASS`. The
`ci-secret-scan` reports CLEAN.

**Next:** investigate the post-consume code path in
`server/index.ts` (the `direct_live_confirmation_mismatch` branch
must record a terminal stage via `recordByokSubmit` before returning
to the client). When that fix is deployed and verified, open
Retry-10. No T2–T5 under any circumstance. This phase made no real
MiniMax call and no music generated, no public launch broadened.

### BYOK-H3B-DIRECT-LIVE-CONFIRMATION-TERMINAL-FIX (post-consume observability closed)

* Fixed root cause: four rejection branches in `handleByokGenerate`
  (the ones that fire AFTER `consumeByokLiveAttempt`) did not call
  `recordByokSubmit` with a terminal stage, so the post-consume reaper
  had to clean them up after a 30s timeout.
* Branches patched: `byok_direct_live_not_enabled`,
  `direct_live_confirmation_mismatch`, `direct_live_provider_error`,
  and the success path `direct_live_relay_ok`.
* Each patch is an additive `recordByokSubmit({ ...terminal: true,
  responseCode: <aligned> })` call immediately before the rejection
  return. No env change, no public BYOK flip, no MiniMax call, no music
  generated.
* Reaper is retained as defense-in-depth and now should not fire
  from `handleByokGenerate`. The reaper stage
  `live_attempt_consumed_without_terminal_stage` and the
  `getByokSilentConsumeCount` accessor remain in place.
* No Retry-10, no T2–T5, no broad public launch. Awaiting operator
  confirmation to commit / push / CI.

### BYOK-H3B-FRONTEND-DIRECT-LIVE-CONFIRMATION-FIX (frontend direct-live contract closed)

* Frontend now supports the operator-supplied `directLiveConfirmation` field.
* Rendered only when `isByokLiveReady === true` (i.e. all server live health fields are positive).
* Included in the `/api/generate/byok` body only when both `isByokLiveReady` and `directLiveConfirmation.length > 0` are true.
* No real MiniMax call, no music generated, no Retry-10 yet, no T2-T5, no public launch broadened.

### BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-10-PREFLIGHT (planning now safe; execution still operator-only)

* HEAD `1566134` eligible for Retry-10 planning. Both preconditions met (post-consume natural terminal recording from `63da013`, frontend direct-live confirmation field from `1566134`).
* Production health shows safe default. Production frontend bundle is the `1566134` build.
* No live gate opened, no live window relocked, no MiniMax call, no audio generated, no T2-T5, no public launch broadened.
* Suggested Retry-10 execution plan is in `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY10_PREFLIGHT_20260613.md` §7. Execution is operator-only.


### BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-10 (attempted, blocked at secret step)

* Result classification: **RETRY10_BLOCKED_OR_ABORTED** (operator
  approval `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` issued; agent
  paused at STEP 2 because `byokLiveConfirmationConfigured: false`).
* Reason: **OPERATOR_SECRET_STEP_NOT_CONFIRMED**
* Window: `h3b-20260613-t1-retry10-133900` (not opened).
* T1 only, no T2–T5, no broad public launch, no MiniMax call, no
  audio.
* Safe default preserved (PID 916435 unchanged).
* Evidence: `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY10_20260613.md`.
