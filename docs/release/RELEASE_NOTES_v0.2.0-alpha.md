# mmx-music-studio v0.2.0-alpha

**发布类型：** Alpha 预览版  
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

### 任务系统
- **Job Queue** — 异步任务提交 → 后台处理 → 轮询状态 → 完成通知
- **任务取消** — 运行中任务可取消
- **Job History Admin** — 任务历史列表、筛选、详情、删除、重试
- **任务统计面板** — 总计/队列中/运行中/成功/失败/配额

### 访问控制与安全
- **Preview Access Gate** — HMAC Cookie + PIN，保护预览模式
- **Generation Access Gate** — 独立生成保护层
- **Basic Rate Limiting** — 时间窗口请求数限制
- **Daily Generation Quota** — 每日生成配额，配额用尽返回 429

### Web 主站
- **创作台** — 纯音乐/自动成歌/歌词成歌/参考改编四种模式
- **作品库** — 在线试听、MP3 下载、历史管理
- **任务历史** — 完整任务生命周期管理
- **设置页** — Key 输入、区域选择、后端模式切换

### 微信小程序准备
- **Taro v4 脚手架** — `apps/weapp/` 完整目录结构
- **Mock Server API Adapter** — 模拟 API 接口适配
- **Audio Playback Adapter** — 小程序音频播放接口
- **Download Adapter** — 小程序文件下载接口
- **Phase 4C/4D 同步** — 与 Web 主站 API 保持同步

### 部署与运维
- **Docker** — Dockerfile + docker-compose.yml
- **Runtime Modes** — Demo Preview / Private Real / Production Locked
- **部署文档** — 本地 / Docker / 生产环境完整指南
- **安全文档** — 详细安全设计决策和最佳实践
- **开发交接文档** — 换电脑继续开发指南

---

## Runtime Modes

| 模式 | 后端 | 生成 | 访问保护 |
|------|------|------|----------|
| Demo Preview | Mock | ❌ 禁用 | Preview PIN |
| Private Real | MMX CLI / API | ✅ 启用 | 可选 PIN |
| Production Locked | Mock | ❌ 禁用 | Generation PIN |

**安全默认值：**
- `REAL_GENERATION_ENABLED=false`
- Mock 后端随时可用
- 真实生成需手动启用

---

## Safety Defaults

- ✅ `.env` 已在 `.gitignore` 中，不会提交
- ✅ `storage/tracks/` 已在 `.gitignore` 中，不会提交真实音频
- ✅ `storage/quota/*.json` 已在 `.gitignore` 中，不会提交运行时额度数据
- ✅ 不打印 Authorization header
- ✅ 不在日志中输出 API Key / PIN
- ✅ `GENERATION_ACCESS_PIN` 明文不在代码/日志中出现

---

## Verified

| 检查项 | 状态 |
|--------|------|
| `npm run typecheck:server` | ✅ PASS |
| `npm run typecheck` | ✅ PASS |
| `npm run build` | ✅ PASS |
| `npm run release:check` | ✅ 20/20 PASS |
| `npm run production:check` | ✅ PASS |
| `npm run manifest:audit` | ✅ PASS |
| `npm run weapp:typecheck` | ✅ PASS |
| `npm run weapp:build` | ✅ PASS |
| `job-queue-smoke-test.sh` | ✅ PASS |
| `job-history-admin-smoke-test.sh` | ✅ 14/14 PASS |
| `auth-quota-smoke-test.sh` | ✅ 31/31 PASS |
| `web-api-smoke-test.sh` | ✅ PASS |
| `weapp-audio-url-smoke-test.sh` | ✅ 8/8 PASS |
| Secret scan | ✅ CLEAN |

---

## Known Limitations

- **API Adapter（实验性）** — MiniMax 直接 API 调用尚未完全稳定
- **暂无多用户账户系统** — 当前为单机自托管
- **HTTPS 域名** — 待 Phase 4E 完成域名备案和 HTTPS 配置
- **微信小程序正式上线** — 需完成微信法律域名备案
- **PIN 暴力破解** — 生产环境建议增加 Redis 计数锁定机制

---

## Project Structure

```
mmx-music-studio/
├── apps/
│   ├── web/              # React 主站
│   └── weapp/            # 微信小程序（Taro v4）
├── packages/
│   ├── core/             # 类型、模式、prompt、API client
│   ├── adapters/         # storage、audio、upload、API/CLI adapter
│   └── ui-tokens/        # 设计 token
├── server/               # Express.js API 服务器
├── docs/                 # 项目文档
│   └── release/          # Release Notes
├── scripts/              # 烟雾测试脚本
├── storage/
│   ├── tracks/           # 生成的音频文件（已 gitignore）
│   └── quota/           # 配额数据（已 gitignore）
└── .env.example          # 环境变量模板（占位符）
```

---

## Links

- **Repository：** https://github.com/conanxin/mmx-music-studio
- **Releases：** https://github.com/conanxin/mmx-music-studio/releases
- **Documentation：** `docs/` 目录下各文档
- **mmx CLI：** `mmx music generate --help`

---

*本版本不消耗任何 MiniMax 额度。所有真实生成功能默认禁用。*
