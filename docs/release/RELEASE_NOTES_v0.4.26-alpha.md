# mmx-music-studio v0.4.26-alpha

**Release tag**: `v0.4.26-alpha`
**Release prep commit**: (filled at tag creation time)
**Date**: 2026-06-11
**Channel**: alpha (pre-stable)
**Status**: BYOK readiness / controlled relay / single-live-call protocol

---

## What is this release?

This release promotes the **BYOK-A / BYOK-B / BYOK-C** readiness work into
the public alpha release line. It adds a **safe server-side BYOK foundation**,
**controlled fake/live relay modes**, and an **auditable single-live-call
verification protocol**.

**No real MiniMax live call was executed in this release.**

BYOK generation is **not** broadly publicly launched in v0.4.26-alpha.

---

## Highlights

- **Added** safe BYOK readiness skeleton.
- **Added** `/api/generate/byok` endpoint.
- **Added** default-disabled BYOK kill switch:
  - `PUBLIC_BYOK_ENABLED=false` (default)
- **Added** dry-run default:
  - `BYOK_DRY_RUN_ONLY=true` (default)
- **Added** controlled **fake / live** relay modes.
- **Added** BYOK live gate (all four required for live mode):
  - `PUBLIC_BYOK_ENABLED=true`
  - `BYOK_DRY_RUN_ONLY=false`
  - `BYOK_LIVE_ENABLED=true`
  - `BYOK_LIVE_CONFIRMATION=CONFIRM_BYOK_LIVE_RELAY_TEST`
- **Added** server-side redaction helper for:
  - `apiKey`
  - `Authorization`
  - `Bearer`
  - `x-api-key`
  - `token`
  - `secret`
- **Added** BYOK Studio panel (`ByokPanel.tsx`).
- **Added** fake relay verification (BYOK-B).
- **Added** single-live-call audit protocol (BYOK-C).
- **Added** BYOK-A / BYOK-B / BYOK-C smoke tests.

---

## BYOK status

| Component | Status |
|---|---|
| **BYOK-A** (safe readiness skeleton) | **PASS** |
| **BYOK-B** (controlled fake/live relay) | **PASS** |
| **BYOK-C** (single live call protocol) | **`PROTOCOL_READY_NO_LIVE_CALL`** |
| Real MiniMax live call | **not executed** |
| Broad public BYOK launch | **not enabled** |
| Default mode | **disabled / dry-run** |

---

## Safety and privacy

This release **does NOT**:

- store user keys
- write user keys to `localStorage`
- write user keys to `IndexedDB`
- write user keys to URL query
- write user keys to metadata
- write user keys to logs
- call existing `/api/generate` from the BYOK path
- use the site operator MiniMax key for BYOK
- execute a real MiniMax live call
- generate music in this release

Search / smoke / docs may contain placeholder strings (e.g. `Bearer ***`),
but **no real key material is committed**.

---

## Current runtime

- **Public URL**: <https://music.conanxin.com>
- **Backend**: `cli` (mmx CLI via subprocess)
- **Library**: <https://music.conanxin.com/library>
- **Ops panel**: <https://music.conanxin.com/ops>
- `/ops` is protected by **Cloudflare Access**.
- `/api/status` is protected by **Cloudflare Access**.
- `/api/health` remains **public**.
- `/api/generate` remains protected by **Launch Guard**.
- `/api/generate/byok` remains **disabled** unless explicitly enabled by
  operator configuration.

---

## Important wording

**Do NOT** claim that real BYOK generation is broadly available yet.

**Correct wording**:

> BYOK-C 已完成单次 live call 的可审计协议与 smoke test，但本轮未提供 operator confirmation，因此未执行真实 MiniMax live call。

**Incorrect wording** (must NOT appear in any user-facing doc, release, tweet, or blog):

- ❌ "Users can paste their Key and generate real music now."
- ❌ "BYOK public launch is live."
- ❌ "Real MiniMax live call has been verified."
- ❌ "All three BYOK phases are PASS with live verification."

---

## What's NOT in this release

- No audio was generated via BYOK in this release.
- No `/api/generate/byok` live path was executed.
- No `sk-*` / `Bearer <real>` / `eyJ...` JWT / `MINIMAX_API_KEY=<value>`
  appears in this release or in the staged set.
- No release-asset zip contains user key material.
- No `dist/` / `node_modules/` / `*.tsbuildinfo` / `logs/` / `storage/runtime/`
  is committed.

---

## Next steps

- **Phase BYOK-C live execution** may be performed later **only with explicit
  operator confirmation** (the operator must issue the phrase
  `CONFIRM_BYOK_C_SINGLE_LIVE_CALL`). Until then, BYOK-C remains
  `PROTOCOL_READY_NO_LIVE_CALL`.
- **Phase Deploy-CF-D Turnstile** should be considered **before** any broad
  public BYOK launch. Turnstile on `/api/generate/byok` reduces abuse risk.
- **Phase BYOK-D public launch** should wait until:
  1. At least one approved live call has been executed and audited.
  2. Abuse controls (Turnstile / rate limit / quota) are decided and deployed.

---

## Files added / changed in this release prep

- `docs/release/RELEASE_NOTES_v0.4.26-alpha.md` (this file)
- `CHANGELOG.md` (top entry)
- `README.md` (release section + current status)
- `docs/DEVELOPMENT_HANDOFF.md` (release line update)
- `docs/PUBLIC_RELEASE_READINESS.md` (release line update)

No source code changed in this release prep beyond docs.

---

## Linked phase reports

- **BYOK-A**: commit `42c3ef3` — safe readiness skeleton
- **BYOK-B**: commit `8e22680` — controlled fake/live relay modes
- **BYOK-C**: commit `1cde092` — single-live-call protocol
- **Live call report**: `docs/security/BYOK_SINGLE_LIVE_CALL_TEST_REPORT.md`

---

**Final wording (must appear verbatim in any user-facing communication)**:

> v0.4.26-alpha 发布 BYOK readiness / controlled relay / single-live-call protocol，但真实 MiniMax live call 尚未执行，BYOK 未 broad public launch。