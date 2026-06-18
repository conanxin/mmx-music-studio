# BYOK Self-Use P2 Library Result Handling

Date: 2026-06-18
Phase: BYOK-SELF-USE-P2-LIBRARY-RESULT-HANDLING
Status: local code/docs/smoke only

## Context

The one-shot BYOK direct-live pilot has succeeded.

- requestId: `byok_d03e86949d9a`
- success stage: `direct_live_relay_ok`
- generation intent: `instrumental`
- model: `music-2.6-free`
- production was rolled back to safe-default after the pilot

The pilot proved that the direct-live provider path can return a successful
result. It did not, by itself, finish the product handling for the returned
audio result.

## Current Result Shape Before This Phase

The direct-live success response already returned a small provider relay shape:

- `ok`
- `code`
- `message`
- `audioUrl`
- `taskId`
- `model`
- `meta`
- `requestId`

It did not explicitly return:

- `stage`
- `generationIntent`
- `downloadUrl`
- Library persistence state
- whether the audio result is relay-only or saved

The server did not write the direct-live result into `storage/tracks` or
`manifest.json`. The existing Library reads only manifest-backed tracks.

## P2 Strategy

This phase chooses a conservative relay-only strategy.

The Studio BYOK panel should clearly show:

- the direct-live success stage
- `requestId`
- model
- generation intent
- provider task id, when present
- audio preview, when an audio URL is returned
- an open/download link, when an audio URL is returned
- a clear "not saved to Library" state

The Library should not pretend that the relay-only provider URL is already a
persisted Library track.

## Server Response Shape

Direct-live success now includes a more explicit, safe shape:

- `stage: direct_live_relay_ok`
- `generationIntent`
- `provider: minimax`
- `audioUrl`
- `downloadUrl`
- `taskId`
- `model`
- `audioResult.available`
- `audioResult.source: provider-url`
- `audioResult.persistence: relay-only`
- `library.saved: false`
- `library.status: not_saved`
- `library.reason: direct_live_relay_only_provider_url_not_persisted`
- safe provider metadata in `meta`
- `requestId`

This is intentionally not a manifest track schema.

## Library Boundaries

The current Library distinguishes:

- demo tracks: local mock/demo data
- CLI generated tracks: manifest-backed `generationSource=mmx-cli`
- persisted API tracks: manifest-backed `generationSource=minimax`

BYOK direct-live relay results are not added as a new Library source in this
phase. They remain Studio-visible relay results until a future persistence step
downloads and stores the audio safely.

## Secret Handling

This phase must not save or display:

- MiniMax API keys
- Authorization headers
- Turnstile tokens
- confirmation phrases
- secrets
- complete provider response bodies

The direct-live result shape returns only safe operational fields and a provider
audio URL returned by the provider path.

## Why Not Save To Library Yet

The current manifest model requires a local `audioFileName` and local download
routes such as `/api/tracks/:id/audio` and `/api/tracks/:id/download`.

The direct-live success path currently receives a provider URL. Treating that
URL as a durable Library asset would be misleading because provider URLs may be
temporary and are not managed by local storage.

## Verification

The new smoke test is static and local-only:

- verifies direct-live success response has stable fields
- verifies Studio can show preview/download or a clear no-audio state
- verifies Studio says the result is not saved to Library
- verifies Library does not confuse relay-only BYOK results with manifest
  tracks
- does not submit `/api/generate/byok`
- does not call MiniMax
- does not read real env secrets
- does not write `storage/tracks`

## P3 / P2B Suggestions

Before broader self-use or small-user rollout:

1. Decide whether BYOK direct-live results should be persisted by default.
2. If yes, add a server-side ingestion step that downloads the returned audio
   URL, validates MIME/size, writes a local audio file, and appends a manifest
   track.
3. Add a new explicit source such as `byok-direct-live` only after the manifest
   schema and Library filters are updated together.
4. Add user-level messaging for expired provider URLs.
5. Keep the default production posture as safe-default until a fresh preflight
   is completed.
