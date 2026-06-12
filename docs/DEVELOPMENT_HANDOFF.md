# mmx-music-studio Development Handoff

> 文档版本：v0.4.30-alpha · 2026-06-12
> 用途：换电脑继续开发、项目交接、开源维护参考

---

## Current release line

> 文档版本：v0.4.30-alpha · 2026-06-12

**v0.4.30-alpha** — Phase Release v0.4.30-alpha: Turnstile gate for BYOK release.

- Deploy-CF-D 已完成 (commit b3d1095): server-side Turnstile gate for `/api/generate/byok`.
- Turnstile Siteverify helper 就位，timeout + redaction，不记录 secret。
- `TURNSTILE_BYOK_REQUIRED=false` 默认非阻断。
- `/api/health` 只暴露 boolean 配置状态，不暴露 secret。
- ByokPanel Turnstile placeholder UI 就位，token 不持久化。
- Deploy-CF-D smoke 21/21 PASS。
- 不 broad public BYOK launch。
- 不执行新的 live call。
- 不生成音乐。
- 没有提交 secret / key / .env / provider raw response / tsconfig.tsbuildinfo / storage runtime。
- 旧 tag v0.4.29-alpha 未移动。

**关键口径**: Deploy-CF-D adds a server-side Turnstile gate for BYOK generation. It does not enable broad public BYOK launch by itself.

**v0.4.29-alpha** — Phase Release v0.4.29-alpha: BYOK direct live verification release.

- BYOK-G 已完成 (commit 7d45e12): 一次 operator-approved direct HTTPS live call 成功验证。
- 确认 direct relay path 可调用 `POST https://api.minimaxi.com/v1/music_generation`。
- 确认 provider 返回 success (HTTP 200, status_code 0, data.audio base64)。
- 确认无 CLI 使用、无 site operator key 使用、user key 未持久化、无 raw provider response 记录。
- 默认值已恢复 disabled / dry-run。
- BYOK-G smoke 21/21 PASS。

**关键口径**: BYOK-C 已完成单次 live call 的可审计协议与 smoke test, 但本轮未提供 operator confirmation, 因此未执行真实 MiniMax live call.

**v0.4.25-alpha** — Phase Release v0.4.25-alpha: Storage-B0 operator cleanup dry-run and safety design release.

- Phase Product Polish-P completed
- Phase Product Polish-N completed (annotation timeline + batch note editing + Library-wide history panel — see v0.4.22-alpha notes below)
- Active filter chips added (来源 / 集合 / 标签 / 搜索 with per-chip × remove buttons)
- Per-filter clear added (search / source / collection / tag — single filter clear without affecting others)
- Search match hints added (标题 / Prompt / 歌词 / 模式 / 来源 / 标签 / 备注, max 3 + N more)
- Batch operation scope hint added (已选 N 首 / 请选择作品后再执行批量操作)
- Timeline accessibility polish completed (role=group, aria-label, per-chip title)
- Timeline filter actions a11y polish
- Track checkbox aria-pressed added
- aria-label / title polish across batch toggle, filter chips, drawer buttons
- Mobile polish 390px / 639px (activeFilterChip wrap, match hint ellipsis, batchScopeHint role=status)
- No server schema migration, no generation logic changes, browser-local only

**v0.4.23-alpha** — Phase Release v0.4.23-alpha: Library UX polish and timeline clarity release.

**Phase Product Polish-O completed** — Library UX polish round 2:
- Current view summary + clear all filters
- Better empty states (search / smart collection / tag / batch)
- Batch toolbar grouping (选择 / 批量标注 / 导出)
- Drawer hierarchy polish (标签与备注 section heading, drawer section dividers)
- Timeline readability polish (border consistency, today/yesterday hint)
- Mobile polish639 /390 breakpoints
- No server schema migration, no generation logic changes, browser-local only

- Annotation timeline (per-track): default5 entries + 查看全部 /收起 (expand to full local history,300 cap).
- 7 action badges: 添加标签 / 删除标签 / 批量添加标签 / 批量删除标签 / 更新备注 / 合并导入 / 覆盖导入.
- Library-wide annotation history panel (`LibraryHistoryPanel`): latest 20 events, 4 filter chips (全部 / 标签变更 / 备注变更 / 导入), collapsible, no 清空 button.
- Batch note editing: overwrite / append modes, 500-char note cap, records `note_updated` annotation history with all selected trackIds.
- Improved mobile Library polish (≤639px): horizontal-scroll filter chips, full-width batch note textarea.
- Annotation history (browser-local): `mmx-studio:annotation-history:v1`, cap 300, includes
  tag_added / tag_removed / batch_tag_added / batch_tag_removed / note_updated /
  backup_import_merge / backup_import_replace.
- Local backup v1.0 includes `annotationHistory`; v1.0 backups without history still importable
  (replace-mode preserves current history; merge-mode dedupes by id, cap 300).
- Batch remove tag (case-insensitive) added to batch toolbar.
- Collection URL state: `?q=&source=&collection=&tag=` written via `history.replaceState`.
- Collection share link button in toolbar: copies a shareable URL of the current filter view.
- Drawer shows `最近标注历史` (last 5 actions) for the current track.
- Collection export Markdown / JSON now include `collectionUrl` + `filters` (query / source / smart collection / tag).
- Included **Release workflow fix** (commit `9662754`): removed `gh release create --verify-tag`
  (401 with `${{ github.token }}`); kept automatic GitHub Release workflow operational.
- **No server schema migration.**
- **No server upload.**
- **No generation is performed for this release.**

### Phase BYOK-C-Hotfix: disable unsafe CLI live path

- **Status**: **LIVE PATH DISABLED**
- **What**: BYOK live preflight 中发现 mmx CLI key fallback bug — CLI 忽略 `MINIMAX_API_KEY` env，fallback 到 `~/.mmx/config.json` operator key。placeholder 测试意外生成真实 MP3（已删除）。
- **Code changes**:
  - `server/adapters/minimax-api/byok.ts`: live path fail-closed（`byok_live_provider_path_disabled`）
  - 删除 `runMmxChild`、`spawn` import、env injection
  - 新增 `byok_live_provider_path_disabled` 到 type union
- **Docs updated**:
  - `docs/security/BYOK_SINGLE_LIVE_CALL_TEST_REPORT.md`: Critical finding 章节
  - `docs/security/BYOK_LIVE_RELAY_TEST_DESIGN.md`: Known issue / Superseded 章节
- **Current availability**: fake ✅ / dry-run ✅ / live ❌（直到 BYOK-C2 direct API relay）
- **Next**: BYOK-C2 direct HTTPS API relay（per-request `Authorization`，无 CLI spawn）

### Phase BYOK-E: Official API Schema Validation

