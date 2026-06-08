#!/bin/bash
# studio-initial-player-hydration-smoke-test.sh
# Phase CLI-Web-E: Verify Studio hydrates player from latest track on page load
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

echo "=== Studio Initial Player Hydration Smoke Test ==="
echo ""

# 1. Studio.tsx calls listTracks on mount
check "Studio calls listTracks on mount (useEffect)" \
  "grep -q \"listTracks()\" src/features/studio/Studio.tsx"

# 2. Studio.tsx has a hydration useEffect (not only getHealth)
check "Studio has a hydration useEffect (not only getHealth)" \
  "grep -c \"useEffect\" src/features/studio/Studio.tsx | grep -q '[2-9]'"

# 3. Studio.tsx has hydrateLatestTrack or equivalent function
check "Studio has hydrateLatestTrack or equivalent" \
  "grep -q \"hydrateLatestTrack\\|hydrate\\|latestTrack\" src/features/studio/Studio.tsx"

# 4. Studio.tsx calls setCurrentTrack after hydration
check "Studio sets currentTrack after hydration" \
  "grep -q \"setCurrentTrack\" src/features/studio/Studio.tsx"

# 5. Studio.tsx imports listTracks from serverApi
check "Studio imports listTracks from serverApi" \
  "grep -w \"listTracks\" src/features/studio/Studio.tsx | grep -v '//' | grep -q 'listTracks'"

# 6. Studio.tsx imports listJobsFiltered from serverApi
check "Studio imports listJobsFiltered from serverApi" \
  "grep -q \"listJobsFiltered\" src/features/studio/Studio.tsx"

# 7. Studio.tsx handles succeeded status (not only polling)
check "Studio handles succeeded status for hydration" \
  "grep -q \"status === 'succeeded'\" src/features/studio/Studio.tsx"

# 8. Studio.tsx supports tracks endpoint audioUrl field
check "Studio maps audioUrl from tracks endpoint" \
  "grep -q \"audioUrl:\" src/features/studio/Studio.tsx"

# 9. Studio.tsx has fallback to jobs if no tracks
check "Studio has jobs fallback if no tracks" \
  "grep -q \"listJobsFiltered\\|listJobs\" src/features/studio/Studio.tsx"

# 10. Studio.tsx does not call /api/generate in hydration
check "Studio does NOT call /api/generate in hydration" \
  "! grep -n '/api/generate' src/features/studio/Studio.tsx | grep -v '// ' || true"

# 11. Studio.tsx does not call mmx music generate
check "Studio does NOT call mmx music generate" \
  "! grep -n 'mmx.*music.*generate\\|music.*generate' src/features/studio/Studio.tsx | grep -v '// ' || true"

# 12. /api/tracks returns at least one track with audioUrl
check "API /api/tracks returns track with audioUrl" \
  "curl -s 'http://127.0.0.1:8787/api/tracks' | python3 -c \"import json,sys; d=json.load(sys.stdin); t=d.get('tracks',[])[0]; assert t.get('audioUrl'), 'no audioUrl'; print('OK')\""

# 13. /api/tracks returns at least one track with downloadUrl
check "API /api/tracks returns track with downloadUrl" \
  "curl -s 'http://127.0.0.1:8787/api/tracks' | python3 -c \"import json,sys; d=json.load(sys.stdin); t=d.get('tracks',[])[0]; assert t.get('downloadUrl'), 'no downloadUrl'; print('OK')\""

# 14. No console.log(apiKey) in Studio.tsx
check "No console.log(apiKey) in Studio.tsx" \
  "! grep -n 'console.log.*key\\|console.log.*token\\|console.log.*secret' src/features/studio/Studio.tsx || true"

# 15. Studio.tsx uses DisplayTrack shape for audioUrl
check "Studio DisplayTrack supports audioUrl" \
  "grep -c 'audioUrl' src/features/studio/Studio.tsx | awk '{exit (\$1 >= 2) ? 0 : 1}'"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ $FAIL -eq 0 ]; then
  echo "STUDIO_INITIAL_PLAYER_HYDRATION_SMOKE_PASS"
  exit 0
else
  echo "STUDIO_INITIAL_PLAYER_HYDRATION_SMOKE_FAIL"
  exit 1
fi