# BYOK Public Lite P3F: Five Active User Cap

Date: 2026-06-19

## Background

The multi-user launch path has been narrowed from a heavier invite-only/private-beta system to a faster public-lite mode for a small trusted audience.

The target is a usable site for no more than five active anonymous users at a time. The site is not being promoted as a broad public launch, does not open public sign-up, and does not replace the later account/workspace/admin path if usage grows.

Production remains safe-default until an operator explicitly enables public-lite mode.

## Product Target

- Allow pages to remain publicly reachable.
- Do not require login for this small rollout.
- Do not create real invite/session records.
- Do not implement public sign-up.
- Keep high-cost actions unavailable when public-lite capacity is full.
- Upgrade the architecture before usage grows beyond five active users.

This is a five active user cap, not a broad public launch.

## Default Configuration

Public-lite mode is default off:

```text
PUBLIC_LITE_MODE_ENABLED=false
PUBLIC_LITE_MAX_ACTIVE_USERS=5
PUBLIC_LITE_SESSION_TTL_MINUTES=30
```

When disabled, production behavior is unchanged. No anonymous public session store is read or written by the public-lite capacity path.

## Anonymous Public Session Cookie

Public-lite mode uses a signed anonymous cookie:

```text
mmx_public_session
```

The cookie contains only a signed anonymous public session payload. It must not contain:

- BYOK API keys
- MiniMax tokens
- Authorization headers
- confirmation phrases
- provider URLs
- prompts or lyrics

The server verifies the signature before accepting a public session. Invalid, missing, or expired cookies do not authorize a high-cost action.

The active window is 30 minutes by default. Expired sessions are pruned before capacity is calculated.

## Active Session Store

The public-lite active session store path is:

```text
storage/access/public-active-sessions.json
```

Each record contains:

- publicSessionId
- issuedAt
- lastSeenAt
- expiresAt
- optional userAgentHash
- optional ipHash

The store must not save raw IP addresses, raw user agents, BYOK keys, tokens, secrets, Authorization headers, confirmation phrases, provider URLs, prompts, lyrics, or provider response bodies.

If the store cannot be read or written, the high-cost action path fails closed: generation and Save to Library are disabled, while read-only pages remain available.

## Capacity Rule

The capacity rule is:

- active users <= 5: capacity available
- active users over the allowed cap, or a sixth new active user: capacity full

When capacity is full, the server returns:

```json
{
  "ok": false,
  "code": "public_capacity_full",
  "stage": "public_capacity_full",
  "message": "The service is temporarily at capacity. Please try again later."
}
```

The service is not stopped. The site remains readable.

## Public Capacity API

The read-only endpoint is:

```text
GET /api/public-capacity
```

Response shape:

```json
{
  "ok": true,
  "mode": "public_lite",
  "maxActiveUsers": 5,
  "activeUsers": 3,
  "capacityFull": false,
  "message": "Available"
}
```

The endpoint must not return session IDs, IP addresses, user-agent values, secrets, keys, tokens, confirmation phrases, or provider URLs.

## High-Cost Action Gate

The public-lite capacity gate applies only to high-cost actions:

- `POST /api/generate/byok`
- `POST /api/byok/direct-live/save-to-library`

The gate must run before:

- MiniMax provider calls
- live BYOK attempt/audio quota consumption
- provider URL validation or download
- manifest writes
- storage/tracks writes

When capacity is full:

- MiniMax is not called
- provider URLs are not downloaded
- manifests are not written
- storage/tracks is not written
- BYOK live quota is not consumed

## Read-Only Routes Stay Open

The capacity gate does not block:

- homepage loading
- `/api/health`
- `GET /api/public-capacity`
- `GET /api/tracks`
- `GET /api/tracks/:id/audio`
- `GET /api/tracks/:id/download`

This is why the service should not be stopped at five users. The goal is read-only availability with high-cost actions disabled when capacity is full.

## Studio UI

Studio checks `/api/public-capacity` on load and before generation or Save to Library.

When capacity is full, the UI shows:

```text
当前使用人数已满，请稍后再试
网站处于 5 人内轻量公开模式
```

The UI does not write public session data, BYOK keys, confirmation phrases, tokens, or provider URLs to localStorage or sessionStorage.

## Boundaries

This stage does not:

- deploy production
- open BYOK live
- call MiniMax
- generate audio
- download provider URLs
- create real invite/session records
- enable public sign-up
- implement an account system
- implement an admin dashboard
- migrate production storage
- declare broad public launch readiness

## Upgrade Path Beyond Five Users

Before usage expands beyond five active users, upgrade to:

- formal account/session system
- workspace management
- user/workspace storage isolation
- admin dashboard
- stronger quota and queue controls
- audit logs
- user data deletion and revocation flows
- stronger storage/database design
- public launch privacy and abuse rollback readiness

Until then, this mode is intentionally small, explicit, and reversible.
