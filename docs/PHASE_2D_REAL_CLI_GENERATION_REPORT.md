# Phase 2D 真实 CLI 生成报告

> 生成日期：2026-06-07
> 阶段：Phase 2D-B 最终验证
> 后端：MMX CLI Adapter（`MINIMAX_BACKEND=cli`）

## 真实生成结果

| # | Prompt | Mode | 文件大小 | HTTP 状态 |
|---|--------|------|---------|-----------|
| 1 | warm ambient electronic, calm, focused | instrumental | 7,304,557 bytes (7.3MB) | 200 ✅ |
| 2 | upbeat lo-fi hip hop, study, coffee shop | instrumental | 6,451,085 bytes (6.2MB) | 200 ✅ |

### 验证项

- `generationSource: "mmx-cli"` ✅
- Download endpoint HTTP 200 ✅
- Content-Type: audio/mpeg ✅
- Content-Length 正确 ✅
- 无 Authorization header ✅
- 无 key/Bearer/token 泄露 ✅
- 真实 MP3 文件写入 `storage/tracks/` ✅

## 修复的问题

### 1. ALL_PROXY=socks5 导致 "Invalid URL protocol"

**根因**：`mmx music generate` 连接 `api.minimaxi.chat:443` 时触发 socks5 代理协议错误。
`mmx quota` 纯本地 JSON 读取，不需要网络，所以不受影响。

**修复**：`client.ts` 的 `runMmx()` 中清除所有含 `proxy` 的环境变量：

```typescript
const safeEnv: Record<string, string> = {};
for (const [k, v] of Object.entries(process.env)) {
  if (k.toLowerCase().includes('proxy')) continue; // 跳过 proxy 变量
  safeEnv[k] = v ?? '';
}
```

注意：`ALL_PROXY` 和 `all_proxy`（小写）都需要清除。

### 2. EISDIR: illegal operation on a directory

**根因**：`--out ./storage/tracks/` 传的是目录，mmx CLI 需要文件路径。

**修复**：server 先生成 `trackId`，CLI adapter 输出到 `storage/tracks/${trackId}.mp3`。
mmx CLI 的 `--out` 参数接受完整文件路径，不接受目录路径。

## CLI Adapter 当前状态

- **后端模式**：`cli`（`MINIMAX_BACKEND=cli`）
- **Token Plan 支持**：✅（通过 `mmx auth` 或 `~/.mmx/config.json`）
- **API Key 模式**：不推荐（key 在命令行会泄露）
- **Proxy bypass**：✅（自动清除 proxy 变量）
- **Auth**：通过 `mmx auth login` 或 config.json
- **文件命名**：server 生成 `track_{timestamp}_{random}.mp3`，与 track id 一致

## 已知技术债务

1. **文件名同步**（Phase 2E 已修复）：Phase 2D-B 阶段生成的 2 个旧记录
   audioFileName 与 track id 不一致，已通过 `legacyFileName=true` 标注。
   新生成不再有此问题。

## 安全记录

- ✅ 无 API key 在命令行参数中出现
- ✅ 无 Authorization header 在响应中
- ✅ 无 key/Bearer/token 在 manifest 中
- ✅ 无 key/Bearer/token 在日志中
- ✅ `~/.mmx/config.json` 未被读取或输出
