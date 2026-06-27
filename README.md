# mmx-music-studio

[![GitHub Repo](https://img.shields.io/badge/GitHub-mmx--music--studio-blue?logo=github)](https://github.com/conanxin/mmx-music-studio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Release](https://img.shields.io/badge/Release-v0.5.0--public--lite--byok-red.svg)](https://github.com/conanxin/mmx-music-studio/releases/tag/v0.5.0-public-lite-byok)
[![CI](https://github.com/conanxin/mmx-music-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/conanxin/mmx-music-studio/actions/workflows/ci.yml)

**A self-hosted Public Lite BYOK MiniMax music generation demo.**

中文说明：[README.zh-CN.md](README.zh-CN.md)

> Disclaimer: this is an unofficial open-source project. It is not affiliated with, endorsed by, or sponsored by MiniMax.

## Current Release

Current version: **v0.5.0-public-lite-byok**

This release packages the project as a small-scale Public Lite BYOK music generation demo for sharing and user feedback.

- Online demo: https://music.conanxin.com/
- Studio: https://music.conanxin.com/studio
- Release notes: [docs/launch/V0_5_0_PUBLIC_LITE_BYOK_RELEASE.md](docs/launch/V0_5_0_PUBLIC_LITE_BYOK_RELEASE.md)
- Share copy: [docs/launch/SHARE_COPY_PUBLIC_LITE_BYOK.md](docs/launch/SHARE_COPY_PUBLIC_LITE_BYOK.md)
- Feedback checklist: [docs/launch/FEEDBACK_CHECKLIST_PUBLIC_LITE_BYOK.md](docs/launch/FEEDBACK_CHECKLIST_PUBLIC_LITE_BYOK.md)

## What It Does

mmx-music-studio is a web-based AI music creation demo built around a BYOK flow: users bring their own MiniMax API Key and submit a music prompt through the Studio page.

Core behavior:

- Users bring their own MiniMax API Key.
- API Key handling is memory-only for the queued job and is not stored on disk, in browser storage, in Library metadata, in manifests, in logs, or in Git.
- Public Lite mode supports up to 5 active users.
- Generation jobs are queued with `concurrency=1`.
- Generated tracks can be played, downloaded, and viewed in Library.
- Studio includes a three-step guide and prompt templates to help first-time users start quickly.

## Quick Start

### Local Development

```bash
npm install
npm run dev:full
```

Expected local URLs:

- Web: http://localhost:5174
- API: http://localhost:8787

Windows / Codex Desktop fallback:

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev
```

### Production Build

```bash
npm install
npm run build
npm run start
```

### Docker

```bash
docker compose up -d
```

Then open http://localhost:8787.

## Project Structure

```text
src/                  Web UI
src/features/studio/  Studio BYOK creation flow
src/features/library/ Library playback and track browsing
server/               API server, queue, storage, BYOK helpers
scripts/              Smoke tests, release checks, deployment helpers
docs/                 Launch, deployment, release, and archive docs
storage/              Runtime track and guard state (not for secrets)
```

## Verification

Common checks before publishing changes:

```bash
npm run typecheck
npm run typecheck:server
npm run build
npm run release:check
git diff --check
```

The release check includes static BYOK safety checks, Public Lite checks, manifest audit, and secret scanning.

## Security Notes

- Do not commit API Keys, tokens, secrets, provider credentials, or Authorization headers.
- BYOK live direct window stays closed unless an operator explicitly opens it through the guarded runbook.
- No server-side shared MiniMax API Key is required for the Public Lite BYOK demo.
- MiniMax generation cost is paid by the user account behind the user-provided API Key.
- Server hosting cost is maintained by the site owner.

## Historical Notes

Long historical phase notes were moved out of the README homepage. See:

- [docs/archive/README_PHASE_HISTORY.md](docs/archive/README_PHASE_HISTORY.md)
- [docs/launch/](docs/launch/)
- [docs/release/](docs/release/)

## License

MIT
