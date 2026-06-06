# Release Notes — v0.1.0-alpha

> 发布日期：2026-06-07
> 里程碑：Phase 2F — Docker 部署与发布准备完成

---

## 项目简介

**mmx-music-studio**（MiniMax 音乐创作台）是一个开源、自托管、BYOK（Bring Your Own Key）的 MiniMax 音乐生成工具。

> ⚠️ **免责声明**：这是一个非官方的开源项目，与 MiniMax 无任何关联。仅用于技术研究和个人学习。

---

## 核心能力（当前可用）

### ✅ Mock 生成模式（安全，默认开启）
- 无需 API Key
- 无需网络连接
- 无额度消耗
- 适合 UI 演示和本地开发

### ✅ MMX CLI Adapter（真实生成，已验证）
- 需服务器安装并登录 `mmx`
- 生成真实 MP3 音乐文件
- 2 次成功验证（7.3MB + 6.2MB）
- 不经过前端传输 Key

### 🔧 API Adapter（实验性）
- 直接调用 MiniMax API
- 支持页面 session key 或服务器环境变量
- 错误处理和稳定性待完善

---

## 主要功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 纯音乐生成 | ✅ | 文字描述 → BGM |
| 自动成歌 | ✅ | 主题 → AI 写词 + 作曲 |
| 歌词成歌 | ✅ | 提供歌词 → AI 谱曲 |
| 参考改编 | ✅ | 参考音频 + 风格描述 |
| 在线试听 | ✅ | 波形播放器 |
| 下载 MP3 | ✅ | 一键下载 |
| 作品库 | ✅ | 历史管理 |
| Docker 部署 | ✅ | 安全模式开箱即用 |

---

## 安全设计

### 默认安全模式

```bash
REAL_GENERATION_ENABLED=false  # 不调用真实 API
MOCK_GENERATION_ENABLED=true   # 使用本地模拟
MINIMAX_BACKEND=mock           # 后端模式
```

### Key 管理

- ❌ 默认不保存用户 API Key
- ✅ sessionStorage 仅存内存，刷新即清空
- ✅ 服务器环境变量模式（Key 不经过前端）
- ✅ 禁止日志打印 Authorization header
- ✅ `.env.example` 只含占位符

### 公共部署警告

> ⚠️ 公开部署（公网可访问）时，请务必：
> - 不要在代码或配置中写入真实 Key
> - 建议添加用户登录认证
> - 建议添加额度限制和速率限制
> - 定期检查 MiniMax Token Plan 剩余额度

---

## 后端模式说明

| 模式 | 真实生成 | 额度消耗 | 需要 |
|------|----------|----------|------|
| `mock` | ❌ | ❌ | 无 |
| `cli` | ✅ | ✅ | 宿主机 `mmx` 已登录 |
| `api` | ✅ | ✅ | `MINIMAX_API_KEY` 环境变量 |

---

## 安装方式

### 方式一：Docker（推荐，最快）

```bash
git clone <repo>
cd mmx-music-studio
docker compose up -d
# 访问 http://localhost:8787
```

### 方式二：本地开发

```bash
npm install
npm run dev:full
# Web: http://localhost:5174
# API: http://localhost:8787
```

### 方式三：生产构建

```bash
npm install
npm run build
npm run start
# API: http://localhost:8787
# 前端: dist/（需配置 Nginx 托管）
```

---

## 已验证场景

### 真实 MMX CLI 生成（Phase 2D-B）

| 记录 | 文件 | 大小 | 时长 | 来源 |
|------|------|------|------|------|
| track_1780760888198_pagole | warm ambient electronic | 7.3MB | ~3:40 | mmx-cli |
| track_1780761040991_4ay4pi | upbeat lo-fi hip hop | 6.2MB | ~3:15 | mmx-cli |

> 所有真实音频文件保存在 `storage/tracks/`，已被 `.gitignore` 排除，不会提交到 git。

---

## 已知限制

1. **API Adapter** 为实验路径，错误处理和重试逻辑待完善
2. **微信小程序** 尚未实现，仅完成设计和文档（MINIPROGRAM-READY.md）
3. **CLI 真实生成** 需要服务器已安装 `mmx` 并完成 `mmx auth login`
4. **公共部署** 需要自行添加用户鉴权和额度控制

---

## 技术栈

- React 18 + TypeScript
- Vite 5（构建工具）
- React Router 6（路由）
- CSS Modules（样式）
- Node.js 22 + tsx（API Server）
- Docker + Docker Compose（容器化）

---

## 截图预览

截图位于 `docs/screenshots/`，包含：
- 创作台（移动端 / 桌面端）
- 作品库（移动端 / 桌面端）
- 设置页（移动端 / 桌面端）
- 安全模式状态
- CLI 后端状态

---

## Roadmap

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | UI 原型 + 项目文档 | ✅ 完成 |
| Phase 2A–F | Mock 生成、API、CLI、Docker、发布准备 | ✅ 完成 |
| Phase 3 | 微信小程序（Taro / uni-app） | 📋 规划 |
| Phase 4 | API Adapter 完善（稳定性、错误处理） | 📋 规划 |
| Phase 5 | 公共多用户部署（认证、额度限制） | 📋 规划 |

---

## 安全声明

1. 本项目为非官方开源项目，与 MiniMax 无任何关联
2. 使用请遵守 MiniMax 服务条款和 API 使用政策
3. 真实生成会消耗 MiniMax Token Plan 额度
4. 请勿在不受信任的环境中输入真实 API Key
5. 推荐使用自托管模式，Key 由服务器环境变量管理