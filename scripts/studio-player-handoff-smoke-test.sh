#!/bin/bash
# studio-player-handoff-smoke-test.sh
# Phase CLI-Web-D: Verify Studio handles job→player handoff after CLI generation
# No real generation. No API key exposure. Static + API-level checks.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PASS=0
FAIL=0

check() {
  local label="$1"
  local cmd="$2"
  echo -n "[$label] "
  if eval "$cmd" > /dev/null 2>&1; then
    echo "PASS"
    PASS=$((PASS + 1))
  else
    echo "FAIL"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Studio Player Handoff Smoke Test ==="
echo ""

# 1. Studio.tsx handles succeeded status
check "Studio handles job status 'succeeded'" \
  "grep -q \"fresh.status === 'succeeded'\" src/features/studio/Studio.tsx"

# 2. Studio.tsx maps job.track via serverTrackToDisplay
check "Studio calls serverTrackToDisplay for job track" \
  "grep -q \"serverTrackToDisplay(fresh.track)\" src/features/studio/Studio.tsx"

# 3. Studio calls setCurrentTrack after job success
check "Studio calls setCurrentTrack after job success" \
  "grep -q \"setCurrentTrack(display)\" src/features/studio/Studio.tsx"

# 4. serverTrackToDisplay function exists
check "serverTrackToDisplay function exists" \
  "grep -q \"function serverTrackToDisplay\" src/features/studio/Studio.tsx"

# 5. serverTrackToDisplay maps audioUrl
check "serverTrackToDisplay maps audioUrl" \
  "grep -q \"audioUrl: t.audioUrl\" src/features/studio/Studio.tsx"

# 6. serverTrackToDisplay maps downloadUrl
check "serverTrackToDisplay maps downloadUrl" \
  "grep -q \"downloadUrl: t.downloadUrl\" src/features/studio/Studio.tsx"

# 7. Studio passes audioUrl to WaveformPlayer
check "WaveformPlayer receives audioUrl prop" \
  "grep -q \"audioUrl={currentTrack.audioUrl}\" src/features/studio/Studio.tsx"

# 8. Studio has download button with downloadUrl
check "Studio has download button with downloadUrl" \
  "grep -q \"href={currentTrack.downloadUrl}\" src/features/studio/Studio.tsx"

# 9. WaveformPlayer sets audio.src from audioUrl
check "WaveformPlayer sets audio.src from audioUrl" \
  "grep -q \"audio.src = audioUrl\" src/components/WaveformPlayer.tsx"

# 10. WaveformPlayer has audioUrl in props interface
check "WaveformPlayer has audioUrl in props interface" \
  "grep -q \"audioUrl?: string\" src/components/WaveformPlayer.tsx"

# 11. serverApi exports getTrackAudioUrl
check "serverApi exports getTrackAudioUrl" \
  "grep -q \"export function getTrackAudioUrl\" src/lib/serverApi.ts"

# 12. serverApi exports getTrackDownloadUrl
check "serverApi exports getTrackDownloadUrl" \
  "grep -q \"export function getTrackDownloadUrl\" src/lib/serverApi.ts"

# 13. API returns track for a known succeeded job (use specific job with track)
check "API returns track for succeeded job with trackId" \
  "curl -s 'http://127.0.0.1:8787/api/jobs/job_1780925873670_910f9cac' | python3 -c \"import json,sys; d=json.load(sys.stdin); job=d.get('job',{}); assert job.get('track'), 'no track in job'; print('OK')\""

# 14. Latest track has audioUrl
check "Latest track has audioUrl" \
  "curl -s 'http://127.0.0.1:8787/api/tracks' | python3 -c \"import json,sys; d=json.load(sys.stdin); tracks=d.get('tracks',[]); t=tracks[0]; assert t.get('audioUrl'), 'no audioUrl'; print('OK')\""

# 15. Latest track has downloadUrl
check "Latest track has downloadUrl" \
  "curl -s 'http://127.0.0.1:8787/api/tracks' | python3 -c \"import json,sys; d=json.load(sys.stdin); tracks=d.get('tracks',[]); t=tracks[0]; assert t.get('downloadUrl'), 'no downloadUrl'; print('OK')\""

# 16. handleGetJob returns track for succeeded job
check "handleGetJob returns track for succeeded job" \
  "curl -s 'http://127.0.0.1:8787/api/jobs/job_1780925873670_910f9cac' | python3 -c \"import json,sys; d=json.load(sys.stdin); job=d.get('job',{}); assert job.get('track'), 'no track in job response'; print('OK')\""

# 17. No console.log(apiKey) in Studio.tsx
check "No console.log(apiKey) in Studio.tsx" \
  "! grep -n 'console.log.*key\|console.log.*token\|console.log.*secret' src/features/studio/Studio.tsx || true"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ $FAIL -eq 0 ]; then
  echo "STUDIO_PLAYER_HANDOFF_SMOKE_PASS"
  exit 0
else
  echo "STUDIO_PLAYER_HANDOFF_SMOKE_FAIL"
  exit 1
fi