# mmx-music-studio v0.4.11-alpha

## What is this release?

This release improves the global playback experience with persistent queues, playback modes, and progress memory.

The Library can now work more like a real music player: users can play a filtered list, keep the queue across refreshes, switch playback modes, and resume from recent playback progress.

## Highlights

- **Persistent playback queue** using browser localStorage (`mmx-studio:playback-queue:v1`)
- **Playback progress memory** using browser localStorage (`mmx-studio:playback-progress:v1`)
- **Four playback modes:**
  - `sequence` — play to end, stop
  - `repeat-all` — loop the entire queue
  - `repeat-one` — repeat the current track
  - `shuffle` — random next, avoid immediate repeat
- Queue is saved automatically when tracks are added, removed, cleared, or jumped
- Playback mode is saved across sessions
- Queue panel improvements:
  - Current mode label (顺序 / 列表循环 / 单曲循环 / 随机)
  - Clickable queue items → jump directly to that track
  - Remove individual track
  - Clear entire queue
  - Current track indicator
- Audio ended event now respects playback mode
- Mobile queue panel polish (70vh max-height on small screens)

## Current Runtime

| Item | Value |
|------|-------|
| Public URL | https://music.conanxin.com |
| Backend | `cli` |
| systemd service | active |
| Cloudflare Tunnel | active |
| Auth guard | enabled (PIN brute-force protection) |
| Audit logging | enabled |

## Notes

- Playback queue and progress are stored **only in the current browser** (localStorage)
- No new generation is performed for this release
- CLI backend remains the recommended default path
- BYOK API Adapter remains real-call verified but experimental

## Known Limitations

- Queue is **browser-local only** — no cross-device sync
- Drag-and-drop queue sorting is not implemented yet
- Cloudflare Access is not enabled
- Playback progress resumes only on track reload (not auto-play on restore)
