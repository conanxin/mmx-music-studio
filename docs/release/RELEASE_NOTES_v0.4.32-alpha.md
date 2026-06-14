# mmx-music-studio v0.4.32-alpha

## Release Type

Stability / hygiene alpha release.

This release promotes the BYOK safe-default baseline and the release / CI hygiene work into the alpha release line. It is not a new feature-major release, not a broad public launch, and does not enable any new real-generation capability.

## Baseline

| Item | Value |
|---|---|
| Version | `v0.4.32-alpha` |
| Baseline commit | `ce978085137d8fd78123dfba46909dc2d6beb16e` |
| Latest commit title | `Update GitHub Actions to Node 24-compatible versions` |
| CI baseline | GitHub Actions CI #140 success |
| Default safety posture | safe default / no-live |

## Highlights

- BYOK-H3B Retry-10 blocker closeout:
  - Recorded the Retry-10 closeout status and operator blocker.
  - Kept BYOK live blocked until the operator secret step is explicitly confirmed.
  - Added local handoff/checklist coverage for the blocked-or-aborted Retry-10 state.
- Release check gate fixes:
  - Restored `npm run release:check` to a clean PASS state.
  - Aligned static smoke expectations with the current safe-default health posture.
  - Hardened local release checks without opening live generation paths.
- WeApp generated SWC cache tracking cleanup:
  - Ignored generated `apps/weapp/.swc/` cache content.
  - Removed the previously tracked platform-specific SWC cache file from Git.
  - Kept WeApp source, Taro config, and dependencies unchanged.
- CI advisory smoke annotation cleanup:
  - Fixed advisory smoke line-ending handling for bash execution.
  - Updated the Studio CLI submit guard smoke assertion to match current CLI/API guard structure.
  - Updated the audio duration smoke test so safe-default empty local storage is diagnostic, not a failure.
- GitHub Actions Node 24-compatible update:
  - Updated official GitHub Actions used by CI / release workflows to Node 24-compatible major versions.
  - Removed the Node.js 20 deprecation warning path without using `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION`.

## Safety Boundary

| Boundary | Status |
|---|---|
| BYOK live default | OFF |
| BYOK live gate | blocked until operator secret step confirmation |
| MiniMax provider call | not executed |
| Real audio generation | not executed |
| Production systemd env | not modified |
| Real API keys / Turnstile secrets / Authorization headers | not read, logged, or committed |
| Broad public launch | not included |

This release does not include:

- a live BYOK pilot run
- a MiniMax API call
- generated real audio
- production environment changes
- new broad public BYOK launch behavior
- new real-generation capability

## Verification

| Check | Result |
|---|---|
| `npm run release:check` | PASS |
| `npm run weapp:typecheck` | PASS |
| `npm run weapp:build` | PASS |
| GitHub Actions CI #140 | success |
| `package-lock.json` | no intentional dependency diff |
| `apps/weapp/package-lock.json` | no intentional dependency diff |

## Known Limitations

- BYOK live remains blocked until the operator secret step is confirmed outside the repository.
- The next BYOK live movement must be a separate controlled pilot phase, not part of this release prep.
- This release is not a broad public launch.
- This release does not add new real-generation capability.
- The safe-default posture remains the expected production and local default.

## Final Wording

> v0.4.32-alpha is a BYOK safe-default baseline plus release / CI hygiene alpha. It closes the Retry-10 blocker documentation loop, restores local release gates, cleans generated WeApp cache tracking, removes advisory CI error annotations, and updates GitHub Actions to Node 24-compatible versions. It does not enable BYOK live, does not call MiniMax, does not generate real audio, and does not modify production environment configuration.
