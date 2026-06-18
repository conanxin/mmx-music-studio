# BYOK-MULTIUSER-P3B-LIBRARY-WORKSPACE-NAMESPACE

Date: 2026-06-19

## Background

P3A concluded that the current product must not move to broad public launch. P2D and P2C made direct-live results understandable and persistable, but the Library and manifest are still effectively global.

The P3B goal is workspace namespace scaffolding for Library, manifest, and track file access. It is the first step toward controlled multi-user support.

## P3A Conclusion

No broad public launch.

The current blocker is not the Save to Library button or the persistence API. The blocker is access and data boundaries:

- the manifest is still global;
- `/api/tracks` is still effectively the whole-site Library;
- Save to Library writes the same shared manifest;
- generation access is not a user/workspace/session identity boundary;
- quota and abuse controls are not user/workspace scoped.

## What P3B Does

P3B adds Library workspace namespace scaffolding:

- introduces a default workspace id;
- validates workspace ids with a strict safe format;
- adds a resolver for workspace track storage paths;
- keeps default / single-workspace compatibility;
- extends track metadata with optional workspace ownership fields;
- threads the current workspace id through track list, audio, download, delete, and Save to Library server paths;
- normalizes API responses so legacy tracks can appear as `workspaceId=default`;
- adds minimal Library UI compatibility for default workspace display.

## What P3B Does Not Do

P3B does not implement real auth.

P3B does not implement real multi-tenant storage enforcement.

P3B does not migrate production storage.

P3B does not move existing `storage/tracks` files.

P3B does not delete or rewrite the existing manifest.

P3B does not add public registration, account switching, workspace switching, or user-owned Library filters.

P3B does not allow a client header/query/cookie to choose a workspace.

## Default Single-Workspace Compatibility

The default workspace is:

`default`

The default workspace maps to the legacy storage layout:

`storage/tracks/manifest.json`

`storage/tracks/`

This preserves current production data and avoids a risky migration.

## Future Workspace Path

Future authenticated workspaces should use:

`storage/workspaces/{workspaceId}/tracks/manifest.json`

`storage/workspaces/{workspaceId}/tracks/audio/...`

P3B implements the resolver scaffolding for this structure, but current request handling still resolves to the default workspace only.

## TrackMetadata Extension

P3B adds optional fields:

- `workspaceId?: string`
- `ownerUserId?: string`
- `visibility?: "private" | "workspace" | "demo"`

Legacy manifest records without these fields remain valid.

New manifest-backed tracks may carry `workspaceId=default` while still writing to the legacy `storage/tracks` layout.

## API Route Workspace Touchpoints

The following server paths now resolve through the current workspace id:

- `/api/tracks`
- `/api/tracks/:id`
- `/api/tracks/:id/audio`
- `/api/tracks/:id/download`
- `DELETE /api/tracks/:id`
- `POST /api/byok/direct-live/save-to-library`
- job responses that attach a manifest-backed track

The current workspace id is fixed to the default workspace. This is intentional P3B scaffolding.

## Why Clients Cannot Select Workspace

P3B must not trust client-provided workspace selectors.

The server must not accept workspace from query params, headers, localStorage, or arbitrary cookies. A malicious client could otherwise switch workspace ids and read another Library.

P3C must bind session/auth to workspaceId server-side before non-default workspaces are allowed.

## Migration Strategy

No production storage migration occurs in P3B.

The migration plan is deferred until after:

- session/auth to workspace binding exists;
- workspace-scoped quota exists;
- ownership checks are covered by smoke tests;
- rollback and audit are defined.

## Follow-Up Split

### P3C: session/auth -> workspace binding

Bind invite/session/auth records to userId, workspaceId, and sessionId. Add revocation and expiry.

### P3D: Library workspace UI / filters

Add user-owned display, workspace badges, source filters, and clearer demo/generated/BYOK direct-live grouping.

### P3E: controlled multi-user pilot

Run a 2-5 user invite-only pilot after auth, workspace ownership checks, quota, revocation, and audit are ready.

## Boundaries

P3B keeps safe-default.

P3B does not open BYOK live, call MiniMax, submit `/api/generate/byok`, download provider URLs, generate audio, deploy production, or write production storage.
