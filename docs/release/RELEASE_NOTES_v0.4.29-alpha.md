# mmx-music-studio v0.4.29-alpha

## What is this release?

This release promotes the BYOK-G direct live verification work into the public alpha release line.

BYOK-G completed one operator-approved direct HTTPS live call successfully using the direct API relay path.

**This is not a broad public BYOK launch.**

## Highlights

- Verified one operator-approved direct HTTPS BYOK live call.
- Confirmed the direct relay path can call:
  - `POST https://api.minimaxi.com/v1/music_generation`
- Confirmed provider success response:
  - HTTP 200
  - provider `status_code=0`
  - response format: `data.audio` base64
- Confirmed no CLI usage.
- Confirmed no site operator key usage.
- Confirmed user key was not persisted.
- Confirmed no raw provider response was recorded.
- Confirmed defaults were restored to disabled / dry-run.
- Added BYOK-G smoke coverage (21/21 PASS).

## Verification Summary

| Field | Value |
|---|---|
| Audio size | 2,967,813 bytes (~2.8 MB) |
| Duration | 92,682 ms (~92s) |
| Sample rate | 44,100 Hz |
| Bitrate | 256,000 bps |
| Channels | 2 (stereo) |
| Trace ID | `0679ff5271e7cef9f7432485d6d39a1a` |

## Safety and Privacy

This release does not include:

- user API keys
- Authorization headers
- raw provider responses
- audio files
- runtime storage
- logs

The BYOK live call was executed exactly once under operator approval.

## Important Status

| Item | Status |
|---|---|
| BYOK direct live path | verified once |
| Broad public BYOK launch | **not enabled** |
| Default mode | disabled / dry-run |
| Abuse controls | still required before public launch |
| Recommended next phase | Deploy-CF-D Turnstile |

## Final Wording

> BYOK-G completed one operator-approved direct HTTPS live call successfully. It is not a broad public BYOK launch. No CLI or site operator key was used, the user key was not persisted, and only a redacted summary was recorded. Defaults remain disabled/dry-run.
