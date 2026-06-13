# Public Release Readiness — mmx-music-studio

> 文档版本：v0.4.31-alpha · 2026-06-12
>
> **Current Release: v0.4.31-alpha — Frontend Turnstile widget runtime for BYOK.** Deploy-CF-E adds the front-end half of the Cloudflare Turnstile integration: the browser can now obtain a verification token and submit it with `POST /api/generate/byok`. The server-side gate from Deploy-CF-D is unchanged. It does not enable broad public BYOK launch by itself. `TURNSTILE_BYOK_REQUIRED=true` post-H1 closeout (production-safe default; was `false` pre-H1). No new live call was executed. No music was generated. No Turnstile secret, key, env, runtime storage, logs, audio, or tsconfig was committed. The front-end does not import or reference `TURNSTILE_SECRET_KEY`. The token is never written to localStorage / sessionStorage / IndexedDB / URL query, and is never displayed in the DOM or console.log'd. Valid-token E2E verification requires a production deploy of this phase (local smoke cannot exercise a real Cloudflare widget without a real key + recognised origin); BYOK-H is gated on that E2E pass.

**Current release**: v0.4.31-alpha

**Phase BYOK-H2B**: Success-Path Redacted Turnstile Log — ✅ OBSERVABILITY HOTFIX COMPLETE (this phase, no production env change).

- **Status**: OBSERVABILITY HOTFIX. Production env unchanged. Live gate stays closed. No broad public launch.
- **Env change**: None. `PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`, `TURNSTILE_BYOK_REQUIRED=true`.
- **Real MiniMax call**: None.
- **Music generated**: None.
- **Real user apiKey**: None.
- **H2A dry-run pilot planning**: PASS_WITH_KNOWN_VALIDATION_EXCEPTION (predecessor).
- **Smoke test**: `bash scripts/byok-h2b-success-log-smoke-test.sh` (18/18 PASS)
- **No release tag** created or moved. v0.4.31-alpha tag stays at `ee6a8a1`.

What H2B delivers:

- A symmetric **success-path redacted log** `[byok-turnstile-ok]` in `server/index.ts`, mirroring the failure-path `[byok-turnstile-debug]` from H1-Hotfix-C.
- Both logs are gated by the same `TURNSTILE_DEBUG_REDACTED=true` runtime flag, and only fire when `verifyTurnstileToken()` populates the `redacted` block.
- **No production env change.** **No code change to the live path.** **No release tag.**

What H2B does **not** deliver:

- BYOK live generation (still disabled).
- Pilot execution (H2C, requires operator approval).
- A new release tag.

Success-path log fields (all redacted): `requestId`, `tokenLength`, `tokenSha256_8`, `cloudflareSuccess`, `cloudflareErrorCodes`, `hostname`, `action`, `cdata`, `outcome=turnstile_ok`. Forbidden: raw token, `TURNSTILE_SECRET_KEY`, user apiKey, Authorization header, full body, provider raw response.

**关键口径**: BYOK-H2B adds success-path redacted Turnstile logging for dry-run pilot observability. It does not enable BYOK live generation or broad public launch.

**Phase BYOK-H2C**: Dry-Run Pilot Execution — ✅ **H2C_DRY_RUN_PILOT_PASS_ROLLED_BACK** (real pilot executed, production rolled back to safe default).

