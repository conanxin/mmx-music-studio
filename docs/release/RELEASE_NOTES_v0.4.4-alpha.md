# mmx-music-studio v0.4.4-alpha

**Release date:** 2026-06-09
**Type:** Studio generation flow polish release

---

## What is this release?

This release polishes the Studio generation flow — making the experience from
prompt input through to success/error feedback feel more like a product and less
like an engineering debug interface.

All changes are UX-only; no changes to generation logic, backend, or API calls.

---

## Highlights

### Studio generation flow — clearer phases

The "generating" state now shows a 4-step progress card:

1. **Creating task…** — job submitted to backend
2. **Calling generation backend…** — MMX CLI or API being invoked
3. **Waiting for audio…** — polling for result (if async)
4. **Saving to library…** — track saved, ready to play

### Prompt guidance

When the prompt field is empty, a subtle hint appears:
> "描述场景、情绪、乐器或用途，生成效果会更稳定。"

Clicking an example chip now **replaces** the current prompt (not appends),
preventing prompt pollution from repeated clicks.

### Success card

After a successful generation, a green card appears with:

- ✅ "生成成功，已保存到作品库"
- 🎵 Play current track
- ⬇️ Download MP3
- 📚 Go to library
- ✨ Continue creating

### Error classification card

Errors are now classified into 6 types, each with a specific hint:

| Error type | Title | Hint |
|------------|-------|------|
| `byok_missing` | 请先在设置中填写 BYOK Key | Open Settings → 输入 Token Plan Key |
| `quota_exceeded` | 今日生成次数已用完 | 明天再来，或切换到 CLI backend |
| `api_error` | MiniMax API 返回错误 | 检查 Key、模型或额度 |
| `async_required` | 任务已进入异步模式 | 当前版本未启用轮询，请稍后刷新作品库 |
| `network` | 网络错误 | 请稍后重试 |
| `unknown` | 生成失败 | 已记录脱敏诊断信息 |

Each card has "知道了" and "查看作品库" recovery actions.

### Mobile state card polish

All state cards (generating / success / error) are now properly styled on
mobile screens (390px) — no overflow, readable text, full-width buttons.

---

## Backend status

- **Recommended:** `MINIMAX_BACKEND=cli` + `REAL_GENERATION_ENABLED=true`
- **BYOK API Adapter:** Verified once in v0.4.2-alpha; still experimental
- **Async task polling (`task_id`):** Not confirmed yet; Phase API-Debug-E pending

---

## Verified

- ✅ GitHub Actions CI: all 6 consecutive runs `success`
- ✅ Web build: 271.94 KB JS, 1.25s
- ✅ Server typecheck: clean
- ✅ WeApp build: compiled in 4.11s
- ✅ Secret scan: CLEAN (240 files)
- ✅ Product Polish A smoke test: 13/13 PASS
- ✅ Product Polish B smoke test: 15/15 PASS
- ✅ Product Polish C smoke test: 22/22 PASS
- ✅ README rendering: clean
- ✅ Public health via Cloudflare Tunnel: `backend: cli`, `realGenerationEnabled: true`

---

## What's changed since v0.4.3-alpha

Studio only:
- `getGenerationPhaseMessage(status, elapsed)` — multi-step generation phase messages
- `classifyError(message) → ErrorType` — 6-type error classification
- `generationSuccess` state — triggers success card on job completion
- `PROMPT_TIP` constant — empty-prompt guidance
- Chip click → `handleMainInputChange(ex)` replaces (not appends)
- `ERROR_TYPE_LABELS` — per-type title + hint for error card
- Success card with 4 action buttons
- 11 new CSS classes for state cards and mobile layout

---

## Known limitations

- Favorites are browser-local only (localStorage)
- Cloudflare Access not enabled — public internet access is open
- Async API task polling (`task_id` response) unconfirmed
- WeApp not reviewed in this release

---

## Public access

**URL:** https://music.conanxin.com
**Backend:** CLI (recommended default)
**No SSH Tunnel required for normal access**