# mmx-music-studio v0.4.9-alpha

**Release date:** 2026-06-10
**Type:** Global mini player and playback continuity

---

## What is this release?

This release adds a **global mini player** and playback continuity across Studio and Library. Users can start playback from the Library or after a Studio generation, keep the current track visible while navigating between pages, and access quick actions from a fixed bottom bar.

---

## Highlights

### Global mini player added at the app layout level
A fixed bottom player appears whenever a track is set as currently playing. It persists across page navigations (Home / Studio / Library).

### Shared GlobalPlayerTrack type
`src/lib/globalPlayerTrack.ts` exports a shared `GlobalPlayerTrack` interface used by App.tsx, Layout.tsx, Studio.tsx, and Library.tsx — avoiding circular import issues.

### App-level current playing track state
`src/App.tsx` holds `const [currentPlayingTrack, setCurrentPlayingTrack]` at the top level. Both Studio and Library receive `currentPlayingTrack` and `onSetPlayingTrack` as props.

### Library play action now opens the global player
Clicking any play button in the Library (card or detail drawer) routes playback to the global mini player instead of creating an independent local Audio instance.

### Studio generated tracks enter the global player after success
After a successful generation (mock or real), Studio calls `onSetPlayingTrack(displayToGlobal(display))` so the new track immediately appears in the global player.

### Bottom fixed player includes:
- Current track title (truncated with ellipsis)
- Source label (mmx-cli / minimax-api / mock)
- Play / Pause button (accent colored)
- Download button
- Close (dismiss player)
- "View Library" shortcut

### Mobile playback polish
- Fixed bottom layout with `position: fixed`
- Compact controls (title 13px, icon-only Library shortcut)
- `padding-bottom: 60px` on `.main` to prevent content overlap

---

## Current runtime

| Item | Value |
|------|-------|
| Public URL | `https://music.conanxin.com` |
| Backend | `cli` |
| Systemd service | `active` |
| Cloudflare Tunnel | `active` |
| BYOK API Adapter | Verified once, experimental |

---

## Notes

- **No new generation is performed for this release.** This is a pure UX/stability release.
- CLI backend remains the recommended default path.
- Global player state is **browser-session only** — not persisted to server or localStorage.
- No persistent playlist, queue, or next-track automation yet.

---

## Known limitations

- No persistent playlist (server-side)
- No queue / next-track automation
- Favorites remain browser-local (`mmx-studio:favorites`)
- Async API task polling (BYOK mode) remains future work

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/globalPlayerTrack.ts` | **New** — shared GlobalPlayerTrack interface |
| `src/App.tsx` | **New** — top-level `currentPlayingTrack` state |
| `src/components/Layout.tsx` | **New** — GlobalMiniPlayer with audio playback engine |
| `src/components/Layout.module.css` | **New** — fixed bottom player CSS + mobile polish |
| `src/features/studio/Studio.tsx` | Generation success wires to global player |
| `src/features/library/Library.tsx` | Play buttons delegate to global player |
| `scripts/product-polish-g-smoke-test.sh` | **New** — 24-item static smoke test |