- **Status**: Real pilot executed. 4/4 testers PASS. 4 unique `[byok-turnstile-ok]` success-path log lines observed. 0 `[byok-turnstile-debug]` during pilot window. 8-pattern leak audit ALL CLEAR. 0 live call, 0 MiniMax call, 0 music, 0 real MiniMax key.
- **H2C deploy**: H2B commit `baaafd7` deployed to production. Build PASS, restart PASS, MainPID cycled 422764 → 428445 (post-H2A) → 437656 (H2C pilot) → 441936 (post-rollback).
- **H2C pilot window** (1 hour, since rolled back):
  - `PUBLIC_BYOK_ENABLED=true`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`, `TURNSTILE_DEBUG_REDACTED=true`
  - Drop-in: `byok-test.conf` temporarily rewritten; backup at `/tmp/byok-test.conf.h2c-pilot.20260612_221511.bak`
- **H2C server-side verifications PASS** (production, during pilot):
  - `/api/health` → `publicByokEnabled=true, byokEnabled=false, hasServerKey=false` ✅
  - `/api/generate/byok` no-token → `code=turnstile_required` ✅
  - **4 real success-path `[byok-turnstile-ok]` log lines** (requestIds: `byok_8d4ffa2fbe94`, `byok_717b3025da5a`, `byok_d7b73105d73c`, `byok_1a526bf40112`; all `hostname=music.conanxin.com`, all `action=byok-generate`, all `outcome=turnstile_ok`) — proves real-browser Turnstile flow works in production
  - H2B `[byok-turnstile-debug]` failure-path log fired in production (8 pre-pilot entries from H1/H2A/H2B probes, 0 during pilot) — redactor end-to-end verified, no leak ✅
- **H2C rollback executed** (production restored to safe default):
  - `byok-test.conf` reverted to 3-line safe default
  - `TURNSTILE_DEBUG_REDACTED` is now `<unset>` in process env
  - `sudo systemctl daemon-reload && restart` → MainPID 441936, active/running
  - Residual journal watch (PID 424825) cleaned via `sudo pkill -9 -f "journalctl -u mmx-music-studio.*-f"`
- **H2C post-rollback verifications PASS**:
  - `/api/health` → `publicByokEnabled=false, byokEnabled=false, hasServerKey=false` ✅
  - `/api/generate/byok` (fake key, no token) → `code=byok_generation_disabled` ✅
  - `/api/health` exposes only public `turnstileSiteKey` (24 chars) + booleans; **no `TURNSTILE_SECRET_KEY`, no raw token, no user key, no Authorization, no full prompt** ✅
  - `/ops` and `/api/status` → 302 to Cloudflare Access login ✅
- **H2C lessons learned**:
  1. **systemd drop-in lex order gotcha (recurring)**: 99-prefix did NOT override `byok-test.conf`. Fix: directly edit the existing drop-in + back up to `/tmp/`.
  2. **Sandbox cannot fake real tester pilot**: H2C success-path needs real browser Turnstile widget, which sandbox cannot simulate. H2C pilot must be human-driven.
  3. **Background process `output_preview` is unreliable**: Use `tee /tmp/h2c-seen.log` side-effect for verification.
- **Full evidence report**: [`docs/launch/BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md`](../launch/BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md)
- **Smoke test**: `scripts/byok-h2c-final-evidence-smoke-test.sh` (asserts all 4 requestIds, action metadata, lessons, links)

**关键口径**: BYOK-H2C completed a controlled dry-run pilot and rolled production back to safe default. It did not enable BYOK live generation or broad public launch.

**Phase BYOK-H2D**: Dry-Run UX/Copy Polish — ✅ **H2D_UX_COPY_POLISH_ACTIVE** (copy-only, no env change, no live, no music).

- **Status**: ACTIVE. UX/copy-only polish in `src/features/studio/ByokPanel.tsx` + `ByokPanel.module.css`. Production env unchanged (MainPID 441936 still H1 closeout safe default). Zero new dependencies, zero new storage, zero new API calls, zero new env vars.
- **Env change**: None. `PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`, `TURNSTILE_BYOK_REQUIRED=true`.
- **Real MiniMax call**: None.
- **Music generated**: None.
- **Real user apiKey**: None.
- **H2D copy improvements**: (8 user-visible) dry-run badge, header subtitle rewrite, API Key hint (fake-key example + no-save), Turnstile human-only + retry + token-privacy hints, confirm-label dry-run note, submit-button label update, dry-run-result explain on `byok_dry_run_only`, footer line.
- **未启用 BYOK live · 未发起 broad public launch** — H2D 不打开 BYOK live 通道。
- **H2D does **not** open the live gate**; BYOK live generation remains disabled until explicit H3 operator approval.
- **All result-code mappings preserved** (`byok_generation_disabled` / `byok_dry_run_only` / `turnstile_required` / `turnstile_invalid` / `byok_live_not_enabled` / `byok_provider_error` / etc.). No logic change.

**Phase BYOK-H3A**: Controlled Live Pilot Planning — ✅ **H3A_PLANNING_COMPLETE** (planning only, no env change, no live, no music, no public launch).

- **Status**: PLANNING ONLY. This is a planning artifact, not a live execution authorisation. H3A does not enable BYOK live generation, does not open BYOK to a broad public audience, and does not modify production environment.
- **Env change**: None. `PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`, `TURNSTILE_BYOK_REQUIRED=true`.
- **Real MiniMax call**: None.
- **Music generated**: None.
- **Real user apiKey**: None.
- **Plan doc**: [`docs/launch/BYOK_H3_CONTROLLED_LIVE_PILOT_PLAN.md`](../launch/BYOK_H3_CONTROLLED_LIVE_PILOT_PLAN.md) (15 sections + appendix: purpose, readiness evidence, scope, approval gate, env toggle matrix, cost ceiling, circuit breaker, rollback drill, real key isolation, provider call boundary, monitoring, tester instructions, incident response, Go/No-Go checklist, H3B execution placeholder).
- **Approval gate**: `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` (operator must send in review channel; without it, no one may set `BYOK_DIRECT_LIVE_ENABLED=true` or `BYOK_DRY_RUN_ONLY=false`).
- **Cost ceiling**: ≤ 10 total live generations, ≤ 2 per tester, ≤ 6/hour, 0 retry on provider error, **stop** on first provider error.
- **Circuit breaker**: one-shot kill switch (set safe-default env, `daemon-reload` + `restart`, verify `/api/health` + `/api/generate/byok` returns `byok_generation_disabled`).
- **Real key isolation**: no localStorage / sessionStorage / IndexedDB / URL / server storage / log / metadata write of raw key.
- **Provider boundary**: direct HTTPS only, no CLI path, no site operator key fallback, no `MINIMAX_API_KEY` operator fallback.
- **未启用 BYOK live · 未发起 broad public launch** — H3A 只是 planning, 不打开 live 通道, 不发起 launch。
- **H3B (execution) is a separate phase** and is not authorised by H3A. H3B requires operator approval phrase + Go/No-Go checklist fully satisfied.
- **Smoke test**: `scripts/byok-h3a-controlled-live-pilot-planning-smoke-test.sh` (35/35 PASS, `BYOK_H3A_CONTROLLED_LIVE_PILOT_PLANNING_SMOKE_PASS`).

**关键口径**: BYOK-H3A prepares the controlled live pilot plan. It does not enable BYOK live generation or broad public launch.

**Phase BYOK-H3B-PREFLIGHT**: Controlled Live Pilot Pre-Flight Runbook — ✅ **H3B_PREFLIGHT_RUNBOOK_COMPLETE** (pre-flight runbook only, no env change, no live, no music, no public launch).

- **Status**: PRE-FLIGHT RUNBOOK ONLY. This is a runbook, not a live execution authorisation. H3B-PREFLIGHT does not enable BYOK live generation, does not call MiniMax, does not generate music, does not open BYOK to a broad public audience, and does not modify production environment.
- **未启用 BYOK live · 未发起 broad public launch** — H3B-PREFLIGHT 只准备 runbook, 不打开 live 通道, 不发起 launch.
- **Runbook doc**: [`docs/launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md`](../launch/BYOK_H3B_PREFLIGHT_RUNBOOK.md) (15 sections + appendix: purpose, required approval, pre-flight prerequisites, environment baseline, Go/No-Go checklist, cost ceiling, circuit breaker commands, rollback drill, live window operating rules, tester instructions, monitoring commands, provider call boundary, incident response, H3B execution handoff placeholder, final no-live statement).
- **Approval phrase**: `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` (per-window, in review channel; the runbook itself is NOT approval).
- **H3B execution is still NOT authorised.** A separate `docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md` will be written only after explicit operator approval + Go/No-Go fully satisfied. That file does NOT exist yet; its absence is the default state.
- **Smoke test**: `scripts/byok-h3b-preflight-runbook-smoke-test.sh` (26/26 PASS, `BYOK_H3B_PREFLIGHT_RUNBOOK_SMOKE_PASS`).

**Phase BYOK-H3B-DRILL**: Dry-Run Rollback Drill Evidence — ✅ DRILL RECORDED.

- **Status**: DRY-RUN DRILL EVIDENCE ONLY. H3B-DRILL does not execute BYOK live generation, does not call MiniMax, does not generate music, does not open BYOK to a broad public audience.
- **未启用 BYOK live · 未发起 broad public launch** — H3B-DRILL only records drill evidence; no live path is enabled at any point in the drill.
- **Drill date**: 2026-06-13 (DRILL_DATE=20260613, drill start `2026-06-13T00:30:12+08:00`).
- **Env change**: Safe-default rewrite only (idempotent; no posture change). `byok-test.conf` re-written to `PUBLIC_BYOK_ENABLED=false` / `BYOK_DRY_RUN_ONLY=true` / `BYOK_DIRECT_LIVE_ENABLED=false`. Prior `turnstile-debug.conf` and `byok-h2c-dry-run.conf` drop-ins removed. Real Turnstile secret drop-in (`turnstile-real.conf`, mode 600) NOT touched.
- **MainPID before**: 441936 → after restart: 503163.
- **Evidence doc**: [`docs/launch/H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md`](../launch/H3B_DRY_RUN_ROLLBACK_DRILL_20260613.md) (10 sections, ~239 lines, 10 KB).
- **Verifications**: `/api/health` shows `publicByokEnabled=false`, `byokEnabled=false`, `hasServerKey=false`, `byokKeyStorage=memory`, `dailyGenerationUsed=0`, `realApiAttemptsUsed=0`. `/api/generate/byok` with fake key returns `code: "byok_generation_disabled"` (server did not enter Turnstile / MiniMax / music). `/ops` and `/api/status` return `HTTP/2 302` redirect to Cloudflare Access login.
- **Leak audit**: 6/6 patterns absent in `/api/health` response (`TURNSTILE_SECRET_KEY`, `Authorization`, `Bearer `, `userApiKey`, `apiKey`, `token`).
- **Smoke test**: `scripts/byok-h3b-rollback-drill-smoke-test.sh` (PASS).
- **Approval phrase**: `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` — still required; this drill does NOT grant that approval.

**关键口径**: BYOK-H3B-DRILL records dry-run rollback evidence for a future controlled live pilot. It does not execute BYOK live generation or broad public launch.

**Phase BYOK-H3B-GONO**: Controlled Live Pilot Go/No-Go Review — ✅ REVIEW RECORDED.

- **Status**: GO/NO-GO REVIEW ONLY. H3B-GONO is a review, not a live execution authorization. It does not execute BYOK live generation, does not call MiniMax, does not generate music, does not open BYOK to a broad public audience.
- **Review date**: 2026-06-13 (DRILL_DATE=20260613).
- **Env change in this review**: None. Production safe default verified via runtime `/proc` env read. `PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`, `TURNSTILE_BYOK_REQUIRED=true`, `TURNSTILE_DEBUG_REDACTED=<unset>`. Turnstile site/secret boolean configured; secret value NOT printed.
- **MainPID**: 503163 (unchanged during this review; post-H3B-DRILL restart).
- **Review doc**: [`docs/launch/BYOK_H3B_GO_NO_GO_REVIEW_20260613.md`](../launch/BYOK_H3B_GO_NO_GO_REVIEW_20260613.md) (10 sections + Appendix A/B, ~182 lines).
- **Evidence reviewed**: H3A plan, H3B pre-flight runbook, H3B rollback drill evidence (20260613), H2C evidence report, H2 dry-run pilot plan.
- **Go/No-Go checklist (22 gates)**:
  - Gates 1-18 (evidence-based, H1/H2C/H2D/H3A/H3B-PREFLIGHT/H3B-DRILL/safe-default/Turnstile/Access/cost ceiling/circuit breaker/rollback recency/key isolation/provider boundary/monitoring/incident/tester instructions): all `YES (PASS)` where evidence exists.
  - Gate 19 (tester cohort confirmed): `NO (PENDING)`.
  - Gate 20 (explicit operator approval phrase received): `NO (NOT RECEIVED)` — **the only hard gate**.
  - Gate 21 (no unresolved P0/P1): `YES (PASS)`.
  - Gate 22 (operator available during full pilot window): `PENDING` (no window scheduled).
- **Decision recorded**: **`NO-GO for H3B live execution`**. Final live decision is determined by Gate 20 alone.
- **H3B execution instructions**: NOT yet authorized to be written. `docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md` does not exist; its absence is the default state.
- **Smoke test**: `scripts/byok-h3b-go-no-go-review-smoke-test.sh` (PASS, see doc for assertion count).
- **Approval phrase**: `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` — still NOT RECEIVED. This review does NOT grant that approval.

**关键口径**: BYOK-H3B-GONO reviews the controlled live pilot gates and records a No-Go decision until explicit operator approval is received. It does not execute BYOK live generation or broad public launch.

**Phase BYOK-H3B-COHORT**: Tester Cohort + Pilot Window Planning — ✅ PLANNING RECORDED. Anonymous slo...[truncated]

**Phase BYOK-H2A**: Dry-Run Pilot Planning — ✅ PLANNING COMPLETE (this phase, no production env change).

- **Status**: PLANNING ONLY. Production env unchanged. Live gate stays closed. No broad public launch.
- **Env change**: None. `PUBLIC_BYOK_ENABLED=false`, `BYOK_DRY_RUN_ONLY=true`, `BYOK_DIRECT_LIVE_ENABLED=false`, `TURNSTILE_BYOK_REQUIRED=true`.
- **Real MiniMax call**: None.
- **Music generated**: None.
- **Real user apiKey**: None.
- **H1 valid-token browser E2E**: PASS (predecessor).
- **Plan doc**: [docs/launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md](launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md)
- **Smoke test**: `bash scripts/byok-h2-dry-run-pilot-planning-smoke-test.sh` (25/25 PASS)
- **No release tag** created or moved. v0.4.31-alpha tag stays at `ee6a8a1`.

What H2A delivers:

- A complete **dry-run pilot plan**: 3–5 trusted testers, Chinese instructions, feedback template, monitoring checklist, rollback plan, Go/No-Go gates for H3.
- A **smoke test** that asserts the plan is structurally correct and does not claim BYOK is now live.
- **No production env change.** **No code change.** **No release tag.**

What H2A does **not** deliver:

- Pilot execution (that's H2C, separate phase, requires operator approval).
- Live call (that's H3, separate phase, requires operator approval + cost ceiling + circuit breaker).

Recommended H2 improvement (for H2B, separate commit):

- Add a symmetric success-path redacted log line `[byok-turnstile-ok]` in `server/index.ts` so the operator can grep for the dry-run success path in the journal.

**关键口径**: BYOK-H2A prepares the dry-run pilot plan for BYOK. It does not enable BYOK live generation or broad public launch.

**Phase Release v0.4.31-alpha**: Frontend Turnstile widget runtime for BYOK — ✅ COMPLETED (2026-06-12).
  - Deploy-CF-E adds frontend Cloudflare Turnstile widget runtime integration
  - `ByokPanel.tsx` dynamically loads `https://challenges.cloudflare.com/turnstile/v0/api.js`
  - Renders per-instance widget via `window.turnstile.render(...)`
  - `callback` / `expired-callback` / `error-callback` lifecycle management
  - Single-use token: widget reset + token clear after submit
  - Submit-time guard: when `turnstileByokRequired === true` and no fresh token, block submit
  - `Studio.tsx` passes `turnstileSiteKey` / `turnstileByokRequired` / `turnstileSecretKeyConfigured` from `healthInfo` into `<ByokPanel />`
  - `/api/health` now also returns the public `turnstileSiteKey` (secret key is never exposed)
  - Server-side `Siteverify` gate (Deploy-CF-D) unchanged and remains source of truth
  - `TURNSTILE_BYOK_REQUIRED=false` by default — non-blocking
  - Token not persisted to localStorage / sessionStorage / IndexedDB / URL query
  - Token not displayed, not logged
  - Front-end does not import or reference `TURNSTILE_SECRET_KEY`
  - New smoke test: `scripts/deploy-cf-e-turnstile-widget-smoke-test.sh` — **23/23 PASS**
  - Does not affect `/api/generate`, `/api/health` (no secret exposed), `/api/status`, `/ops`
