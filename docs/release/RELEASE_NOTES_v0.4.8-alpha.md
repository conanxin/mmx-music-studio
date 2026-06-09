# mmx-music-studio v0.4.8-alpha

**Prompt templates and style presets release**

---

## What is this release?

This release adds a structured **prompt template and style preset system** to the Studio page. Instead of starting from a blank prompt, users can now combine scene, mood, instrument, and usage tags to generate a more complete, editable music description — then apply it to the prompt field before generating.

---

## Highlights

### New Studio template composer
A collapsible "🎵 模板组合器" panel sits below the prompt textarea. It presents four preset groups:

| Group | Label | Sample options |
|-------|-------|----------------|
| 🏞 Scene | 场景 | 深夜编程, 清晨通勤, 夏夜海边, 咖啡馆阅读, 纪录片旁白, 游戏菜单, 健身运动, 睡前放松 |
| 💭 Mood | 情绪 | 温柔, 松弛, 明亮, 孤独, 史诗感, 复古, 浪漫, 神秘 |
| 🎹 Instrument | 乐器 | 钢琴, 合成器, 木吉他, 弦乐, Lo-fi鼓点, 环境音, 电子节拍, 古典吉他 |
| 🎯 Usage | 用途 | 背景音乐, 短视频配乐, 播客片头, 学习专注, 睡前放松, 产品展示, 运动健身, 冥想静心 |

Users select one chip per group, then click **"✨ 应用到描述"** to compose a prompt such as:

> 生成一段深夜编程、温柔的 Lo-fi 音乐，以钢琴和合成器为主，适合学习专注，情绪舒缓，不要人声，适合长时间聆听。

The composed prompt is written into the textarea and remains **fully editable** before the user submits generation. Selecting different chips or clicking "清空选择" resets the selection without touching the textarea.

### Browser-local custom templates
Users can save the current prompt (after editing) as a named template:

- Templates are persisted in `localStorage` under the key `mmx-studio:prompt-templates`
- Up to **20 templates** per browser
- Templates are listed under "📁 我的模板" and can be re-applied or deleted
- Saving an empty prompt, a duplicate, or exceeding the 20-template cap shows a clear inline error message

Template data is local to the current browser — no cloud sync.

### Existing inspiration chips preserved
The original "示例灵感" chips (e.g. `深夜编程、爵士、放松`) are unchanged. The template composer is a **complementary addition**, not a replacement.

### Mobile template layout
On screens `< 640 px` the template chips wrap naturally, the action buttons stack to full-width, and the template input/save row reflows to a single column.

---

## Current runtime

| Item | Value |
|------|-------|
| Public URL | `https://music.conanxin.com` |
| Backend | `cli` (recommended) |
| systemd service | `mmx-music-studio.service` — `active`, `enabled` |
| Cloudflare Tunnel | `active` — 4 San Jose connections |
| Daily generation limit | 50 (CLI backend) |
| BYOK API Adapter | Real-call verified — experimental |

---

## Notes

- Applying a template preset does **not** trigger music generation. The user reviews and submits manually.
- Templates are stored in browser `localStorage` only. Clearing browser data removes them.
- The CLI backend (`mmx music generate` via local `mmx` CLI) remains the recommended default path.
- The BYOK API Adapter has been verified with a real MiniMax API call (`task_id` → `succeeded`, `direct_audio` response kind), but remains marked experimental.
- No new generation is performed as part of this release.

---

## Known limitations

| Limitation | Status |
|------------|--------|
| Custom templates are browser-local only | By design — no cloud sync |
| Async API task polling (`task_id` → `succeeded`) | Planned — Phase API-Debug-E |
| Cloudflare Access authentication layer | Optional — Phase Deploy-CF-C |
| WeApp legal domain configuration | Pending WeChat review |

---

## What's changed since v0.4.7-alpha

| File | Change |
|------|--------|
| `src/features/studio/Studio.tsx` | Added preset groups, template composer UI, localStorage helpers, new state |
| `src/features/studio/Studio.module.css` | Template composer styles + mobile responsive |
| `scripts/product-polish-f-smoke-test.sh` | New smoke test (32 assertions) |
| `README.md` | Version badge → v0.4.8-alpha, release entry |
| `docs/DEVELOPMENT_HANDOFF.md` | Phase table updated |
| `docs/release/RELEASE_NOTES_v0.4.8-alpha.md` | This document |
| `CHANGELOG.md` | v0.4.8-alpha entry added |