- **Status**: **VERIFIED**
- **Source**: mmx-cli v1.0.16 source code (official MiniMax CLI)
- **Verified schema**:
  - `POST /v1/music_generation`
  - `Authorization: Bearer <key>`
  - Models, request body, response shape, error shape
- **Decision**: BYOK-F implementation unblocked

### Phase BYOK-D: Direct HTTPS API Relay Design (v0.4.28-alpha)

- **Status**: DESIGN ONLY (no live calls)
- **What**: 设计 direct HTTPS provider call 架构，替代 CLI live path
- **Files**:
  - `docs/security/BYOK_DIRECT_API_RELAY_DESIGN.md` — 设计文档
  - `server/adapters/minimax-api/byok-direct.ts` — adapter skeleton
- **Key principles**:
  - 不使用 CLI spawn
  - 不使用 `MINIMAX_API_KEY` env injection
  - 不使用 `--api-key` flag（会暴露 key 到 process argv）
  - 未来使用 per-request `Authorization` header
  - user key 永不存储、永不记录、永不返回
  - provider error 全部 redact
- **Blocked until**: 官方 MiniMax music generation API endpoint/schema 验证完成
- **Release**: v0.4.28-alpha
- **Next**: BYOK-E Official API Schema Validation → Deploy-CF-D Turnstle

- **Status**: DESIGN ONLY (no live calls)
- **What**: 设计 direct HTTPS provider call 架构，替代 CLI live path
- **Files**:
  - `docs/security/BYOK_DIRECT_API_RELAY_DESIGN.md` — 设计文档
  - `server/adapters/minimax-api/byok-direct.ts` — adapter skeleton
- **Key principles**:
  - 不使用 CLI spawn
  - 不使用 `MINIMAX_API_KEY` env injection
  - 不使用 `--api-key` flag（会暴露 key 到 process argv）
  - 未来使用 per-request `Authorization` header
  - user key 永不存储、永不记录、永不返回
  - provider error 全部 redact
- **Blocked until**: 官方 MiniMax music generation API endpoint/schema 验证完成
- **Next**: BYOK-E Official API Schema Validation → Deploy-CF-D Turnstile


### Phase BYOK-G: Single Direct Live Call Verification

- **Status**: **LIVE CALL SUCCESS**
- **What**: 执行一次 operator-approved direct HTTPS BYOK live call
- **Operator confirmation**: `CONFIRM_BYOK_G_SINGLE_DIRECT_LIVE_CALL` — received
- **Live call**: **已执行**（1 次，使用 user-provided MiniMax API Key）
- **Result**: **SUCCESS** — provider returned base64 audio, HTTP 200, status_code 0
- **Audio summary**:
  - Size: 2,967,813 bytes (~2.8 MB)
  - Duration: 92,682 ms (~92s)
  - Sample rate: 44,100 Hz
  - Bitrate: 256,000 bps
  - Channels: 2 (stereo)
  - Trace ID: `0679ff5271e7cef9f7432485d6d39a1a`
- **Safety**:
  - No CLI used
  - No site operator key used
  - User key not persisted
  - Raw provider response not recorded in repo
  - Only redacted summary recorded
  - Defaults remain disabled / dry-run
- **No broad public BYOK launch**
- **Report**: `docs/security/BYOK_DIRECT_SINGLE_LIVE_CALL_REPORT.md`
- **Smoke**: BYOK-G smoke 21/21 PASS
- **Next**: Release v0.4.30-alpha — Turnstile gate for BYOK

### Phase Release v0.4.30-alpha: Turnstile gate for BYOK

- **Status**: **RELEASED**
- **Commit**: `b3d1095`
- **What**: Deploy-CF-D adds a server-side Turnstile gate for BYOK generation.
- **Key points**:
  - `/api/generate/byok` live/direct path now supports Turnstile verification.
  - `TURNSTILE_BYOK_REQUIRED=false` by default.
  - It does not enable broad public BYOK launch by itself.
  - No new live call was executed.
  - No music was generated.
  - No Turnstile secret, key, env, runtime storage, logs, audio, or tsconfig was committed.
- **Smoke**: Deploy-CF-D smoke 21/21 PASS
- **Next**: Configure real Turnstile site/secret keys outside repo → BYOK-H public launch (only after Turnstile configured + verified)

### Phase Deploy-CF-D: Turnstile protection for BYOK generation

- **Status**: **COMPLETED**
- **What**: 为 `/api/generate/byok` 增加 server-side Turnstile gate
- **Files**:
  - `docs/deploy/CLOUDFLARE_TURNSTILE_BYOK.md` — 设计文档
  - `server/security/turnstile.ts` — Siteverify helper
  - `server/types.ts` — Turnstile config fields
  - `server/index.ts` — Turnstile gate in `/api/generate/byok` + health exposure
  - `src/features/studio/ByokPanel.tsx` — Turnstile UI skeleton
  - `src/features/studio/ByokPanel.module.css` — Turnstile placeholder styles
  - `scripts/deploy-cf-d-turnstile-smoke-test.sh` — 21/21 PASS
- **Key principles**:
  - Server-side Siteverify，不是纯前端
  - `TURNSTILE_BYOK_REQUIRED=false` 默认非阻断
  - Secret 不记录、不返回、不提交
  - Token 不持久化到 localStorage / sessionStorage / URL
  - 不影响 `/api/generate`, `/api/health`, `/api/status`, `/ops`
- **Default**: disabled / dry-run / non-broad public
- **No new live call**
- **No music generation**
- **Status**: Released as v0.4.30-alpha (commit b3d1095)
- **Next**: Configure real Turnstile site/secret keys outside repo → BYOK-H public launch (only after Turnstile configured + verified)

### Phase Deploy-CF-E: Frontend Turnstile widget runtime integration for BYOK

