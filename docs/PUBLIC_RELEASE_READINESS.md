# Public Release Readiness — mmx-music-studio

> 文档版本：v0.4.25-alpha · 2026-06-11
>
> **Current Release: v0.4.25-alpha — Storage-B0 operator cleanup dry-run and safety design release.** Storage-B0 is **dry-run only**: `destructive=false`, no files deleted, no server schema migration, no generation. Current cleanup candidates: **0**. `/ops` and `/api/status` remain protected by Cloudflare Access; `/api/health` remains public; `/api/generate` remains protected by Launch Guard.

****Phase BYOK-A shipped (commit 42c3ef3).** Public BYOK generation readiness. Server-side relay scaffold only; BYOK is **disabled by default** at `POST /api/generate/byok`. Phase BYOK-A returns `byok_dry_run_only` (does NOT call real MiniMax). User keys are not written to disk / logs / metadata / track object; not put in `localStorage` / `sessionStorage` / `IndexedDB` / URL query. Users pay with their own MiniMax account -- billing responsibility on user. Design: `docs/security/BYOK_PUBLIC_GENERATION_DESIGN.md`.

**Current release**: v0.4.28-alpha

**Phase BYOK-B in progress (commit pending).** Controlled BYOK relay test. Phase BYOK-C: protocol ready (`PROTOCOL_READY_NO_LIVE_CALL`), no live call executed.

**Phase BYOK-C status**: `PROTOCOL_READY_NO_LIVE_CALL` -- 单次 live call 的可审计协议已交付,smoke test 通过,本轮未提供 operator confirmation,因此未执行真实 MiniMax live call。详细报告: [`docs/security/BYOK_SINGLE_LIVE_CALL_TEST_REPORT.md`](security/BYOK_SINGLE_LIVE_CALL_TEST_REPORT.md)。

**关键口径**: BYOK-C 已完成单次 live call 的可审计协议与 smoke test,但本轮未提供 operator confirmation,因此未执行真实 MiniMax live call。 BYOK-B adds a `fake / live` switch to the public endpoint, gated by three env flags: `PUBLIC_BYOK_ENABLED=true`, `BYOK_LIVE_ENABLED=true`, `BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST`. The default behavior is `byok_dry_run_only`. The fake mode returns `byok_fake_relay_ok` deterministically with no provider call. Live mode exists but is intentionally unreachable without all three env flags set at process start. The user-supplied `apiKey` is injected into a child `mmx` process environment as `MINIMAX_API_KEY=<userKey>`; the site operator's `MINIMAX_API_KEY` is explicitly stripped. Provider stdout / stderr / error messages go through `redactCliOutput`. UI status codes handled by `ByokPanel.tsx`: `byok_dry_run_only`, `byok_fake_relay_ok`, `byok_live_relay_ok`, `byok_live_not_enabled`, `byok_live_confirmation_required`, `byok_provider_error*`.

**Final wording (do not weaken)**: **"BYOK-B 已完成受控 fake/live relay 测试结构，但真实 MiniMax live call 仍未执行。"** No claim that a real MiniMax call has been verified, no claim that BYOK public launch is open, no claim that a user can paste a Key and generate for real today. A true broad public BYOK launch should consider `Phase Deploy-CF-D` Turnstile / abuse control before enabling `BYOK_LIVE_ENABLED=true` for the public route. Design: `docs/security/BYOK_LIVE_RELAY_TEST_DESIGN.md`.

## Release notes

- **v0.4.23-alpha — Library UX polish and timeline clarity release**
  - Library current view summary improved
  - Library empty states improved
  - Export / backup local-only clarification improved
  - **Library interaction polish round 3 (Phase Product Polish-P)**:
    - Active filter chips with per-chip remove buttons (来源 / 集合 / 标签 / 搜索)
    - Per-filter clear handlers (search / source / collection / tag) — single filter clear without affecting others
    - Search match hints on each track card (matching 标题 / Prompt / 歌词 / 模式 / 来源 / 标签 / 备注, max 3)
    - Batch operation scope hints (批量操作将作用于已选择的 N 首作品 / 请选择作品后再执行批量操作)
    - Timeline action filters a11y polish (role=group, aria-label, per-chip title)
    - Accessibility polish across batch toggle, track checkbox, filter chips, drawer buttons
    - Mobile polish: activeFilterChip wrap, match hint ellipsis, batchScopeHint role=status
    - **Filter chips are browser-local UI state only** (not persisted, not uploaded)
    - **Search match hints do not expose prompt/note full text** — only categorical labels
    - No upload to server, no server schema migration
  - No server upload
  - No server schema migration
  - `/ops` and `/api/status` remain protected by Cloudflare Access

