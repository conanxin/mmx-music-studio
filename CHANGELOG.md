# CHANGELOG

All notable changes to mmx-music-studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [v0.4.16-alpha] — 2026-06-10

### Highlights

- **Storage management and retention dry-run release** — Phase Storage-A
- Added `server/storage-maintenance.ts` — storage inventory, retention dry-run, backup manifest
- Added `scripts/storage-a-inventory-report.sh` — human-readable inventory summary
- Added `scripts/storage-a-retention-dry-run.sh` — retention dry-run with configurable days (RETENTION_DAYS env var)
- Added `scripts/storage-a-backup-manifest.sh` — lightweight JSON backup manifest to stdout
- Added `docs/STORAGE_POLICY.md` — storage categories, retention proposal, safety rules
- Updated `docs/OPS_MONITORING.md` — storage command reference
- Updated `docs/DEVELOPMENT_HANDOFF.md` and `docs/PUBLIC_RELEASE_READINESS.md` — Storage-A status

### Notes

- No files are deleted by this release — all cleanup logic is dry-run only
- No generation is performed for this release
- Runtime storage is not committed
- Storage-B may add operator-confirmed cleanup later

## [v0.4.15-alpha] — 2026-06-10

### Highlights

- **Public runtime diagnostics release** — Phase Ops-Monitor-A
- Added `GET /api/status` — public-safe runtime status endpoint
- Added `server/runtime-status.ts` — aggregates backend + launchGuard + jobQueue + storage
- Added job queue aggregate: pending, running, succeeded, failed
- Added storage aggregate: track count, audio file count, approximate audio bytes
- Added `docs/OPS_MONITORING.md` — ops monitoring guide
- Added `scripts/ops-monitor-a-smoke-test.sh` (27 assertions)
- Updated Home Trust copy with runtime status note
- Updated public release readiness docs

### Notes

- No generation is performed for this release
- `/api/status` avoids raw IP, sourceHash, prompt, token, raw logs, and absolute paths
- This is observability for public alpha operations, not a full admin dashboard
- CLI backend remains the recommended default path

## [v0.4.14-alpha] — 2026-06-10

### Highlights

- **Protected public generation release** — Phase Launch Guard-A
- Added public generation guardrails: global pause, per-source daily limit, generation cooldown
- Added `server/launch-guard.ts` — hashed source guard state, atomic writes, daily reset
- Added `/api/health` guard fields: `launchGuardEnabled`, `publicGenerationEnabled`, `perSourceDailyLimit`, `generationCooldownSeconds`
- Added Studio guardrail error states: `public_generation_paused`, `per_source_daily_limit_exceeded`, `generation_cooldown_active`
- Added Home / Trust generation protection copy
- Added `scripts/launch-guard-a-smoke-test.sh` (31 assertions)
- Updated systemd service and `scripts/systemd-service-smoke-test.sh` for Launch Guard settings
- Updated `.env.example` with 4 Launch Guard variables
- Updated `README.md`, `docs/DEVELOPMENT_HANDOFF.md`, `docs/PUBLIC_RELEASE_READINESS.md`

### Notes

- No generation is performed for this release
- Guard only protects `/api/generate`; Library and playback remain available
- Source identification uses SHA256 hashing — raw IP addresses are never stored
- This is a lightweight public alpha guardrail, not a full account system

## [v0.4.13-alpha] — 2026-06-10

### Highlights

- **Public launch readiness release** — trust UX for first-time visitors
- Added Public Alpha launch readiness section on Home with 4 cards: Real Generation / Library / Local Experience / Experimental Capabilities
- Added Trust and Data Notes: browser localStorage data, server-side track records, BYOK API key handling, alpha limitations
- Added Feedback and Version section: release badge, GitHub Issues, GitHub repository, Release Notes links
- Updated Home status card version to `v0.4.12-alpha`
- Added responsive layout for launch / trust / feedback sections (639px single column, 389px full width)
- Added `docs/PUBLIC_RELEASE_READINESS.md`
- Added `scripts/product-polish-j-smoke-test.sh` (31 assertions)

### Notes

- No generation is performed for this release
- CLI backend remains the recommended default path
- BYOK API Adapter remains experimental
- This remains an alpha release

## [v0.4.12-alpha] — 2026-06-10

### Highlights

- **API Adapter async polling readiness release** — prepares codebase for future async MiniMax responses
- Added `server/adapters/minimax-api/polling.ts` with `normalizeMiniMaxTaskStatus()` and `parseAsyncTaskReference()`
- Added `pollingEndpointConfigured: false` — explicit design flag
- Added defensive async task mock fixtures: `processing`, `succeeded`, `failed`
- Studio error card now shows "需要任务轮询" for `async_polling_required` errors
- Added async polling design smoke test (25 assertions)
- Documentation updated: polling endpoint is not confirmed, no polling is called

