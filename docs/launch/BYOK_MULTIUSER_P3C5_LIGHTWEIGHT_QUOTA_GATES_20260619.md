# BYOK Multiuser P3C-5 Lightweight Quota Gates

Date: 2026-06-19

## Background

P3C-1 added five-user invite/session scaffolding, P3C-2 wired route workspace resolution through access context, P3C-3 verified session store fixtures, and P3C-4 added invite session route gate enforcement.

The product target remains a small trusted five-user mode. This is not a broad public launch, not public sign-up, and not a Private Beta control plane. The site is still expected to run safe-default unless an operator explicitly enables the controlled live window and the multiuser gates.

## Scope

P3C-5 adds lightweight daily quota gates for two costly actions:

- `generate_byok`
- `save_to_library`

The quota gate is default off:

- `MULTIUSER_QUOTA_ENABLED=false` by default.
- With the default config, production behavior is unchanged.
- Missing or disabled quota config does not read or write quota storage.

This stage intentionally does not add a management dashboard, public sign-up, complex abuse scoring, full audit trails, billing, queue controls, or broad public launch readiness. Those belong to a later upgrade if usage grows beyond five trusted users.

## Limits

Suggested lightweight defaults:

- `dailyGeneratePerUser`: 10
- `dailyGeneratePerWorkspace`: 50
- `dailySavePerUser`: 20
- `dailySavePerWorkspace`: 100

The limits are evaluated at two scopes:

- user scope: `date + userId + action`
- workspace scope: `date + workspaceId + action`

Both scopes must have remaining quota before the action proceeds.

## Store

The local store path is:

```text
storage/access/quotas/YYYY-MM-DD.json
```

The store contains only quota counters:

- `date`
- `userId`
- `workspaceId`
- `action`
- `count`
- `updatedAt`

The quota store must not save BYOK API keys, MiniMax tokens, Authorization headers, confirmation phrases, prompts, lyrics, provider URLs, raw provider response bodies, or audio metadata.

Writes use an atomic temporary-file rename pattern. Smoke tests must use a temp fixture directory and must not write real `storage/access`.

## Route Integration

P3C-5 integrates quota checks into:

- `POST /api/generate/byok`
- `POST /api/byok/direct-live/save-to-library`

No quota is applied in this stage to:

- `GET /api/tracks`
- `/api/tracks/:id/audio`
- `/api/tracks/:id/download`
- `DELETE /api/tracks/:id`
- job lookup routes

For `POST /api/generate/byok`, the quota check runs after basic request validation and before any live provider call, BYOK live attempt consumption, MiniMax call, or audio generation.

For `POST /api/byok/direct-live/save-to-library`, the quota check runs after idempotency lookup and before provider URL validation, provider URL download, manifest write, or local audio write.

Quota usage is recorded only after successful live generation or successful new save-to-library persistence. Idempotent existing save results do not consume an additional save quota.

## Error Shape

When quota is enabled and the daily cap is exceeded, the server returns HTTP 429:

```json
{
  "ok": false,
  "code": "multiuser_quota_exceeded",
  "stage": "multiuser_quota_exceeded",
  "action": "generate_byok",
  "scope": "user",
  "limit": 10,
  "used": 10,
  "remaining": 0,
  "message": "Daily quota exceeded for this action."
}
```

The same shape is used for `save_to_library`; `scope` can be `user` or `workspace`.

## Security Boundaries

Quota keys come from verified access context, not client-selected workspace values. The server must not trust:

- `x-workspace-id`
- query `workspaceId`
- localStorage workspace selectors
- sessionStorage workspace selectors
- unsigned cookie workspace fields

BYOK keys remain request-memory only. The quota gate must not persist BYOK keys, tokens, secrets, Authorization headers, confirmation phrases, provider URLs, or full provider response bodies.

Quota exceeded must not call MiniMax, consume BYOK live attempt/audio caps, download provider URLs, write `storage/tracks`, or write the manifest.

## Upgrade Path After Five Users

If usage grows beyond five trusted users, upgrade before broader access:

- real account system
- invite and session management UI
- admin dashboard
- stronger user/workspace quotas
- queue and cost controls
- richer audit logging
- abuse rollback
- stronger storage backend
- deletion and revocation workflows

This stage does not deploy production, open BYOK live, call MiniMax, download provider URLs, or generate real audio.
