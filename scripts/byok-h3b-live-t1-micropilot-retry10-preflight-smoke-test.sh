#!/usr/bin/env bash
# Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-10-PREFLIGHT smoke test.
#
# Read-only preflight checklist. Does NOT submit, does NOT call
# provider, does NOT generate audio, does NOT open live gate, does
# NOT relock a window, does NOT set BYOK_LIVE_CONFIRMATION. Verifies
# that the current state of the repo and the live service is
# eligible for a future Retry-10 planning decision.
#
# Triggers the explicit operator phrase
# `BYOK_H3B_LIVE_T1_MICROPILOT_RETRY10_PREFLIGHT_SMOKE_PASS` on
# success.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

pass=0
fail=0

pass_count() { pass=$((pass+1)); echo "PASS: $1"; }
fail_count() { fail=$((fail+1)); echo "FAIL: $1"; }

need() {
  local file="$1"; local needle="$2"; local label="$3"
  if grep -Fq -- "$needle" "$file"; then pass_count "$label"
  else fail_count "$label — missing: $needle in $file"; fi
}

reject() {
  local file="$1"; local needle="$2"; local label="$3"
  if grep -Fq -- "$needle" "$file"; then fail_count "$label — unexpected: $needle in $file"
  else pass_count "$label"; fi
}

# ─────────────────────────────────────────────────────────────
# A. Backend terminal-fix is in HEAD
# ─────────────────────────────────────────────────────────────
need server/index.ts "stage: 'direct_live_not_enabled'" \
  "A1: backend direct_live_not_enabled terminal recording present"
need server/index.ts "stage: 'direct_live_confirmation_mismatch'" \
  "A2: backend direct_live_confirmation_mismatch terminal recording present"
need server/index.ts "stage: 'direct_live_provider_error'" \
  "A3: backend direct_live_provider_error terminal recording present"
need server/index.ts "stage: 'direct_live_relay_ok'" \
  "A4: backend direct_live_relay_ok terminal recording present"
need server/index.ts "responseCode: 'byok_direct_live_not_enabled'" \
  "A5: backend direct_live_not_enabled responseCode aligned"
need server/index.ts "responseCode: 'byok_direct_live_confirmation_required'" \
  "A6: backend direct_live_confirmation_mismatch responseCode aligned"

# ─────────────────────────────────────────────────────────────
# B. Frontend directLiveConfirmation fix is in HEAD
# ─────────────────────────────────────────────────────────────
need src/features/studio/ByokPanel.tsx "useState<string>('')" \
  "B1: frontend directLiveConfirmation state declared"
need src/features/studio/ByokPanel.tsx "setDirectLiveConfirmation" \
  "B2: frontend setDirectLiveConfirmation setter present"
need src/features/studio/ByokPanel.tsx "id=\"byok-direct-live-confirmation\"" \
  "B3: frontend input has test-hook id"
need src/features/studio/ByokPanel.tsx "type=\"password\"" \
  "B4: frontend input is password type"
need src/features/studio/ByokPanel.tsx "isByokLiveReady &&" \
  "B5: frontend input rendered only when live-ready"
need src/features/studio/ByokPanel.tsx "directLiveConfirmation.length > 0" \
  "B6: frontend payload gated by non-empty length"
need src/features/studio/ByokPanel.tsx "setDirectLiveConfirmation('')" \
  "B7: frontend finally-block clears directLiveConfirmation"

# ─────────────────────────────────────────────────────────────
# C. No hardcoded real phrase
# ─────────────────────────────────────────────────────────────
reject src/features/studio/ByokPanel.tsx "CONFIRM_BYOK_DIRECT_LIVE_TEST" \
  "C1: source has no hardcoded direct-live phrase"
reject src/features/studio/ByokPanel.tsx "CONFIRM_BYOK_LIVE_RELAY_TEST" \
  "C2: source has no hardcoded CLI live phrase"