### Notes

- No generation is performed for this release
- No real polling endpoint is called
- CLI backend remains the recommended default path
- BYOK API Adapter remains real-call verified but experimental

## [v0.4.11-alpha] — 2026-06-10

### Highlights

- **Playback queue persistence release** — queue survives page refresh via browser localStorage
- Browser-local playback queue storage (`mmx-studio:playback-queue:v1`)
- Browser-local playback progress memory (`mmx-studio:playback-progress:v1`)
- Four playback modes: `sequence`, `repeat-all`, `repeat-one`, `shuffle`
- Queue panel mode label (顺序 / 列表循环 / 单曲循环 / 随机) and clickable queue items
- Audio ended behavior now respects playback mode
- Mobile queue panel polish (70vh max-height on small screens)

### Notes

- No generation is performed for this release — pure UX/stability release
- Queue and progress are **localStorage-only** — no cross-browser/cross-device sync
- CLI backend remains the recommended default path; BYOK API Adapter remains experimental

## [v0.4.9-alpha] — 2026-06-10

### Highlights

- **Global mini player and playback continuity release** — Library and Studio share a unified current-playing-track state at the App level
- **Global mini player** — fixed bottom bar appears when a track is playing, persists across page navigations
- **App-level `currentPlayingTrack` state** — `src/App.tsx` holds `useState<GlobalPlayerTrack | null>`, propagated to Layout / Studio / Library via props
- **Library play → global player** — card and detail drawer play buttons call `onSetPlayingTrack(itemToGlobal(track))` instead of creating independent Audio instances
- **Studio → global player** — generation success points (mock, polling, mock flow) call `onSetPlayingTrack(displayToGlobal(display))`
- **Bottom fixed player controls** — play/pause, download, close, "View Library" shortcut
- **Mobile bottom player polish** — compact layout, icon-only Library shortcut, `padding-bottom: 60px` on `.main`

### Notes

- No generation is triggered for this release — pure UX/stability release
- Global player state is **client-side only** — browser session, not persisted
- CLI backend remains the recommended default path; BYOK API Adapter remains experimental

## [v0.4.8-alpha] — 2026-06-09

### Highlights

- **Prompt templates and style presets release** — Studio gains a structured template composer
- **New Studio "🎵 模板组合器"** — collapsible panel below the prompt textarea
- **Four preset groups**:场景 (8 options), 情绪 (8 options), 乐器 (8 options), 用途 (8 options)
- **One-click "应用到描述"** — selects one chip per group, composes a natural-language prompt, fills the textarea
- **Composed prompt remains fully editable** — user reviews before submitting generation
- **Browser-local custom templates** — save current prompt as a named template in `localStorage` (`mmx-studio:prompt-templates`)
  - Up to 20 templates per browser
  - Re-apply or delete saved templates
  - Duplicate / empty / cap-limit cases show inline error messages
- **Existing "示例灵感" chips preserved** — complementary, not a replacement
- **Mobile template layout polish** — chips wrap, buttons stack to full-width, input/save row reflows to single column

### Notes

- Applying a template preset does **not** trigger music generation — user reviews and submits manually
- Templates are `localStorage`-only — no cloud sync, cleared if browser data is cleared
- CLI backend remains the recommended default path; BYOK API Adapter remains experimental

## [v0.4.7-alpha] — 2026-06-09

### Highlights

- **Track sharing and export polish release** — Library detail drawer gains share link and Markdown export actions
- **Copy share link** — button copies `https://music.conanxin.com/library?track=<trackId>` to clipboard with toast confirmation
- **Deep-link track drawer** — `/library?track=<trackId>` URL param auto-opens the corresponding detail drawer on page load
- **Copy Markdown track info** — "导出" button copies track title, source, duration, created time, Track ID, download URL, and prompt as Markdown
- **Copy Track ID and prompt** — existing copy buttons retained in detail drawer
- **Mobile drawer action layout** — 639px: 2-column grid; 389px: single-column stack; bottom-sheet on all mobile sizes
- **Safe title-based download filename** — server-side `Content-Disposition` uses track title with safe characters only

### Notes

No new generation or quota consumption in this release. CLI backend remains the recommended default path. Favorites remain browser-local.

## [v0.4.6-alpha] — 2026-06-09

### Highlights

