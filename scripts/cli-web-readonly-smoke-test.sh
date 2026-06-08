#!/bin/bash
# CLI Web Readonly Smoke Test — Phase CLI-Web-G
# Read-only verification of Web CLI backend main path.
# Does NOT call /api/generate, does NOT run mmx music generate.
set -e

ERRORS=0

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; ERRORS=$((ERRORS+1)); }

echo "=== CLI Web Readonly Smoke Test ==="

# 1. Health
HEALTH=$(curl -s http://127.0.0.1:8787/api/health 2>/dev/null) || true
if [ -z "$HEALTH" ]; then
  fail "API /api/health responds"
else
  pass "API /api/health responds"
  BACKEND=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('backend',''))" 2>/dev/null || echo "")
  if [ "$BACKEND" = "cli" ]; then
    pass "backend=cli"
  else
    fail "backend=cli (got: $BACKEND)"
  fi
  RGE=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('realGenerationEnabled',''))" 2>/dev/null || echo "")
  if [ "$RGE" = "True" ] || [ "$RGE" = "true" ]; then
    pass "realGenerationEnabled=true"
  else
    fail "realGenerationEnabled=true (got: $RGE)"
  fi
  MGE=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('mockGenerationEnabled',''))" 2>/dev/null || echo "")
  if [ "$MGE" = "False" ] || [ "$MGE" = "false" ]; then
    pass "mockGenerationEnabled=false"
  else
    fail "mockGenerationEnabled=false (got: $MGE)"
  fi
fi

# 2. Tracks
TRACKS=$(curl -s "http://127.0.0.1:8787/api/tracks" 2>/dev/null) || true
if [ -z "$TRACKS" ]; then
  fail "/api/tracks responds"
else
  pass "/api/tracks responds"
  COUNT=$(echo "$TRACKS" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('tracks',[])))" 2>/dev/null || echo 0)
  if [ "$COUNT" -gt 0 ]; then
    pass "/api/tracks has tracks (count=$COUNT)"
  else
    fail "/api/tracks has tracks (count=$COUNT)"
  fi
fi

# 3. Find mmx-cli track
MmxTrack=$(echo "$TRACKS" | python3 -c "
import sys,json
tracks=json.load(sys.stdin).get('tracks',[])
for t in tracks:
    gs=str(t.get('generationSource','')).lower()
    if gs in {'mmx-cli','cli'}:
        print(json.dumps(t)); break
" 2>/dev/null || echo "")

if [ -n "$MmxTrack" ] && [ "$MmxTrack" != "None" ]; then
  pass "Found mmx-cli track"
  TRACK_ID=$(echo "$MmxTrack" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
  AUDIO_URL="/api/tracks/${TRACK_ID}/audio"
  DOWNLOAD_URL="/api/tracks/${TRACK_ID}/download"
  HAS_AUDIO=$(echo "$MmxTrack" | python3 -c "import sys,json; print(bool(json.load(sys.stdin).get('audioUrl')))" 2>/dev/null || echo "false")
  HAS_DL=$(echo "$MmxTrack" | python3 -c "import sys,json; print(bool(json.load(sys.stdin).get('downloadUrl')))" 2>/dev/null || echo "false")
  if [ "$HAS_AUDIO" = "True" ] || [ "$HAS_AUDIO" = "true" ]; then
    pass "mmx-cli track has audioUrl"
  else
    fail "mmx-cli track has audioUrl"
  fi
  if [ "$HAS_DL" = "True" ] || [ "$HAS_DL" = "true" ]; then
    pass "mmx-cli track has downloadUrl"
  else
    fail "mmx-cli track has downloadUrl"
  fi
else
  fail "Found mmx-cli track"
  TRACK_ID=""
fi

# 4. Audio + Download endpoints
if [ -n "$TRACK_ID" ]; then
  AUDIO_CODE=$(curl -o /dev/null -s -w "%{http_code}" --max-time 20 "http://127.0.0.1:8787${AUDIO_URL}" 2>/dev/null || echo "000")
  if [ "$AUDIO_CODE" = "200" ] || [ "$AUDIO_CODE" = "206" ]; then
    pass "audio endpoint returns 200/206 (code=$AUDIO_CODE)"
  else
    fail "audio endpoint returns 200/206 (code=$AUDIO_CODE)"
  fi
  DOWNLOAD_CODE=$(curl -o /dev/null -s -w "%{http_code}" --max-time 20 "http://127.0.0.1:8787${DOWNLOAD_URL}" 2>/dev/null || echo "000")
  if [ "$DOWNLOAD_CODE" = "200" ]; then
    pass "download endpoint returns 200 (code=$DOWNLOAD_CODE)"
  else
    fail "download endpoint returns 200 (code=$DOWNLOAD_CODE)"
  fi
else
  fail "audio endpoint returns 200/206 (no track id)"
  fail "download endpoint returns 200 (no track id)"
fi

# 5. Sub smoke tests
run_subtest() {
  local name="$1"; local script="$2"
  echo ""
  echo "[Subtest] $name"
  if bash "$script" > /tmp/subtest_${name// /_}.log 2>&1; then
    pass "$name"
  else
    fail "$name — see /tmp/subtest_${name// /_}.log"
  fi
}

run_subtest "Studio initial hydration" scripts/studio-initial-player-hydration-smoke-test.sh
run_subtest "Studio player handoff" scripts/studio-player-handoff-smoke-test.sh
run_subtest "Audio duration display" scripts/audio-duration-display-smoke-test.sh
run_subtest "Studio CLI submit guard" scripts/studio-cli-submit-guard-smoke-test.sh
run_subtest "BYOK mode smoke test" scripts/byok-mode-smoke-test.sh
run_subtest "Real API attempt guard" scripts/real-api-attempt-guard-smoke-test.sh

# 6. Secret scan (no apiKey in key files — but skip this script itself)
echo ""
echo "[Secret Scan]"
KEY_FILES="src/components/WaveformPlayer.tsx src/features/studio/Studio.tsx src/features/library/Library.tsx"
for f in $KEY_FILES; do
  if test -e "$f"; then
    # Use word boundary to avoid matching the pattern string in comments
    if grep -wE 'console\.log\([[:space:]]*["'"'"']apiKey["'"'"']' "$f" 2>/dev/null | grep -qv '#.*console.log'; then
      fail "Secret in $f"
    else
      pass "No secret leak in $f"
    fi
  fi
done

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "=== Results: All passed ==="
  echo "CLI_WEB_READONLY_SMOKE_PASS"
  exit 0
else
  echo "=== Results: $ERRORS failed ==="
  exit 1
fi