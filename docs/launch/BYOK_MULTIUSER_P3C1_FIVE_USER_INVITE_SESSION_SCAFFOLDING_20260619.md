# BYOK-MULTIUSER-P3C1-FIVE-USER-INVITE-SESSION-SCAFFOLDING

Date: 2026-06-19

## Background

P3A and P3B established that the current product is not ready for broad public launch. P3C then described a full invite/session/workspace/quota design.

This P3C1 phase narrows the near-term goal.

The target is a five-user small-circle version, not a complex Private Beta platform.

## Product Assumption

The site will not be publicly advertised.

There is no public sign-up.

The expected concurrent use is at most 5 active users.

The users are trusted friends or a small trusted self-use group.

If usage grows beyond 5 users, the project must upgrade to a fuller account system, stronger quota/abuse controls, admin tooling, audit workflows, and a more durable storage architecture.

## Explicit Conclusion

No broad public launch.

No public registration.

No claim that this is a public generation service.

The correct near-term path is five-user invite-only mode with lightweight invite/session/workspace binding.

## What P3C1 Implements

P3C1 adds scaffolding only:

- `server/access.ts`;
- `InviteRecord`;
- `SessionRecord`;
- `RevocationRecord`;
- `AccessContext`;
- `MAX_ACTIVE_INVITES = 5`;
- `MAX_ACTIVE_SESSIONS = 5`;
- signed session cookie helper;
- verify signed session cookie helper;
- anonymous fallback;
- five-user cap helper;
- store path constants for `storage/access/invites.json`, `storage/access/sessions.json`, and `storage/access/revocations.json`.

P3C1 does not wire this into production routes yet.

P3C1 does not create real production invite/session records.

P3C1 does not change production behavior.

## What P3C1 Defers

The following are intentionally deferred until the product exceeds the five-user assumption or until a later pilot requires them:

- complete account system;
- public registration;
- management dashboard;
- complex daily quota system;
- complex failure lock system;
- multi-tenant billing;
- enterprise audit;
- large-scale public launch readiness;
- admin support workflow.

## Five-User Cap

The target cap is 5 active invites or 5 active sessions.

The scaffolding uses:

`MAX_ACTIVE_INVITES = 5`

`MAX_ACTIVE_SESSIONS = 5`

The active count must consider only active, non-expired records.

If more than 5 users need access, the implementation must stop treating this as a small-circle tool and upgrade to the fuller account/quota/audit model.

## Invite-Only Model

Each invite record should contain:

- inviteId;
- userId;
- workspaceId;
- optional displayName;
- createdAt;
- expiresAt;
- maxSessions;
- status: active / revoked / expired / disabled.

Only an operator should create invites.

Anonymous users must not create invites.

Public users must not self-register.

## Session Model

Each session record should contain:

- sessionId;
- inviteId;
- userId;
- workspaceId;
- issuedAt;
- expiresAt;
- status: active / revoked / expired / disabled;
- optional revokedAt;
- optional lastSeenAt.

The session cookie must be signed, expiring, and revocable.

The cookie must be HttpOnly, Secure, and SameSite=Lax or stricter.

The cookie must bind sessionId, userId, workspaceId, and inviteId.

The session can be revoked by adding a server-side revocation record or by marking the session disabled/revoked in the session store.

## Server-Side Store

The lightweight local store paths are:

`storage/access/invites.json`

`storage/access/sessions.json`

`storage/access/revocations.json`

These files must not contain API keys, BYOK keys, MiniMax tokens, Authorization values, Turnstile tokens, confirmation phrases, raw provider URLs, or full provider response bodies.

P3C1 defines the paths and types only. It does not write these files in production.

## Workspace Binding

The server must resolve workspaceId from the verified signed session.

The server must not trust:

- header workspace selector;
- query workspace selector;
- localStorage workspace selector;
- sessionStorage workspace selector;
- unsigned cookie workspace selector.

Library reads must be for the current workspace.

Save to Library must write the current workspace manifest.

Audio and download routes must verify that the track belongs to the current workspace before serving it.

## Anonymous Fallback

Anonymous mode is allowed only as a safe preview mode.

Anonymous users can load safe UI.

Anonymous users must not perform real generation, Save to Library, workspace selection, or private Library access.

## BYOK Key Boundary

BYOK key handling remains request-memory only.

The BYOK key must not be stored in:

- cookie;
- localStorage;
- sessionStorage;
- manifest;
- logs;
- audit payloads;
- invite/session/revocation store.

The same restriction applies to token/key/secret, Authorization, Turnstile token, confirmation phrase, provider URL, and full provider response body.

## Safe-Default Production Boundary

Production remains safe-default.

BYOK live stays closed unless an operator explicitly opens a controlled live window.

P3C1 does not run `scripts/byok-live-window-operator.sh open --apply`.

P3C1 does not call `/api/generate/byok`.

P3C1 does not call Save to Library.

P3C1 does not call MiniMax.

P3C1 does not download provider URLs.

P3C1 does not generate audio.

P3C1 does not deploy production.

## Updated Roadmap

### P3C1: Five-User Invite Session Scaffolding

Add minimal access model types, signed session helpers, revocation record types, anonymous fallback, and five-user cap constants.

### P3D1: Five-User Workspace Route Binding

Wire server route workspace resolution to verified session context while keeping anonymous safe preview.

### P3E1: Five-User Controlled Pilot

Create at most 5 active invites, run an operator-controlled pilot, and validate Library isolation and Save to Library behavior without public launch.

### Upgrade Path Beyond Five Users

If active use grows beyond 5 users, upgrade to a full account system, stronger quota/abuse controls, admin dashboard, audit/deletion workflows, and more durable storage before any wider launch.
