# Real Generation Variants — Phase 2C-C2

> ⚠️ 这些 variant 只能按顺序执行，每次只允许 1 个真实成功的生成。
> ⚠️ 每次执行前必须确认 server 在安全模式（`realGenerationEnabled=false`）下重启。

---

## Variant A: Minimal URL Instrumental（推荐优先试）

**目标**：验证移除 `aigc_watermark` 后，`output_format=url` + minimal payload 是否可通过。

**执行条件**：
- server 在 `REAL_GENERATION_ENABLED=true` 下运行
- 确认 `output_format=url`（不再是 `mp3/aac`）
- 确认 `aigc_watermark` 字段已移除

```bash
# 1. 停止所有 server
pkill -f "tsx server/index.ts" 2>/dev/null || true
sleep 2

# 2. 启动真实模式 server
REAL_GENERATION_ENABLED=true \
PUBLIC_DEMO_MODE=false \
MOCK_GENERATION_ENABLED=false \
npm run dev:server > /tmp/mmx-phase2c-c2-variant-a.log 2>&1 &

sleep 3

# 3. 确认 health
curl -s http://localhost:8787/api/health | python3 -m json.tool
# 必须看到: realGenerationEnabled: true, mockGenerationEnabled: false

# 4. 调用 /api/debug/payload 确认 payload 干净（安全模式为 false 时不工作，这里先检查）
# payload 应该只有: model, prompt, is_instrumental=true, output_format=url, audio_setting

# 5. 执行真实生成（仅 1 次）
curl -s -X POST http://localhost:8787/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "keyMode": "server",
    "input": {
      "mode": "instrumental",
      "prompt": "warm electronic ambient, calm, focused, no vocals"
    }
  }' | python3 -m json.tool

# 6. 立即停止真实模式 server
pkill -f "tsx server/index.ts" 2>/dev/null || true
sleep 2

# 7. 切回安全模式
REAL_GENERATION_ENABLED=false \
PUBLIC_DEMO_MODE=false \
MOCK_GENERATION_ENABLED=true \
npm run dev:server > /tmp/mmx-phase2c-c2-safe.log 2>&1 &

sleep 3
curl -s http://localhost:8787/api/health | python3 -m json.tool
# 必须看到: realGenerationEnabled: false
```

**期望结果**：
- `ok: true`
- `generationSource: "minimax"`
- `trackId` 存在
- `audioUrl` 存在
- `downloadUrl` 存在

**如果 Variant A 失败**（`invalid params`）：
- 停止，不要自动跑 Variant B
- 记录 `requestId`，发给 MiniMax 支持

---

## Variant B: Minimal Hex Instrumental

**目标**：如果 Variant A 的 `output_format=url` 仍然 invalid params，尝试 `output_format=hex`。

```bash
# 临时修改 constants.ts：
# export const DEFAULT_OUTPUT_FORMAT = 'hex' as const

# 然后重新启动真实 server 并重试。
```

**注意**：`hex` 模式可能需要 `stream=true`，这会改变响应格式。当前 adapter 不支持 stream=true。如果 Variant A 失败，应该先向 MiniMax 确认为什么 `url` + minimal payload 仍然 invalid params。

---

## Variant C: 带 audio_setting 的完整 payload

**目标**：如果 Variant A 成功，验证带 `audio_setting` 的完整 payload 也能工作。

```bash
# 在 UI 中选择 44.1kHz / 320kbps 音质，然后生成。
```

---

## 执行规则

1. **不自动重试**：Variant A 失败后，停止，不要跑 B/C
2. **一次一个**：每次只能有一个 variant 处于真实模式
3. **立即切回**：生成后立即切回安全模式
4. **记录 requestId**：每次尝试都要记录 requestId
5. **不跑 mmx music generate**：不调用 mmx CLI 作为替代
