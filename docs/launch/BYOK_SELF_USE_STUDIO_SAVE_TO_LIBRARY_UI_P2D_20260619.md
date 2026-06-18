# BYOK-SELF-USE-P2D-STUDIO-SAVE-TO-LIBRARY-UI

Date: 2026-06-19

## Background

P2 made BYOK direct-live success understandable in Studio as a relay-only result. P2C added the server-side API:

`POST /api/byok/direct-live/save-to-library`

That API is safe-default disabled unless the controlled BYOK live window is open and the operator confirmation gate matches. P2D connects Studio to that API without changing production state and without opening live.

## Scope

This phase adds the Studio Save to Library UI only. It does not implement a new server API because P2C already did that work.

The UI keeps the existing relay-only result visible and adds a save area when a direct-live success response includes an audio result. It calls the P2C endpoint with the current result metadata and the current controlled confirmation input value.

## UI Flow

1. A direct-live result succeeds and includes a provider relay audio URL.
2. Studio displays stage, requestId, model, generationIntent, taskId, preview, open/download, and Not saved to Library.
3. Studio shows Save to Library.
4. The user clicks Save to Library.
5. Studio sends the current result metadata to `/api/byok/direct-live/save-to-library`.
6. On success, Studio shows Saved to Library, the returned trackId, local track links, and Go to Library.
7. On failure, Studio keeps the relay-only preview and shows a stable error message.

## UI State Machine

The Studio save area uses:

`idle / saving / saved / error`

- idle: direct-live result is available, but not persisted.
- saving: request is in flight and the button is disabled.
- saved: P2C returned `byok_library_persist_ok` or `byok_library_persist_existing` with a manifest-backed track.
- error: P2C returned a stable error, including safe-default disabled.

## Safe Preview Mode

When production is in safe-default, the P2C endpoint returns:

`byok_library_persist_disabled`

This is the safe preview mode path.

The UI displays:

`Safe preview mode: Library persistence is disabled until the controlled live window is opened.`

This is expected. P2D validation does not open the live window and does not attempt a real provider download.

## Success And Existing Handling

Successful persistence uses the returned manifest-backed track:

- local audio URL: `/api/tracks/:id/audio`
- local download URL: `/api/tracks/:id/download`
- local track id
- `library.saved=true`

If the server returns `byok_library_persist_existing`, Studio treats it as saved and notes that the result is existing/idempotent.

## Browser Storage Boundaries

The UI does not write the confirmation phrase to localStorage or sessionStorage.

The UI does not write the raw provider URL to browser storage.

The UI does not log the full save payload, API key, Authorization, token, secret, or confirmation phrase.

## Library Compatibility

This phase does not implement Library source filters. P2C returns a normal manifest-backed track, so the existing Library data source can discover it after persistence.

P2D only adds minimal source display compatibility for `byok-direct-live`, so Library can label a saved BYOK direct-live track without treating it as a demo track.

Full source filters and richer BYOK direct-live Library views are left for P2E.

## Local-Only Validation Boundary

This phase does not open BYOK live, call MiniMax, download a real provider URL, or generate audio.

Validation uses static smoke tests, typecheck, build, and release-check only.

## Smoke Coverage

`scripts/byok-self-use-studio-save-to-library-ui-smoke-test.sh` verifies:

- Studio renders Save to Library.
- Studio has idle / saving / saved / error states.
- Studio calls `saveByokDirectLiveToLibrary`.
- `serverApi` posts to `/api/byok/direct-live/save-to-library`.
- UI handles success, existing/idempotent, disabled, and error states.
- UI keeps relay-only provider preview visible on failure.
- UI uses local track URLs after success.
- UI does not store confirmation or raw provider URL in browser storage.
- Library labels `byok-direct-live` without adding P2E filters.
- The smoke itself does not submit `/api/generate/byok`, open live, call MiniMax, download provider URLs, read env secrets, or write `storage/tracks`.

## Next Steps

- P2E: add Library source badge/filter UX for BYOK direct-live tracks.
- P2F: controlled live persistence pilot using one known direct-live result and immediate closeout.
- Later: decide whether Save to Library should be operator-only, user-visible, or only available in a self-use window.
