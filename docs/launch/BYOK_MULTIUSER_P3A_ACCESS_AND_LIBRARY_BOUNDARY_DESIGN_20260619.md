# BYOK-MULTIUSER-P3A-ACCESS-AND-LIBRARY-BOUNDARY-DESIGN

Date: 2026-06-19

## Background

P2D is deployed. Studio can show a BYOK direct-live relay-only result, including stage, requestId, model, generationIntent, taskId, preview, open/download links, and Save to Library UI.

P2C is deployed. The server has:

`POST /api/byok/direct-live/save-to-library`

Production safe-default remains healthy. BYOK live is closed, Save to Library is disabled by the server gate, MiniMax is not called, and provider URLs are not downloaded.

The blocker has moved from result visibility to multi-user access control and Library data isolation.

## Explicit Conclusion

This codebase is not ready for broad public launch.

The next suitable launch shape is a controlled multi-user pilot with invite-only access, small quotas, explicit operator windows, and workspace-scoped Library data.

The current version must not be marketed as a public generation service.

## Current Code And Risk Analysis

### Generation Access Cookie

The current generation access cookie is created as a timestamped HMAC-shaped token. The verifier accepts a valid-looking `hmac:timestamp` token within the configured age window.

The current verifier is not enough as a multi-user identity boundary because it is effectively format and freshness validation. It is not bound to a userId, workspaceId, sessionId, invite, device, or revocation record.

For multi-user use, a cookie/session must be signed / bound / expiring / revocable. It must not be format-only validation.

### Global Manifest And Library

The current manifest-backed Library uses a global manifest:

`storage/tracks/manifest.json`

Tracks and audio files are not currently scoped by userId, workspaceId, or sessionId. The current `/api/tracks` route returns the global Library. Current track audio and download routes resolve tracks by global id from the global manifest.

The current Save to Library API writes BYOK direct-live tracks to the global manifest. That is acceptable for single self-use and controlled safe-default validation, but it is not acceptable for broad public launch.

If 2-5 users try the current system without isolation, saved tracks can become mutually visible through the shared Library and shared `/api/tracks/:id/audio` or `/api/tracks/:id/download` routes.

### Quota And Abuse Controls

Existing limits are useful but not enough for multi-user identity:

- IP or sourceHash based limits can reduce abuse, but they do not identify a workspace owner.
- Daily quota is not yet modeled per user/workspace.
- Save to Library limits are not yet modeled per user/workspace.
- Failure lock, cooldown, deletion, revocation, and audit are not yet user/workspace aware.

### Broad Public Launch Risk List

- Global manifest causes cross-user Library visibility.
- Global `storage/tracks` creates ambiguous ownership.
- `/api/tracks` can expose the full site Library.
- Save to Library writes to the global manifest.
- Generation access cookie is not a strong identity boundary.
- Rate limit lacks user/workspace dimensions.
- There is no user disable or invite revocation mechanism.
- There is no user data deletion workflow.
- Audit events are not tied to a stable user/workspace identity.
- Cost exposure is not bounded by user/workspace quotas.
- BYOK key must stay request-memory only and must never become browser or server persistent state.

## Launch Mainline

### A. Current State: Safe Preview / Single Self-Use

- BYOK live is default closed.
- Operator live window remains the top-level switch.
- Library is global.
- Save UI and P2C API exist, but safe-default keeps persistence disabled.
- This is suitable for controlled operator validation and single self-use only.

### B. Next Stage: Controlled Multi-User Invite-Only Pilot

- 2-5 trusted users.
- Invite-only, no public registration.
- Operator manually opens limited live windows.
- Small attempt, audio, generation, and save quotas.
- Explicit user/workspace/session model.
- Workspace-scoped Library and storage.
- No broad public launch language.

### C. Private Beta

- Invite code or account-backed access.
- userId/workspaceId/sessionId are durable enough for auth, quota, audit, and revocation.
- Library data isolation is complete.
- User/workspace daily generation quota and daily save quota are enforced.
- Deletion, revocation, disable, and audit flows exist.

### D. Public Launch

