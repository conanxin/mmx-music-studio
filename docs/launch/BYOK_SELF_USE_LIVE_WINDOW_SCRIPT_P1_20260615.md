# BYOK Self-Use Live Window Script P1

Date: 2026-06-15

Phase: BYOK-SELF-USE-P1-LIVE-WINDOW-SCRIPT

## Why This Exists

The one-shot BYOK direct-live pilot succeeded, but the operator steps were too
manual. Opening a live window by hand is easy to get wrong:

- one env name can be missed,
- caps can be left too high,
- Turnstile can be accidentally bypassed,
- the rollback step can be forgotten after success or failure.

This phase adds an operator-only helper script that standardizes the live
window process while keeping safe-default as the normal state.

## Script

`scripts/byok-live-window-operator.sh`

Supported commands:

- `status`
- `open`
- `close`
- `help`

The default mode is dry-run. The script prints what it would do, but does not
write system files or restart services unless `--apply` is supplied.

## Defaults

- Service name: `mmx-music-studio`
- Health URL: `http://127.0.0.1:8787/api/health`
- Env directory: `/etc/mmx-music-studio`
- Systemd drop-in directory: `/etc/systemd/system/mmx-music-studio.service.d`
- Window id: `h3b-YYYYMMDD-HHMMSS-selfuse`
- Live attempt cap: `1`
- Live audio cap: `1`
- Turnstile for BYOK: required

These can be overridden with non-secret operator environment variables:

- `MMX_SERVICE_NAME`
- `MMX_HEALTH_URL`
- `MMX_ENV_DIR`
- `MMX_SYSTEMD_DROPIN_DIR`
- `MMX_BYOK_LIVE_WINDOW_ID`
- `MMX_BYOK_LIVE_ATTEMPT_CAP`
- `MMX_BYOK_LIVE_AUDIO_CAP`

## Status

`status` performs a read-only GET to `/api/health`.

It does not send Authorization headers, does not send keys, does not submit a
generation request, and does not call MiniMax. It prints only booleans,
counters, safe enum-like strings, and health classifications.

## Open

`open` without `--apply` is dry-run only.

`open --apply` is intended for the production server under operator control.
It requires root or sudo. It writes:

- `/etc/mmx-music-studio/byok-live-pilot.env`
- `/etc/systemd/system/mmx-music-studio.service.d/byok-live-pilot.conf`

The env file is installed with mode `0600`. The systemd drop-in points to the
env file with `EnvironmentFile`.

After writing files, `open --apply` runs:

- `systemctl daemon-reload`
- `systemctl restart <service>`
- a health check expecting `READY_FOR_CONTROLLED_LIVE_PILOT_PREFLIGHT`

The script does not print the env file content and does not print confirmation
values.

## Close

`close` without `--apply` is dry-run only.

`close --apply` removes:

- `/etc/mmx-music-studio/byok-live-pilot.env`
- `/etc/systemd/system/mmx-music-studio.service.d/byok-live-pilot.conf`

Then it runs:

- `systemctl daemon-reload`
- `systemctl restart <service>`
- a health check expecting safe-default:
  - `publicByokEnabled=false`
  - `byokLiveEnabled=false`
  - `byokLiveConfirmationConfigured=false`

Operators should close the window immediately after the one-shot generation,
whether the pilot succeeds or fails.

## Recommended Use Flow

1. `scripts/byok-live-window-operator.sh status`
2. `scripts/byok-live-window-operator.sh open`
3. `sudo scripts/byok-live-window-operator.sh open --apply`
4. Run the readiness check and confirm the controlled live preflight state.
5. Manually perform one browser-based BYOK generation during the attended
   window.
6. `sudo scripts/byok-live-window-operator.sh close --apply`
7. `scripts/byok-live-window-operator.sh status` and confirm safe-default.

## Prohibitions

- Do not use this as a broad public launch.
- Do not store or paste MiniMax API keys into the script, docs, env files, or
  chat.
- Do not submit generation from this script.
- Do not call MiniMax from this script.
- Do not bypass Turnstile.
- Do not leave the live window open after the pilot.
- Do not print raw env file contents.
- Do not print confirmation values.
- Do not raise attempt/audio caps without a new operator-approved plan.

## P2 / P3 Recommendations

- P2: add an operator checklist that pairs the script with CI state, deployed
  commit, and health evidence before opening.
- P2: decide whether successful direct-live BYOK results should enter Library
  or remain direct relay only.
- P2: design user-level error messages for provider, Turnstile, cap, and
  validation failures.
- P3: consider a tiny self-use allowlist with explicit caps, audit evidence,
  rollback automation, and a clear non-public-launch policy.
