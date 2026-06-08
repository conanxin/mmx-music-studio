# mmx-music-studio v0.3.1-alpha

**发布日期：** 2026-06-08
**基于：** v0.3.0-alpha (8c294fe)
**类型：** 安全补丁版（Safety Patch Release）

---

## 发布说明

v0.3.1-alpha 是基于 v0.3.0-alpha 的安全补丁版，专注于 **BYOK 真实 API 调用防护**的文档化、测试覆盖和已知限制明确。

> ⚠️ **v0.3.0-alpha tag 保持不变**，本版本为增量 commit，不移动原有 tag。

---

## 新增内容

### 文档 / Documentation

- **`docs/BYOK_REAL_TEST_POSTMORTEM.md`**（NEW）— Phase 5B-B 真实 API 测试失败复盘文档。记录了 guard 配置错误（`REAL_API_DAILY_ATTEMPT_LIMIT=0` 误设为 100）、smoke test 修复过程，以及真实 API 调用的安全边界设计。
- **`docs/BYOK_REAL_TEST_PLAN.md`**（UPDATE）— 新增 Phase 5B-C 检查项，明确 `realApiAttemptsUsed` 计数器的已知限制。

### 测试 / Tests

- **`scripts/real-api-attempt-guard-smoke-test.sh`**（NEW）— 13 个测试用例，覆盖：
  - Guard 状态在 `/api/health` 中的正确暴露
  - `REAL_API_DAILY_ATTEMPT_LIMIT=0` 时真实 API 调用被阻止
  - Job 创建成功但立即被 worker 标记为 `failed`
  - 错误类型为 `real_api_attempt_limit_exceeded`
  - 多次调用均被正确阻止
  - 已知限制：`realApiAttemptsUsed` 在 guard 拦截时不递增

---

## 修复内容

### Real API Attempt Guard

- **`server/rate-limit.ts`** — 新增 `RealApiAttemptGuard` 类，实现 `isRealApiAttemptLimitReached()` 和 `reserveRealApiAttempt()`
- **`server/jobs.ts`** — `executeApiJob()` 在调用真实 API 前执行 guard 检查，超限时将 job 标记为 `failed`（不在 handler 层拒绝，以保持 API 兼容性）
- **`server/index.ts`** — `handleGenerate` 添加 try/catch，捕获 guard 阻止时的错误并返回友好提示
- **`src/features/studio/Studio.tsx`** — UI 错误消息覆盖新的 `real_api_attempt_limit_exceeded` 类型
- **`src/lib/serverApi.ts`** — `HealthInfo` 类型扩展，新增 `realApiAttemptLimitEnabled`、`realApiDailyAttemptLimit`、`realApiAttemptsUsed`、`remainingRealApiAttempts` 字段

### 环境变量

- **`.env.example`** — 新增 3 个相关占位符：
  - `REAL_API_ATTEMPT_LIMIT_ENABLED=true`
  - `REAL_API_DAILY_ATTEMPT_LIMIT=1`
  - `REAL_API_TESTING_MODE=false`

---

## 已知限制

### `realApiAttemptsUsed` 计数器不递增（Known Limitation）

**问题描述：** 当 guard 阻止真实 API 调用时，`realApiAttemptsUsed` 不会递增，始终为 0。

**原因：** Guard 在 `executeApiJob`（worker）中执行，跳过了 `reserveRealApiAttempt()` 调用（以避免在 guard 失败时产生副作用）。

**影响：** 轻度。真实 API 调用本身已被正确阻止，计数器不递增不影响安全边界。

**计划修复：** Phase 5D 将在 guard 检查**之前**调用 `reserveRealApiAttempt()`，使计数器正确递增，同时确保 guard 失败时不影响计数准确性。

### Guard 拦截位置（Design Trade-off）

Guard 在 worker 中阻止，而非在 API handler 层拒绝。这意味着：
- Job 会成功创建（API 返回 200 + job_id）
- Worker 处理时立即将 job 标记为 `failed`
- 适用于异步队列场景，不影响同步 API 兼容性

---

## 安全确认

| 检查项 | 状态 |
|--------|------|
| 全量 smoke tests（mock 模式） | ✅ PASS |
| Secret scan | ✅ CLEAN（0 真实 key/token） |
| 未调用真实 MiniMax API | ✅ 确认 |
| 未消耗额度 | ✅ 确认 |
| `REAL_GENERATION_ENABLED=false` | ✅ 默认 |
| `REAL_API_DAILY_ATTEMPT_LIMIT=1` | ✅ 默认（极低限额） |
| Guard 在 worker 中阻止 | ✅ 确认 |
| `.env.example` 无真实值 | ✅ 确认 |

---

## 升级说明

从 v0.3.0-alpha 升级无需数据库迁移或特殊操作：

```bash
git pull origin master
npm install
npm run build
# 重启 server（BACKEND=mock npx tsx server/index.ts）
```

---

## 下一步

- **Phase 5C：小程序 BYOK 策略** — 小程序端 key 安全提示设计，adapter 化策略
- **Phase 5D（可选）：** 修复 `realApiAttemptsUsed` 计数器，使其在 guard 拦截时真实递增
- **GitHub Release：** 手动创建（gh CLI 未登录）

---

## 相关文档

- `docs/BYOK_REAL_TEST_POSTMORTEM.md`
- `docs/BYOK_REAL_TEST_PLAN.md`
- `docs/SECURITY.md`（Dual-layer access protection）
- `docs/RUNTIME_MODES.md`（Generation Access Gate）
- `server/rate-limit.ts`（RealApiAttemptGuard）
- `scripts/real-api-attempt-guard-smoke-test.sh`