- **Stable public deployment release** — app is now publicly reachable through Cloudflare Tunnel and runs as a systemd service
- **Cloudflare Tunnel public access verified** — `https://music.conanxin.com` live and routing to `127.0.0.1:8787`
- **Node server installed as systemd service** — `mmx-music-studio.service`, `enabled` at boot, `Restart=always`, 50/day generation limit
- **CLI backend diagnostics added** — `cli-backend-diagnostics.sh` (13 runtime checks) and `cli-backend-readiness-smoke-test.sh` (26 static checks)
- **systemd helpers added** — unit file template, install script, smoke test script
- **README / handoff / deployment docs updated** — all documentation reflects systemd-managed deployment

### Notes

CLI backend remains the recommended default path. No new generation or quota consumption in this release. Cloudflare Access remains optional and not yet enabled.

## [v0.4.5-alpha] — 2026-06-09

### Highlights

- **Public landing and onboarding polish** — redesigned homepage for first-time visitors arriving at the live public URL
- **New homepage hero** — "MMX Music Studio" title with live-status badge ("公网已启用 · 推荐 MMX CLI 模式") and green indicator dot
- **Quick Start 3-step onboarding** — visual guide: write description → click generate → play/download/favorite
- **Status cards** — live card showing public URL, recommended backend, current version, and BYOK API status
- **Capability cards** — four cards for Studio / Library / BYOK / Cloudflare Tunnel with icons and descriptions
- **Navigation polish** — "首页" nav item added; logo links back to homepage; active state highlighting
- **Footer polish** — Release Notes link to GitHub CHANGELOG
- **Mobile homepage responsive** — dual breakpoints at 639px and 389px; capability cards 2-column at 639px, single-column at 389px; CTA buttons full-width at 389px

### Notes

CLI backend remains the recommended default path. No real generation or quota consumption in this release. BYOK API Adapter remains verified once (v0.4.2-alpha) and experimental.

## [v0.4.4-alpha] — 2026-06-09

### Highlights

- **Studio generation flow polish** — 4-step phase messages (creating task → calling backend → waiting audio → saving to library)
- **Prompt guidance** — empty-field hint: "描述场景、情绪、乐器或用途，生成效果会更稳定。"
- **Example chips replace (not append)** — prevents prompt pollution from repeated clicks
- **Success card** — green card with play / download / go-to-library / continue-creating actions; triggers on job completion
- **Error classification card** — 6-type classifier (BYOK missing / quota exceeded / API error / async required / network / unknown); per-type title + hint + recovery actions
- **Mobile state card polish** — all state cards properly styled at 390px, no overflow

### Notes

CLI backend remains recommended default. BYOK API Adapter remains experimental. No new generation calls performed for this release.

### Highlights

- **Public UX polish release** — Studio and Library UX significantly improved after public URL went live at `https://music.conanxin.com`
- **Cloudflare Tunnel public URL verified** — `music.conanxin.com` → `127.0.0.1:8787` live; SSH Tunnel no longer required for normal access
- **Studio prompt example chips** — 6 clickable inspiration chips below the prompt textarea; click appends to prompt without triggering generation
- **Productized runtime mode labels** — status bar shows `MMX CLI 模式` / `BYOK API 模式` / `API 实验模式` / `本地预览` instead of raw technical strings
- **API warnings gated to API backend** — `⚠️ 会消耗额度` / `真实测试剩余 N 次` hidden when `backend === 'cli'`
- **Library search** — full-text search across title, prompt, lyrics, source, and mode; combines with source filters
- **Library favorites** — browser-local star/unstar via `localStorage`; dedicated Favorites filter tab with count badge
- **Track detail drawer** — right-side panel with title, source, mode, duration, format, Track ID (copyable), prompt, lyrics, and action buttons
- **Copy prompt / Copy Track ID** — one-click copy with 2-second toast confirmation
- **Mobile bottom-sheet detail view** — detail drawer becomes a bottom sheet on 390px screens
- **README table rendering fixed** — `||` double-pipe prefix replaced with `|`; long table split into 4 focused tables
- **Cloudflare Tunnel deployment documented** — `docs/CLOUDFLARE_TUNNEL_DEPLOYMENT.md` + helper script created

### Backend

- CLI backend remains recommended default (`MINIMAX_BACKEND=cli`, `REAL_GENERATION_ENABLED=true`)
- BYOK API Adapter: verified once in v0.4.2-alpha; still experimental
- No real generation performed for this release

### Safety

- No automatic generation during release prep
- No additional MiniMax quota consumed
- No API key/token printed in logs or committed
- Favorites are `localStorage`-only (no server persistence)

### Known Limitations