- **Default**: disabled / dry-run / non-broad public
- **No new live call**
- **No music generation**
- **Next**: Deploy v0.4.31-alpha to production → valid-token E2E verification → BYOK-H small public launch planning only after E2E PASS

**Phase Deploy-CF-D**: Turnstile protection for BYOK generation — ✅ COMPLETED (2026-06-12, commit b3d1095).
  - `/api/health` now also returns the public `turnstileSiteKey` (the secret key is never exposed)
  - `src/lib/serverApi.ts` `HealthInfo` type extended with `turnstileSiteKey?: string` + boolean flags
  - `Studio.tsx` passes Turnstile props into `<ByokPanel />`
  - `ByokPanel.tsx` rewritten with idempotent dynamic script loader, `window.turnstile.render(...)`, `callback` / `expired-callback` / `error-callback` lifecycle, single-use token reset after submit
  - `ByokPanel.module.css` adds widget container, state badge (loading/ready/verified/expired/error), mobile overflow protection (≤639px)
  - New smoke test: `scripts/deploy-cf-e-turnstile-widget-smoke-test.sh` — 23/23 assertions
  - `TURNSTILE_BYOK_REQUIRED=false` by default — non-blocking
  - Server-side Siteverify remains the source of truth (Deploy-CF-D unchanged)
  - Token not persisted to localStorage / sessionStorage / IndexedDB / URL query
  - Token not displayed, not logged
  - Secret never logged, never returned, never committed
  - Does not affect `/api/generate`, `/api/health` (boolean only, no secret), `/api/status`, `/ops`
