# Public-Lite Studio Production Deploy - 2026-06-22

## 1. Deployment Target

- Deploy the Public-Lite Studio product polish to `music.conanxin.com`.
- Move `/studio` from an engineering-test feel toward a clearer BYOK music creation page.

## 2. Deployment Commits

- Before deploy: `f1c44288772836697bc6b845bffb170d309f9b08`
- After deploy: `889ed4cc2a9a87b586666c17fe163db1e2507b5c`

## 3. Merge Records

- PR #3: `polish(studio): make public-lite BYOK flow product-ready`
- PR #4: `fix(studio): unblock public-lite smoke checks`

## 4. Production Verification

- `/`: HTTP 200
- `/studio`: HTTP 200
- `/api/health`: PASS
- `/api/public-capacity`: `activeUsers=1`, `maxActiveUsers=5`, `capacityFull=false`
- systemd service: `active`

## 5. Manual Smoke

- Title `今天想创作什么音乐？` is visible.
- BYOK main creation flow is visible.
- API Key copy includes `服务器内存`.
- System status is collapsed and does not dominate the first screen.
- Right-side player empty state is normal.
- No obvious application-side console error was observed.

## 6. Safety Boundaries

- No real MiniMax API call was made.
- `/api/generate/byok` was not called.
- BYOK live direct window was not opened.
- No API Key, token, or secret was committed.
- No tag was created.
- No release was created.

## 7. Notes

- Cloudflare Turnstile iframe emits third-party console noise, but it does not affect page loading.
- `storage/guard/public-generation-guard.json` is a production runtime file; it was not committed or deleted.
- `tsconfig.tsbuildinfo` was restored after production build.
