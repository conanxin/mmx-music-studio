# BYOK-MULTIUSER-P3C2-ACCESS-CONTEXT-ROUTE-GATES

Date: 2026-06-19

## Background

P3C-1 completed five-user invite/session scaffolding:

- `server/access.ts`;
- `MAX_ACTIVE_INVITES = 5`;
- `MAX_ACTIVE_SESSIONS = 5`;
- signed session cookie helper;
- verify signed session cookie helper;
- anonymous fallback;
- `storage/access/*.json` path constants.

P3C-2 wires route workspace resolution through access context while preserving current behavior.

## What P3C-2 Does

Routes now derive workspace through:

`accessContext.workspaceId`

The current access context remains anonymous fallback plus default workspace.

This means existing anonymous/safe-preview behavior remains compatible with the legacy default workspace:

`storage/tracks`

P3C-2 is route workspace resolution scaffolding. It prepares the server for session-bound workspace resolution without turning on real multi-user access.

## What P3C-2 Does Not Do

P3C-2 does not force login.

P3C-2 does not create real invite/session records.

P3C-2 does not enable public sign-up.

P3C-2 does not deploy production.

P3C-2 does not open BYOK live.

P3C-2 does not call MiniMax.

P3C-2 does not download provider URLs.

P3C-2 does not migrate production storage.

P3C-2 does not broaden launch posture. There is still no broad public launch.

## Access Context Behavior

`resolveRouteAccessContext(req, config)` currently returns:

- anonymous mode;
- unauthenticated;
- default workspace.

The default workspace remains:

`default`

This preserves current production behavior because the default workspace maps to the existing legacy Library storage.

Future phases can replace the anonymous fallback with verified signed session lookup when the five-user invite store is intentionally enabled.

## Workspace Trust Boundary

The server must not trust client-provided workspace selectors.

Do not trust:

- header workspace selector;
- query workspace selector;
- localStorage workspace selector;
- sessionStorage workspace selector;
- unsigned cookie workspace selector.

Specifically, request values such as `x-workspace-id` or `?workspaceId=` must not authorize Library access.

Only a verified server-side session may choose a non-default workspace in a later phase.

## Route Integration List

P3C-2 routes workspace resolution through access context for:

- `/api/tracks`;
- `/api/tracks/:id`;
- `/api/tracks/:id/audio`;
- `/api/tracks/:id/download`;
- `DELETE /api/tracks/:id`;
- job list track lookup;
- job detail track lookup;
- `/api/byok/direct-live/save-to-library`.

Each route still falls back to anonymous/default workspace when no real session is enabled.

## Why Production Behavior Should Not Change

No real invite/session store is active.

No session cookie is required.

No route is newly login-required.

No client workspace selector is accepted.

The access context returns `workspaceId=default`, and default maps to the legacy `storage/tracks` path.

Therefore the current Library, audio, download, delete, job track lookup, and Save to Library workspace behavior remains equivalent to P3B/P3C-1 safe-default behavior.

## Follow-Up

### P3C-3: Real Invite/Session Store Enablement

Enable reading signed sessions from the server-side access store for the five-user pilot. Keep anonymous safe preview, but require valid session for private workspace Library and Save to Library.

### P3C-4: User/Workspace Quota Enforcement

Add simple five-user quota controls only if needed by pilot behavior. Do not implement a heavy broad-public quota/abuse system until the product exceeds the five-user assumption.

## Boundaries

P3C-2 does not submit `/api/generate/byok`.

P3C-2 does not call Save to Library.

P3C-2 does not write `storage/access`.

P3C-2 does not write `storage/tracks`.

P3C-2 does not run `scripts/byok-live-window-operator.sh open --apply`.

P3C-2 does not open BYOK live, call MiniMax, download provider URLs, generate audio, push, tag, release, or deploy production.
