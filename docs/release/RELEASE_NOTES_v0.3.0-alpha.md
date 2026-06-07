# mmx-music-studio v0.3.0-alpha

**发布类型：** Alpha 预览版（Phase 4 完整版）  
**发布日期：** 2026-06-08  
**仓库：** https://github.com/conanxin/mmx-music-studio

---

## What is this

**mmx-music-studio**（MiniMax 音乐创作台）是一个开源、自托管、支持 MiniMax Token Plan / MMX CLI 的音乐生成工作台。

- **Unofficial**：非 MiniMax 官方项目
- **BYOK**：Bring Your Own Key，用户自行提供 MiniMax Token Plan Key
- **Self-hosted**：自行部署，数据自主
- **MIT License**：开源许可证

---

## Highlights

### HTTPS 部署完成
- **生产地址：** https://music.conanxin.com
- **安全架构：** Server 强制监听 `127.0.0.1:8787`，Caddy 反向代理转发
- **HTTP → HTTPS：** 自动重定向
- **安全头：** CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy

### 任务系统（Phase 4 全套）
- **Job Queue** — 异步任务提交 → 后台处理 → 轮询状态
- **任务取消** — 运行中任务可取消
- **Job History Admin** — 任务历史列表、筛选、详情、删除、重试
- **任务统计面板** — 总计/队列中/运行中/成功/失败/配额

### 访问控制与安全（Phase 4C）
- **Preview Access Gate** — HMAC Cookie + PIN，保护预览模式
- **Generation Access Gate** — 独立生成保护层，防止未授权调用
- **Rate Limit** — 每分钟 N 次，防止滥用
- **Daily Quota** — 每日生成配额，防止额度超耗
- **PIN Brute-force Guard** — 错误 N 次后锁定 M 分钟
- **Audit Logging** — 记录所有安全事件（JSONL，忽略敏感信息）

### Settings 安全审计面板
- 查看审计日志开启状态
- 查看 PIN 防爆破配置
- 查看解锁失败/成功次数
- 查看生成被拦截统计
- 查看任务操作事件数

### 微信小程序（Phase 3 Mock 完成）
- 完整 Mock API 适配层
- Mock 音频播放适配器（`wx.createInnerAudioContext`）
- Mock 下载适配器（`wx.downloadFile`）
- Mock 文件选择适配器（`wx.chooseMessageFile`）
- 小程序端 Typescript 类型与 Web 共用 `packages/core`

### 部署就绪
- `Dockerfile` + `docker-compose.yml`
- `Caddyfile.example` — 一键 HTTPS 配置模板
- `nginx.mmx-music-studio.conf.example` — Nginx 配置模板
- `.env.proxy.example` — HTTPS/代理环境变量模板
- `run-local-behind-proxy.sh` — 本地开发安全启动脚本

---

## Security Defaults

| 保护层 | 状态 | 说明 |
|--------|------|------|
| Real Generation | 默认关闭 | 必须手动开启 |
| Generation Access Gate | 可选 | 独立 PIN 保护层 |
| Rate Limit | 可选 | 每分钟限次 |
| Daily Quota | 可选 | 每日配额上限 |
| PIN Brute-force Guard | 可选 | 暴力破解自动拦截 |
| Audit Logging | 可选 | 所有安全事件留痕 |
| HTTPS | 必须 | Caddy/Nginx 反向代理 |
| No API Keys Committed | ✅ | `.env` / `storage/` 全部忽略 |

---

## Known Limitations

- **多用户系统**：未实现（当前为单机自用）
- **CLI Adapter**：实验性质（`mmx music generate --json` 依赖 mmx CLI 安装）
- **API Adapter**：实验性质（需要真实 MiniMax API Key）
- **微信正式发布**：需要将 `https://music.conanxin.com` 配置为微信公众平台合法域名
- **Redis**：PIN Brute-force Guard 使用内存存储，重启后计数清零

---

## Environment Variables (Key New in v0.3.0)

```bash
# 安全（新增）
AUTH_GUARD_ENABLED=true
AUTH_GUARD_WINDOW_MS=300000
AUTH_GUARD_MAX_FAILURES=5
AUTH_GUARD_LOCK_MS=900000
AUDIT_LOG_ENABLED=true
AUDIT_LOG_DIR=./storage/audit

# HTTPS 部署（新增）
CADDY_HTTP_PORT=80
CADDY_HTTPS_PORT=443
CADDY_DOMAIN=music.yourdomain.com
CADDY_EMAIL=admin@yourdomain.com
DISABLE_HTTP=false
HTTP_PORT=80
HTTPS_PORT=443

# 现有（保留）
MINIMAX_API_KEY=<your_key>
MINIMAX_REGION=cn
REAL_GENERATION_ENABLED=false
PREVIEW_ACCESS_PIN=<your_pin>
PREVIEW_ACCESS_ENABLED=false
GENERATION_ACCESS_ENABLED=false
GENERATION_ACCESS_PIN=<your_pin>
RATE_LIMIT_ENABLED=false
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=3
DAILY_QUOTA_LIMIT=10
```

---

## Roadmap

| 版本 | 内容 | 优先级 |
|------|------|--------|
| **v0.3.0-alpha** | Phase 4 完整版发布（HTTPS + 安全加固） | ✅ 今日 |
| **v0.3.x** | 多用户系统、API Key 管理、Stripe 集成 | 规划中 |
| **v0.4.0** | MiniMax API Adapter 稳定化 | 规划中 |
| **v0.5.0** | 微信小程序正式版（合法域名 + 审核） | 规划中 |

---

## Links

- **GitHub：** https://github.com/conanxin/mmx-music-studio
- **Release：** https://github.com/conanxin/mmx-music-studio/releases/tag/v0.3.0-alpha
- **Demo：** https://music.conanxin.com
- **文档：** https://github.com/conanxin/mmx-music-studio#readme