- **Default**: disabled / dry-run / non-broad public
- **No new live call**
- **No music generation**
- **Next**: Release v0.4.31-alpha → deploy to production → valid-token E2E verification → BYOK-H small public launch planning only after E2E PASS

**Phase Deploy-CF-D**: Turnstile protection for BYOK generation — ✅ COMPLETED (2026-06-12, commit b3d1095).
  - `TURNSTILE_BYOK_REQUIRED=false` by default — non-blocking
  - Secret never logged, never returned, never committed
  - Token not persisted to localStorage / sessionStorage / URL
  - Does not affect `/api/generate`, `/api/health`, `/api/status`, `/ops`
- **Default**: disabled / dry-run / non-broad public
- **No new live call**
- **No music generation**
- **Next**: Release v0.4.30-alpha → BYOK-H public launch (only after Turnstile configured + verified)

### Historical BYOK-F status

- **Phase BYOK-F**: Gated direct HTTPS API relay implementation completed.
- Uses per-request `Authorization` headers behind explicit live gates (`BYOK_DIRECT_LIVE_ENABLED`, `BYOK_DIRECT_LIVE_CONFIRMATION`).
- Broad public BYOK launch remains blocked until Turnstile and abuse controls are configured.
- No broad public BYOK launch.

### Historical BYOK-E status

