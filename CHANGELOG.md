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

## 早期版本说明

v0.1.0-alpha 之前无正式版本记录。