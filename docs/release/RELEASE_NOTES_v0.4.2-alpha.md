# mmx-music-studio v0.4.2-alpha

**Release date:** 2026-06-09
**Type:** BYOK API Adapter real-call verified alpha

---

## What is this release?

This release marks the first verified real BYOK API Adapter generation.

The Web CLI backend remains the recommended default path, while the BYOK API Adapter has now completed one controlled real MiniMax API generation through the Web UI.

---

## Highlights

### Real BYOK API generation — verified success

Completed one controlled real BYOK API generation through the Web UI. The entire pipeline — Web UI → API Adapter → MiniMax → audio storage → track record → Studio player — operated correctly on a live MiniMax API call.

- **Response kind verified:** `direct_audio`
- **Job ID:** `job_1780992991977_c9eaaa0c`
- **Track ID:** `track_1780993112817_yg4g4m`
- **Title:** 轻柔钢琴测试音乐
- **Audio endpoint:** `200 OK`
- **Download endpoint:** `200 OK`

### Studio BYOK submit diagnostics — fixed

Multiple issues preventing the Web UI from submitting real BYOK API calls have been resolved:

- **BYOK key missing guard:** Added explicit "请先在设置中填写你的 MiniMax Token Plan Key" message when key is absent in BYOK mode
- **Real API attempt status:** Submit button now correctly reflects `remainingRealApiAttempts` counter
- **Daily quota guard behavior:** Fixed `dailyQuotaEnabled` flag so disabled local quota no longer incorrectly blocks API testing

### Real success documentation and smoke test

- Created `docs/API_DEBUG_C_REAL_CALL_REPORT.md` — full real call observation record
- Created `scripts/api-adapter-real-success-record-smoke-test.sh` — 19/19 PASS
- All 5 API contract smoke tests passing: 29+21+20+19+23+29 = 144 checks

### Defensive async task response parser — preserved

The async task (`task_id` + `status: processing`) response handling is defensive and ready for future polling work. This gap is documented in Known Gaps.

---

## Safety and boundaries

- API key was entered only through the Web BYOK UI (Settings panel)
- API key was held in-memory only, deleted after job completion via `deleteJobApiKey()`
- API key was never written to disk
- API key was never logged
- Server was switched back to CLI backend after observation
- No production multi-user readiness is claimed

---

## Recommended usage

**For personal self-hosted generation, continue using:**

```bash
REAL_GENERATION_ENABLED=true
MOCK_GENERATION_ENABLED=false
MINIMAX_BACKEND=cli
```

**Use API Adapter / BYOK mode for:**
- Controlled single-call testing
- Future development of async polling support
- Web UI-based key management (no disk persistence)

---

## Known gaps

| Gap | Status |
|-----|--------|
| Async task polling endpoint (`task_id` + polling loop) | Not yet confirmed — parser identifies it defensively, polling remains future work |
| Public mainland custom-domain access | Still depends on ICP recordal or non-mainland deployment |

---

## Changelog (since v0.4.1-alpha)

- **Phase API-Debug-C-UI-Guard** (`c755f11`): Clarify BYOK submit guard — show enter-key message when key missing
- **Phase API-Debug-C-Click-Path** (`22ff0cf`): Add submit disabled reason diagnostic — 6-condition guard made visible
- **Phase API-Debug-C-Quota-Guard** (`7e82fa1`): Respect `dailyQuotaEnabled` flag in all Studio quota guards
- **Phase API-Debug-C-Observe** (`0324496`): Document real BYOK API generation result — `direct_audio` response, `job_1780992991977_c9eaaa0c`, `track_1780993112817_yg4g4m`
- **Phase API-Debug-D** (`a5c6de3`): Stabilize API Adapter success documentation — real BYOK call smoke test, updated all docs

---

## Full phase completion map

| Phase | Status |
|-------|--------|
| Phase CLI-Web-E | ✅ COMPLETE |
| Phase API-Debug-A | ✅ COMPLETE |
| Phase API-Debug-B1 | ✅ COMPLETE |
| Phase API-Debug-C-UI-Guard | ✅ COMPLETE |
| Phase API-Debug-C-Click-Path | ✅ COMPLETE |
| Phase API-Debug-C-Quota-Guard | ✅ COMPLETE |
| Phase API-Debug-C-Observe | ✅ COMPLETE |
| Phase API-Debug-D | ✅ COMPLETE |
| Phase Release v0.4.2-alpha | ✅ THIS RELEASE |