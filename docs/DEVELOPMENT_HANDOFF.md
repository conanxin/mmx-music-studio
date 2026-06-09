# mmx-music-studio Development Handoff

> 文档版本：v0.4.1-alpha · 2026-06-09
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
| Web 公网预览 | ✅ 可用 | Cloudflare Tunnel `https://music.conanxin.com`（CLI backend，无需 SSH Tunnel） |
| Mock 生成 | ✅ 完成 | server mock，不消耗额度 |
| MMX CLI 生成 | ✅ 已验证 | `MINIMAX_BACKEND=cli`，需 auth login，Web+CLI 主链路 |
| API adapter | ⚠️ 实验性 | `MINIMAX_BACKEND=api`，需真实 key |
| 微信小程序 | ✅ Phase 3C/3D | Taro v4，mock API，音频播放/下载 adapter |
| HTTPS 域名 | ⏳ 待办 | Phase 3E：需用户提供域名 |
| 微信合法域名 | ⏳ 待办 | Phase 3E：request + downloadFile |
| 多用户鉴权 | ✅ 完成 | Phase 4C：Generation Access PIN |
| 额度限制/限流 | ✅ 完成 | Phase 4C：Rate Limit + Daily Quota |
| 任务历史管理 | ✅ 完成 | Phase 4D：Jobs 页面 + delete/retry/stats API |

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
| **Phase 3E** | HTTPS 域名实装 + 微信合法域名 | 用户提供域名 |
| **Phase 3F** | 微信小程序真机预览 | Phase 3E 完成 |
| **Phase 4C** | **多用户鉴权 + 速率限制 + 每日额度** | ✅ 完成 |
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
