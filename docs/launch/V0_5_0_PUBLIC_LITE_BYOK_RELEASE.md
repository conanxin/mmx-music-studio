# v0.5.0-public-lite-byok

## One-Line Summary

5 人内轻量公开 BYOK AI 音乐生成 demo。

This release packages the current Public-Lite BYOK flow into a shareable demo build for small-circle trials and feedback.

## Access

- Home: https://music.conanxin.com/
- Studio: https://music.conanxin.com/studio

## Core Capabilities

- Users generate music with their own MiniMax API Key.
- The site does not save API Keys.
- BYOK generation tasks run through a queue.
- The public demo supports up to 5 active users.
- Generated music can be played and downloaded from the Library.
- Studio includes a three-step guide and one-click prompt templates for first-time users.
- The homepage highlights the latest real generated track when one is available.

## Verified

- Real BYOK generation loop completed.
- Audio playback and MP3 download verified.
- Generated track visibility in Library verified.
- `jobQueue concurrency=1` verified.
- `hasServerKey=false` verified.
- Public Lite capacity endpoint verified with `maxActiveUsers=5`.
- API Key persistence boundary verified: no disk, browser storage, Library, manifest, logs, or Git persistence.

## Safety Boundaries

- This is a small-scale demo and not a broad public launch.
- No server-side shared MiniMax API Key is configured.
- Users are responsible for their own MiniMax API Key and generation cost.
- The site maintainer covers server hosting cost.
- No account system, payment system, admin dashboard, or 5-way concurrent generation is included.
- BYOK live direct window remains closed.

## Suggested Trial Flow

1. Open https://music.conanxin.com/studio.
2. Choose a template or write a short music description.
3. Enter your own MiniMax API Key.
4. Complete Turnstile if prompted.
5. Submit the task and wait in the queue.
6. Play, download, or view the result in Library after completion.

## Feedback

Use `docs/launch/FEEDBACK_CHECKLIST_PUBLIC_LITE_BYOK.md` for trial feedback.