- **Status**: **COMPLETED** (2026-06-12, in progress for this session)
- **What**: Add the front-end half of the Turnstile integration so the browser can obtain a verification token and submit it with `POST /api/generate/byok`. The server-side gate from Deploy-CF-D already exists in `server/security/turnstile.ts` and inside the `/api/generate/byok` live/direct path.
- **Files**:
  - `server/index.ts` — `/api/health` now also returns the public `turnstileSiteKey` (booleans `turnstileByokRequired` / `turnstileSecretKeyConfigured` / `turnstileSiteKeyConfigured` already existed from Deploy-CF-D). Never returns `TURNSTILE_SECRET_KEY`.
  - `src/lib/serverApi.ts` — `HealthInfo` type extended with `turnstileSiteKey?: string` and the three boolean flags.
  - `src/features/studio/Studio.tsx` — passes `turnstileSiteKey` / `turnstileByokRequired` / `turnstileSecretKeyConfigured` into `<ByokPanel />`.
  - `src/features/studio/ByokPanel.tsx` — full rewrite (671 lines) with:
    - Idempotent dynamic loader for `https://challenges.cloudflare.com/turnstile/v0/api.js` (no double injection under React strict mode / re-mount).
    - `window.turnstile.render(...)` with explicit `callback` (sets `turnstileToken`, status → `verified`), `expired-callback` (clears token, status → `expired`), `error-callback` (clears token, status → `error`).
    - Submit-time guard: if `turnstileByokRequired === true` and no token, submit is blocked with a "complete Turnstile first" message.
    - After submit: widget is reset and token cleared — token is single-use.
    - UI states: `not_configured` / `loading` / `ready` / `verified` / `expired` / `error`.
  - `src/features/studio/ByokPanel.module.css` — widget container, state badge, mobile-overflow protection (≤639px), `size: 'flexible'` padding.
  - `scripts/deploy-cf-e-turnstile-widget-smoke-test.sh` — 23 assertions: script URL, callback names, state machine, single-use reset, token not in localStorage / sessionStorage / IndexedDB / URL query, raw token not displayed, no `TURNSTILE_SECRET_KEY` reference in front-end, `serverApi.ts` exposes `turnstileSiteKey` type, `Studio.tsx` passes it, `/api/health` returns it, no broad public BYOK launch, no MiniMax live call, no music generation. Emits `DEPLOY_CF_E_TURNSTILE_WIDGET_SMOKE_PASS`.
  - `docs/deploy/CLOUDFLARE_TURNSTILE_BYOK.md` — Deploy-CF-E section + explicit "Valid-token E2E verification requires production deploy" note.
  - `README.md` — Deploy-CF-E row added to current release table.
- **Key principles**:
  - Server-side Siteverify remains the source of truth (Deploy-CF-D unchanged).
  - `TURNSTILE_BYOK_REQUIRED` still defaults to `false` (non-blocking).
  - Site key is public by design; secret key never crosses `/api/health`.
  - Token is never written to `localStorage` / `sessionStorage` / IndexedDB / URL query.
  - Token is never rendered in the DOM, never `console.log`'d, never sent to a logging endpoint.
  - Front-end does not import or reference `TURNSTILE_SECRET_KEY` (the smoke test grep-verifies this).
- **Default**: disabled / dry-run / non-broad public
- **No new live call**
- **No music generation**
- **E2E gate**: a real valid-token E2E pass requires a production deploy of this phase (local smoke cannot exercise a real Cloudflare widget without a real key + recognised origin). BYOK-H is gated on this E2E pass.
- **Status**: Released as v0.4.31-alpha (commit pending this session)
- **Next**: Release v0.4.31-alpha → deploy to production → valid-token E2E verification → BYOK-H small public launch planning only after E2E PASS.

### In-flight phase: none — Phase Release v0.4.25-alpha closed (2026-06-11)

- **Phase Release v0.4.25-alpha** (Phase Storage-B0 promoted to release) — ✅ closed2026-06-11.
- **Storage-B0 dry-run + safety design** (Storage-B0 promoted to release): `scripts/storage-b-operator-cleanup-dry-run.sh` (read-only, `destructive: false`, optional `--retention-days` / `--json`), `scripts/storage-b-confirmation-guard.sh` (rejects unless `STORAGE_B_CONFIRMATION=CONFIRM_STORAGE_B_CLEANUP`, never deletes), `docs/storage/STORAGE_B_OPERATOR_CLEANUP_DESIGN.md` (candidate categories: orphan audio / orphan metadata / missing audio refs / old tracks; never-delete list; required report; rollback note; required confirmation phrase), `scripts/storage-b-smoke-test.sh` (59/59 PASS — file presence / executable / static safety / runtime behavior / design doc content / documentation records).
- **Current inventory (Storage-B0)**: 300 audio files, 0 orphan audio, 0 orphan metadata, 0 missing audio references, 0 old track candidates, 0 reclaimable bytes, `destructive: false`.
- **No `/api/generate` call, no music generation, no server schema change, no runtime storage committed.**
- **Product Polish-N doc drift fixed** — `DEVELOPMENT_HANDOFF.md` now explicitly lists "Phase Product Polish-N completed" at the top; Product Polish-N smoke restored to 55/55 PASS.
- See `docs/release/RELEASE_NOTES_v0.4.25-alpha.md` and `CHANGELOG.md` v0.4.25-alpha.

### Next recommended phases

- **Phase Deploy-CF-D** — Turnstile protection for BYOK generation ✅ completed 2026-06-12
  - `docs/deploy/CLOUDFLARE_TURNSTILE_BYOK.md` documents the server-side Siteverify gate
  - `server/security/turnstile.ts` implements `verifyTurnstileToken()` with timeout + redaction
  - `/api/generate/byok` requires `turnstileToken` when `TURNSTILE_BYOK_REQUIRED=true`
  - `/api/health` exposes `turnstileByokRequired`, `turnstileSecretKeyConfigured`, `turnstileSiteKeyConfigured` (never the secret)
  - Default `TURNSTILE_BYOK_REQUIRED=false` — non-blocking until operator enables
  - No broad public BYOK launch without Turnstile or equivalent abuse control
  - `scripts/deploy-cf-d-turnstile-smoke-test.sh` 21/21 PASS
- **Phase Storage-B1** — operator-confirmed cleanup **only if** real candidates exist AND the operator reviews and approves the Storage-B0 manifest. Current dry-run shows **0 candidates**, so Storage-B1 is **not urgent**.
- **Phase Product Polish-Q** — optional next round of UI polish.
- **Phase Deploy-CF-C** (Cloudflare Access for Ops / Status) — ✅ verified2026-06-10.
  - `docs/deploy/CLOUDFLARE_ACCESS_OPS.md` documents the recommended Access application
    (`MMX Music Studio Ops`, self-hosted, paths `/ops`, `/ops/*`, `/api/status`, `/api/debug/*`).
  - Public paths retained: `/`, `/library`, `/studio`, `/api/health`.
  - `/api/generate` is **not** moved to Access — it stays under server-side Launch Guard.
  - Dashboard application `MMX Music Studio Ops` has been **enabled** by the operator.
  - `scripts/deploy-cf-c-access-smoke-test.sh` returns `DEPLOY_CF_C_ACCESS_SMOKE_PASS`
    (12/12, exit 0). Protected responses carry `Location: https://soft-wood-f891.cloudflareaccess.com/...`,
    `www-authenticate: Cloudflare-Access`, and `set-cookie: CF_AppSession=...`.
  - Verification table recorded in `docs/deploy/CLOUDFLARE_ACCESS_OPS.md` ("Verification (2026-06-10)").
