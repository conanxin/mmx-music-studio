# CHANGELOG

All notable changes to mmx-music-studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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