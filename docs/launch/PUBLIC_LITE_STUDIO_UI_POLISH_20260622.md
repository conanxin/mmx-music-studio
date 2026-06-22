# Public-Lite Studio UI Polish

Date: 2026-06-22

## Summary

This polish pass changes the `/studio` page from an engineering-oriented BYOK test surface into a clearer Public-Lite music creation flow.

The backend queued BYOK generation path was not changed. BYOK live direct window remains closed by default, and no real MiniMax API call was made for this work.

## What Changed

- Reframed the Studio page around the product question: "今天想创作什么音乐？"
- Added a user-facing subtitle that explains the core BYOK value: enter a description, use your own MiniMax API Key, then generate playable and downloadable music.
- Consolidated the primary path into one flow:
  - choose creation mode
  - enter music description
  - select model
  - enter MiniMax API Key
  - complete Turnstile verification
  - click "生成音乐"
  - follow queue / generation / success / failure status
  - play, download MP3, save to Library, or generate a similar style
- Moved secondary inspiration and advanced controls behind a collapsed section.
- Updated empty and result states in the right-side player to read like a product surface instead of a test console.
- Updated README and development handoff status to state that Public-Lite BYOK queued generation is available for alpha use.

## Engineering Information Hidden From The Primary View

The primary Studio view no longer foregrounds these implementation details:

- `activeUsers`
- `maxActiveUsers`
- `capacityFull`
- job queue concurrency
- BYOK live direct-window status
- internal phase labels such as BYOK-H2D / H3B / Retry

Capacity and queue notes are retained as lightweight product hints or inside the "系统状态" details panel.

## User Flow

The intended user flow is:

1. Choose a mode: 纯音乐 / 自动成歌 / 歌词成歌 / 参考改编.
2. Describe the desired music.
3. Select a supported MiniMax music model.
4. Fill in a MiniMax API Key.
5. Complete Turnstile verification when required.
6. Click "生成音乐".
7. Watch the generation state.
8. After success, play the result, download MP3, save to Library, or generate a similar style.

## Security Boundaries Unchanged

- Existing BYOK queued generation backend behavior is unchanged.
- BYOK live direct window was not opened.
- No account system was added.
- No admin dashboard was added.
- No 5-way concurrent generation was added.
- No real MiniMax API call was made during validation.
- No API key, token, secret, Authorization header, confirmation phrase, or provider URL is committed.
- API Key copy states that queued generation temporarily keeps the key in server memory for the job, then deletes it after completion, failure, cancellation, or expiry; it is not written to disk, browser storage, the Library, manifest, logs, or Git.
- Public-Lite remains alpha and is not a broad public launch.
- Public-Lite remains scoped to up to 5 active users, with single-worker queued generation.

## Verification

Run locally after implementation:

```bash
npm run typecheck
npm run build
git diff --check
```

Expected result:

- Typecheck passes.
- Build passes.
- Diff whitespace check passes.
- No production deployment, push, tag, release, BYOK live opening, MiniMax call, or real audio generation occurs in this phase.
