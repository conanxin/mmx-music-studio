# MiniMax 音乐创作台 / mmx-music-studio

[![GitHub Repo](https://img.shields.io/badge/GitHub-mmx--music--studio-blue?logo=github)](https://github.com/conanxin/mmx-music-studio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Phase](https://img.shields.io/badge/Phase-0.1.0--alpha-red.svg)](https://github.com/conanxin/mmx-music-studio/releases)

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

**Phase 2F：Docker 部署与 GitHub Release 准备** ✅

- ✅ Dockerfile（多阶段构建，默认安全模式）
- ✅ docker-compose.yml（默认安全模式）
- ✅ .dockerignore
- ✅ `docs/DEPLOYMENT.md`（本地/Docker/生产部署指南）
- ✅ `CONTRIBUTING.md`（贡献指南）
- ✅ `CHANGELOG.md`（版本记录）
- ✅ `docs/release/RELEASE_NOTES_v0.1.0-alpha.md`（发布说明）
- ✅ `docs/OPEN_SOURCE_CHECKLIST.md`（开源检查清单）
- ✅ `scripts/release-check.sh`（11 项发布前检查）

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
| Phase 3 | 微信小程序（Taro / uni-app） | 📋 规划 |
| Phase 4 | API Adapter 完善（稳定性、错误处理） | 📋 规划 |
| Phase 5 | 公共多用户部署（认证、额度限制） | 📋 规划 |

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
PUBLIC_DEMO_MODE=false
MINIMAX_API_KEY=***
```

CLI Adapter 推荐原因：不通过 HTTP 直连 MiniMax，由 mmx CLI 管理认证和请求。

详见 [docs/SECURITY.md](docs/SECURITY.md)

---

## 开源协议

MIT License — 可自由使用、修改、分发，包括商业用途，但需保留原作者署名和版权声明。

---

**Unofficial open-source project. Not affiliated with MiniMax.**