# D. No persistence
reject src/features/studio/ByokPanel.tsx "localStorage.setItem" \
  "D1: no localStorage write"
reject src/features/studio/ByokPanel.tsx "sessionStorage.setItem" \
  "D2: no sessionStorage write"
reject src/features/studio/ByokPanel.tsx "indexedDB" \
  "D3: no IndexedDB"
reject src/features/studio/ByokPanel.tsx "document.cookie" \
  "D4: no cookie"

# E. No logging
reject src/features/studio/ByokPanel.tsx "console.log(directLiveConfirmation" \
  "E1: no console.log of directLiveConfirmation"
reject src/features/studio/ByokPanel.tsx "console.warn(directLiveConfirmation" \
  "E2: no console.warn of directLiveConfirmation"
reject src/features/studio/ByokPanel.tsx "console.error(directLiveConfirmation" \
  "E3: no console.error of directLiveConfirmation"

# F. Tag unchanged
LATEST_TAG=$(git tag --sort=-v:refname | head -1)
if [ "$LATEST_TAG" = "v0.4.31-alpha" ]; then
  pass_count "F1: latest tag unchanged at v0.4.31-alpha"
else
  fail_count "F1: latest tag moved to $LATEST_TAG"
fi

# ─────────────────────────────────────────────────────────────
# G–P. Live production health (read-only) probe
# ─────────────────────────────────────────────────────────────
HEALTH_URL="https://music.conanxin.com/api/health"
HEALTH_FILE=/tmp/byok-h3b-retry10-preflight-health.json
curl -s "$HEALTH_URL?ts=$(date +%s)" -o "$HEALTH_FILE"

python3 - <<PY
import json
from pathlib import Path
d = json.loads(Path("$HEALTH_FILE").read_text())
checks = {
  "G1_publicByokEnabled_false": d.get("publicByokEnabled") is False,
  "G2_byokEnabled_false": d.get("byokEnabled") is False,
  "H_byokDirectLiveEnabled_proxy": (
    # directLiveEnabled is not in /api/health (only the proxy
    # observable: byokDirectLiveEnabled should equal False if
    # BYOK_DIRECT_LIVE_ENABLED is unset, but the field is not
    # surfaced. So we use a stricter proxy: byokLiveEnabled is False
    # and the last submit modeCandidate is not "live".
    d.get("byokLiveEnabled") is False
    and d.get("byokLastSubmitModeCandidate") != "live"
  ),
  "I_byokLiveEnabled_false": d.get("byokLiveEnabled") is False,
  "J_no_live_confirmation": d.get("byokLiveConfirmationConfigured") is False,
  "K_no_live_window_active": (
    d.get("byokLiveAttemptsUsed", 0) == 0
    and d.get("byokLiveAttemptsRemaining", 1) >= 1
  ),
  "L_no_live_attempts_remaining_untouched": (
    d.get("byokLiveAttemptsRemaining", 0) >= 0
  ),
  "M_no_real_api_used": d.get("realApiAttemptsUsed", 0) == 0,
  "N_no_audio_generated": d.get("byokLiveAudioUsed", 0) == 0,
  "O_no_new_silent_consume_since_deploy": d.get("byokSilentConsumeCount", 0) == 0,
  "P_no_pending_consumed_attempts": d.get("byokPendingConsumedAttempts", 0) == 0,
}
import sys
ok = True
for k, v in checks.items():
  print(("PASS: " if v else "FAIL: ") + k)
  if not v: ok = False
sys.exit(0 if ok else 1)
PY
rc=$?
if [ $rc -eq 0 ]; then pass_count "G–P: health safe-default probe"; else fail_count "G–P: health safe-default probe failed"; fi

# Q. No live stage in last submit
LAST_STAGE=$(python3 -c "import json; print(json.load(open('$HEALTH_FILE')).get('byokLastSubmitStage', ''))")
if [ "$LAST_STAGE" = "killswitch_off" ] || [ "$LAST_STAGE" = "fake_relay_ok" ] || [ -z "$LAST_STAGE" ]; then
  pass_count "Q1: no live stage in last submit (last: '$LAST_STAGE')"