## Current Public URL

**https://music.conanxin.com**

## Current Release

**v0.4.27-alpha** — BYOK readiness and controlled relay protocol release

- BYOK-A 已完成 (commit 42c3ef3): safe BYOK readiness skeleton, `/api/generate/byok` 端点, default disabled, dry-run default, redaction helper.
- BYOK-B 已完成 (commit 8e22680): controlled fake/live relay modes, fake mode 已端到端验证, live mode scaffold + 三把钥匙 gate + key 隔离 + redaction 已就位.
- BYOK-C 已完成协议层 (commit 1cde092): `PROTOCOL_READY_NO_LIVE_CALL`, smoke 35/35 PASS, 本轮未提供 operator confirmation, 因此未执行真实 MiniMax live call.
- BYOK 默认状态保持 disabled / dry-run.
- 不 broad public BYOK launch.
- /ops 与 /api/status 仍受 Cloudflare Access 保护.
- /api/health 仍公开.
- /api/generate 仍受 Launch Guard 保护.
- /api/generate/byok 仍 disabled (除非 operator 显式配置).
- 没有提交 key / .env / provider raw response / tsconfig.tsbuildinfo / storage runtime.
- 不移动旧 tag (v0.4.20-alpha..v0.4.25-alpha 全部 commit 不变).

完整 release notes 见 [`docs/release/RELEASE_NOTES_v0.4.26-alpha.md`](../release/RELEASE_NOTES_v0.4.26-alpha.md).

**关键口径**: BYOK-C 已完成单次 live call 的可审计协议与 smoke test, 但本轮未提供 operator confirmation, 因此未执行真实 MiniMax live call.

**Next recommended phases**:

- Operator-approved BYOK-C live call (only after explicit operator confirmation).
- Phase Deploy-CF-D Turnstile (before any broad public BYOK launch).
- Phase BYOK-D Direct HTTPS API Relay Design (current — design only, no live calls).
- Phase BYOK-E Official API Schema Validation.
- Phase BYOK-F Direct API Implementation (gated, no broad public launch).
- Phase Deploy-CF-D Turnstile (before any broad public BYOK launch). launch (only after live verification + abuse controls).

**v0.4.23-alpha** — Library UX polish and timeline clarity release

**v0.4.22-alpha** — Annotation timeline and batch notes release

**Phase Product Polish-O (pending closeout)** — Library UX polish round 2:
- Current view summary and clear-all-filter controls
- Library local-only annotations / export / backup explanations improved (collection link only copies filter conditions, local backup does not include audio, no server upload)
- Batch toolbar grouping (选择 / 批量标注 / 导出, three groups)
- Drawer hierarchy polish (标签与备注 section heading, drawer section dividers, timeline hint inline)
- Timeline readability polish (border consistency)
- No server upload, no server schema migration (Phase Release v0.4.22-alpha: per-track annotation timeline with 7 action badges + 查看全部 / 收起, Library-wide 标注历史总览 (collapsible, 20 latest, 4 filter chips, no 清空 button), batch note editor (overwrite / append modes, 500-char cap, `note_updated` history with all selected trackIds), improved Library mobile polish for timeline and batch note controls, included Release workflow fix after v0.4.21-alpha: removed `gh release create --verify-tag` (401 with `${{ github.token }}`); `product-polish-n-smoke-test` 55/55 PASS; all 15 smoke tests green, all 4 typecheck/build green)

**v0.4.21-alpha** — Protected Ops and release automation closeout (Phase Release v0.4.21-alpha: verified Cloudflare Access protection for `/ops`, `/ops/*`, `/api/status`, `/api/debug/*` at the edge; `/`, `/library`, `/studio`, `/api/health` remain public; `/api/generate` remains owned by the server-side Launch Guard; added and verified automatic GitHub Release workflow `.github/workflows/release.yml` with tag-push trigger + `workflow_dispatch` backfill + zip safety check + built-in `${{ github.token }}`; backfilled `v0.4.18-alpha`, `v0.4.19-alpha`, `v0.4.20-alpha`; `deploy-cf-c-access-smoke-test` 12/12 PASS)

**v0.4.20-alpha** — Collection sharing, tag cleanup, and annotation history release (Phase Product-Polish-M: annotation history `mmx-studio:annotation-history:v1` cap 300 entries (7 action types: tag_added, tag_removed, batch_tag_added, batch_tag_removed, note_updated, backup_import_merge, backup_import_replace), batch remove tag (case-insensitive), collection URL state `?q=&source=&collection=&tag=` via `history.replaceState`, share link button, drawer 最近标注历史 list, backup v1.0 now includes annotationHistory with backward compat for older backups, collection Markdown/JSON export now include collectionUrl + filters, mobile CSS, smoke test 67/67)

