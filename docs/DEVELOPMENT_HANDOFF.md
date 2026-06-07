# mmx-music-studio Development Handoff

> 文档版本：v0.2.0-alpha · 2026-06-07
> 用途：换电脑继续开发、项目交接、开源维护参考

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
| Web 公网预览 | ✅ 可用 | `http://118.195.129.137:8787`（mock 模式） |
| Mock 生成 | ✅ 完成 | server mock，不消耗额度 |
| MMX CLI 生成 | ✅ 已验证 | `MINIMAX_BACKEND=cli`，需 auth login |
| API adapter | ⚠️ 实验性 | `MINIMAX_BACKEND=api`，需真实 key |
| 微信小程序 | ✅ Phase 3C/3D | Taro v4，mock API，音频播放/下载 adapter |
| HTTPS 域名 | ⏳ 待办 | Phase 3E：需用户提供域名 |
| 微信合法域名 | ⏳ 待办 | Phase 3E：request + downloadFile |
| 多用户鉴权 | ⏳ 待办 | Phase 4：公网真实生成前必须 |
| 额度限制/限流 | ⏳ 待办 | Phase 4：防滥用 |

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

访问：`http://localhost:8787` 或 `http://118.195.129.137:8787`

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
bash scripts/weapp-api-smoke-test.sh         # ✓ 3/3 PASS
bash scripts/weapp-audio-url-smoke-test.sh   # ✓ 8/8 PASS

# 域名就绪（用户提供域名后）
DOMAIN=your.domain.com bash scripts/weapp-domain-readiness-check.sh
```

---

## 推荐后续阶段

| 阶段 | 目标 | 前置条件 |
|------|------|----------|
| **Phase 3E** | HTTPS 域名实装 + 微信合法域名 | 用户提供域名 |
| **Phase 3F** | 微信小程序真机预览 | Phase 3E 完成 |
| **Phase 4** | 多用户鉴权 + 额度限制 + 速率限制 | Phase 3E + HTTPS |
| **Phase 5** | API adapter 生产化 | Phase 4 |

---

## 安全红线

1. **不提交** `.env`、`真实 API key`、`真实 token`
2. **不触发** 真实生成 unless `REAL_GENERATION_ENABLED=true`（且做好防护）
3. **不裸露** 真实生成公网服务 without auth + rate limit + quota
4. **不覆盖** 用户真实生成的音频文件
5. **不读取** `~/.mmx/config.json` 或 `~/.hermes/.env`