- **Phase Release-Automation-A** (`.github/workflows/release.yml`) — ✅ verified 2026-06-10.
  - tag push trigger, `workflow_dispatch` backfill, `git archive` source zip, safety check,
    `gh release create --verify-tag` / `upload --clobber`, built-in `${{ github.token }}`.
  - Backfilled `v0.4.18-alpha`, `v0.4.19-alpha`, `v0.4.20-alpha` (3/3 success).
- **No code changes** to server routes, storage, audit log, or generation logic.

### Next recommended phases

- **Phase Storage-B operator-confirmed cleanup** — operator-driven dry run + manual confirm cleanup of `storage/tracks/`, `storage/quota/`, `storage/audit/`, `storage/guard/`.
- **Phase Deploy-CF-D** (optional) — Turnstile protection for BYOK generation ✅ completed 2026-06-12
  - `docs/deploy/CLOUDFLARE_TURNSTILE_BYOK.md` documents the server-side Siteverify gate
  - Default `TURNSTILE_BYOK_REQUIRED=false` — non-blocking until operator enables
  - No broad public BYOK launch without Turnstile or equivalent abuse control
  - `scripts/deploy-cf-d-turnstile-smoke-test.sh` 21/21 PASS
  - Next: Release v0.4.30-alpha → BYOK-H public launch (only after Turnstile configured + verified)


### Local backup localStorage keys

- `mmx-studio:track-annotations:v1`
- `mmx-studio:favorites`
- `mmx-studio:prompt-templates`
- `mmx-studio:playback-queue:v1`
- `mmx-studio:playback-progress:v1`
- `mmx-studio:annotation-history:v1` (new in Product Polish-M)

---

## Repository

```
https://github.com/conanxin/mmx-music-studio
git clone git@github.com:conanxin/mmx-music-studio.git
```

---

## 当前状态

| 模块 | 状态 | 说明 |
|------|------|------|
| Web UI | ✅ 完成 | 移动端优先，桌面双栏，暖黑/米白/绿色 |
| Web 公网预览 | ✅ 可用 | Cloudflare Tunnel `https://music.conanxin.com`（CLI backend，无需 SSH Tunnel） |
| Mock 生成 | ✅ 完成 | server mock，不消耗额度 |
| MMX CLI 生成 | ✅ 已验证 | `MINIMAX_BACKEND=cli`，需 auth login，Web+CLI 主链路 |
| API adapter | ⚠️ 实验性 | `MINIMAX_BACKEND=api`，需真实 key |
| 微信小程序 | ✅ Phase 3C/3D | Taro v4，mock API，音频播放/下载 adapter |
| HTTPS 域名 | ✅ 已完成 | `https://music.conanxin.com` via Cloudflare Tunnel（Phase Deploy-CF-B） |
| 微信合法域名 | ⏳ 待办 | Phase 3E：request + downloadFile |
| 多用户鉴权 | ✅ 完成 | Phase 4C：Generation Access PIN |
| 额度限制/限流 | ✅ 完成 | Phase 4C：Rate Limit + Daily Quota |
| 任务历史管理 | ✅ 完成 | Phase 4D：Jobs 页面 + delete/retry/stats API |
| 公开生成保护 | ✅ 完成 | Phase Launch Guard-A：全局暂停/每来源日限额/冷却/SHA256源识别 |
| 公开运行观测 | ✅ 完成 | Phase Ops-Monitor-A：`/api/status`、job queue/storage 聚合、ops 监控文档 |
| 存储治理 | ✅ 完成 | Phase Storage-A：inventory/dry-run/backup manifest 脚本，无自动删除，operator-driven |
| 算子确认清理（仅 dry-run） | ✅ Phase Storage-B0 closed | `storage-b-operator-cleanup-dry-run.sh`（只读，输出 manifest JSON，destructive=false）+ `storage-b-confirmation-guard.sh`（必须 `STORAGE_B_CONFIRMATION=CONFIRM_STORAGE_B_CLEANUP` 才接受）+ `docs/storage/STORAGE_B_OPERATOR_CLEANUP_DESIGN.md`；**B0 不删除任何文件**，未调用 /api/generate，未生成音乐 |
|| Cloudflare Access for Ops/Status | ✅ Phase Deploy-CF-C | `docs/deploy/CLOUDFLARE_ACCESS_OPS.md` 已写，Dashboard 应用 `MMX Music Studio Ops` 已启用，smoke test 12/12 PASS；`/api/generate` 仍由 Launch Guard 守 |
|| Turnstile for BYOK generation | ✅ Phase Deploy-CF-D | `docs/deploy/CLOUDFLARE_TURNSTILE_BYOK.md` 已写，server-side Siteverify helper 就位，`TURNSTILE_BYOK_REQUIRED=false` 默认非阻断，smoke test 21/21 PASS；不 broad public launch |
| 自动 Release 工作流 | ✅ Phase Release-Automation-A | `.github/workflows/release.yml` 已上线：tag push 触发 + `workflow_dispatch` 手动 backfill + zip 安全检查 + 内置 `github.token`；v0.4.18/19/20 backfill 3/3 success |
| Recent Release History backfilled | ✅ 完成 | v0.4.18-alpha → bd5736c, v0.4.19-alpha → 5c7fec2, v0.4.20-alpha → 7edb764，tag 全部未被移动 |
| 当前 release line | ✅ v0.4.21-alpha | Phase Release v0.4.21-alpha：Protected Ops and release automation closeout |

---

## 在新电脑继续开发

### 1. Clone 项目

```bash
git clone git@github.com:conanxin/mmx-music-studio.git
cd mmx-music-studio
```

### 2. 安装依赖

```bash
npm install
```

> 包含根 workspace + `apps/web` + `apps/weapp` 依赖（npm workspaces）

### 3. 验证构建

```bash
npm run typecheck        # TypeScript 类型检查
npm run build            # Web 生产构建
npm run release:check    # 发布前检查清单
npm run manifest:audit   # manifest 审计
npm run weapp:typecheck  # 小程序类型检查
npm run weapp:build      # 小程序构建
```

### 4. Web 开发

```bash
# mock 模式（不消耗额度）
npm run dev:server
npm run dev:web

# 或
npm run dev:full
```

### 5. Mock 预览（公网访问用）

```bash
PREVIEW_ACCESS_ENABLED=false \
REAL_GENERATION_ENABLED=false \
MOCK_GENERATION_ENABLED=true \
MINIMAX_BACKEND=mock \
HOST=0.0.0.0 \
PORT=8787 \
npm run start
```

访问：`http://localhost:8787` 或 Cloudflare Tunnel `https://music.conanxin.com`（无需 SSH Tunnel）

---

## 真实 MMX CLI 生成（需服务器上先配置）

### 前置准备（服务器上执行一次）