**Phase Product Polish-N** — Annotation timeline, batch note editing, and Library polish (browser-local only, no server upload, no schema migration, no generation): per-track 标注时间线 (collapse: 5, expand: 300 via 查看全部 / 收起), action badges (添加标签 / 删除标签 / 批量添加标签 / 批量删除标签 / 更新备注 / 合并导入 / 覆盖导入), Library-wide 标注历史总览 折叠面板 (最近 20 条 + filter chips: 全部 / 标签变更 / 备注变更 / 导入), batch note editor in batch toolbar (覆盖备注 / 追加到备注, 500-char cap, records `note_updated` history with all selected trackIds), mobile CSS (historyFilterRow horizontal scroll, batch note full-width), smoke test 51/51 PASS

**v0.4.19-alpha** — Collections export, library batch actions, and annotation backup release (Phase Product-Polish-L: `libraryBackup.ts` with LibraryLocalBackupV1 model, batch mode checkbox + select-all + batch add tag, current/selected collection export Markdown/JSON with smart-collection labels, local backup panel with merge/replace import, mobile adaptation, smoke test)

**v0.4.18-alpha** — Tags, notes, and smart collections release (Phase Product-Polish-K: trackAnnotations.ts, Library annotation editor, tag chips, smart collections, tag filter, enhanced search, Markdown export tags/notes, localStorage browser-only)

**v0.4.17-alpha** — Read-only operations panel release (Phase Ops-Monitor-B: `/ops` page, service/Launch Guard/job queue/storage summary cards, copyable diagnostics, manual refresh, 30s auto-refresh, mobile layout, Ops-Monitor-B smoke test)

**v0.4.15-alpha** — Public runtime diagnostics release (Phase Ops-Monitor-A: `/api/status`, job queue/storage aggregates, ops monitoring docs)

## What is Ready

- CLI backend generation (MMX CLI — recommended default)
- Studio prompt templates
- Library: search, favorites, details, sharing, Markdown export
- Global mini player
- Persistent playback queue with 4 modes
- Playback progress memory (localStorage)
- BYOK API Adapter `direct_audio` verified once
- Async polling readiness (types + Studio error UX)
- HTTPS via Cloudflare Tunnel
- Public generation guardrails (Phase Launch Guard-A)
- Public runtime diagnostics (Phase Ops-Monitor-A: `/api/status`, job queue/storage aggregates)
- Storage management and retention planning (Phase Storage-A: inventory, dry-run, backup manifest, no auto-deletion)
- **Phase Storage-B0** (promoted to v0.4.25-alpha): operator-confirmed cleanup **dry-run + safety design only** (no deletion). `storage-b-operator-cleanup-dry-run.sh` reports orphan/missing/old candidates and emits a JSON manifest with sha256 + paths + `destructive: false`; `storage-b-confirmation-guard.sh` enforces `STORAGE_B_CONFIRMATION=CONFIRM_STORAGE_B_CLEANUP` (rejects by default, never deletes). The actual deletion logic is a **separate future phase (Storage-B1)** that will only run after a human operator confirms the B0 manifest. No `/api/generate` calls, no music generation, no server schema change, no runtime storage committed.
- Read-only operations panel (Phase Ops-Monitor-B: OpsPanel.tsx, `/api/health`+`/api/status` aggregation, launch guard/job queue/storage status cards, copyable diagnostic summary, auto-refresh, nav entry, mobile CSS)
- Browser-local Library annotations (Phase Product-Polish-K: track tags, notes, smart collections, tag filter, enhanced search, Markdown export with tags/notes, `mmx-studio:track-annotations:v1` localStorage)
- Library batch actions, collections export, local annotation backup (Phase Product-Polish-L: `libraryBackup.ts` with LibraryLocalBackupV1 model, batch mode checkbox + select-all/clear + batch add tag (≤12 tags, ≤24 chars), current/selected collection export Markdown/JSON with smart-collection labels, local backup panel exporting/importing localStorage data with merge or replace — no server upload, no schema migration)
- Collection sharing, tag cleanup, annotation history (Phase Product-Polish-M: `mmx-studio:annotation-history:v1` cap 300, 7 action types, batch remove tag (case-insensitive), collection URL state `?q=&source=&collection=&tag=` via `history.replaceState`, share link button copies current filter URL, drawer `最近标注历史` last 5 actions per track, `LibraryLocalBackupV1.annotationHistory` field with backward compat for v1.0 backups, collection Markdown/JSON export now include `collectionUrl` + `filters`)
- Cloudflare Access for Ops / Status (Phase Deploy-CF-C: `docs/deploy/CLOUDFLARE_ACCESS_OPS.md`, protects `/ops`, `/ops/*`, `/api/status`, `/api/debug/*`; keeps `/`, `/library`, `/studio`, `/api/health` public; `/api/generate` remains owned by Launch Guard; Access configured in Cloudflare Dashboard, not in app code; smoke test `scripts/deploy-cf-c-access-smoke-test.sh` returns `DEPLOY_CF_C_ACCESS_PENDING` before Dashboard config and `DEPLOY_CF_C_ACCESS_SMOKE_PASS` after; **verified PASS 2026-06-10** — Dashboard application `MMX Music Studio Ops` enabled, `/ops` and `/api/status` return `302` to Cloudflare Access login, public paths unchanged)

