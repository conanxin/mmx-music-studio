# BYOK-MULTIUSER-P3C-SESSION-WORKSPACE-BINDING-AND-QUOTA-DESIGN

Date: 2026-06-19

## Background

P3A defined the multi-user launch boundary: no broad public launch, and the next viable shape is a controlled invite-only pilot.

P3B added Library workspace namespace scaffolding. The default workspace remains compatible with the legacy `storage/tracks` layout, while future non-default workspaces are expected to use `storage/workspaces/{workspaceId}/tracks/...`.

Production is still on the P2D safe-default deployment. P3B is not deployed to production. BYOK live is closed, MiniMax is not called, provider URLs are not downloaded, and no audio is generated.

The remaining blocker for controlled multi-user use is not the UI. It is session/auth to workspace binding and user/workspace quota enforcement.

## Explicit Conclusion

This codebase is still not ready for broad public launch.

P3C should design an invite-only session model and quota gates. It must not implement public sign-up, a real account system, or broad public access.

## Current Auth And Quota Risk Analysis

### Generation Access Cookie

The current generation access cookie is named `mmx_gen_access`.

The current token shape is:

`<hmac_hex>:<timestamp>`

The current verifier accepts a valid-format token within the configured age window. The implementation notes that it accepts any valid-format token because the random UUID used during signing is not available during verification.

That means the current cookie check is primarily format and timestamp validation. It is not a stable multi-user identity boundary.

Current gaps:

- no real `userId`;
- no real `workspaceId`;
- no real `sessionId`;
- no `inviteId`;
- no server-side session store;
- no session revocation;
- no user disable;
- no workspace ownership check;
- no per-user or per-workspace quota.

### Current Rate Limit And Guard Dimensions

The current rate limit uses a hashed client IP key.

The launch guard uses `sourceHash`, derived from the same client key. This is useful as an auxiliary abuse signal, but it is not a user or workspace identity.

The daily generation quota is currently global and source-count based. It is not keyed by userId or workspaceId.

Save to Library currently has no user/workspace quota model.

### Current Workspace Resolution

P3B added `resolveCurrentWorkspaceId(req)` as scaffolding. It currently returns `default` and explicitly does not trust client header/query/cookie workspace selectors.

That is correct for the current stage. In a multi-user stage, this function must resolve workspaceId from a verified session, not from untrusted request fields.

## Invite-Only Session Model

### Invite-Only Access

The controlled pilot should use operator-created invites only.

No public sign-up.

No anonymous real generation.

No anonymous Save to Library.

Each invite record should contain:

- `inviteId`;
- `userId`;
- `workspaceId`;
- `displayName` optional;
- `expiresAt`;
- `maxSessions`;
- `status`: `active`, `revoked`, or `expired`.

An invite should create a server-side session only after validation. The resulting user can operate only inside the assigned workspace and within the configured quotas.

## Session Cookie Requirements

The session cookie must be:

- signed cookie, using HMAC or an equivalent signature;
- HttpOnly;
- Secure;
- SameSite=Lax or SameSite=Strict;
- expiring cookie/session with an explicit `expiresAt`;
- bound to `sessionId`;
- bound to `userId`;
- bound to `workspaceId`;
- bound to `inviteId`;
- revocable session;
- rotating or replaceable when needed.

The cookie must not contain:

- BYOK key;
- MiniMax token;
- API key;
- provider audio URL;
- confirmation phrase;
- token/key/secret;
- raw provider response.

The BYOK key must remain request-memory only. It must never be written to cookie, localStorage, sessionStorage, manifest, track metadata, logs, audit payloads, or server-side session files.

## Server-Side Session Store

P3C should design a lightweight local store first, with a clear migration path to a database.

Recommended files:

`storage/access/sessions.json`

`storage/access/invites.json`

`storage/access/revocations.json`

The store should contain only access metadata:

- sessionId;
- userId;
- workspaceId;
- inviteId;
- issuedAt;
- expiresAt;
- status;
- revokedAt optional;
- disabledAt optional;
- lastSeenAt optional;

The store must not save API key, BYOK key, MiniMax token, Authorization value, confirmation phrase, token/key/secret, provider URL, or raw provider body.

P3C is design only. It does not enable this store in production.

## Revocation Design

Revocation must be server-side.

Revocable entities:

- invite;
- session;
- user;
- workspace if needed by operator.

Every route that requires identity must reject a revoked or expired session before quota, storage, provider, or manifest work.

Revocation should support immediate operator rollback during a controlled pilot.

## Workspace Binding Design

The server must derive workspaceId from the verified session:

`resolveCurrentWorkspaceId(req) -> read signed session -> verify signature / expiry / revocation -> return workspaceId`

The server must not trust:

- `query.workspaceId`;
- header `x-workspace-id`;
- unsigned cookie workspaceId;
- localStorage workspaceId;
- sessionStorage workspaceId;
- arbitrary client-sent workspace values.

Client-provided workspace selectors are not authorization. They can be UI hints only after server-side session identity exists, and even then server authorization must remain authoritative.

## Access Modes

### 1. Safe Preview Anonymous

