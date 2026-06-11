# mmx-music-studio v0.4.27-alpha

## What is this release?

This is a **BYOK safety hotfix release**.

A CLI key fallback bug was discovered during the BYOK-C live-call preparation flow. The unsafe BYOK live provider path is now **disabled fail-closed**. BYOK remains available only as readiness / dry-run / fake-relay infrastructure until a direct HTTPS API relay path is designed, implemented, and verified.

## Critical finding

The mmx CLI music generation path does **not** use the child-process `MINIMAX_API_KEY` environment variable as the BYOK key source.

Instead, the CLI may fall back to `~/.mmx/config.json`, which can accidentally use the site operator key.

As a result, **CLI-based BYOK live generation is not safe**.

## What changed

- **Disabled** the unsafe BYOK CLI live path.
- **Added** `byok_live_provider_path_disabled`.
- **Removed** CLI live spawn path from the BYOK adapter.
- **Removed** user-key env injection into the child process.
- **Documented** the CLI key fallback issue.
- **Documented** why `--api-key` is not the preferred production fix because it may expose key material in process argv.
- **Preserved** safe BYOK modes:
  - `disabled`
  - `dry-run`
  - `fake relay`
- **Added** BYOK-C hotfix smoke coverage.

## BYOK status

| Mode | Status |
|------|--------|
| BYOK readiness | ✅ available |
| BYOK dry-run | ✅ available |
| BYOK fake relay | ✅ available |
| BYOK live via CLI | ❌ disabled |
| Real BYOK live generation | ❌ not available |
| Broad public BYOK launch | ❌ blocked |

## Required future path

The next safe implementation path is:

1. **Phase BYOK-D Direct API Relay Design**
2. Use direct HTTPS provider call
3. Use per-request `Authorization` header
4. Redact provider errors
5. Never write user key to disk, metadata, logs, URL, localStorage, or process argv
6. Add abuse controls before any broad public launch

## Safety and privacy

This release does **not**:
- execute a live MiniMax call
- generate music
- use a real user key
- use the site operator key
- store user keys
- submit runtime storage
- move old tags

## Final public wording

> **BYOK live path is disabled after discovering a CLI key fallback bug. BYOK remains readiness/fake-relay only until direct API relay validation is complete.**
