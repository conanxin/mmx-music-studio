# mmx-music-studio v0.4.5-alpha

> Release date: 2026-06-09
> Public URL: https://music.conanxin.com

## What is this release?

This release adds public landing and onboarding polish for the live site at https://music.conanxin.com. It helps first-time visitors quickly understand what the project is, how to start creating music, and where to manage generated tracks — without needing to read documentation first.

## Highlights

### New public landing page hero

- **Title**: "MMX Music Studio" — clearly identifies the product
- **Public access badge**: "公网已启用 · 推荐 MMX CLI 模式" with live green indicator dot
- **Recommended backend**: MMX CLI backend remains the default recommended path
- **BYOK API Adapter**: Verified once in v0.4.2-alpha; still marked as experimental

### Quick Start onboarding

3-step visual guide on the homepage:

1. **Write a music description** — e.g., "深夜编程，Coffee Jazz"
2. **Click generate, wait for completion** — MMX CLI backend, local, no API key required
3. **Play, download, or favorite** — MP3 download, favorites in Library

### Status cards

Live-status card showing:

- Public URL: `music.conanxin.com` (linked)
- Recommended backend: `MMX CLI`
- Current version: `v0.4.5-alpha`
- API Adapter: `BYOK · 已验证`

### Capability cards

Four cards linking to key sections:

- **Studio 创作** — text-to-music generation
- **Library 作品库** — search, favorites, track detail, MP3 download
- **BYOK API Adapter** — bring-your-own-key, experimental
- **Cloudflare Tunnel** — public HTTPS access without SSH tunnel

### Navigation polish

- **Home nav item**: "首页" added to the top navigation bar
- **Logo click**: Logo now links back to the homepage (`/` route)
- Active state highlighting on the current page

### Footer polish

- **Release Notes link**: links to `CHANGELOG.md` on GitHub
- Footer links: 设置 / 文档 / 作品库 / Release Notes / MIT License disclaimer

### Mobile homepage responsive polish

- **639px breakpoint**: Quick Start stacks vertically, status cards wrap, capability cards go2-column
- **389px breakpoint**: Capability cards go single-column, CTA buttons go full-width
- No horizontal overflow on any screen size

## Current backend

Recommended default remains:

```
REAL_GENERATION_ENABLED=true
MOCK_GENERATION_ENABLED=false
MINIMAX_BACKEND=cli
GENERATION_ACCESS_ENABLED=false
```

No real generation is performed by the landing page itself.

## Related prior releases

| Release | Key feature |
|---------|-----------|
| [v0.4.2-alpha](https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.2-alpha) | BYOK API Adapter real-call verified |
| [v0.4.3-alpha](https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.3-alpha) | Public UX polish release |
| [v0.4.4-alpha](https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.4-alpha) | Studio generation flow polish release |

## Known limitations

- **Cloudflare Access** (auth layer) is not enabled yet — the site is publicly accessible without login
- **BYOK API Adapter** is real-call verified once but still experimental for sustained production-style usage
- **Browser favorites** are `localStorage`-only — clearing browser data will reset favorites
- **Async task polling** (`task_id` response path) remains a future compatibility item (Phase API-Debug-E)

## Verification

All smoke tests pass:

- `product-polish-smoke-test.sh` — 13/13 ✅
- `product-polish-b-smoke-test.sh` — 15/15 ✅
- `product-polish-c-smoke-test.sh` — 22/22 ✅
- `product-polish-d-smoke-test.sh` — 26/26 ✅
- `readme-render-smoke-test.sh` — 14/14 ✅
- `api-adapter-real-success-record-smoke-test.sh` — 19/19 ✅
- Secret scan: CLEAN (242 files)

GitHub Actions CI: all gates pass. No real generation or quota consumption in this release.

## How to use

Visit https://music.conanxin.com — no SSH tunnel required.

1. Read the Quick Start on the homepage
2. Click "开始创作" to go to Studio
3. Type a music description or use example chips
4. Click "生成音乐" — backend is MMX CLI (no API key needed)
5. When done, play the track or download as MP3
6. Click "收藏" to save to Library
7. Go to Library to search and manage all your tracks

## Contributing

This is an open-source project under MIT License. Not affiliated with MiniMax.

Repository: https://github.com/conanxin/mmx-music-studio