Anonymous users may load the page, view safe preview UI, and see demo or public-safe copy.

Anonymous users must not:

- generate real audio;
- submit `/api/generate/byok`;
- Save to Library;
- access private workspace tracks;
- select a workspace.

### 2. Invite-Only User Mode

An invited user has a signed, expiring, revocable session.

The session binds:

- userId;
- workspaceId;
- sessionId;
- inviteId.

Capabilities are still gated by:

- operator live window;
- Turnstile requirements;
- BYOK confirmation requirements;
- daily generation quota per user;
- daily generation quota per workspace;
- daily save quota per user;
- daily save quota per workspace;
- cooldownSeconds;
- failureLockThreshold;
- failureLockMinutes.

### 3. Operator/Admin Mode

An operator/admin can:

- open or close the live window;
- revoke invite;
- revoke session;
- disable user;
- inspect audit summaries;
- run rollback procedures.

P3C does not implement a full admin dashboard. It only defines the model and route gates needed before such a dashboard is useful.

## User And Workspace Quota Design

Identity-aware quotas should be separate from the existing global and sourceHash guards.

Recommended config keys:

- `dailyGenerationQuotaPerUser`;
- `dailyGenerationQuotaPerWorkspace`;
- `dailySaveQuotaPerUser`;
- `dailySaveQuotaPerWorkspace`;
- `cooldownSeconds`;
- `failureLockThreshold`;
- `failureLockMinutes`;

Existing live-window caps remain:

- `liveWindowAttemptCap`;
- `liveWindowAudioCap`;

IP and sourceHash remain auxiliary abuse signals. They must not be the only quota identity.

Recommended quota key fields:

- date;
- userId;
- workspaceId;
- action: `generate` or `save-to-library`;
- count;
- failedCount;
- lockedUntil;

Recommended quota store:

`storage/access/quotas/YYYY-MM-DD.json`

The quota store must not save BYOK key, API key, token, secret, Authorization, confirmation phrase, prompt body beyond explicit audit policy, provider URL, or full provider response body.

## Route Gate Integration Points

Every identity-sensitive route should use this order:

1. Parse and verify signed session.
2. Check expiry and revocation.
3. Resolve userId and workspaceId.
4. Check action-specific quota and cooldown.
5. Resolve workspace-scoped storage.
6. Perform the allowed action.

Required route gates:

- `/api/generate/byok` gate;
- `/api/byok/direct-live/save-to-library` Save to Library gate;
- `/api/tracks` workspace gate;
- `/api/tracks/:id/audio` ownership check;
- `/api/tracks/:id/download` ownership check;
- `DELETE /api/tracks/:id` ownership check;
- job track lookup ownership check;
- Library UI session-aware workspace display;
- Studio Save to Library UI disabled/allowed states.

The route gates must reject anonymous users for real generation and Save to Library.

The route gates must not let a client choose workspace by header, query, localStorage, sessionStorage, or unsigned cookie.

## Secret And BYOK Key Boundary

BYOK key handling remains request-memory only.

Never store:

- BYOK key;
- MiniMax API key;
- Authorization;
- Turnstile token;
- confirmation phrase;
- token/key/secret;
- raw provider URL in long-term storage;
- full provider response body.

Allowed durable fields are identity, quota, ownership, requestId, providerTaskId, trackId, timestamps, status, and safe summarized diagnostics.

## Audit, Deletion, And Revocation Requirements

Controlled multi-user pilot requires:

- session creation audit;
- invite acceptance audit;
- generation request audit;
- Save to Library audit;
- quota rejection audit;
- failure lock audit;
- revocation audit;
- track deletion audit;
- user data deletion procedure;
- workspace deletion or export procedure;
- operator rollback runbook.

Audit records must be keyed by userId, workspaceId, sessionId, requestId, and trackId where applicable.

Audit records must not store token/key/secret, BYOK key, Authorization, confirmation phrase, full prompt where policy disallows it, full provider URL, or full provider response body.

## Follow-Up Route

### P3D: Library Workspace UI / Filters

Add source filters, workspace badges, user-owned display, and clearer demo/generated/BYOK direct-live grouping.

### P3E: Controlled Multi-User Pilot

Run 2-5 invite-only users with operator windows, quotas, revocation, audit, and rollback.

### P4: Public Launch Readiness

Public launch requires auth, workspace isolation, quota, deletion, revocation, audit, cost controls, abuse rollback, privacy copy, and support operations.

Public launch must not be achieved by simply opening the existing BYOK live window.

## Out Of Scope For P3C

This phase does not implement real auth, public login, public registration, account creation, real session store code, real quota store code, production deployment, BYOK live enablement, MiniMax calls, provider URL download, audio generation, production storage migration, commits, pushes, tags, or releases.

This phase does not submit `/api/generate/byok`, call Save to Library, run `scripts/byok-live-window-operator.sh open --apply`, write `storage/tracks`, or persist any BYOK key.

For the avoidance of doubt: this phase does not call Save to Library, does not start BYOK live, does not call MiniMax, does not download provider URLs, does not generate audio, does not write `storage/tracks`, and does not modify production.