- Cloudflare Access not enabled — `music.conanxin.com` is open to public internet
- Favorites are browser-local only — clearing browser data erases them
- Async API task polling (`task_id` response) unconfirmed

---

## [v0.4.2-alpha] — 2026-06-09

### Highlights

- **API Adapter real BYOK generation succeeded** — one controlled real MiniMax API call completed via Web UI → BYOK → API Adapter path on 2026-06-09; `job_1780992991977_c9eaaa0c` → `track_1780993112817_yg4g4m` "轻柔钢琴测试音乐"; response kind `direct_audio`; audio endpoint `200 OK` (4.76 MB); key never in logs/disk
- **Studio BYOK submit diagnostics** — submit disabled reason diagnostic card shows exact condition blocking generation ("请先输入 BYOK Key" / "✅ 可点击" / "真实 API 测试次数已用完" / "本地每日生成保护次数已用完")
- **dailyQuotaEnabled guard fix** — Studio guards for daily quota now correctly check `dailyQuotaEnabled === true` before applying `remainingDailyGenerations <= 0`; was causing false "本地每日生成保护次数已用完" block when `dailyQuotaEnabled=false`
- **API Adapter status updated** — now documented as "experimental, one real success" rather than "unvalidated"; CLI backend remains recommended default

### Safety

- No automatic generation during release prep
- No additional MiniMax quota consumed
- No API key/token printed in logs or committed
- BYOK key entered only via Web UI Settings (never in chat)

### Known Limitations

- API Adapter still marked experimental — one controlled success does not claim production multi-user readiness
- Async polling path (for `task_id` responses) is defensive only; polling endpoint not confirmed from MiniMax
- `hex_audio` path has fixture/contract test but no real call yet

---

## [0.4.1-alpha] — 2026-06-09

### Highlights

- **Web CLI backend is now the recommended main path** — Web 生成可以使用与 Telegram/Hermes CLI 相同的 MMX CLI 路由
- **Studio player cold-start hydration** — 页面加载时自动从 `listTracks()` 获取最新可播放 track，无需用户手动操作
- **Studio player handoff after generation** — 生成完成后 handoff 携带 track audio/download URL，解决播放器无音频可放的 bug
- **Audio duration display from metadata** — WaveformPlayer 监听 `loadedmetadata` 事件从 HTMLAudioElement 读取真实时长，移除 `?:??` 硬编码
- **cli-web-readonly-smoke-test.sh** — 综合只读 smoke test，覆盖 backend=cli、tracks、audio/download、duration、hydration
- **Documentation clarifies backend paths** — 明确区分 MMX CLI backend（推荐主链路）vs API Adapter / BYOK API（实验性研究路径）

### Safety

- No automatic generation during release checks
- No MiniMax quota consumed during release prep
- No generated audio committed
- No .env committed
- No API keys, PINs, or tokens committed

### Known Limitations

- API Adapter / BYOK API remains experimental
- Successful real MiniMax API Adapter generation is not claimed in this release
- Tencent Cloud mainland custom domain still requires ICP recordal
- For personal self-hosted usage, MMX CLI backend is the recommended path

### Added

- **Studio hydration useEffect** — `Studio.tsx` 冷启动优先调用 `listTracks()`，fallback 到 `listJobsFiltered()`
- **Player handoff with track metadata** — Studio 生成完成后通过 `playerHandoff()` 传递完整 track 对象
- **WaveformPlayer duration from HTMLAudioElement** —监听 `loadedmetadata`，依赖数组加入 `duration`
- **cli-web-readonly-smoke-test.sh** — 20-case read-only smoke test for Web CLI path
- **studio-initial-player-hydration-smoke-test.sh** — 15-case Studio hydration smoke test
- **studio-player-handoff-smoke-test.sh** — 17-case Studio handoff smoke test
- **audio-duration-display-smoke-test.sh** — 11-case audio duration display smoke test

### Changed

- **Studio.tsx** — 移除 3 处 `'?:??'` 硬编码 duration fallback，改为 `durationText?: string`
- **Library.tsx** — 移除 2 处 `'?:??'` 硬编码 duration fallback，改为 `durationText?: string`
- **WaveformPlayer.tsx** — 添加 `loadedmetadata` 事件监听，`duration` 加入 useEffect 依赖数组

### Documentation

- **README.md** — 更新版本至 v0.4.1-alpha，标注 MMX CLI backend 为推荐主链路
- **docs/MINIMAX_BACKEND_DIAGNOSIS.md** — 新增 Post-CLI-Web-G 状态章节，记录完整修复链
- **docs/BYOK_MODE.md** —明确 CLI 为推荐主链路、BYOK 为实验性研究方向
- **docs/DEVELOPMENT_HANDOFF.md** — 更新 backend 表格，标注 `backend=cli` 为主链路

