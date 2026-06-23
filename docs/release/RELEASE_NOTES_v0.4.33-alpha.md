# mmx-music-studio v0.4.33-alpha

## Release Type

Public-Lite Studio productization alpha release.

This release makes the `/studio` Public-Lite BYOK flow feel like a lightweight music creation product instead of an engineering test console.

This is still an alpha release. It is not a broad public launch.

## Highlights

* Productized the `/studio` page around the main question: “今天想创作什么音乐？”
* Consolidated the BYOK creation flow:

  * mode
  * prompt
  * model
  * MiniMax API Key
  * Turnstile
  * generate
  * playback / download / save
* Moved engineering/runtime details into a weaker system status area.
* Replaced heavy safety notice styling with lightweight product hints.
* Improved right-side player empty/result/action states.
* Clarified BYOK key handling copy:

  * the key is temporarily kept in server memory during the queued job;
  * it is deleted after completion, failure, cancellation, or expiry;
  * it is not written to disk, browser storage, Library, manifest, logs, or Git.
* Fixed Windows / Codex Desktop local startup by replacing the bash-only `npm run dev:full` path with `node scripts/dev-full.mjs`.
* Fixed Vite dev `/api/*` proxy so `localhost:5174` dev smoke works correctly.

## Production Deployment

* Production site: `https://music.conanxin.com`
* Production feature commit: `889ed4cc2a9a87b586666c17fe163db1e2507b5c`
* Deployment closeout doc commit: `038351b4cd9e9c548d75994bb549191dadc81908`
* 24-hour observation: stable

## Verification

* `npm run typecheck`: PASS
* `npm run build`: PASS
* `git diff --check`: PASS
* CI: PASS
* `/`: HTTP 200
* `/studio`: HTTP 200
* `/api/health`: PASS
* `/api/public-capacity`: PASS
* Service status: active

## Safety Boundaries

* No real MiniMax API call was made.
* `/api/generate/byok` was not called during verification.
* BYOK live direct window was not opened.
* No server-side shared MiniMax key was added.
* No API key, token, secret, Authorization header, or provider credential was committed.
* No account system was added.
* No admin dashboard was added.
* No 5-way concurrent generation was added.
* This is not a broad public launch.

## Known Notes

* Cloudflare Turnstile iframe may emit third-party console noise; this does not affect app loading.
* `storage/guard/public-generation-guard.json` is production runtime state and should not be committed or deleted.
* Production does not need another deployment for docs-only release metadata.
