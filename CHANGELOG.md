# CHANGELOG

All notable changes to mmx-music-studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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


## 早期版本说明

v0.1.0-alpha 之前无正式版本记录。