- **Phase BYOK-E**: Official API schema validation completed.
- Verified MiniMax music generation API endpoint and request/response schema from official CLI source.
- Unblocked BYOK-F direct API relay design.
- No live calls executed during validation.

### Historical BYOK-D status

- **Phase BYOK-D**: Direct HTTPS API relay design skeleton completed.
- Design document: `docs/security/BYOK_DIRECT_API_RELAY_DESIGN.md`.
- Key principle: no CLI spawn, no `--api-key` flag, per-request `Authorization` header.
- No live provider calls during design phase.

## Release notes

- **v0.4.31-alpha — Frontend Turnstile widget runtime integration for BYOK**
  - Deploy-CF-E adds the front-end half of the Turnstile integration
  - Browser can obtain a Turnstile token and submit it with `POST /api/generate/byok`
  - It does not enable broad public BYOK launch by itself
  - Server-side Siteverify remains the source of truth (Deploy-CF-D unchanged)
  - `TURNSTILE_BYOK_REQUIRED=false` by default
  - `/api/health` now also returns the public `turnstileSiteKey` (secret key is never exposed)
  - Token not persisted to localStorage / sessionStorage / IndexedDB / URL query
  - Token not displayed, not logged
  - Front-end does not import or reference `TURNSTILE_SECRET_KEY`
  - New smoke test: `scripts/deploy-cf-e-turnstile-widget-smoke-test.sh` — 23/23 assertions
  - No new live call was executed
  - No music was generated
  - No Turnstile secret, key, env, runtime storage, logs, audio, or tsconfig was committed
  - Valid-token E2E verification requires a production deploy of this phase
  - BYOK-H is gated on that E2E pass
  - Next step: deploy v0.4.31-alpha to production → valid-token E2E verification → BYOK-H small public launch planning only after E2E PASS

