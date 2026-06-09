# MiniMax 音乐创作台 / mmx-music-studio

[![GitHub Repo](https://img.shields.io/badge/GitHub-mmx--music--studio-blue?logo=github)](https://github.com/conanxin/mmx-music-studio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Phase](https://img.shields.io/badge/Phase-v0.4.1--alpha-red.svg)](https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.1-alpha)
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

**Version:** `v0.4.1-alpha` · [Release Notes](https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.1-alpha)

## Current Status

> **推荐主链路**：Web + MMX CLI backend（`backend=cli`）。与 Telegram 生成链路一致，稳定性已验证。

|| 模块 | 状态 | 备注 |
|------|------|------|
| UI | ✅ PASS | |
| Mock generation | ✅ PASS | |
| **MMX CLI backend** | ✅ **推荐** | `backend=cli`，与 Telegram 链路一致 |
| MMX CLI 真实生成 | ✅ PASS | 已验证 |
| MMX API adapter (BYOK) | ⚠️ 实验性 | 研究方向，非生产推荐 |
| Docker 部署 | ✅ PASS | |
| **三种运行模式** | ✅ Phase 4A 新增 | |
| **Systemd 部署模板** | ✅ Phase 4A 新增 | |
| **生产发布检查** | ✅ Phase 4A 新增 | |
| **Job Queue** | ✅ PASS | |
| **Job History Admin** | ✅ PASS | |
| Studio 冷启动播放器 | ✅ Phase CLI-Web-E | 自动加载最新 track |
| Audio duration 显示 | ✅ Phase CLI-Web-F | 从 HTMLAudioElement 读取 metadata |
| **Access Control / Quota** | ✅ PASS | |
| **Audit Logging** | ✅ PASS | |
| **PIN Brute-force Guard** | ✅ PASS | |
| **HTTPS** | ✅ PASS（Caddy + Let's Encrypt） | |
| **域名 ICP 备案** | ⏳ 腾讯云大陆服务器需备案，当前外部访问被拦截 | |
| 微信小程序 | ✅ PASS（scaffold + adapters） | |
| **Web BYOK API Key Mode** | ✅ Phase 5A | sessionStorage + x-minimax-api-key header |
| **WeChat BYOK strategy** | ✅ Phase 5C | key 管理方案已文档化 |
| **Real API attempt guard** | ✅ Phase 5B-C/5E | 计数器在 check 前递增 |
| **CI smoke pipeline** | ✅ Phase 5G | GitHub Actions CI，静态 +独立 mock server |
| **WeApp build in CI** | ✅ Phase WeApp-CI-RootCause-D | deterministic `scripts/weapp-build.mjs` wrapper; blocking gate if wrapper passes; diagnostic issue on failure; `scripts/ci-secret-scan.py` replaces inline grep |
| **API Adapter official contract alignment** | ✅ Phase API-Debug-B1 | official fixtures in `test-fixtures/minimax-api/`; parser aligned with `data.audio`/`extra_info`/`base_resp`; `api-adapter-official-contract-smoke-test.sh` 29/29 PASS; CLI backend recommended, API Adapter preflight complete |
| Real generation in CI | ❌ Disabled | CI 使用 mock / limit=0 guard |
| Secrets required for CI | ❌ None | 无需真实 key/token |

**完整状态与换电脑继续开发指南**：[docs/DEVELOPMENT_HANDOFF.md](docs/DEVELOPMENT_HANDOFF.md)

## Release

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

> ⚠️ Requires cloud security group to open TCP 8787 inbound. If the address is not reachable, open TCP 8787 in your cloud provider's security group settings (Tencent Cloud / Alibaba Cloud / etc.).

### Public Preview API Base

生产预览默认使用 **same-origin API**：

- 打开 `http://<server-ip>:8787` 时，前端自动请求 `http://<server-ip>:8787/api/*`
- **不要**在生产构建中写死 `VITE_API_BASE_URL=http://localhost:8787`（会导致浏览器向用户本机 localhost 发请求）
- 本地开发如果需要可设置 `VITE_API_BASE_URL=http://localhost:8787`
- 不要在环境变量中写入任何真实 Key

---

## 当前状态

| 模块 | 状态 |
|------|------|
| UI | ✅ PASS |
| Mock generation | ✅ PASS |
| MMX CLI adapter | ✅ PASS |
| MMX CLI 真实生成 | ✅ PASS（2次instrumental） |
| MMX API adapter | 🔧 实验性 |
| Docker 部署 | ✅ PASS |
| 微信小程序 | 📋 规划中 |

---

## 当前阶段

**Phase 5A + 5B-A：BYOK API Key 模式** ✅

- ✅ `server/byok-secrets.ts` — Key 内存存储，job.id → key，TTL 30min
- ✅ `server/index.ts` — BYOK guard，验证 x-minimax-api-key header
- ✅ `src/features/settings/Settings.tsx` — BYOK 模式 UI
- ✅ `src/features/studio/Studio.tsx` — key 缺失时禁用/提示
- ✅ `scripts/byok-mode-smoke-test.sh` — 13/13 PASS
- ✅ Phase 5B-A 预检：guard 拦截 ✅ / fake key 安全路径 ✅ / key 不泄露 ✅
- ✅ `docs/BYOK_MODE.md` + `docs/BYOK_REAL_TEST_PLAN.md`
- ✅ 与 Phase 4C Generation Access Gate 正交兼容
- ✅ CLI Adapter 不使用页面 BYOK key

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