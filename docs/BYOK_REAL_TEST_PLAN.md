# BYOK Real API Test Plan

> Phase 5B-B: Bring Your Own Key — Real MiniMax API One-Track Test
>
> ⚠️ **This plan requires explicit user confirmation before execution.**
> ⚠️ **Do NOT paste real keys into this document or chat.**

---

## Purpose

Verify the complete end-to-end path of API Adapter + BYOK session key:

```
Browser (React session key)
  → x-minimax-api-key HTTP header
    → server job memory storage
      → API Adapter
        → MiniMax API (real)
          → audio saved locally
            → player / download
              → key cleanup on job complete/fail/cancel
```

---

## Preconditions（必须全部满足才可执行）

| # | 条件 | 验证方式 |
|---|------|----------|
| 1 | 用户明确口头/文字确认执行真实测试 | 用户必须发送 `CONFIRM_BYOK_REAL_API_ONE_TRACK` |
| 2 | 用户只在浏览器 UI 填写 key，不在聊天中粘贴 | 告知用户：浏览器设置页 → API Key → 填写 → 直接生成 |
| 3 | `REAL_GENERATION_ENABLED=true` | server 启动时设置 |
| 4 | `MINIMAX_BACKEND=api` | server 启动时设置 |
| 5 | `BYOK_ENABLED=true` | server 启动时设置 |
| 6 | `SERVER_KEY_FALLBACK=false` | server 启动时设置 |
| 7 | `GENERATION_ACCESS_ENABLED=true`（推荐）| Phase 4C PIN 保护 |
| 8 | `RATE_LIMIT_ENABLED=true`（推荐）| Phase 4C 速率限制 |
| 9 | `DAILY_QUOTA_ENABLED=true`（推荐）| Phase 4C 每日额度限制 |
| 10 | 有可用的 MiniMax Token Plan 额度 | 用户自行确认 |

---

## Test Scope

**仅测试一首歌，禁止批量：**

| 字段 | 值 |
|------|-----|
| mode | `instrumental`（纯音乐） |
| prompt | 短描述，例如：`"深夜编程，安静专注的氛围音乐"` |
| cover | 无 |
| lyrics | 无 |
| duration | 默认 |
| batch | 1（禁止批量） |
| key source | 用户在浏览器 UI 填写（session key）|

---

## Expected Flow

```
1. 用户在浏览器 Settings 页 → "API Key（仅当前会话）" → 填写 → 保存
2. Studio 页 → 模式：纯音乐 → 描述：深夜编程
3. 点击"生成音乐"
4. 前端 → POST /api/generate + x-minimax-api-key header
5. Server guard 验证 key 格式（本地，无网络）
6. Server 存储 key 到 byok-secrets Map（job.id → key，TTL 30min）
7. Server 创建 job，enqueue
8. Worker 读取 key，调用 MiniMax API（真实）
9. MiniMax 返回音频 URL / 直接生成音频
10. Server 保存音频到 storage/tracks/
11. Job status → succeeded
12. Player 显示试听
13. Download MP3
14. Key 在 job 完成后从 Map 删除（success/fail/cancel 都触发）
```

---

## Stop Conditions（立即停止）

满足以下任一条件，立即停止并切回 mock：

| # | 条件 | 立即动作 |
|---|------|----------|
| SC1 | MiniMax 返回 invalid key / auth failed | 停止，切 mock |
| SC2 | 额度耗尽（quota exhausted）| 停止，切 mock |
| SC3 | 音频下载失败 | 停止，切 mock |
| SC4 | 检测到 key 泄露到 response / manifest / audit / logs | 停止，切 mock，不提交代码 |
| SC5 | MiniMax 返回任何非预期错误 | 停止，分析原因 |
| SC6 | 用户不想继续 | 立即切 mock |

---

## Execution Commands（切勿提前执行）

### Step 1: 停止当前 mock server

```bash
pkill -f "tsx server/index.ts" 2>/dev/null
sleep 2
```

### Step 2: 启动真实 BYOK server

```bash
cd /home/ubuntu/projects/mmx-music-studio
BYOK_ENABLED=true \
SERVER_KEY_FALLBACK=false \
REAL_GENERATION_ENABLED=true \
MOCK_GENERATION_ENABLED=false \
MINIMAX_BACKEND=api \
GENERATION_ACCESS_ENABLED=true \
RATE_LIMIT_ENABLED=true \
DAILY_QUOTA_ENABLED=true \
HOST=127.0.0.1 \
PORT=8787 \
npm run start > /tmp/mmx-byok-real-test.log 2>&1 &
sleep 4
```

### Step 3: 验证 health

```bash
curl -s http://127.0.0.1:8787/api/health | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('ok:', d.get('ok'))
print('backend:', d.get('backend'))
print('realGenerationEnabled:', d.get('realGenerationEnabled'))
print('byokEnabled:', d.get('byokEnabled'))
print('serverKeyFallback:', d.get('serverKeyFallback'))
"
```

必须全部为预期值才可继续。

### Step 4: 用户在浏览器操作

```
浏览器打开 http://127.0.0.1:8787
→ Settings
→ API Key（仅当前会话）→ [在输入框填写，不要在聊天中]
→ 保存
→ Studio
→ 模式：纯音乐
→ 描述：深夜编程，安静专注的氛围音乐
→ 生成音乐
```

### Step 5: 监控 server 日志

```bash
tail -f /tmp/mmx-byok-real-test.log
```

观察是否有错误。

### Step 6: 验证音频

```bash
# 检查 storage/tracks/
ls -la storage/tracks/
# 验证音频可播放
file storage/tracks/*.mp3
```

### Step 7: 验证 key 清理