```bash
# 1. 认证
mmx auth login --recommend --region=cn

# 2. 确认认证状态
mmx auth status

# 3. 查看额度
mmx quota

# 4. 验证 CLI 生成可用
mmx music generate --prompt "深夜编程" --output ./test.mp3
```

### 启动真实生成 server

```bash
REAL_GENERATION_ENABLED=true \
MOCK_GENERATION_ENABLED=false \
MINIMAX_BACKEND=cli \
HOST=0.0.0.0 \
PORT=8787 \
npm run start
```

**⚠️ 重要警告**

- 真实生成会消耗 MiniMax Token Plan 额度
- **不要**将真实生成服务裸露到不受控的公网
- 公网开放前必须实现：登录鉴权 + 额度限制 + 速率限制 + 管理员面板
- 建议先用 `whois` 或防火墙限制访问来源

---

## 微信小程序开发

### 构建

```bash
npm run weapp:typecheck
npm run weapp:build
```

### 微信开发者工具导入

- 导入路径：`apps/weapp/`（不是 `dist/`）
- AppID：测试号 `touristappid`
- 开发阶段：详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」

> `project.config.json` 已配置 `"miniprogramRoot": "./dist/"`，工具会自动找到编译产物。

### API Base 配置

| 环境 | API Base | 用途 |
|------|----------|------|
| 开发（当前） | `http://118.195.129.137:8787` | 开发者工具调试 |
| 生产占位符 | `https://music.yourdomain.com` | 正式小程序（用户提供域名后替换） |

### HTTPS 域名（Phase 3E，未执行）

- 配置模板：`deploy/Caddyfile.example`（推荐，自动 HTTPS）
- 配置模板：`deploy/nginx.mmx-music-studio.conf.example`
- 文档：`docs/WEAPP_DOMAIN_HTTPS_GUIDE.md`
- 域名就绪检查：`DOMAIN=your.domain.com bash scripts/weapp-domain-readiness-check.sh`
- 微信公众平台需配置 request + downloadFile 合法域名

---

## 重要文件索引

### 入口与配置

| 文件 | 说明 |
|------|------|
| `README.md` | 项目总览 |
| `package.json` | npm scripts 入口 |
| `.env.example` | 环境变量占位符模板 |
| `Dockerfile` | 容器化部署 |
| `docker-compose.yml` | 容器编排 |

### 文档

| 文件 | 说明 |
|------|------|
| `docs/DEPLOYMENT.md` | Server 部署指南 |
| `docs/SECURITY.md` | 安全规范 |
| `docs/CLI-ADAPTER.md` | MMX CLI adapter 说明 |
| `docs/ARCHITECTURE.md` | 系统架构 |
| `docs/PRODUCT.md` | 产品设计 |
| `docs/UI-SPEC.md` | UI 设计规范 |
| `docs/WEAPP_ARCHITECTURE.md` | 小程序架构 |
| `docs/WEAPP_DEV_GUIDE.md` | 小程序开发指南 |
| `docs/WEAPP_DEVTOOLS_IMPORT.md` | 开发者工具导入 |
| `docs/WEAPP_REAL_DEVICE_CHECKLIST.md` | 真机测试清单 |
| `docs/WEAPP_TROUBLESHOOTING.md` | 问题排查 |
| `docs/WEAPP_DOMAIN_HTTPS_GUIDE.md` | HTTPS 域名配置 |
| `docs/CADDY_DEPLOYMENT.md` | Caddy 部署 |
| `docs/NGINX_DEPLOYMENT.md` | Nginx 部署 |
| `docs/DEVELOPMENT_HANDOFF.md` | 本文档 |

### 脚本

| 文件 | 说明 |
|------|------|
| `scripts/weapp-api-smoke-test.sh` | 小程序 API smoke test |
| `scripts/weapp-audio-url-smoke-test.sh` | 音频 URL smoke test |
| `scripts/weapp-domain-readiness-check.sh` | 域名就绪检查 |
| `scripts/package-weapp-dist.sh` | 小程序 dist 打包 |

---

## 不要提交的内容

以下内容已在 `.gitignore` 和 `.dockerignore` 中排除，**不要**手动添加或强制提交：

```
.env                          # 真实环境变量
.env.*                        # 任何本地环境变量
real API keys                 # 真实 API key
MiniMax tokens                # 真实 token
storage/tracks/*.mp3          # 生成的音频文件
storage/tracks/*.wav
storage/tracks/*.flac
node_modules/                 # npm 包
dist/                         # Web 构建产物
apps/weapp/dist/              # 小程序编译产物
*.tsbuildinfo                 # TypeScript 增量缓存
logs/                         # 日志
tmp/                          # 临时文件
*.zip                         # 打包产物（除非刻意）
project.private.config.json    # 微信开发者工具私有配置
SSL certificates /            # 证书和私钥
private keys
```

---

## 环境变量参考

复制 `.env.example` 为 `.env` 并填写：

```bash
cp .env.example .env
```

`.env.example` 内容（均为占位符）：

```bash
MINIMAX_API_KEY=<your_minimax_token_plan_key>
MINIMAX_REGION=cn
MINIMAX_BACKEND=api
MUSIC_OUTPUT_DIR=./storage/tracks
PUBLIC_DEMO_MODE=true
```

> **安全提示**：`.env` 不要提交到 Git。用 `git update-index --assume-unchanged .env` 或加入 CI secret 管理。

---

## 验证命令清单

在新电脑 clone 后，运行以下命令确认环境正常：

```bash
# 基础构建
npm run typecheck           # ✓ TypeScript 类型检查
npm run build               # ✓ Web 生产构建
npm run release:check       # ✓ 发布前清单（21/21 项）
npm run manifest:audit      # ✓ manifest 审计

# 小程序
npm run weapp:typecheck     # ✓ 小程序 TS 类型检查
npm run weapp:build         # ✓ 小程序编译

# API 测试
bash scripts/job-queue-smoke-test.sh         # ✓ PASS
bash scripts/job-history-admin-smoke-test.sh # ✓ 14/14 PASS
bash scripts/auth-quota-smoke-test.sh        # ✓ 31/31 PASS
bash scripts/web-api-smoke-test.sh           # ✓ PASS

# 域名就绪（用户提供域名后）
DOMAIN=your.domain.com bash scripts/weapp-domain-readiness-check.sh
```

---


## Phase BYOK-A: Public BYOK generation readiness (shipped, commit 42c3ef3)

Server-side relay scaffold only. BYOK is **disabled by default** for the
public endpoint. Phase BYOK-A returns a `byok_dry_run_only` response and
does NOT call real MiniMax.

Key files added/modified in BYOK-A:

- `docs/security/BYOK_PUBLIC_GENERATION_DESIGN.md` (new, full design)
- `server/security/redaction.ts` (new, `redactSensitive` / `redactObject` / `validateApiKeyShape`)
- `server/index.ts` (added `/api/generate/byok` route + `handleByokGenerate` dry-run, imported redaction helpers, `publicByokEnabled` config flag)
- `server/types.ts` (`ServerConfig.publicByokEnabled` field)
- `src/features/studio/ByokPanel.tsx` (new UI block, password input + model select + confirmation + disabled-by-default)
- `src/features/studio/ByokPanel.module.css` (new)
- `src/features/studio/Studio.tsx` (mounts `<ByokPanel />`)
- `scripts/byok-a-smoke-test.sh` (new, 50+ assertions)

User key is never written to disk / logs / metadata / track object, and
never put in `localStorage` / `sessionStorage` / `IndexedDB` / URL query.
Users pay with their own MiniMax account -- billing responsibility is
on the user.

## Phase BYOK-B: Controlled BYOK relay test (in progress)

> **BYOK-B 已完成受控 fake/live relay 测试结构，但真实 MiniMax live call 仍未执行。**

Phase BYOK-B builds on BYOK-A by adding a `fake / live` switch under
three gating env flags and a dedicated provider adapter.

### Mode matrix

| Mode | Response | Provider call |
| --- | --- | --- |
| disabled (`PUBLIC_BYOK_ENABLED=false`) | `403 byok_generation_disabled` | none |
| dry-run (`BYOK_DRY_RUN_ONLY=true`) | `200 byok_dry_run_only` | none |
| fake relay | `200 byok_fake_relay_ok` | none (deterministic) |
| live not enabled | `403 byok_live_not_enabled` | none |
| live confirmation missing | `403 byok_live_confirmation_required` | none |
| live enabled (all 3 keys) | `200 byok_live_relay_ok` | mmx spawn with user key |
| provider error | `502 byok_provider_error*` (redacted) | mmx spawn attempt, redacted |

### Live mode env (must be set together at process start)

- `PUBLIC_BYOK_ENABLED=true`
- `BYOK_LIVE_ENABLED=true`
- `BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST`

The confirmation phrase `CONFIRM_BYOK_LIVE_RELAY_TEST` is a **public
constant**, not a secret. It exists so an operator must opt-in at
process start, not to authenticate the user.

### Live mode safety

- User-supplied `apiKey` is injected into the child `mmx` process
  environment as `MINIMAX_API_KEY=<userKey>`. The site operator's
  `MINIMAX_API_KEY` is explicitly stripped from the child env.
- Provider stdout, stderr, and error messages are passed through
  `redactCliOutput` before being surfaced to the route layer.
- The live env is read once at `loadConfig()` time. A request cannot
  flip live mode mid-flight.

### Final wording (do not weaken)

- Do not claim "user can paste a Key and generate for real today".
- Do not claim "BYOK public launch is open".
- Do not claim "a live MiniMax call has been verified".
- Strongest correct claim: **"BYOK-B 已完成受控 fake/live relay 测试结构，但真实 MiniMax live call 仍未执行。"**

A true broad public BYOK launch should consider `Phase Deploy-CF-D`
Turnstile / abuse control before enabling `BYOK_LIVE_ENABLED=true` for
the public route.

### Key files added/modified in BYOK-B

- `docs/security/BYOK_LIVE_RELAY_TEST_DESIGN.md` (new)
- `server/adapters/minimax-api/byok.ts` (new -- `generateByokMusic` + `isLiveGateOpen` + per-request `MINIMAX_API_KEY` injection + site-operator key stripping)
- `server/index.ts` (extended `handleByokGenerate` with 4-mode state machine: disabled / dry-run / fake / live, plus `byok_live_not_enabled` / `byok_live_confirmation_required` guards)
- `server/types.ts` (+3 fields: `byokDryRunOnly` / `byokLiveEnabled` / `byokLiveConfirmation`)
- `src/features/studio/ByokPanel.tsx` (rewritten -- 12 status code mappings, prompt + musicMode inputs, post-submit clear key)
- `src/features/studio/ByokPanel.module.css` (+ `.textarea` / `.resultHint`)
- `scripts/byok-b-smoke-test.sh` (new, 50+ assertions, `BYOK_B_SMOKE_PASS`)

### Distinction from Phase 5A (admin BYOK)

- Phase 5A operator-BYOK path: site admin sets the operator key in
  `.env` once, the server uses it for all generations. Static,
  privileged, audit-tracked.
- Phase BYOK-B public BYOK path: each request carries a user-supplied
  `apiKey`, used in memory for one request, never persisted. Default
  disabled. Live requires a triple env flag and is intended only for
  one-off operator-confirmed tests.

## Phase BYOK-C: Single Live Call Verification Protocol (delivered)

- **Status**: `PROTOCOL_READY_NO_LIVE_CALL`
- **Operator confirmation**: not provided in this run
- **Live call executed**: **no**
- **Music generated**: **no**
- **User key used**: **no**
- **Site operator key used**: **no**
- **broad public BYOK launch**: **no**
- 详细报告见 `docs/security/BYOK_SINGLE_LIVE_CALL_TEST_REPORT.md`
- 协议验证通过 `scripts/byok-c-smoke-test.sh`

**关键口径**: BYOK-C 已完成单次 live call 的可审计协议与 smoke test,但本轮未提供 operator confirmation,因此未执行真实 MiniMax live call。下一次 operator 给出 `CONFIRM_BYOK_C_SINGLE_LIVE_CALL` 短语后,才能执行真实 live call。

Distinction from Phase 5A (admin BYOK):

- Phase 5A is admin/server-operator level, configured via env at startup
- Phase BYOK-A is public endpoint with per-request user-supplied key
- Both share `byokKeyStorage: memory` policy


---


## Phase 5A: BYOK API Key Mode（已完成）

### 核心文件

| 文件 | 作用 |
|------|------|
| `server/byok-secrets.ts` | BYOK Key 内存存储，job.id → key，TTL 30min |
| `server/index.ts` | BYOK guard，验证 x-minimax-api-key header |
| `server/jobs.ts` | setJobApiKey / clearJobApiKey 接入 |
| `src/features/settings/Settings.tsx` | BYOK 模式 UI |
| `src/features/studio/Studio.tsx` | BYOK key 缺失时禁用/提示 |
| `src/lib/serverApi.ts` | HealthInfo BYOK 字段 |

### 安全模型

- Key 只存 React state（页面内存，刷新清除）
- Key 只存 server 内存 Map（job.id → key，30min TTL）
- 不写 disk / localStorage / sessionStorage / manifest / logs
- `x-minimax-api-key` 用 HTTP header 传递，不在 URL 或 JSON body
- `REAL_GENERATION_ENABLED=false` 时走 mock 安全路径，不要求 key
- `REAL_GENERATION_ENABLED=true` + `BYOK_ENABLED=true` 时必须有 session key
- `SERVER_KEY_FALLBACK=false` 时不使用 server MINIMAX_API_KEY
- 前端禁止把 key 放在 URL query param

