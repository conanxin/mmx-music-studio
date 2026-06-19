# BYOK-MULTIUSER-P3C4-INVITE-SESSION-ROUTE-GATE-ENFORCEMENT

Date: 2026-06-19

## Background

P3C-3 verified the five-user fixture session store gate.

The server can now resolve a valid signed invite session into `invite_user + workspaceId` when multiuser access is explicitly enabled and a server-side session secret is configured.

P3C-4 adds the first route gate enforcement layer for invite-only actions.

## Goal

The goal is route gate enforcement for mutating or costly actions while keeping the default production behavior unchanged.

This is still for a five-user small-circle version.

This is no broad public launch.

## What This Phase Implements

P3C-4 adds:

- an invite user access context helper;
- a route gate enabled helper;
- a `requireInviteUserForAction(...)` helper;
- stable unauthenticated JSON error shape;
- gate checks for mutating or costly actions.

The gate requires:

- `multiuserAccessEnabled === true`;
- `multiuserRouteGateEnabled === true`;
- access context mode is `invite_user`;
- `isAuthenticated === true`;
- userId exists;
- workspaceId exists;
- sessionId exists;
- inviteId exists.

## Safe Default

The multiuser route gate is default off.

When `MULTIUSER_ROUTE_GATE_ENABLED` is false, production behavior remains compatible with the current anonymous/default workspace flow.

When `MULTIUSER_ACCESS_ENABLED` is false, route gate enforcement is not active.

When the session secret is missing, no request can be authorized as an invite user.

The route gate does not create invite records, session records, workspace records, or access store files.

## Gated Routes

The first gated route list is intentionally small:

- `POST /api/generate/byok`;
- `POST /api/byok/direct-live/save-to-library`;
- `DELETE /api/tracks/:id`.

These are mutating, costly, or destructive actions.

Read-only Library routes remain compatible in this phase:

- `GET /api/tracks`;
- `GET /api/tracks/:id`;
- `GET /api/tracks/:id/audio`;
- `GET /api/tracks/:id/download`;
- job track lookup.

P3C-5 can tighten read-only ownership behavior once invite/session and quota enforcement are ready for controlled pilot use.

## Error Shape

When the gate is enabled and the request does not have a valid invite session, the route returns a stable JSON error:

```json
{
  "ok": false,
  "code": "multiuser_invite_session_required",
  "stage": "multiuser_invite_session_required",
  "action": "byok_generate",
  "message": "A valid invite session is required for this action."
}
```

HTTP status is 401.

The response does not include cookie values, signatures, session details, secrets, BYOK keys, provider URLs, or confirmation phrases.

## Header And Query Boundary

The server must not trust:

- `x-workspace-id`;
- query `workspaceId`;
- localStorage workspace selectors;
- sessionStorage workspace selectors;
- unsigned cookie workspace fields.

Workspace ownership must come from a verified signed session and matching server-side store records.

## Secret Boundary

The route gate must not persist or log:

- BYOK key;
- MiniMax token;
- Authorization;
- confirmation phrase;
- Turnstile token;
- provider audio URL;
- full provider response body;
- token/key/secret values.

The BYOK key remains request-memory only.

The session secret is server-only and is never returned in health, logs, manifests, or client responses.

## Explicit Non-Goals

P3C-4 does not create real production invite/session records.

P3C-4 does not enable public sign-up.

P3C-4 does not deploy production.

P3C-4 does not open BYOK live.

P3C-4 does not call `/api/generate/byok`.

P3C-4 does not call Save to Library.

P3C-4 does not call MiniMax.

P3C-4 does not download provider URLs.

P3C-4 does not generate audio.

P3C-4 does not migrate production storage.

## Why Production Behavior Does Not Change

The route gate helper is inert unless both explicit flags are enabled.

Default configuration keeps:

- `multiuserAccessEnabled=false`;
- `multiuserRouteGateEnabled=false`.

That means existing safe preview, default workspace, and safe-default BYOK behavior remain unchanged.

## Follow-Up

P3C-5: user/workspace quota enforcement for generation and Save to Library.

P3D: Library workspace UI, ownership display, and filters.

P3E: five-user controlled pilot.