- **v0.4.30-alpha — Turnstile gate for BYOK release**
  - Deploy-CF-D adds a server-side Turnstile gate for BYOK generation
  - It does not enable broad public BYOK launch by itself
  - `/api/generate/byok` live/direct path now supports Turnstile verification
  - `TURNSTILE_BYOK_REQUIRED=false` by default
  - No new live call was executed
  - No music was generated
  - No Turnstile secret, key, env, runtime storage, logs, audio, or tsconfig was committed
  - Next step: configure real Turnstile site/secret keys outside repo → BYOK-H public launch

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

完整 release notes 见 [`docs/release/RELEASE_NOTES_v0.4.30-alpha.md`](../release/RELEASE_NOTES_v0.4.30-alpha.md).

**关键口径**: Deploy-CF-D adds a server-side Turnstile gate for BYOK generation. It does not enable broad public BYOK launch by itself.

**Next recommended phases**:

- Release v0.4.30-alpha ✅ (Turnstile gate for BYOK)
- Configure real Turnstile site/secret keys outside repo
- BYOK-H public launch (only after Turnstile configured + verified + operator-approved)
- Phase Storage-B1 operator-confirmed cleanup (only if candidates exist)
- Phase Product Polish-Q (optional)

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

**Phase BYOK-H3B-COHORT readiness note**

- **Tester cohort/window plan**: [docs/launch/BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md](launch/BYOK_H3B_TESTER_COHORT_WINDOW_PLAN.md)
- **Current decision**: NO-GO for H3B live execution.
- **Cohort slots**: anonymous T1-T5 only; no tester PII is committed to the repository.
- **Pilot window**: NOT SCHEDULED; approval phrase NOT RECEIVED.
- **This phase does not open the live gate.**

BYOK-H3B-WINDOW-LOCK readiness note

- Window-lock evidence: `docs/launch/BYOK_H3B_WINDOW_LOCK_20260613.md`
- Approval phrase: RECEIVED
- Tester cohort: T1–T5 confirmed anonymous slots only
- Pilot window: 2026-06-13T04:45:04+08:00 → 2026-06-13T05:15:04+08:00 (Asia/Shanghai)
- This phase does not open the live gate.

BYOK-H3B-EXEC-INSTRUCTIONS readiness note

- Instructions: `docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md`
- This phase is documentation only; production env remains safe default.
- T1–T5 are confirmed anonymous slots; pilot window is locked (2026-06-13T04:45:04+08:00 → 2026-06-13T05:15:04+08:00, Asia/Shanghai).
- The execution instructions document itself does not open the live gate; it only records the steps.
- Live execution requires a separate operator action after re-validating the window.

**Phase BYOK-H3B-CODE-FOLLOWUP**: Live Gate Hardening — ✅ CODE FOLLOWUP COMPLETE.

- **Status**: CODE FOLLOWUP ONLY. Centralised `BYOK_LIVE_CONFIRMATION_PHRASE`; added server-side one-shot guard; added 5+1 new `/api/health` live-gate fields.
- This phase does not enable BYOK live generation, does not call MiniMax, does not generate music, does not open BYOK to a broad public audience, and does not modify production environment.
- **Smoke test**: `scripts/byok-h3b-code-followup-smoke-test.sh` (53/53 PASS, `BYOK_H3B_CODE_FOLLOWUP_SMOKE_PASS`).

**Phase BYOK-H3B-LIVE-T1-MICROPILOT**: First Controlled Live Attempt — ✅ WINDOW EXECUTED + ROLLED BACK.

- **Status**: WINDOW-LOCKED + T1-ONLY LIVE ATTEMPT. Hardened live gate and one-shot guard verified. T1's submit returned `byok_live_attempt_limit_reached` on retry; no second live call reached MiniMax. Unconditional rollback executed; production safe default re-verified.
- Evidence: `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_20260613.md`.
- **Approval phrase**: `CONFIRM_BYOK_H3_CONTROLLED_LIVE_PILOT` already received for the broader H3B pilot plan, but the single-shot T1 attempt is a separate operator-attended window.

**Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-2**: Second Controlled Live Attempt — ✅ WINDOW EXECUTED + ROLLED BACK.

- **Status**: WINDOW-LOCKED + T1-ONLY LIVE ATTEMPT, REVISITED. T1 reported a single submission; server-side observed only `byok_fake_relay_ok` (fake path, no provider call); `byokLiveAttemptsUsed` remained 0. Unconditional rollback executed; production safe default re-verified.
- Evidence: `docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY2_20260613.md`.
- **Smoke test**: `scripts/byok-h3b-live-t1-micropilot-retry2-smoke-test.sh` (33/33 PASS, `BYOK_H3B_LIVE_T1_MICROPILOT_RETRY2_SMOKE_PASS`).
- **Observability gap discovery**: the BYOK submit handler logged nothing at the route entry, and `byokLiveAttemptsUsed` only counted live-mode attempts. Closed in `Phase BYOK-H3B-OBSERVABILITY-FOLLOWUP`.

**Phase BYOK-H3B-OBSERVABILITY-FOLLOWUP**: Submit Observability — ✅ CODE FOLLOWUP COMPLETE.

