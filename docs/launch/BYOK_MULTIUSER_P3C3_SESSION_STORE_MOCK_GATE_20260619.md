# BYOK-MULTIUSER-P3C3-SESSION-STORE-MOCK-GATE

Date: 2026-06-19

## Background

P3C-1 added five-user invite/session scaffolding: access records, signed session cookie helpers, anonymous fallback, and five-user cap constants.

P3C-2 wired server routes through access context workspace resolution while preserving anonymous/default behavior.

P3C-3 verifies the smallest local fixture session store gate.

## Goal

This phase proves that a valid signed session can resolve an `invite_user` access context and workspaceId from a server-side fixture store.

The same resolver must return anonymous/default when multiuser access is disabled, when the session secret is missing, when the cookie is missing or invalid, when the store is missing, or when the invite/session is revoked or expired.

## What This Phase Implements

- `readInvitesStore(options?)`
- `readSessionsStore(options?)`
- `readRevocationsStore(options?)`
- `resolveAccessContextFromRequest(req, options)`
- `validateFiveUserAccessStores(invites, sessions, now?)`
- server config fields for explicit multiuser access enablement
- route resolver wiring that calls the access resolver only when enabled and a session secret is configured
- local fixture smoke coverage for active, revoked, expired, disabled, and cap-exceeded states

## Fixture Behavior

With multiuser access disabled, the resolver returns:

- mode: anonymous
- workspaceId: default
- authenticated: false

With multiuser access enabled but the session secret missing, the resolver also returns anonymous/default.

With a valid signed session cookie and active invite/session records, the resolver returns:

- mode: invite_user
- authenticated: true
- userId
- workspaceId
- sessionId
- inviteId

The workspaceId comes from the verified session and matching server-side store records.

## Revoked And Expired Records

The resolver does not authenticate:

- expired session cookie
- expired session record
- expired invite record
- revoked session
- revoked invite
- revoked user
- revoked workspace
- disabled session
- disabled invite

Revoked/expired access falls back to anonymous/default and does not authorize workspace access.

## Five-User Cap

The five-user cap remains:

- `MAX_ACTIVE_INVITES = 5`
- `MAX_ACTIVE_SESSIONS = 5`

The resolver validates active invite and active session counts before authorizing a fixture session.

If more than 5 active invites or more than 5 active sessions exist, the access store is treated as over cap and the resolver falls back to anonymous/default.

This keeps the near-term target explicitly scoped to a five-user small-circle version.

## Safe Defaults

Multiuser access is default off.

Missing session secret means anonymous/default.

Missing cookie means anonymous/default.

Missing store files mean anonymous/default.

The session secret is server-only and must not be exposed in health, logs, manifests, client responses, or browser storage.

## Route Behavior

Routes already consume `accessContext.workspaceId` from P3C-2.

P3C-3 only makes the resolver verifiable under explicit local fixture conditions.

No route is forced to require login in this phase.

Anonymous/default behavior remains equivalent to the current single-workspace behavior.

## Explicit Non-Goals

P3C-3 does not create real production invite/session records.

P3C-3 does not enable public sign-up.

P3C-3 does not force all routes to login.

P3C-3 does not deploy production.

P3C-3 does not open BYOK live.

P3C-3 does not call `/api/generate/byok`.

P3C-3 does not call Save to Library.

P3C-3 does not call MiniMax.

P3C-3 does not download provider URLs.

P3C-3 does not generate audio.

P3C-3 does not migrate production storage.

## Secret Boundary

The access store and cookie must not contain:

- BYOK key
- MiniMax token
- Authorization
- confirmation phrase
- Turnstile token
- provider audio URL
- full provider response body
- token/key/secret values

The BYOK key remains request-memory only.

## Header And Query Boundary

The server must not trust:

- `x-workspace-id`
- query `workspaceId`
- localStorage workspace selectors
- sessionStorage workspace selectors
- unsigned cookie workspace selectors

Workspace binding must come from a verified signed session and matching server-side store records.

## Follow-Up

P3C-4: route gate enforcement for invite-only actions.

P3C-5: user/workspace quota enforcement for generation and Save to Library.

P3E: five-user controlled pilot with at most 5 active invites/sessions.

This is still no broad public launch.