## [0.4.0-alpha] — 2026-06-08

### Highlights

- **Web BYOK API Key Mode completed** — 用户可在页面输入 Key，存储于 sessionStorage，经 `x-minimax-api-key` header 传给后端
- **WeChat Mini Program BYOK strategy completed** — 小程序端 `WEAPP_BYOK_STRATEGY.md` 明确了 key 管理方案
- **Real API attempt guard added** — `REAL_API_ATTEMPT_LIMIT_ENABLED=true` 时，阻止超过 `REAL_API_DAILY_ATTEMPT_LIMIT` 的真实 API 调用
- **realApiAttemptsUsed counter observability fixed** — `reserveRealApiAttempt()` 在 `checkRealApiAttemptLimit()` 之前调用，确保 counter 每次都递增
- **BYOK real test postmortem documented** — 记录了 guard 拦截 3 次真实 API attempt 的测试结果
- **BYOK safety smoke tests added** — 覆盖 BYOK 模式、guard、job queue、auth quota、job history、web API、weapp audio URL

### Added

- **Web BYOK API Key Mode** — `src/features/settings/Settings.tsx` + `server/api/key.ts`，sessionStorage + `x-minimax-api-key` header
- **WeChat BYOK strategy** — `docs/WEAPP_BYOK_STRATEGY.md` + `apps/weapp/src/adapters/request.ts`
- **Real API attempt guard** — `server/rate-limit.ts` `RealApiAttemptGuard` 类，`server/jobs.ts` 中集成
- **BYOK real test plan** — `docs/BYOK_REAL_TEST_PLAN.md`，明确测试窗口、limit 配置、人工确认步骤
- **BYOK real test postmortem** — `docs/BYOK_REAL_TEST_POSTMORTEM.md`，记录 guard 拦截事件和教训
- **Smoke tests** — `scripts/byok-mode-smoke-test.sh` (13 cases), `scripts/real-api-attempt-guard-smoke-test.sh` (13 cases), `scripts/reserve-real-api-attempt-test.sh` (5 cases)
- **`realApiAttemptsUsed` / `remainingRealApiAttempts` health fields** — `/api/health` 暴露 counter 状态
- **Generation Access Gate** — `server/auth.ts`，可选 PIN 保护真实生成功能
- **Audit logging** — `server/audit.ts`，记录所有关键操作
- **Job history admin API** — `GET/DELETE/POST /api/jobs/:id`，`GET /api/jobs/stats`

### Fixed

- **realApiAttemptsUsed counter** — `server/jobs.ts` 中 `reserveRealApiAttempt()` 移到 `checkRealApiAttemptLimit()` 之前调用，确保每次真实 API 路径都 +1

### Safety

- BYOK keys 通过 `x-minimax-api-key` header 传递，不写入 URL、JSON body、manifest、audit logs 或磁盘
- BYOK keys 按 job id 存储在内存中，job 完成后立即清除
- Real API attempt guard 防止在测试窗口内重复调用真实 API
- Mock / CLI / API runtime modes 完全隔离
- 无真实 keys 提交，无生成音频提交，无 .env 提交

### Known Limitations

- **BYOK 真实 MiniMax API 音频生成尚未成功通过** — 最新测试被 real API attempt guard 正确拦截，未能调用 MiniMax API
- **下次真实测试建议** — `REAL_API_DAILY_ATTEMPT_LIMIT=3` + 前端防抖 + 人工确认窗口
- **API Adapter 仍为实验性**
- **ICP 备案尚未完成**，国内腾讯云自定义域名公网访问受限

### Removed / Changed

- N/A

## [0.3.1-alpha] — 2026-06-08

### Added

- **BYOK real API test postmortem** — `docs/BYOK_REAL_TEST_POSTMORTEM.md`，复盘 Phase 5B-B 真实 API 测试失败原因和修复
- **Real API attempt guard smoke test** — `scripts/real-api-attempt-guard-smoke-test.sh`，13 个测试用例验证 guard 逻辑
- **Hardened BYOK test safety documentation** — `docs/BYOK_REAL_TEST_PLAN.md` 更新，明确限制和已知限制

### Fixed

- **Real API attempt guard** — `server/rate-limit.ts` 新增 `RealApiAttemptGuard` 类，阻止 `REAL_API_DAILY_ATTEMPT_LIMIT=0` 时的真实 API 调用
- **Guard placement** — guard 在 `server/jobs.ts` 的 `executeApiJob` worker 中阻止，不在 API handler 中阻止（job 创建成功但立即失败）