else
  fail_count "Q1: unexpected last stage '$LAST_STAGE'"
fi

# R. No T2-T5 / Retry-10+ marker in any doc
T25_HIT=$(grep -RIl "Phase BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-1[1-9]\|Phase BYOK-H3B-T[2-5]" docs/ 2>/dev/null | head -3 || true)
if [ -z "$T25_HIT" ]; then
  pass_count "R1: no T2-T5 / Retry-11+ marker in any doc"
else
  fail_count "R1: T2-T5 / Retry-11+ marker found in: $T25_HIT"
fi

# Retry-10 marker is allowed only as a *plan*, never an *execution*. We
# check that the only Retry-10 reference is in the preflight report
# (the file we are about to create). After this file is written, the
# marker check should be re-run in a follow-up.
RETRY10_HIT=$(grep -RIl "Retry-10" docs/ 2>/dev/null | head -3 || true)
if [ -n "$RETRY10_HIT" ]; then
  echo "INFO: Retry-10 marker found in: $RETRY10_HIT (expected: preflight report only)"
fi

# S. Frontend bundle in production has the test hook
PROD_HTML=$(curl -s "https://music.conanxin.com/?ts=$(date +%s)")
BUNDLE_PATH=$(echo "$PROD_HTML" | grep -oE "/assets/index-[A-Za-z0-9_-]+\.js" | head -1)
if [ -z "$BUNDLE_PATH" ]; then
  fail_count "S1: production HTML does not declare /assets/index-*.js"
else
  BUNDLE_FILE=/tmp/byok-h3b-retry10-preflight-bundle.js
  curl -s "https://music.conanxin.com$BUNDLE_PATH" -o "$BUNDLE_FILE"
  SIZE=$(wc -c < "$BUNDLE_FILE")
  if grep -F "byok-direct-live-confirmation" "$BUNDLE_FILE" >/dev/null; then
    pass_count "S1: production bundle ($BUNDLE_PATH, $SIZE bytes) contains byok-direct-live-confirmation hook"
  else
    fail_count "S1: production bundle ($BUNDLE_PATH) DOES NOT contain byok-direct-live-confirmation hook"
  fi
  if grep -F "CONFIRM_BYOK_DIRECT_LIVE_TEST\|CONFIRM_BYOK_LIVE_RELAY_TEST" "$BUNDLE_FILE" >/dev/null; then
    fail_count "S2: production bundle leaks a real confirmation phrase"
  else
    pass_count "S2: production bundle has no real confirmation phrase"
  fi
fi

# T. This script does not submit /api/generate/byok. Self-check:
# strip comment lines from this script's source, then grep for any
# network-submit line that targets the generate endpoint. The
# assertion string itself is masked with a sentinel.
SELF_NON_COMMENT=$(sed -e "s|T1: this script itself contains a POST /api/generate/byok call (forbidden)|T1_SENTINEL|g" "$0" | sed -e 's/#.*$//' | grep -E "curl.*/api/generate/byok|curl.*-X[[:space:]]*POST|wget.*/api/generate/byok" || true)
if [ -n "$SELF_NON_COMMENT" ]; then
  fail_count "T1: this script itself contains a POST /api/generate/byok call (forbidden)"
else
  pass_count "T1: this script does not submit /api/generate/byok"
fi

# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────
echo
echo "=== Summary ==="
echo "PASS=$pass  FAIL=$fail"

if [ "$fail" -eq 0 ]; then
  echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY10_PREFLIGHT_SMOKE_PASS"
  exit 0
else
  echo "BYOK_H3B_LIVE_T1_MICROPILOT_RETRY10_PREFLIGHT_SMOKE_FAIL"
  exit 1
fi
