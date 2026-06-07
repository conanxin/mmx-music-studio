# 部署指南 / Deployment Guide

> 本文档涵盖 mmx-music-studio 的本地开发、生产运行、Docker 部署和后端模式配置。

## 环境要求

- **Node.js**: 22.x 或更高
- **npm**: 10.x 或更高
- **Docker**: 20.x+（可选，用于容器化部署）
- **Docker Compose**: 2.x+（可选）

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动完整开发环境（Web + API Server）
npm run dev:full

# 分别启动（两个终端）
npm run dev          # Web: http://localhost:5174
npm run dev:server    # API: http://localhost:8787
```

### 生产运行

```bash
# 构建
npm run build

# 启动 API Server（生产模式）
npm run start

# API 运行于 http://localhost:8787
# Web 静态文件在 dist/
```

> **注意**：`start` 运行 API Server，前端 Web 通过 Vite dev server 或 Nginx 反向代理提供。生产环境建议使用 Nginx 托管 `dist/` 目录并代理 `/api` 请求到 `localhost:8787`。

### 模式说明

mmx-music-studio 支持三种后端模式，由环境变量 `MINIMAX_BACKEND` 控制：

| 模式 | 说明 | 真实生成 | 消耗额度 |
|------|------|----------|----------|
| `mock` | 本地模拟音频，安全模式 | ❌ | ❌ |
| `cli` | 调用宿主机 `mmx` CLI | ✅ | ✅ |
| `api` | 直接调用 MiniMax API（实验性） | ✅ | ✅ |

默认：`mock`（安全模式）。

### 安全默认值

默认配置为安全模式，**不会调用真实 MiniMax API 或消耗额度**：

```bash
REAL_GENERATION_ENABLED=false  # 禁用真实生成
MOCK_GENERATION_ENABLED=true   # 使用本地模拟音频
MINIMAX_BACKEND=mock           # 后端模式
PUBLIC_DEMO_MODE=true          # 公共演示模式
```

## Docker 部署

### 构建镜像

```bash
docker build -t mmx-music-studio:0.1.0 .
```

### 运行容器（安全模式）

```bash
docker run -d \
  --name mmx-music-studio \
  -p 8787:8787 \
  -e PUBLIC_DEMO_MODE=true \
  -e REAL_GENERATION_ENABLED=false \
  -e MOCK_GENERATION_ENABLED=true \
  -e MINIMAX_BACKEND=mock \
  -v $(pwd)/storage/tracks:/app/storage/tracks \
  mmx-music-studio:0.1.0

# 访问 http://localhost:8787
```

### Docker Compose（安全模式）

```bash
docker compose up -d
# 访问 http://localhost:8787
```

### Docker 安全模式说明

默认 `docker-compose.yml` 配置为安全模式：
- 不调用真实 MiniMax API
- 不消耗 Token Plan 额度
- 使用本地模拟音频

---

## 安全公网预览（推荐）

### 启动命令

```bash
cd /home/ubuntu/projects/mmx-music-studio

PUBLIC_DEMO_MODE=true \
REAL_GENERATION_ENABLED=false \
MOCK_GENERATION_ENABLED=true \
MINIMAX_BACKEND=mock \
MINIMAX_REGION=cn \
PORT=8787 \
HOST=0.0.0.0 \
MUSIC_OUTPUT_DIR=./storage/tracks \
npm run start
```

### 访问

`http://<服务器公网IP>:8787`

### 当前预览地址

> **注意**：以下地址需要云厂商安全组已开放 TCP 8787 入站。
>
> 地址：`http://118.195.129.137:8787`

### Public Preview API Base（同源 API）

生产构建默认使用 **same-origin**：

- 打开 `http://<server-ip>:8787` 时，前端自动请求 `http://<server-ip>:8787/api/*`
- `src/lib/serverApi.ts` 中 `getApiBaseUrl()` 优先使用 `window.location.origin`
- **不要**在生产构建中写死 `VITE_API_BASE_URL=http://localhost:8787`（会导致浏览器向用户本机 localhost 发请求）

### 安全模式说明

该模式只使用本地 mock 音频：
- ❌ 不调用 MiniMax API
- ❌ 不调用 mmx CLI 真实生成
- ❌ 不消耗 MiniMax Token Plan 额度
-❌ 不需要配置 MiniMax Key
- ✅ 使用本地模拟音频，适合 UI 演示和公网预览

### ⚠️ 安全警告

- **不要**把 `REAL_GENERATION_ENABLED=true` 的真实生成服务裸露到公网
- 真实生成公网部署前**必须**增加：登录鉴权、速率限制、额度限制
- **不要**把 API Key 写入前端、Dockerfile、docker-compose.yml 或公开文档
- 公网 HTTPS 推荐使用 **Caddy** 或 **Nginx** 反向代理（HTTP 明文传输存在中间人攻击风险）

