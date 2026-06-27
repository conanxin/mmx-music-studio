#!/usr/bin/env bash
#
# scripts/verify-existing-cli-track.sh
# Verifies that existing mmx-cli tracks in the manifest are accessible.
# Does NOT call /api/generate or trigger new mmx music generate.
#
# Exit codes:
#   0 = all mmx-cli tracks accessible
#   1 = some mmx-cli tracks unreachable
#   2 = no mmx-cli tracks found (PARTIAL)
#

set -euo pipefail

SERVER="${SERVER:-http://localhost:8787}"
TRACKS_JSON=$(curl -sf "$SERVER/api/tracks" 2>/dev/null) || {
  echo "PARTIAL_NO_CLI_TRACK_SERVER_UNAVAILABLE: Cannot reach $SERVER/api/tracks"
  exit 2
}

# Find mmx-cli tracks
CLI_TRACKS=$(echo "$TRACKS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
tracks = data.get('tracks', [])
cli = [t for t in tracks if t.get('generationSource') == 'mmx-cli']
for t in cli:
    print(t.get('id', ''))
" 2>/dev/null) || {
  echo "PARTIAL_NO_CLI_TRACK: No mmx-cli tracks found in manifest"
  exit 2
}

if [[ -z "$CLI_TRACKS" ]]; then
  echo "PARTIAL_NO_CLI_TRACK: No mmx-cli tracks found"
  exit 2
fi

PASS=0
FAIL=0
for ID in $CLI_TRACKS; do
  # Check info endpoint
  INFO_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$SERVER/api/tracks/$ID")
  # Check audio endpoint
  AUDIO_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$SERVER/api/tracks/$ID/audio")
  # Check download endpoint
  DL_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$SERVER/api/tracks/$ID/download")
  # Check download headers for security
  HEADERS=$(curl -sI "$SERVER/api/tracks/$ID/download" 2>/dev/null)
  HAS_AUTH=$(echo "$HEADERS" | grep -ci "authorization:" || true)
  HAS_KEY=$(echo "$HEADERS" | grep -ci "x-minimax-api-key:" || true)
  HAS_BEARER=$(echo "$HEADERS" | grep -ci "bearer" || true)
  CONTENT_TYPE=$(echo "$HEADERS" | grep -i "^content-type:" | head -1 || echo "")
  CONTENT_DISP=$(echo "$HEADERS" | grep -i "^content-disposition:" | head -1 || echo "")
  CONTENT_LEN=$(echo "$HEADERS" | grep -i "^content-length:" | head -1 || echo "")

  if [[ "$INFO_CODE" == "200" && "$AUDIO_CODE" == "200" && "$DL_CODE" == "200" ]]; then
    # Check security headers
    if [[ "$HAS_AUTH" -gt 0 || "$HAS_BEARER" -gt 0 ]]; then
      echo "FAIL: $ID download contains Authorization header"
      FAIL=$((FAIL+1))
      continue
    fi
    # Check content type
    if [[ "$CONTENT_TYPE" != *"audio/"* ]]; then
      echo "WARN: $ID unexpected content-type: $CONTENT_TYPE"
    fi
    echo "PASS: $ID (info=$INFO_CODE audio=$AUDIO_CODE download=$DL_CODE)"
    echo "      content-type: ${CONTENT_TYPE#content-type: }"
    echo "      content-disposition: ${CONTENT_DISP#content-disposition: }"
    echo "      content-length: ${CONTENT_LEN#content-length: }"
    PASS=$((PASS+1))
  else
    echo "FAIL: $ID (info=$INFO_CODE audio=$AUDIO_CODE download=$DL_CODE)"
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo "Summary: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