### Known Limitations

- `realApiAttemptsUsed` 计数器在 guard 拦截时不递增（Phase 5D 计划修复）
- Guard 在 worker 中阻止，job 会被创建然后标记为 failed，而非在 handler 层拒绝

## [0.1.0-alpha] — 2026-06-07

### Added

#### 功能 / Features
- **中文 UI 原型** — 创作台、作品库、设置、文档页，响应式布局（移动端优先）
- **Mock 生成模式** — 本地模拟音频，无需 API Key，安全演示
- **API Adapter（实验性）** — 直接调用 MiniMax API，适合 BYOK 场景
- **MMX CLI Adapter** — 通过 `mmx` CLI 生成真实音乐，已验证成功
- **真实 CLI 生成验证** — 2 次成功生成（7.3MB + 6.2MB MP3）
- **作品库** — 试听、下载、删除历史作品
- **Manifest 管理** — `manifest-audit.ts` / `manifest-fix.ts` 审计和修复脚本
- **Docker 部署** — Dockerfile + docker-compose.yml
- **微信小程序准备文档** — MINIPROGRAM-READY.md

#### 项目基础设施 / Project Infrastructure
- **Monorepo 结构** — `packages/core`、`packages/adapters`、`packages/ui-tokens`
- **TypeScript** — 全链路类型安全
- **Vite 构建** — 220KB JS 生产构建
- **发布前检查脚本** — `scripts/release-check.sh`（11 项检查）
- **烟雾测试套件** — config / server / web-api / CLI adapter / track 验证

### 安全特性 / Security
- **默认安全模式** — `REAL_GENERATION_ENABLED=false`，不消耗额度
- **不保存 API Key** — sessionStorage 仅存内存
- **禁止日志打印 Key** — `Ed()` 函数脱敏 Authorization header
- **.gitignore 保护** — 排除 `.env`、真实音频文件
- **Secret scan** — release-check.sh 内置敏感信息扫描

### 文档 / Documentation
- `README.md` — 项目介绍、快速开始、当前状态
- `docs/PRODUCT.md` — 产品目标、用户画像、MVP 功能范围
- `docs/UI-SPEC.md` — 中文 UI 设计规范（色彩、字体、组件）
- `docs/ARCHITECTURE.md` — 技术架构、monorepo 结构、小程序迁移策略
- `docs/MINIPROGRAM-READY.md` — 微信小程序迁移路径、adapter 设计
- `docs/SECURITY.md` — 安全设计决策、key 管理模式
- `docs/DEPLOYMENT.md` — 部署指南（本地/Docker/生产）
- `docs/CLI-ADAPTER.md` — MMX CLI Adapter 详细说明
- `docs/PHASE_2D_REAL_CLI_GENERATION_REPORT.md` — 真实生成实验报告
- `docs/RELEASE_CHECKLIST.md` — 28 项发布前检查清单
- `CONTRIBUTING.md` — 贡献指南
- `.env.example` — 环境变量模板（占位符）

### 已知限制 / Known Limitations

- API Adapter 为实验性，稳定性和错误处理待完善
- 微信小程序尚未实现（仅文档规划）
- CLI 真实生成需要服务器已安装并登录 `mmx`
- 公共部署需自行添加用户认证和额度限制

---

## [0.2.0-alpha] — 2026-06-08

### Added

#### 任务系统 / Job System
- **Job Queue 异步任务队列** — 提交任务 → 后台异步处理 → 轮询状态 → 完成通知
- **任务取消** — `POST /api/jobs/:id/cancel`，运行中任务可取消
- **Job History Admin 任务历史管理** — 列表、筛选、详情、删除、重试
- **任务统计面板** — `GET /api/jobs/stats`，总计/队列中/运行中/成功/失败/繁忙/队列长度
- **Job 详情侧边栏** — 生成时间、模式、后端、prompt、trackId、操作按钮

#### 访问控制 / Access Control
- **Preview Access Gate** — HMAC Cookie 锁，PIN 保护预览模式，`PREVIEW_ACCESS_PIN` 环境变量
- **Generation Access Gate** — 生成保护模式，HMAC Cookie 解锁，`GENERATION_ACCESS_PIN` 环境变量
- **PIN Hash 验证** — SHA256(PIN + cookieSecret)，防止 PIN 明文泄露
- **双重访问保护** — Preview Gate + Generation Gate 分层防护