```bash
# job 完成后，检查 byok-secrets Map 是否已清空
# 通过 /api/jobs 确认 job 已完成
# 检查 manifest 不含 key
```

### Step 8: 切回 mock 模式（测试后必须执行）

```bash
pkill -f "tsx server/index.ts" 2>/dev/null
sleep 2
PREVIEW_ACCESS_ENABLED=false \
REAL_GENERATION_ENABLED=false \
MOCK_GENERATION_ENABLED=true \
MINIMAX_BACKEND=mock \
HOST=127.0.0.1 \
PORT=8787 \
npm run start &
sleep 3
```

---

## Post-Test Actions

测试完成后：

1. **立即切回 mock**（Step 8）
2. **确认 key 未泄露**：`grep -r "sk-" storage/tracks/ storage/audit/ server/logs 2>/dev/null || echo "CLEAN"`
3. **确认音频可播放**
4. **确认 job 状态为 succeeded**
5. **更新文档**：在 Phase 5B-B 执行记录中注明结果
6. **如发现 key 泄露**：立即停止，修复，不提交代码

---

## What NOT to Do

- ❌ 不在聊天中粘贴真实 API key
- ❌ 不 commit 真实 key 到 git
- ❌ 不把 key 写入 .env
- ❌ 不触发批量生成（scope 限制为 1）
- ❌ 不触发 cover / 歌词模式
- ❌ 不在 SC1–SC6 发生后继续执行
- ❌ 不读取 ~/.mmx/config.json 或 ~/.hermes/.env

---

## Key Confirmation Checklist

执行前，用户必须在聊天中发送：

```
CONFIRM_BYOK_REAL_API_ONE_TRACK
```

没有此确认，不执行任何真实 API 调用。

---

## Security Reminder

BYOK 模式的优势：**真实 key 不经过你的服务器存储**，只存在用户浏览器 session 和 server 内存 Map 中，job 完成后立即删除。即使服务器被攻破，key 也不会残留在磁盘或日志中。

但仍需：
- 确保 HTTPS（防止 key 在传输中被截获）
- 确保 server 不记录原始 Authorization header
- 确保 manifest/audit 不含 key 原文

---

## Related Documents

- [docs/BYOK_MODE.md](BYOK_MODE.md) — BYOK 完整说明
- [docs/SECURITY.md](SECURITY.md) — 安全规范
- [docs/AUTH_AND_QUOTA.md](AUTH_AND_QUOTA.md) — 额度保护
- [docs/BYOK_REAL_TEST_POSTMORTEM.md](BYOK_REAL_TEST_POSTMORTEM.md) — Phase 5B-B 事故复盘

---

## Phase 5B-C: Real API Attempt Guard（必须满足）

Phase 5B-C 新增 Real API Attempt Guard，确保真实 API 调用前先预约配额。

### 启动前必须确认

```bash
# 1. 检查剩余 attempt 次数（应为 1 或 0）
curl http://127.0.0.1:8787/api/health | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('realApiAttemptLimitEnabled:', d.get('realApiAttemptLimitEnabled'))
print('realApiDailyAttemptLimit:', d.get('realApiDailyAttemptLimit'))
print('remainingRealApiAttempts:', d.get('remainingRealApiAttempts'))
"
```

### 真实测试前的硬门槛

| 条件 | 要求 |
|------|------|
| `remainingRealApiAttempts` | 必须为 1（首次）或 0（禁止测试） |
| `REAL_API_ATTEMPT_LIMIT_ENABLED` | 必须为 `true` |
| `REAL_API_DAILY_ATTEMPT_LIMIT` | 建议为 1 |
| 前端显示 | "真实测试剩余 N 次" |

### 测试后必须检查

```bash
# 执行一次真实生成后，立即检查
curl http://127.0.0.1:8787/api/health | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('remainingRealApiAttempts:', d.get('remainingRealApiAttempts'))
print('realApiAttemptsUsed:', d.get('realApiAttemptsUsed'))
"

# 应显示: remainingRealApiAttempts=0, realApiAttemptsUsed=1
```

### 禁止条件

- `remainingRealApiAttempts = 0` 时禁止触发任何真实生成
- `REAL_API_DAILY_ATTEMPT_LIMIT` 不允许手动临时调高超过 1（除非明确知道会消耗）
- 不要在 server 配置不确定时启动 realGeneration server

---

## Phase API-Debug-B0 前置条件更新

**状态**: ✅ 已完成 (2026-06-09)

Phase API-Debug-B0 完成了 async task response 结构化识别：
- 新增 `server/adapters/minimax-api/response.ts` — 5 种 response kind
- async task 不再报"音频格式无法处理"，改为 `MINIMAX_API_ASYNC_POLLING_REQUIRED`
- 不猜 polling endpoint
- `api-adapter-async-contract-smoke-test.sh`: 20/20 PASS

**真实调用前必须确认**:
1. 官方 MiniMax task status polling endpoint（当前未知）
2. 或用户提供 API 文档
3. polling endpoint 确认后才可进入 Phase API-Debug-B1

## v0.4.0-alpha 版本边界

本文档描述的测试方案已冻结于 v0.4.0-alpha。

**已验证：** Guard 正确拦截超额真实 API attempts。**未验证：** 真实 MiniMax API 成功返回音频。

**下次真实测试必须：**
1. `REAL_API_DAILY_ATTEMPT_LIMIT=3`（而非 1）
2. 前端生成按钮添加 10 秒防抖（点击后 disable 10s）
3. 增加人工确认对话框（"确认发送 1 次真实 API 调用？"）
4. 单次操作，不 retry
5. 低峰时段（UTC 02:00-06:00）