### CLI Adapter

CLI Adapter（`mmx music generate/cover`）不使用页面 BYOK key，始终使用 server 本地 mmx auth login 的凭据。

**运行时诊断命令：**
```bash
# 运行时诊断（health + mmx binary + storage，不生成音乐）
bash scripts/cli-backend-diagnostics.sh

# 静态 smoke test（代码完整性，不调 API，可用于 CI）
bash scripts/cli-backend-readiness-smoke-test.sh
```

**systemd Service（Phase CLI-Debug-B）：**
```bash
# 安装
sudo bash scripts/install-systemd-service.sh

# 状态 / 重启 / 停止
sudo systemctl status mmx-music-studio
sudo systemctl restart mmx-music-studio
sudo systemctl stop mmx-music-studio

# 日志
journalctl -u mmx-music-studio -f

# systemd smoke test
bash scripts/systemd-service-smoke-test.sh
```
Unit 文件: `deploy/systemd/mmx-music-studio.service`

### 环境变量

```bash
BYOK_ENABLED=true          # 启用 BYOK 模式
SERVER_KEY_FALLBACK=false # 推荐：不允许回退到 server key
BYOK_KEY_STORAGE=memory    # 仅 memory（当前仅支持）
```

详见 [docs/BYOK_MODE.md](BYOK_MODE.md)。

---

## 推荐后续阶段

| 阶段 | 目标 | 前置条件 |
|------|------|----------|
| **Phase CLI-Debug-A** | **MMX CLI 主链路体检与稳定化** | ✅ PASS |
| **Phase CLI-Debug-B** | **MMX CLI systemd auto-restart（systemd service 已安装并运行）** | ✅ PASS |
| **Phase Product-Polish-E** | **Library 分享链接 / Markdown 导出 / URL deep-link / 移动端 drawer 适配** | ✅ PASS |
| **Phase Product-Polish-F** | **Studio模板组合器 / 场景+情绪+乐器+用途预设 / localStorage 我的模板 / 移动端适配 /灵感示例保留** | ✅ PASS |
| **Phase Release v0.4.8-alpha** | **Prompt templates and style presets release** | ✅ PASS |
| **Phase Product Polish-G** | **Global mini player and playback continuity** | ✅ PASS | App-level currentPlayingTrack, fixed bottom player in Layout, Library and Studio play unified |
| **Phase Release v0.4.9-alpha** | **Global mini player and playback continuity release** | ✅ PASS |
| **Phase Product Polish-H** | **Playback queue: App-level queue state, prev/next buttons, audio ended → next, Library plays filtered list, detail drawer add-to-queue, queue panel with remove/clear, mobile responsive** | ✅ PASS |
| **Phase Release v0.4.10-alpha** | **Playback queue and continuous playback release** | ✅ PASS |
| **Phase Product Polish-I** | **Playback queue persistence: localStorage queue/mode restore on mount, 4 playback modes (sequence/repeat-all/repeat-one/shuffle), throttled progress save/restore, queue item click-to-jump, queue panel mode label** | ✅ PASS |
| **Phase Release v0.4.11-alpha** | **Playback queue persistence and playback modes release** | ✅ PASS |
| **Phase API-Debug-E** | **Async task polling design: polling.ts types, normalizeMiniMaxTaskStatus(), parseAsyncTaskReference(), pollingEndpointConfigured: false, 3 async fixtures (processing/succeeded/failed), Studio async polling error card, async polling design smoke test** | ✅ PASS |
| **Phase Release v0.4.12-alpha** | **API Adapter async polling readiness release** | ✅ PASS |
| **Phase Product Polish-J** | **Public Launch Readiness: Home Launch/Trust/Feedback UX blocks, v0.4.12-alpha badge, Settings backend/BYOK explanation, PUBLIC_RELEASE_READINESS.md, data notes, feedback links** | ✅ PASS |
| **Phase Release v0.4.13-alpha** | **Public launch readiness and trust UX release** | ✅ PASS |
| **Phase Launch Guard-A** | **Public generation guardrails: global pause, per-source daily limit, per-source cooldown, source hash (no raw IP), /api/health guard fields, Studio 3-error UX, Home Trust section, .env.example, systemd smoke, smoke test** | ✅ PASS |
| **Phase Release v0.4.15-alpha** | **Public runtime diagnostics release — /api/status, job queue/storage aggregates, ops monitoring doc, CI** | ✅ PASS |
| Phase Ops-Monitor-A | Public runtime diagnostics: `/api/status`, job queue aggregate, storage aggregate, ops monitoring doc | ✅ 完成 |
| **Phase Release v0.4.16-alpha** | **Storage management dry-run release — storage-maintenance.ts, inventory/retention-dry-run/backup-manifest scripts, STORAGE_POLICY.md, CI** | ✅ PASS |
| Phase Storage-A | Storage management and cleanup | ✅ 完成 |
| **Phase Ops-Monitor-B** | **Read-only operations panel: OpsPanel.tsx, /api/health+status aggregation, launch guard/job queue/storage cards, diagnostic summary with copy, auto-refresh, nav entry, mobile CSS, no sensitive data exposed** | ✅ PASS |
| **Phase Release v0.4.17-alpha** | **Read-only operations panel release — /ops page, CI** | ✅ PASS |
| **Phase Product-Polish-L** | **Collections export, library batch actions, and annotation backup: libraryBackup.ts, batch mode, collection MD/JSON export, local backup panel** | ✅ PASS |
| **Phase Product-Polish-K** | **Tags, notes, and smart collections** | ✅ PASS |

> **Browser localStorage:** Track annotations use `mmx-studio:track-annotations:v1` (tags[], note, updatedAt per trackId). Tags max 12, note max 500 chars. Not synced to server. See `src/lib/trackAnnotations.ts`.

> **Phase Product-Polish-L — localStorage snapshot for backup (`src/lib/libraryBackup.ts`):**
> - `mmx-studio:track-annotations:v1` — annotations map (tags + note per trackId)
> - `mmx-studio:favorites` — array of favorited trackIds
> - `mmx-studio:prompt-templates` — Studio prompt templates
> - `mmx-studio:playback-queue:v1` — playback queue + mode (App.tsx)
> - `mmx-studio:playback-progress:v1` — last position per track (Layout.tsx)
> Backup is browser-local export/import only. Never uploaded to the server. No schema migration. No account sync.