#### 限流与额度 / Rate Limiting & Quota
- **Basic Rate Limiting** — `RATE_LIMIT_WINDOW_MS` + `RATE_LIMIT_MAX_REQUESTS`，内存计数
- **Daily Generation Quota** — `DAILY_QUOTA_MAX_GENERATIONS`，每日生成上限
- **Quota 持久化** — `storage/quota/daily.json` 每日配额计数
- **队列超额拒绝** — 配额用尽返回 429，包含剩余可用时间

#### Web UI 增强 / Web UI Enhancements
- **生成进度状态** — queued → running → succeeded/failed，实时 UI 反馈
- **任务历史页面 `/jobs`** — 统计卡片 + 筛选标签 + 任务列表 + 详情面板
- **导航栏任务入口** — 新增「任务」导航项
- **创作台任务链接** — Studio 页面增加「查看任务历史」入口
- **设置页任务统计** — 显示任务总数和成功/失败计数

#### 微信小程序 / WeChat Mini Program
- **Phase 4C 类型更新** — HealthInfo 扩展 `generationAccessUnlocked` 字段
- **Phase 4D API 同步** — `listJobsFiltered`/`deleteJob`/`retryJob`/`getJobStats` 小程序端支持
- **Phase 4D UI 同步** — Job History Admin 小程序端 API 端点对接

#### 部署与运维 / Deployment & Operations
- **运行时模式增强** — `deriveRuntimeMode()` 支持 generationAccessUnlocked
- **生产环境锁模式** — `.env.production-locked.example` 完整配置模板
- **开发交接文档** — `DEVELOPMENT_HANDOFF.md` 详细开发状态和下一步

#### 安全加固 / Security Hardening
- **HMAC Cookie 安全** — 不可预测的 cookie 签名，防篡改
- **PIN 暴力破解防护** — 无锁定机制（生产环境建议加 Redis 计数）
- **Secret scan 增强** — 多 `grep -qF` 模式，避免正则假阳性
- **任务历史安全** — 删除/重试操作权限校验

### Security
- `.gitignore` 忽略 `storage/quota/*.json`（运行时额度数据）
- `storage/quota/.gitkeep` 确保目录结构存在
- Phase 4C/4D 所有 API 不打印 Authorization header
- `GENERATION_ACCESS_PIN` 明文不在日志中出现

### Known Limitations
- API Adapter 仍为实验性，真实 API 生成未完全稳定
- 暂无多用户账户系统
- HTTPS 域名实装待 Phase 4E
- 微信小程序正式上线需完成法律域名备案

---

## [0.3.0-alpha] — 2026-06-08

### Added

#### HTTPS 部署完成 / HTTPS Deployment
- **生产 HTTPS 地址** — https://music.conanxin.com
- **Caddy 反向代理** — HTTP → HTTPS 自动重定向，安全响应头（CSP/HSTS/X-Frame-Options 等）
- **Server 安全监听** — 强制 `127.0.0.1:8787`，仅允许本地代理访问
- **Caddyfile 模板** — `deploy/Caddyfile.example`，开箱即用配置模板
- **Nginx 配置模板** — `deploy/nginx.mmx-music-studio.conf.example`
- **本地安全启动脚本** — `scripts/run-local-behind-proxy.sh`
- **域名就绪检查脚本** — `scripts/domain-readiness-check.sh`
- **HTTPS 部署完整文档** — `docs/HTTPS_DOMAIN_DEPLOYMENT.md`

#### 安全加固 / Security Hardening（Phase 4F）
- **Audit Logging 审计日志** — `server/audit.ts`，13 种事件类型，JSONL 持久化
- **PIN Brute-force Guard** — `server/auth-guard.ts`，错误 N 次后锁定 M 分钟，返回 429
- **Audit API** — `GET /api/audit/stats`（统计）、`GET /api/audit/events`（事件列表）
- **Health 审计字段** — `/api/health` 新增 `auditLogEnabled`、`authGuardEnabled`、`authGuard` 详情
- **敏感信息过滤** — 审计日志自动过滤 PIN/API key/Authorization/原始 IP
- **clientHash 匿名化** — 使用 SHA256(IP) 前16字符，不保存原始 IP
- **Settings 安全审计面板** — 查看审计状态、解锁统计、拦截统计

#### 部署基础设施 / Deployment Infrastructure
- **Docker HTTPS 支持** — `docker-compose.yml` 包含 port 80/443 映射
- **Caddy 自动 HTTPS** — Let's Encrypt 自动签发证书
- **.env.proxy.example** — 17 个 HTTPS/代理相关环境变量模板

#### 安全默认策略 / Security Defaults
- Real Generation 默认关闭
- Audit Logging / Auth Guard / Rate Limit / Daily Quota 均可选启用
- PIN / API key / Authorization 绝不写入日志或提交 git

