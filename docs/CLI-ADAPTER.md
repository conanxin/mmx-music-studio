# MMX CLI Adapter — Phase 2D.1 + 2D-B

## 状态

**Phase 2D.1 + 2D-B 全部完成** ✅

- Phase 2D.1：CLI Adapter 代码实现完成，所有 smoke tests 通过，前端 mmx-cli 支持完成
- Phase 2D-B：真实 CLI 生成成功 2 次（7.3MB + 6.2MB MP3），download endpoint 验证通过

---

## Phase 2D.1 完成清单

- `server/adapters/minimax-cli/` — 完整实现（diagnoseMmxCli / generateWithMmxCli / runMmx / redactCliOutput / 6 种错误类）
- `GET /api/debug/cli` — 健壮诊断，每命令独立捕获失败，整体返回不因单点失败而 500
- `/api/health` — 新增 `backend` / `availableBackends` / `cliAvailable` / `cliAuthenticated` / `cliRegion` 字段
- `scripts/cli-adapter-smoke-test.sh` — 容错设计，auth/config error → PARTIAL_AUTH_OR_CONFIG_ERROR，exit 0
- 前端 Studio + Library — `generationSource=mmx-cli` 标签（橙色 `#FFB76B`），文案「MMX CLI」
- Settings 页面 — 新增「生成后端」区域，6 项状态卡片 + 提示文案
- 移除 `diagnoseMmxCli()` 对 `~/.mmx/config.json` 的读取（安全违规）
- 修复 TypeScript 错误（`* as fs/path` 命名空间导入，`lyrics` 属性访问）

---

## mmx CLI 当前状态

**已知问题**：服务器环境有 `ALL_PROXY=socks5://127.0.0.1:7898`，mmx music generate 触发 "Invalid URL protocol"。

**根因已定位**：`mmx quota` 成功（纯本地 JSON读取），但 `mmx music generate` 需要网络请求时 socks5 代理导致协议错误。直连 `api.minimaxi.chat:443` 无需代理。

**修复方案**（已实现）：CLI adapter 在 spawn mmx 时清除所有 proxy 环境变量（`ALL_PROXY`/`HTTPS_PROXY`/`HTTP_PROXY` 等），让 mmx 直连 MiniMax API。

**手动修复（在服务器终端执行，不要把 key 粘贴进聊天）**：

```bash
# 1. 检查 mmx 版本
mmx --version

# 2. 检查 auth 状态
mmx auth status

# 3. 如果 auth 失败，用推荐方式登录（不粘贴 key 到聊天）
mmx auth login --recommend --region=cn
# 或
mmx auth login --region=cn

# 4. 验证登录成功
mmx quota

# 5. 确认 auth 正常后，可进行 Phase 2D-B
```

如果必须用 API key 登录，只在服务器终端手动运行，不要写进项目文件。

---

## CLI Adapter 特性

### 安全设计

- **不传 API key via CLI args**：不使用 `mmx ... --api-key ***`（会进入 process list）
- **不传 API key via env**：spawn 时不注入 `MINIMAX_API_KEY`
- **依赖 mmx 自有认证**：mmx CLI 从 `~/.mmx/config.json` 加载已有凭据
- **参数数组传递**：`spawn('mmx', ['music', 'generate', ...])`，无 shell 拼接
- **stdout/stderr 脱敏**：`redactCliOutput()` 移除 sk-/Bearer/token 模式
- **不记录完整输出**：最多保存 stderr preview 前 2000 字符

### 支持的模式

| 模式 | 支持 | 命令 |
|------|------|------|
| `instrumental` | ✅ | `mmx music generate --prompt ... --instrumental --out ...` |
| `auto` | ✅ | `mmx music generate --prompt ... --lyrics-optimizer --out ...` |
| `lyrics` | ✅ | `mmx music generate --prompt ... --lyrics "..." --out ...` |
| `cover-url` | ✅ | `mmx music cover --prompt ... --audio <url> --out ...` |
| `cover-file` | ❌ | 需配合文件上传适配器 |

### 错误类型