- **Status**: CODE FOLLOWUP ONLY. Redacted `[byok-submit-received]` log line at the first statement of `handleByokGenerate`; 9 new `/api/health` fields (`byokSubmitsReceived` / `byokLastSubmitAt` / `byokLastSubmitStage` / `byokLastSubmitRequestId` / `byokLastSubmitOutcome` / `byokLastSubmitModeCandidate` / `byokLastSubmitTurnstilePresent` / `byokLastSubmitApiKeyPresent` / `byokLastSubmitPromptPresent`).
- Strict non-sensitive policy: only booleans, enum strings, requestId, ISO timestamp — never apiKey, token, prompt, lyrics, or raw provider response.
- Counter is in-memory only; resets on process restart; never persisted to disk.
- This phase does not enable BYOK live generation, does not call MiniMax, does not generate music, does not open BYOK to a broad public audience, and does not modify production environment.
- Closes the observability gap discovered in `Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-2`.
- **Smoke test**: `scripts/byok-h3b-observability-followup-smoke-test.sh` (output: `BYOK_H3B_OBSERVABILITY_FOLLOWUP_SMOKE_PASS`).

**关键口径**: BYOK-H3B-OBSERVABILITY-FOLLOWUP adds redacted submit-received telemetry so future live retries can distinguish client-side fake/dry-run behavior from server-side live-gate handling. It does not execute BYOK live generation or broaden public launch.

### BYOK-H3B-OBSERVABILITY-FOLLOWUP-HOTFIX (2026-06-13)

Fixes an uncaught TypeError (`Cannot read properties of undefined
(reading 'length')`) discovered during a safe-default production probe:

- Three safe helpers added in `server/index.ts`:
  `safeString` / `safeStringLength` / `safeHeaderString`.
- Header probe rewritten as
  `safeHeaderString(req.headers['x-turnstile-token']).length > 0`.
- Body `apiKey` probe rewritten as `safeStringLength(body.apiKey) > 0`.
- `SUBMIT_OBSERVABILITY_EMPTY` initial state no longer carries
  `stage='received' / outcome='allowed'` — empty strings prevent
  misleading `/api/health` output before any real submit.
- New enum value `ByokSubmitStage = 'unhandled_error'` reserved for
  future top-level catch paths.

Re-verified under safe default: `byok_generation_disabled` returned,
`byokSubmitsReceived` 0 → 2, `byokLastSubmitStage=killswitch_off`,
no uncaught TypeError, no MiniMax call, no music, no secret leak.
BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-3 — single-T1 controlled submit + unconditional rollback

* Evidence: docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY3_20260613.md
* Smoke: scripts/byok-h3b-live-t1-micropilot-retry3-smoke-test.sh (38/38 PASS)
* Window: 2026-06-13 07:39:45 → 08:39:45 (Asia/Shanghai)
* WINDOW_ID: h3b-20260613-t1-retry3-073945
* Hardened live gate ON; one-shot guard = 1 attempt / window; submit observability ON
* T1 submitted twice (counter 0→4); both reached server, both `modeCandidate=live`,
  both blocked at `audio_quota_rejected` (not `byok_live_attempt_limit_reached`)
* No MiniMax call (`byokLiveAttemptsUsed=0`, `realApiAttemptsUsed=0`)
* No music generated (`dailyGenerationUsed=0`, generated audio count = 0)
* T2/T3/T4/T5 not run
* Unconditional rollback to safe default at 07:48:06; post-rollback
  `byok_generation_disabled` confirmed
* Final口径: BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-3 executed at most one
  controlled BYOK live generation for T1 using the hardened live gate,
  one-shot guard, and submit observability, then restored safe default.
  It does not broaden public launch.
BYOK-H3B-AUDIO-QUOTA-FOLLOWUP — gate ordering and live audio cap

* Status: code + docs + 1 new smoke + validation PASS; production still safe default.
* What changed: confirmed BYOK-live requests now skip the public launch
  guard and use a dedicated `BYOK_LIVE_MAX_AUDIO_PER_WINDOW` (default 1)
  audio cap, window-scoped to the same id as the one-shot attempt guard.
* What does NOT change: public/fake/dry-run traffic still hits the launch
  guard exactly as before. No live call, no MiniMax, no music generation.
* New health fields: `byokLiveAudioCapEnabled`, `byokLiveMaxAudioPerWindow`,
  `byokLiveAudioUsed`, `byokLiveAudioRemaining` (booleans/numbers only).
* New observability stages: `audio_quota_bypassed_for_byok_live`,
  `byok_live_audio_cap_reached`, `live_attempt_consumed`.
* Root cause of retry-3: the launch guard fired before the live-attempt
  guard, blocking confirmed live requests with `per_source_daily_limit_exceeded`.
  Follow-up plan: docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY3_20260613.md §11.
* Gate order: see docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md §4c.
* This phase does not execute BYOK live generation or broaden public launch.

BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-4 — one-shot T1 live micropilot (controlled)

