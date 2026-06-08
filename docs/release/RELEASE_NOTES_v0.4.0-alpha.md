# mmx-music-studio v0.4.0-alpha

**Release date:** 2026-06-08
**Git tag:** `v0.4.0-alpha`
**Commit:** `720b9ac`

---

## What is this release?

This is a **BYOK (Bring Your Own Key) Safety and WeChat Mini Program Strategy** alpha release. It freezes the work from Phase 5A through Phase 5E of the mmx-music-studio project.

This release **does not claim successful real MiniMax API audio generation**. The primary goal is safety hardening, guard observability, and documentation — establishing a safe foundation for future real API tests.

---

## What was frozen in this release?

### Phase 5A — Web BYOK API Key Mode
- Users can input their MiniMax Token Plan key in the browser UI
- Keys stored in `sessionStorage` (not localStorage or disk)
- Keys passed via `x-minimax-api-key` HTTP header (not URL, not JSON body)
- Keys stored in memory by job ID, cleared immediately after job completion
- **No server-side key storage, no disk writes, no logs**

### Phase 5B-A / 5B-C — Real API Attempt Guard
- `RealApiAttemptGuard` class added to `server/rate-limit.ts`
- Integrated into `server/jobs.ts` job execution path
- Blocks real MiniMax API calls when `REAL_API_ATTEMPT_LIMIT_ENABLED=true` and `remainingRealApiAttempts=0`
- Counter incremented before guard check (not after) for observability
- Health endpoint exposes `realApiAttemptsUsed` and `remainingRealApiAttempts`

### Phase 5C — WeChat Mini Program BYOK Strategy
- `docs/WEAPP_BYOK_STRATEGY.md` defines key management for future Taro/uni-app client
- Platform adapters abstracted: `request.ts`, `storage.ts`, `audio.ts`, `upload.ts`
- Platform-agnostic core (`packages/core`) shared between web and future weapp

### Phase 5E — Counter Observability Fix
- `server/jobs.ts`: `reserveRealApiAttempt()` moved before `checkRealApiAttemptLimit()`
- Ensures counter always increments when entering real API path, even when limit=0
- `scripts/reserve-real-api-attempt-test.sh`: 5-case direct unit test for counter logic

---

## What's included?

### Security & Safety
- [x] BYOK key via `x-minimax-api-key` header (not URL/body/log/disk)
- [x] BYOK key in memory by job ID, cleared after job
- [x] Real API attempt guard (counter-based)
- [x] Generation Access Gate (PIN-optional)
- [x] Audit logging (`server/audit.ts`)
- [x] Secret scan clean in all committed files
- [x] No `.env`, no real keys, no real audio committed

### Web Features
- [x] BYOK API Key Mode (sessionStorage + header)
- [x] Mock generation (fully functional without real API)
- [x] Job queue with concurrency control
- [x] Job history (list, detail, delete, retry, stats)
- [x] Track library (list, audio stream, download)
- [x] Access control (rate limit, daily quota, generation gate)

### Smoke Tests
- [x] `byok-mode-smoke-test.sh` — 13 cases
- [x] `real-api-attempt-guard-smoke-test.sh` — 13 cases
- [x] `reserve-real-api-attempt-test.sh` — 5 cases
- [x] `job-queue-smoke-test.sh` — 5 cases
- [x] `auth-quota-smoke-test.sh` — 31 cases
- [x] `job-history-admin-smoke-test.sh` — 14 cases
- [x] `web-api-smoke-test.sh` — 6 cases
- [x] `weapp-audio-url-smoke-test.sh` — 8 cases

### Documentation
- [x] `docs/BYOK_MODE.md`
- [x] `docs/BYOK_REAL_TEST_PLAN.md`
- [x] `docs/BYOK_REAL_TEST_POSTMORTEM.md`
- [x] `docs/WEAPP_BYOK_STRATEGY.md`
- [x] `docs/SECURITY.md`
- [x] `docs/ARCHITECTURE.md`

---

## What's NOT included?

- **Successful real MiniMax API audio generation** — not claimed in this release
- **Multi-user accounts / authentication** — not implemented
- **Production HTTPS with custom domain** — ICP recordal required for mainland public access
- **API Adapter stability** — experimental, not production-ready
- **WeChat Mini Program production build** — strategy documented, actual Taro/uni-app build not started

---

## Known issue

> The latest BYOK real-test attempt (Phase 5B-B-Retry) was **blocked by the real API attempt guard**. The guard worked correctly — 3 consecutive requests were all rejected with `real_api_attempt_limit_exceeded`. However, this does not prove that MiniMax API can be successfully called through the BYOK path.
>
> Root cause: `REAL_API_DAILY_ATTEMPT_LIMIT=1` was too restrictive for manual testing. Users may click twice or retry, exhausting the single attempt immediately.
>
> **Next real test should use:** `REAL_API_DAILY_ATTEMPT_LIMIT=3` + frontend button debounce (disable for 10s after click) + manual confirmation dialog.

---

## Recommended next steps

1. **Phase 5B-D: Controlled BYOK real API test** — `REAL_API_DAILY_ATTEMPT_LIMIT=3`, frontend debounce, manual confirmation dialog, single operator, low-traffic window
2. **Phase 5G: CI smoke test pipeline** — run all smoke tests in GitHub Actions on every push
3. **ICP recordal** — required for stable mainland public HTTPS access via custom domain
4. **API Adapter hardening** — error handling, retry logic, timeout protection
5. **v0.4.0-alpha GitHub Release** — publish this release

---

## Safety status

| Check | Status |
|-------|--------|
| No real API keys committed | ✅ PASS |
| No generated audio committed | ✅ PASS |
| No .env committed | ✅ PASS |
| No quota/audit runtime JSON committed | ✅ PASS |
| Secret scan clean | ✅ PASS |
| All smoke tests pass (in mock mode) | ✅ PASS |
| BYOK key never in URL/body/log/disk | ✅ PASS |

---

## Links

- **GitHub Release:** https://github.com/conanxin/mmx-music-studio/releases/tag/v0.4.0-alpha
- **Project repo:** https://github.com/conanxin/mmx-music-studio
- **Documentation:** `docs/` directory in repository

---

*mmx-music-studio is an unofficial open-source project. It is not affiliated with MiniMax.*