| 错误类型 | code | 说明 |
|----------|------|------|
| `MmxCliNotFoundError` | `CLI_NOT_FOUND` | mmx 不在 PATH 中 |
| `MmxCliTimeoutError` | `TIMEOUT` | 生成超时（默认 3 分钟） |
| `MmxCliAuthError` | `AUTH_FAILED` | 未登录或认证过期 |
| `MmxCliUnsupportedModeError` | `UNSUPPORTED_MODE` | 不支持的模式 |
| `MmxCliGenerationError` | `GENERATION_FAILED` | 生成失败（非 auth 原因） |

---

## API 端点

### GET /api/debug/cli

安全模式（`REAL_GENERATION_ENABLED=false`）下的 CLI 诊断端点。健壮设计：每个子命令独立运行，任何失败不影响整体返回。

返回：
```json
{
  "ok": true,
  "mmxAvailable": true,
  "commands": {
    "version":        { "ok": false, "exitCode": 1, "outputPreview": "..." },
    "authStatus":     { "ok": false, "exitCode": 1, "outputPreview": "..." },
    "configShow":     { "ok": false, "exitCode": 1, "outputPreview": "..." },
    "quota":          { "ok": false, "exitCode": 1, "outputPreview": "..." },
    "musicGenerateHelp": { "ok": true, "exitCode": 0, "outputPreview": "..." },
    "musicCoverHelp":    { "ok": true, "exitCode": 0, "outputPreview": "..." }
  },
  "cliReadyForGeneration": false,
  "reason": "auth/config needs repair on server"
}
```

---

## Phase 2D-B：已完成

**真实 CLI 生成结果：**

| # | Prompt | Mode | 文件 | 大小 | 结果 |
|---|--------|------|------|--------|------|
| 1 | warm ambient electronic, calm, focused | instrumental | `track_1780760888198_pagole.mp3` | 7.3MB | ✅ HTTP 200 |
| 2 | upbeat lo-fi hip hop, study, coffee shop | instrumental | `track_1780761040991_4ay4pi.mp3` | 6.2MB | ✅ HTTP 200 |

**修复的问题：**

1. **ALL_PROXY=socks5 导致 "Invalid URL protocol"** — `runMmx()` 中清除所有含 `proxy` 的环境变量（`ALL_PROXY`/`all_proxy`/`HTTPS_PROXY`/`http_proxy`/`https_proxy`）
2. **EISDIR: illegal operation on a directory** — `--out` 改为传完整文件路径而非目录；server 先生成 track id 并传给 CLI adapter，保证 id 与文件名一致

**track id / 文件名一致性**（Phase 2E 修复）：
- Server 先生成 `track_{timestamp}_{random}.mp3`
- 传给 CLI adapter 作为 `--out` 参数
- 不再需要 rename，mmx 直接写入正确文件名
- 旧记录已通过 `manifest:fix --apply` 标记 `legacyFileName=true`

### API Adapter vs CLI Adapter

| 特性 | API Adapter | CLI Adapter |
|------|------------|------------|
| 依赖 | `MINIMAX_API_KEY` env | mmx auth |
| 请求方式 | HTTP POST | spawn 子进程 |
| 进度追踪 | 需自己实现轮询 | mmx CLI 自己管理 |
| 错误处理 | HTTP + MiniMax 错误码 | process exit code |
| Phase 2C 状态 | 服务返回"准备失败"（服务侧问题） | 已完成，真实生成 2 次 |
| Phase 2D.1 状态 | experimental | ✅ PASS，smoke test 通过 |

---

## 不泄露内容

以下内容永远不会出现在日志或响应中：
- API key / Bearer token / Authorization header
- `sk-` 开头的 key 值
- `Authorization: Bearer ***` 完整值
- `MINIMAX_API_KEY=***` 形式
- `~/.mmx/config.json` 的 api_key 字段内容
- MiniMax 响应中的签名 URL（仅记录域名部分）

---

## 下一步

1. **手动修复 mmx auth**（在服务器终端执行，不要粘贴 key 到聊天）
2. **Phase 2D-B** — 确认 auth 正常后执行单次真实 CLI 生成
3. 如果 CLI 生成仍失败，可能是该 key 本身无音乐生成权限或额度问题