* Status: code + docs + 1 new smoke (scripts/byok-h3b-live-t1-micropilot-retry4-smoke-test.sh, 40/40 PASS).
* Commit: pending (this phase).
* Evidence: docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY4_20260613.md.
* Outcome: T1 attempted ONCE (1 unique requestId `byok_8d3713433de8`).
  * `byokSubmitsReceived` 0 → 3 (`received` + `live_attempt_consumed` + `fake_relay_ok`).
  * `byokLiveAttemptsUsed` 0 → 1 (one-shot guard consumed the slot).
  * `byokLiveAudioUsed` 0 → 0 (no real audio produced; audio cap not exceeded).
  * `dailyGenerationUsed` 0 (no quota consumed).
  * `realApiAttemptsUsed` 0 (no MiniMax call).
  * Generated audio count: 0.
  * Final stage: `fake_relay_ok` (adapter demoted the call to fake relay after live gate allowed it; the live gate enforces slot + audio cap, not the actual provider selection).
  * This does NOT execute BYOK live generation. The gate-ordering fix from `da4b16e` is verified end-to-end (live path no longer blocked by public quota), but the actual MiniMax call is not made because the API adapter does not yet route to the live provider under these conditions.
* Rollback: completed (PID 701159 → 705613, env restored to safe default).
  * Post-rollback POST returned `code: "byok_generation_disabled"`.
  * Post-rollback health: `publicByokEnabled=false`, `byokLiveEnabled=false`, `byokLiveConfirmationConfigured=false`, `byokLiveAudioCapEnabled=true`, `byokLiveMaxAudioPerWindow=1`.
  * `byokLiveAudioUsed` and `byokLiveAttemptsUsed` reset to 0 (in-memory by design).
* This phase does NOT call MiniMax, does NOT generate music, does NOT broaden public launch.
* Next phase recommendation: investigate why the live gate allows the call but the API adapter routes to fake relay (separate from gate ordering — this is a provider-selection issue). Until that is fixed, no future pilot will reach MiniMax.
* Final口径: BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-4 executes at most one controlled BYOK live generation for T1 using the hardened live gate, one-shot guard, BYOK-live audio cap, and submit observability, then restores safe default. It does not broaden public launch.

BYOK-H3B-PROVIDER-SELECTION-FOLLOWUP — adapter alignment

* Root cause: retry-4 reached the server, passed the live gate, but the
  adapter's provider selection fell back to `byok_fake_relay_ok` because
  `adapterMode` only switched to `'live'` when `requestedMode === 'live'`,
  missing requests that named `'direct-live'` (or that satisfied the
  gate but were demoted by the route's direct-live early-return).
* Fix: new `isConfirmedByokLiveProviderPath(env, userApiKey)` helper
  checks every gate condition (publicByok, dry-run, liveEnabled,
  liveConfirmation, liveWindowId, directLiveEnabled,
  directLiveConfirmation, user apiKey). The route now uses this
  helper and forwards the env snapshot to `generateByokMusic`.
* `generateByokMusic` adds a confirmed-live branch that delegates to
  the HTTPS direct adapter (`generateByokDirectMusic`) so the live
  call actually reaches MiniMax. Unconfirmed-live path remains
  fail-closed (`byok_live_provider_path_disabled`).
* Fake relay preserved for dry-run / fake / disabled / missing-gate.
* No MiniMax call in this phase. No live pilot executed. No broad
  public launch.
* Smoke: scripts/byok-h3b-provider-selection-followup-smoke-test.sh — 27/27 PASS.

BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-5 — controlled live pilot attempt

* Window: h3b-20260613-t1-retry5-091635
* Direct confirmation: CONFIRM_BYOK_DIRECT_LIVE_TEST (read from code constant)
* Health live gate: all true before submit
* T1 submitted once, one-shot guard consumed slot (byokLiveAttemptsUsed=1)
* Provider result: fake_relay_ok (not live_relay_ok)
* Root cause: client request sent mode='fake' (default), not mode='live' or
  mode='direct-live'. The server correctly honored the client's mode choice.
* No MiniMax call. No audio generated. realApiAttemptsUsed=0.
* Rollback verified. Post-rollback byok_generation_disabled confirmed.
* No secret/key/token/PII/audio/log committed.
* Smoke: scripts/byok-h3b-live-t1-micropilot-retry5-smoke-test.sh — 26/26 PASS.

BYOK-H3B-FRONTEND-MODE-FOLLOWUP — frontend mode fix + server defensive block

* Retry-5 root cause: the BYOK client submit handler did not send an
  explicit `mode` field. The live gate was fully open but the request
  silently fell through to `mode='fake'`.
* Frontend fix: `HealthInfo` exposes 4 live gate fields; `ByokPanel`
  computes `isByokLiveReady`; submit handler sends
  `mode: isByokLiveReady ? 'direct-live' : 'fake'`.
* Server defense: `server/index.ts` returns `code: byok_live_mode_required`
  when fake mode is requested while the live gate is satisfied. No-op
  when live gate is closed.
* This phase does not open live, does not call MiniMax, does not
  generate music, does not broaden public launch. Production env
  remains safe default.
* Smoke: `scripts/byok-h3b-frontend-mode-followup-smoke-test.sh`
  (39/39 PASS, `BYOK_H3B_FRONTEND_MODE_FOLLOWUP_SMOKE_PASS`).
