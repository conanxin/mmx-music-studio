# Public-Lite Demo Ready Pack

Date: 2026-06-26

## Goal

Move the production Public-Lite BYOK queued generation experience from "available but easy to miss" to "demo ready for first-time users".

The target version remains the 5-person lightweight public BYOK queued generation mode:

- Users bring their own MiniMax API Key.
- Public Lite is capped at up to 5 active users.
- Generation tasks are queued and executed one at a time.
- API Keys are not persisted.
- This is still not a broad public launch.

## What Changed

- Studio now shows an obvious three-step usage guide:
  1. Prepare your own MiniMax API Key.
  2. Enter the API Key and music description.
  3. Submit, wait in the queue, then play, download, or view the result in Library.
- Studio now includes five one-click prompt templates:
  - Lo-fi study beat
  - 赛博朋克电子乐
  - 国风器乐
  - 儿童绘本背景音乐
  - 史诗电影预告片配乐
- Template clicks only fill the BYOK form state. They do not submit a generation request.
- The home page now explains the Public-Lite demo in product language:
  - 5-person lightweight public BYOK demo
  - use your own MiniMax API Key
  - this site does not persist API Keys
  - generation tasks run through a queue
  - generation pauses when active-user capacity is full
- The home page highlights the latest playable non-demo Library track when one exists. If no playable real track exists, it shows a normal empty explanation instead of hardcoding a track id.

## Cost Notes

- MiniMax generation fees are charged to the user's own MiniMax API Key/account.
- Server hosting and site operation costs are covered by the site maintainer.
- The app does not add a shared server-side MiniMax key.

## Safety Boundaries Kept

- BYOK queued generation backend path is unchanged.
- BYOK live direct window is not opened.
- No account system is added.
- No payment system is added.
- No admin dashboard is added.
- No 5-way concurrent generation is added.
- API Keys are not written to disk, browser storage, Library, manifest, logs, or Git.
- Templates do not auto-submit and do not call MiniMax.

## Verification Plan

- `npm run typecheck`
- `npm run typecheck:server`
- `npm run build`
- `npm run release:check`
- `git diff --check`

## Production Runtime Note

Production may have runtime-only guard state at `storage/guard/public-generation-guard.json`.
That file should be ignored in the production worktree, not committed, not deleted, and not read for sensitive content during this phase.