### Security
- `storage/audit/*.jsonl` 不提交 git（`.gitignore` 保护）
- `storage/audit/.gitkeep` 保持目录结构
- `.env.example` 新增 6 个 Phase 4F 环境变量（均为占位符）
- Phase 4 全阶段 secret scan 持续 CLEAN
- 无原始 IP、API key、Authorization header、PIN 明文泄露

### Known Limitations
- 多用户系统未实现（单机自用场景）
- Redis 未集成（PIN Guard 为内存存储，重启清零）
- 微信正式发布需在微信公众平台配置 `https://music.conanxin.com` 为合法域名


## [0.3.0-alpha] — 2026-06-08

### Highlights

- **HTTPS 域名部署就绪** — Caddy + Let's Encrypt 技术链路完成，`music.conanxin.com` HTTPS 正式可用（待 ICP 备案后公开访问）
- **腾讯云备案拦截文档** — 记录大陆服务器域名需 ICP 备案 / 接入备案的技术原因和解决方案
- **Cloudflare Tunnel 临时预览** — 开发阶段临时 HTTPS 公开访问，无需 ICP 备案
- **BYOK API Key 模式** — 后端核心、UI、smoke tests、文档全部完成
- **BYOK 真实测试预检** — Phase 5B-A 不调用真实 API 的预检流程完成
- **Real API Attempt Guard** — Phase 5B-C 新增，每次真实 API 调用前计数，超限直接拦截
- **Job Queue / Job History / Access Control** — 继承自 v0.2.0-alpha，全部稳定
- **微信小程序 Mock API + 音频播放 + 下载 Adapters** — scaffold 完整，DevTools 可导入

### Added

#### 安全防护 / Security
- **Real API Attempt Guard** — `storage/quota/real-api-attempts.json` 独立统计，每天最多 N 次真实 MiniMax API 调用，超限直接 failed，不发出网络请求
- **BYOK Key 内存模式** — 用户 key 仅存内存，会话结束即清除，不写磁盘
- **generationAccessUnlocked** — 生成访问 Cookie 双重保护（HMAC 签名 + 时间戳验证）
- **attempt guard 健康字段** — `/api/health` 新增 `realApiAttemptLimitEnabled`、`realApiDailyAttemptLimit`、`realApiAttemptsUsed`、`remainingRealApiAttempts`

#### 文档 / Documentation
- **docs/ICP_RECORDAL_AND_TEMP_ACCESS.md** — 腾讯云备案拦截根因 + 5 种临时访问方案
- **docs/CLOUDFLARE_TUNNEL_PREVIEW.md** — Cloudflare Tunnel 临时 HTTPS 预览完整指南
- **docs/BYOK_REAL_TEST_PLAN.md** — BYOK 真实测试计划（attempt guard / 禁止条件 / 测试后检查）
- **docs/BYOK_REAL_TEST_POSTMORTEM.md** — Phase 5B-B 事故复盘报告

#### 部署基础设施 / Deployment Infrastructure
- **Caddy HTTPS 技术配置** — `/etc/caddy/Caddyfile` 已配置 `music.conanxin.com` 反向代理，Let's Encrypt 证书自动签发
- **deploy/Caddyfile.example** — Caddy 反代模板（含安全头）
- **deploy/Caddyfile.safe-preview.example** — Caddy safe-preview 模式模板
- **deploy/nginx.mmx-music-studio.conf.example** — Nginx 反代模板（80→443 重定向）
- **scripts/run-local-behind-proxy.sh** — 仅监听 127.0.0.1 的安全 server 启动脚本
- **scripts/domain-readiness-check.sh** — 端口/DNS/HTTPS 就绪检查脚本
- **scripts/real-api-attempt-guard-smoke-test.sh** — Attempt Guard 专项 smoke test（12,494字节）

### Security
- Real Generation 默认关闭（`realGenerationEnabled=false`）
- backend=mock 时不触发任何真实 API 调用
- BYOK key 内存存储，不写磁盘
- `storage/quota/real-api-attempts.json` 不提交 git
- 无 API key / Authorization header / PIN 明文泄露
- Secret scan 持续 CLEAN

### Known Limitations
- `music.conanxin.com` 公开访问需完成 ICP 备案 / 腾讯云接入备案（当前被 webblock 拦截）
- Cloudflare Tunnel URL 每次重启变化，仅适合开发测试临时预览
- BYOK 真实 MiniMax API 测试尚未完成（待 ICP 备案后执行）
- MiniMax API Adapter 仍为实验性
- 多用户账号系统未实现


## 早期版本说明

v0.1.0-alpha 之前无正式版本记录。