---

### 启用真实 CLI 生成（⚠️ 消耗额度）

需要在容器中或宿主机安装并登录 `mmx` CLI：

```bash
# 1. 在宿主机安装 mmx CLI 并登录
npm install -g @minimax/mmx
mmx auth login

# 2. 启动容器并挂载 mmx 配置
docker run -d \
  --name mmx-music-studio \
  -p 8787:8787 \
  -e REAL_GENERATION_ENABLED=true \
  -e MINIMAX_BACKEND=cli \
  -e MOCK_GENERATION_ENABLED=false \
  -e MINIMAX_API_KEY=sk-xxx \
  -v $(pwd)/storage/tracks:/app/storage/tracks \
  mmx-music-studio:0.1.0
```

### 启用 API Adapter（BYOK 模式）

推荐通过 Web UI 的 session key 输入，或使用服务器环境变量：

```bash
# 不在命令行或 compose 文件中写真实 key
# 使用 .env 文件（不被 git 跟踪）

# .env
MINIMAX_API_KEY=<your_token_plan_key>
MINIMAX_BACKEND=api
REAL_GENERATION_ENABLED=true
```

## 真实生成说明

### 什么是真实生成？

当 `REAL_GENERATION_ENABLED=true` 时，系统会：
- 调用 MiniMax API 或 `mmx` CLI 生成真实音乐
- **消耗 MiniMax Token Plan 额度**
- 生成可下载的 MP3 文件

### 安全建议

> ⚠️ **重要**：公开部署（公网可访问）时，请务必：

1. **不要**在 Dockerfile 或 docker-compose.yml 中写入真实 API Key
2. **不要**将 `.env` 文件提交到 git
3. **不要**在不受信任的网络环境中输入真实 Key
4. 使用服务器端环境变量模式（Key 不经过前端）
5. 考虑添加用户认证、额度限制、速率限制
6. 定期检查 MiniMax Token Plan 剩余额度

### 后端模式选择建议

| 场景 | 推荐模式 | 说明 |
|------|----------|------|
| 本地演示 / 开发 | `mock` | 无需 API Key，无额度消耗 |
| 自托管个人使用 | `cli` 或 `api` | 需配置服务器环境变量 |
| 团队共享（内网） | `api` + 登录认证 | 建议加用户认证层 |
| 公共部署 | **不建议开启真实生成** | 除非已实现完整的用户鉴权和额度控制 |

## 目录结构

```
mmx-music-studio/
├── dist/                    # Web 构建产物（生产环境托管）
├── server/                  # API Server（TypeScript）
├── packages/                # 共享核心包
│   ├── core/               # 业务逻辑（平台无关）
│   ├── adapters/           # API 适配器
│   └── ui-tokens/          # UI 设计令牌
├── storage/tracks/          # 生成的音频文件（git 忽略）
│   └── manifest.json       # 音频文件索引
├── docs/                    # 项目文档
└── docker-compose.yml       # Docker 部署配置
```

## 环境变量参考

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8787` | API Server 端口 |
| `PUBLIC_DEMO_MODE` | `true` | 公共演示模式 |
| `REAL_GENERATION_ENABLED` | `false` | 启用真实生成（消耗额度） |
| `MOCK_GENERATION_ENABLED` | `true` | 启用模拟生成 |
| `MINIMAX_BACKEND` | `mock` | 后端模式：`mock` / `cli` / `api` |
| `MINIMAX_REGION` | `cn` | 区域：`cn` / `global` |
| `MUSIC_OUTPUT_DIR` | `./storage/tracks` | 音频输出目录 |
| `MINIMAX_API_KEY` | — | MiniMax API Key（仅 server 模式） |

## 健康检查

```bash
curl http://localhost:8787/api/health
```

响应示例：
```json
{
  "ok": true,
  "service": "mmx-music-studio",
  "phase": "2F",
  "demoMode": false,
  "realGenerationEnabled": false,
  "mockGenerationEnabled": true,
  "backend": "mock"
}
```

## 故障排除

### 端口被占用

```bash
# 换一个端口
PORT=8788 npm run start
```

### Docker 构建失败

- 检查 Node.js 版本（需要 22.x）
- 确认没有 `.env` 文件在构建上下文中
- 确认 `storage/tracks/` 下没有大文件被复制进镜像

### CLI 模式认证失败

```bash
# 在宿主机检查 mmx auth 状态
mmx auth status

# 如果需要，重新登录
mmx auth login
```

### API 模式连接失败

- 检查 `MINIMAX_API_KEY` 是否正确
- 检查区域设置（`cn` vs `global`）
- 检查网络是否能访问 `api.minimaxi.com`（中国区）或 `api.minimax.io`（全球）