| Phase 4C | 多用户鉴权 + 速率限制 + 每日额度 | ✅ 完成 |
| **Phase 4D** | **任务历史管理后台** | ✅ 完成 |
| Phase 4E | API adapter 生产化 + HTTPS 域名实装 | ✅ 完成 |
| **Phase 5A** | **BYOK API Key 模式** | ✅ 完成 |
| Phase 5B | BYOK 受控真实 API 测试 | 规划 |
| Phase 5C | 小程序 BYOK 策略 | 规划 |
| Phase 6 | 正式 Release v0.4.0-alpha | 规划 |

---

## 安全红线

1. **不提交** `.env`、`真实 API key`、`真实 token`
2. **不触发** 真实生成 unless `REAL_GENERATION_ENABLED=true`（且做好防护）
3. **不裸露** 真实生成公网服务 without auth + rate limit + quota
4. **不覆盖** 用户真实生成的音频文件
5. **不读取** `~/.mmx/config.json` 或 `~/.hermes/.env`

## Phase 4F: Audit Logging and PIN Brute-Force Protection

See [docs/AUDIT_AND_SECURITY_HARDENING.md](docs/AUDIT_AND_SECURITY_HARDENING.md) for details.

---

## Phase Launch Guard-A: Public Generation Guardrails

**Status:** ✅ Completed (v0.4.13-alpha post-merge)

### Core Files

- `server/launch-guard.ts` — guard logic, config builder, state persistence
- `server/index.ts` — guard integration before job creation, `/api/health` guard fields
- `server/types.ts` — `ServerConfig.launchGuard: LaunchGuardConfig`
- `server/audit.ts` — `generation_blocked_by_launch_guard` audit event type

### Protections

| Protection | Config | Default |
|------------|--------|---------|
| Global pause | `PUBLIC_GENERATION_ENABLED=false` | `true` |
| Per-source daily limit | `PER_SOURCE_DAILY_GENERATION_LIMIT` | `5` |
| Per-source cooldown | `GENERATION_COOLDOWN_SECONDS` | `30` |

### Guard Flow

```
checkLaunchGuard(req, config)
  → enabled? no → allow
  → publicGenerationEnabled? no → block (public_generation_paused)
  → daily count >= limit? yes → block (per_source_daily_limit_exceeded)
  → cooldown elapsed? no → block (generation_cooldown_active)
  → all pass → record count+timestamp → allow
```

### Error Codes

- `public_generation_paused` — global generation pause active
- `per_source_daily_limit_exceeded` — source hit daily cap
- `generation_cooldown_active` — source must wait before next generation

### Security Properties

- Source identification uses `getClientKey()` from `rate-limit.ts` (SHA256, never raw IP)
- Guard state stored in `storage/guard/public-generation-guard.json` (gitignored)
- Atomic write: `.tmp` + `rename` — no partial state on crash
- Daily auto-reset at midnight (date-keyed state)
- No raw IPs in guard state, no API keys, no tokens

### /api/health Fields

```json
{
  "launchGuardEnabled": true,
  "publicGenerationEnabled": true,
  "perSourceDailyLimit": 5,
  "generationCooldownSeconds": 30
}
```

### Debug Reset

`GET /api/debug/reset-guard` — only when `DEBUG_RESET_ENDPOINTS=true` (smoke test only, never production).

### What Launch Guard Is NOT

- Not an account system
- Not billing / quota billing
- Not full abuse prevention
- Does NOT affect Library or playback — only `/api/generate`

### Next Phase

Phase Release v0.4.14-alpha — tag, GitHub Release, smoke test CI gate.

---

## Phase 5: BYOK Safety and WeChat Strategy

**Frozen in v0.4.0-alpha.** See [docs/release/RELEASE_NOTES_v0.4.0-alpha.md](docs/release/RELEASE_NOTES_v0.4.0-alpha.md) for full details.

**关键里程碑：**
- Phase 5A: Web BYOK API Key Mode ✅
- Phase 5B-A/B-C: Real API attempt guard ✅
- Phase 5C: WeChat BYOK strategy ✅
- Phase 5E: realApiAttemptsUsed counter fix ✅
|- Phase 5B-D: 真实 MiniMax API 生成 ⏳ PENDING

## Phase API-Debug-B1: Official Contract Alignment

**Frozen in v0.4.1-alpha.** Official MiniMax Music Generation API contract fixture + static alignment.

**关键里程碑：**
- Phase API-Debug-A: Static diagnosis of API Adapter ✅
- Phase API-Debug-B0: Async task response parser + mock contract tests ✅
- Phase API-Debug-B1: Official contract fixtures + alignment ✅
  - 新增 `test-fixtures/minimax-api/` — 4 个 official fixture
  - 确认 endpoint/auth/Content-Type/response shape
  - Parser 完整映射 `extra_info.*` 和 `base_resp.*`
  - `api-adapter-official-contract-smoke-test.sh` 29/29 PASS
- Phase API-Debug-C: 用户确认后单次真实 API 调用 ✅ COMPLETE
  - `job_1780992991977_c9eaaa0c` → succeeded
  - Track `track_1780993112817_yg4g4m` "轻柔钢琴测试音乐" 已写入并可播放
  - Audio endpoint `/api/tracks/{id}/audio` → 200 OK, 4.76 MB
  - Response kind: `direct_audio` (binary → local storage)
  - 详情见 [docs/API_DEBUG_C_REAL_CALL_REPORT.md](docs/API_DEBUG_C_REAL_CALL_REPORT.md)
- Phase API-Debug-E: Async polling design (2026-06-10) ✅
  - `server/adapters/minimax-api/polling.ts` — `MiniMaxAsyncTaskStatus` enum, `normalizeMiniMaxTaskStatus()`, `parseAsyncTaskReference()`
  - `pollingEndpointConfigured: false` — official polling endpoint not confirmed
  - `MINIMAX_API_ASYNC_POLLING_REQUIRED` error code + Studio `async_polling_required` error card
  - 3 async fixtures: processing / succeeded / failed
  - No real polling calls made

**推荐主链路：** Web + MMX CLI backend（`backend=cli`）。API Adapter 已完成一次真实 BYOK 生成验证，但仍为实验性路径。

**查看详情：** [docs/API_ADAPTER_DEBUG_REPORT.md](docs/API_ADAPTER_DEBUG_REPORT.md) | [docs/BYOK_REAL_TEST_PLAN.md](docs/BYOK_REAL_TEST_PLAN.md)

## GitHub Actions CI

CI 自动验证链路稳定性和 BYOK 安全修复，防止后续改动破坏已完成的主链路。

**查看运行状态：** https://github.com/conanxin/mmx-music-studio/actions

**CI 特点：**
- 无需真实 MiniMax key
- CI 不会生成音乐
- 所有 smoke tests 使用 mock 或 `REAL_API_DAILY_ATTEMPT_LIMIT=0` guard
- CI 失败时优先看 typecheck/build/smoke test 输出

详见 [docs/CI_PIPELINE.md](docs/CI_PIPELINE.md)。