## What Remains Alpha / Experimental

| Item | Status |
|------|--------|
| BYOK API Adapter | Experimental — verified `direct_audio` once |
| Async polling | Design-only — endpoint not confirmed |
| Cloudflare Access | ✅ Enabled (Phase Deploy-CF-C verified 2026-06-10) |
| Queue / local preferences | Browser-local only, no cross-device sync |
| Account system | None |
| Production SLA | None |

## Public Generation Guardrails

The public deployment includes lightweight generation guardrails (Phase Launch Guard-A):

- `PUBLIC_GENERATION_ENABLED=false` can pause public generation without disabling Library or playback
- `PER_SOURCE_DAILY_GENERATION_LIMIT` enforces a per-source daily generation cap (default: 5)
- `GENERATION_COOLDOWN_SECONDS` enforces a minimum interval between generations from the same source (default: 30s)
- Source identification uses SHA256 hashing (`cf-connecting-ip` / `x-forwarded-for` / `remoteAddress`) — raw IP addresses are never stored
- Guard state is stored in `storage/guard/public-generation-guard.json` (gitignored, atomic write with `.tmp` + rename)
- Daily auto-reset at midnight

These guardrails are intended for public alpha protection. They are not a replacement for accounts, billing, or full abuse-prevention infrastructure.

### Phase BYOK-C-Hotfix: disable unsafe CLI live path

- **Status**: **LIVE PATH DISABLED**
- **What**: BYOK live preflight 中发现 mmx CLI key fallback bug。CLI 忽略 `MINIMAX_API_KEY` env，fallback 到 `~/.mmx/config.json` operator key。placeholder 测试意外生成真实 MP3（已删除）。
- **Current state**:
  - fake mode: ✅ 可用
  - dry-run mode: ✅ 可用（默认）
  - live mode: ❌ **不可用**
- **Public claim**: BYOK live 生成**不可用**。不要声称用户填 Key 就能真实生成。
- **Next**: BYOK-C2 direct HTTPS API relay design


### /api/health Guard Fields

```json
{
  "launchGuardEnabled": true,
  "publicGenerationEnabled": true,
  "perSourceDailyLimit": 5,
  "generationCooldownSeconds": 30
}
```

### Error Codes

- `public_generation_paused` — global generation pause active
- `per_source_daily_limit_exceeded` — source reached daily cap
- `generation_cooldown_active` — source must wait before next generation

## Data Notes

| Data type | Storage | Notes |
|-----------|---------|-------|
| Favorites | Browser localStorage | `mmx-studio:favorites` |
| Prompt templates | Browser localStorage | `mmx-studio:prompt-templates` |
| Playback queue | Browser localStorage | `mmx-studio:playback-queue:v1` |
| Playback progress | Browser localStorage | `mmx-studio:playback-progress:v1` |
| Track annotations | Browser localStorage | `mmx-studio:track-annotations:v1` (tags, note per trackId) — browser-local only, not synced to server |
| Generated track metadata | Server-side | For Library display and playback |
| BYOK API keys | Memory only | Not written to disk; 30-min TTL |
| Guard state | `storage/guard/public-generation-guard.json` | SHA256 source hash, no raw IPs |

## Pre-Launch Checklist

- [x] Public URL returns HTTP 200
- [x] `/api/health` backend is `cli`
- [x] Secret scan is clean
- [x] Typecheck passes
- [x] Build passes
- [x] WeApp build passes
- [x] Product smoke tests pass (A–L)
- [x] API adapter smoke tests pass
- [x] systemd service smoke passes
- [x] Launch Guard enabled
- [x] `/api/health` exposes guard status
- [x] No runtime guard state committed
- [x] Release notes available
- [ ] GitHub Release manually uploaded (zip asset)

## Feedback Channels

- **Issues:** https://github.com/conanxin/mmx-music-studio/issues
- **Source:** https://github.com/conanxin/mmx-music-studio
- **Release Notes:** https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.13-alpha