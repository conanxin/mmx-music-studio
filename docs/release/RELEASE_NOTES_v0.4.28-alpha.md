# mmx-music-studio v0.4.28-alpha

## What is this release?

This release promotes the BYOK-D Direct HTTPS API Relay Design work into the public alpha release line.

BYOK-D documents and scaffolds the future direct HTTPS relay path that should replace the unsafe CLI-based live BYOK path. No live provider call is implemented or executed in this release.

## Highlights

- Added BYOK Direct HTTPS API Relay design.
- Added direct API adapter skeleton: `server/adapters/minimax-api/byok-direct.ts`
- Added explicit non-live status: `byok_direct_api_not_verified`
- Updated Studio BYOK UI to explain:
  - BYOK live path is disabled
  - direct API relay is not yet verified
- Preserved BYOK safe modes: disabled, dry-run, fake relay
- Kept unsafe CLI live path fail-closed.
- Added BYOK-D smoke coverage.

## Important status

| Item | Status |
|---|---|
| Direct API live call | **NOT implemented** |
| Official MiniMax endpoint/schema | **NOT verified** |
| Real MiniMax live call | **NOT executed** |
| Music generation | **NOT performed** |
| Broad public BYOK launch | **NOT enabled** |
| BYOK live path | **DISABLED** |

## Why this matters

The previous CLI-based live BYOK path was disabled after discovering a CLI key fallback bug. BYOK-D starts the safer replacement path:

- direct HTTPS provider call
- per-request Authorization header
- no CLI
- no process argv key exposure
- no operator key fallback
- strict redaction

## Notes

The official endpoint/schema could not be verified from curl-accessible documentation in this phase. Therefore this release does not guess provider endpoints or request/response schemas.

Future implementation requires BYOK-E Official API Schema Validation.

## Safety and privacy

This release does not:
- execute a live MiniMax call
- generate music
- use a real user key
- use the site operator key
- store user keys
- submit runtime storage
- move old tags

## Final wording

> BYOK-D documents and scaffolds the direct HTTPS API relay path, but it does not execute live provider calls. BYOK live remains disabled until official endpoint/schema validation and abuse controls are complete.