- Account system is ready.
- Privacy copy is ready.
- Cost and rate safeguards are ready.
- Abuse rollback is ready.
- Admin review and support workflows are ready.
- Public launch must not be implemented by simply opening the existing BYOK live window.

## Access Control Design

The controlled multi-user pilot should use invite-only access.

Recommended roles:

- `userId`: stable invited person or account identity.
- `workspaceId`: Library, quota, and track ownership boundary.
- `sessionId`: browser session/device boundary with expiration and revocation.

The session cookie must be signed / bound / expiring / revocable.

The cookie must not be format-only validation. It should be bound to a server-side or signed record that includes userId, workspaceId, sessionId, issuedAt, expiresAt, and revocation state.

The cookie must not contain a MiniMax key, BYOK key, token, secret, confirmation phrase, or provider URL.

The MiniMax/BYOK key is request-memory only. It must not be persisted to cookie, localStorage, sessionStorage, manifest, logs, audit payloads, or track metadata.

## Library Isolation Design

Keep single-workspace compatibility while adding a workspace namespace.

Recommended storage shape:

`storage/workspaces/{workspaceId}/tracks/manifest.json`

`storage/workspaces/{workspaceId}/tracks/audio/...`

Equivalent safe structures are acceptable if they preserve the same ownership boundary.

Required route behavior:

- `/api/tracks` must return only the current workspace tracks.
- `/api/tracks/:id/audio` must verify workspace ownership before serving audio.
- `/api/tracks/:id/download` must verify workspace ownership before serving a download.
- Save to Library must write the current workspace manifest.
- Track delete must only delete tracks from the current workspace.
- Demo tracks must be marked separately from user-owned tracks.
- CLI generated tracks, demo tracks, and BYOK direct-live tracks must remain distinguishable.

Recommended BYOK direct-live fields:

- `generationSource: byok-direct-live`
- `provider: minimax`
- `requestId`
- `providerTaskId`
- `generationIntent`
- `workspaceId`
- `createdByUserId`
- `byok.mode: direct-live`
- `byok.persistedFrom: provider-url`

Do not save raw provider URLs as long-term manifest fields.

## Quota And Abuse Control Design

The operator live window remains the highest-level switch.

BYOK live attempt/audio caps remain in place.

Add identity-aware controls:

- user/workspace daily generation quota.
- user/workspace daily save quota.
- per-user cooldown.
- per-workspace cooldown.
- failure lock after repeated provider/save failures.
- invite revocation and user disable.
- audit records keyed by userId, workspaceId, sessionId, requestId, and trackId.

IP/sourceHash controls should remain as auxiliary abuse signals, not as the primary multi-user quota boundary.

## Launch Gate Checklist

Broad public launch is blocked until all of these are true:

- auth ready.
- workspace isolation ready.
- quota ready.
- deletion/revocation ready.
- audit ready.
- cost/rate safeguards ready.
- privacy copy ready.
- abuse rollback ready.

## Implementation Split

### P3B: Library Workspace Namespace

Add workspace-scoped manifest and track path helpers. Keep single-workspace compatibility. Make `/api/tracks`, audio, download, delete, and Save to Library resolve through the current workspace.

### P3C: Multi-User Quota / Abuse Control

Add user/workspace daily generation quota, daily save quota, cooldown, failure lock, invite revocation, user disable, and identity-aware audit.

### P3D: Library P2E UI Badge / Filter / User-Owned Display

Add Library badges and filters for demo, CLI generated, and BYOK direct-live tracks. Show ownership and workspace scope without exposing sensitive fields.

### P3E: Controlled Multi-User Pilot

Run a 2-5 user invite-only pilot with operator windows, explicit quotas, monitored logs, deletion/revocation procedures, and no public registration.

### P4: Public Launch Readiness

Only after auth, workspace isolation, quota, deletion, revocation, audit, cost safeguards, privacy copy, and abuse rollback are proven.

## Out Of Scope For P3A

This phase does not implement accounts, real multi-tenant storage, workspace manifest migration, production deployment, live enablement, MiniMax calls, provider URL download, or audio generation.

This phase does not change production environment, run `scripts/byok-live-window-operator.sh open --apply`, submit `/api/generate/byok`, call Save to Library, or write `storage/tracks`.
