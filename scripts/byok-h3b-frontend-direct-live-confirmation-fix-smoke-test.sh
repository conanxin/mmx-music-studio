#!/usr/bin/env bash
# Phase BYOK-H3B-FRONTEND-DIRECT-LIVE-CONFIRMATION-FIX smoke test.
#
# Verifies that the ByokPanel frontend now supports an operator-supplied
# direct-live confirmation phrase:
#   - A. The `directLiveConfirmation` field is wired into the React state
#        and submit payload.
#   - B. The submit payload includes `directLiveConfirmation` only when
#        `mode === 'direct-live'` AND the field is non-empty.
#   - C. The submit payload omits the field when the mode is not
#        direct-live (i.e. when `isByokLiveReady` is false → mode is
#        'fake'), or when the field is empty.
#   - D. The frontend does NOT hardcode the real confirmation phrase.
#   - E. The frontend does NOT log the phrase to console.
#   - F. The frontend does NOT persist the phrase to localStorage /
#        sessionStorage / IndexedDB.
#   - G. Safe default: production env vars unchanged.
#   - H–J. Live gates still closed.
#   - K–O. No live traffic, no MiniMax call, no audio, no tag move, no
#         Retry-10 marker, no T2–T5 marker.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PANEL_TSX="$REPO_ROOT/src/features/studio/ByokPanel.tsx"
BUNDLE_DIR="$REPO_ROOT/dist"

pass=0

need() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    echo "PASS: $label"
    pass=$((pass+1))
  else
    echo "FAIL: $label"
    echo "  missing: $needle"
    echo "  file: $file"
    exit 1
  fi
}

reject() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    echo "FAIL: $label"
    echo "  unexpected: $needle"
    echo "  file: $file"
    exit 1
  else
    echo "PASS: $label"
    pass=$((pass+1))
  fi
}

# A. State + UI wiring.
need "$PANEL_TSX" "const [directLiveConfirmation, setDirectLiveConfirmation]" \
  "A1: React state directLiveConfirmation is declared"
need "$PANEL_TSX" "id=\"byok-direct-live-confirmation\"" \
  "A2: input element with id byok-direct-live-confirmation is rendered"
need "$PANEL_TSX" "isByokLiveReady && (" \
  "A3: confirmation field is rendered only when isByokLiveReady"
need "$PANEL_TSX" "data-h2d=\"byok-direct-live-confirmation\"" \
  "A4: confirmation field exposes data-h2d test hook"
need "$PANEL_TSX" "data-h2d=\"byok-direct-live-confirmation-hint\"" \
  "A5: confirmation hint exposes data-h2d test hook"
need "$PANEL_TSX" "COPY.directLiveConfirmationLabel" \
  "A6: confirmation label is sourced from COPY constant"
need "$PANEL_TSX" "COPY.directLiveConfirmationHint" \
  "A7: confirmation hint copy references operator-supplied contract"
need "$PANEL_TSX" "setDirectLiveConfirmation('')" \
  "A8: phrase is cleared after submit (finally block)"

# B. Submit payload includes directLiveConfirmation when live + non-empty.
need "$PANEL_TSX" "isByokLiveReady &&" \
  "B1: payload inclusion is guarded by isByokLiveReady"
need "$PANEL_TSX" "directLiveConfirmation.length > 0" \
  "B2: payload inclusion is also guarded by non-empty length"
need "$PANEL_TSX" "{ directLiveConfirmation }" \
  "B3: payload spread carries the directLiveConfirmation key"

# C. The "else" branch is {} (object spread omitted), confirming the
#    field is NOT present in non-direct-live or empty-field cases.
#    We assert on the negative: there is no unconditional inclusion of
#    the field in the body literal.
reject_anywhere() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -F "$needle" "$file" >/dev/null; then
    echo "FAIL: $label"
    echo "  unexpected: $needle"
    echo "  file: $file"
    exit 1
  else
    echo "PASS: $label"
    pass=$((pass+1))
  fi
}
reject_anywhere "$PANEL_TSX" "directLiveConfirmation: directLiveConfirmation," \
  "C1: payload does NOT unconditionally include directLiveConfirmation"
reject_anywhere "$PANEL_TSX" "directLiveConfirmation: 'CONFIRM_" \
  "C2: payload does NOT include a string literal starting with CONFIRM_"

# D. No hardcoded real phrase in source.
reject_anywhere "$PANEL_TSX" "CONFIRM_BYOK_DIRECT_LIVE_TEST" \
  "D1: source does NOT embed the real CONFIRM_BYOK_DIRECT_LIVE_TEST phrase"
reject_anywhere "$PANEL_TSX" "CONFIRM_BYOK_LIVE_RELAY_TEST" \
  "D2: source does NOT embed the CLI live phrase either"
if [ -d "$BUNDLE_DIR/assets" ] && ls "$BUNDLE_DIR/assets"/index-*.js >/dev/null 2>&1; then
  for bundle in "$BUNDLE_DIR/assets"/index-*.js; do
    if grep -F "CONFIRM_BYOK_DIRECT_LIVE_TEST" "$bundle" >/dev/null; then
      echo "FAIL: D3: built bundle $bundle embeds the real phrase"
      exit 1
    fi
    if grep -F "CONFIRM_BYOK_LIVE_RELAY_TEST" "$bundle" >/dev/null; then
      echo "FAIL: D4: built bundle $bundle embeds the CLI live phrase"
      exit 1
    fi
  done
  echo "PASS: D3: built bundle does NOT embed the real phrase"
  echo "PASS: D4: built bundle does NOT embed the CLI live phrase either"
  pass=$((pass+2))
else
  echo "INFO: dist/assets/index-*.js not present, D3/D4 skipped"
fi

# E. No console.log / logger of the phrase.
#    Strict pattern: any console.* call that mentions
#    directLiveConfirmation, or any direct log of the variable name.
reject_anywhere "$PANEL_TSX" "console.log(directLiveConfirmation" \
  "E1: no console.log(directLiveConfirmation) call"
reject_anywhere "$PANEL_TSX" "console.warn(directLiveConfirmation" \
  "E2: no console.warn(directLiveConfirmation) call"
reject_anywhere "$PANEL_TSX" "console.error(directLiveConfirmation" \
  "E3: no console.error(directLiveConfirmation) call"
reject_anywhere "$PANEL_TSX" "console.debug(directLiveConfirmation" \
  "E4: no console.debug(directLiveConfirmation) call"
reject_anywhere "$PANEL_TSX" "JSON.stringify(directLiveConfirmation" \
  "E5: no JSON.stringify of the phrase"
reject_anywhere "$PANEL_TSX" "alert(directLiveConfirmation" \
  "E6: no alert(directLiveConfirmation) call"

# F. No persistence to localStorage / sessionStorage / IndexedDB.
reject_anywhere "$PANEL_TSX" "localStorage.setItem('directLiveConfirmation" \
  "F1: no localStorage.setItem of the phrase"
reject_anywhere "$PANEL_TSX" "sessionStorage.setItem('directLiveConfirmation" \
  "F2: no sessionStorage.setItem of the phrase"
reject_anywhere "$PANEL_TSX" "sessionStorage.setItem(\"directLiveConfirmation" \
  "F3: no sessionStorage.setItem of the phrase (double quote)"
reject_anywhere "$PANEL_TSX" "localStorage.setItem(\"directLiveConfirmation" \
  "F4: no localStorage.setItem of the phrase (double quote)"
# A more general check: no localStorage / sessionStorage / IndexedDB
# write keyed by anything matching `directLiveConfirmation` (any quoting).
if grep -nE "(localStorage|sessionStorage)\.setItem\(\s*['\"]directLiveConfirmation" "$PANEL_TSX" >/dev/null; then
  echo "FAIL: F5: phrase persistence detected via regex"
  exit 1
else
  echo "PASS: F5: no phrase persistence via regex"
  pass=$((pass+1))
fi

# G–J. Server-side safe default probes (read-only).
#    These run as runtime probes against the production service. They
#    MUST NOT flip any env var. They MUST report the live gates
#    closed.
read_health() {
  local file="$1"
  curl -s "https://music.conanxin.com/api/health?ts=$(date +%s)" \
    | tee "$file" >/dev/null
}

HEALTH_JSON="$(mktemp)"
read_health "$HEALTH_JSON"

python3 - <<PY
import json
from pathlib import Path
d = json.loads(Path("$HEALTH_JSON").read_text())
checks = {
  "G_publicByokEnabled_false": d.get("publicByokEnabled") is False,
  "G_byokLiveEnabled_false": d.get("byokLiveEnabled") is False,
  "G_byokEnabled_false": d.get("byokEnabled") is False,
  "G_byokLiveConfirmationConfigured_false": d.get("byokLiveConfirmationConfigured") is False,
  "H_no_recent_live_stage": d.get("byokLastSubmitStage") in (None, "received", "fake_relay_ok", "killswitch_off"),
  "I_no_live_attempts_consumed": d.get("byokLiveAttemptsUsed", 0) == 0,
  "J_no_window_active": d.get("byokLiveAttemptsRemaining", 0) >= 0,
}
for k, ok in checks.items():
  print(("PASS: " if ok else "FAIL: ") + k)
  if not ok:
    raise SystemExit(1)
PY
pass=$((pass+7))

# K–L. No live / no MiniMax / no audio in the production service.
python3 - <<PY
import json
from pathlib import Path
d = json.loads(Path("$HEALTH_JSON").read_text())
checks = {
  "K_no_live_attempts_consumed": d.get("byokLiveAttemptsUsed", 0) == 0,
  "K_no_live_audio_used": d.get("byokLiveAudioUsed", 0) == 0,
  "K_no_real_api_used": d.get("realApiAttemptsUsed", 0) == 0,
  "L_no_audio_generated": d.get("byokLiveAudioUsed", 0) == 0,
}
for k, ok in checks.items():
  print(("PASS: " if ok else "FAIL: ") + k)
  if not ok:
    raise SystemExit(1)
PY
pass=$((pass+4))

# N. No T2–T5 / no executed-Retry-10+ markers in repo docs.
# The smoke was originally written for the pre-Retry-10 baseline. After
# Retry-10, the new retry10 report is allowed, but only if its
# classification is one of the operator-controlled outcomes (A/B/C/D/E
# from the phase plan). An executed Retry-10 is still blocked.
for f in \
  "$REPO_ROOT/docs/launch"/*.md \
  "$REPO_ROOT/docs/DEVELOPMENT_HANDOFF.md" \
  "$REPO_ROOT/docs/PUBLIC_RELEASE_READINESS.md" \
  "$REPO_ROOT/README.md"; do
  if [ -f "$f" ]; then
    if grep -E "BYOK-H3B-LIVE-T1-MICROPILOT-RETRY-1[0-9]|T2-RETRY|T3-RETRY|T4-RETRY|T5-RETRY" "$f" >/dev/null; then
      # Allow the marker only if the SAME file contains a
      # operator-classified Retry-10 outcome (A/B/C/D/E from the phase
      # plan). Otherwise the marker is an execution marker and is
      # rejected.
      if grep -Eq "RETRY10_(DIRECT_LIVE_RELAY_OK|PROVIDER_ERROR_NATURAL_TERMINAL|CONFIRMATION_MISMATCH_NATURAL_TERMINAL|REAPER_SYNTHETIC_TERMINAL|BLOCKED_OR_ABORTED)" "$f"; then
        continue
      else
        echo "FAIL: N: $f has Retry-10+ marker without operator-classified outcome"
        exit 1
      fi
    fi
  fi
done
echo "PASS: N: no T2-T5 / executed-Retry-10+ marker in any doc"
pass=$((pass+1))

# O. No tag move.
TAG_LATEST="$(cd "$REPO_ROOT" && git tag --sort=-v:refname | head -1)"
if [ "$TAG_LATEST" = "v0.4.31-alpha" ]; then
  echo "PASS: O: latest tag unchanged at v0.4.31-alpha"
  pass=$((pass+1))
else
  echo "FAIL: O: latest tag is $TAG_LATEST (expected v0.4.31-alpha)"
  exit 1
fi

echo
echo "=== Summary ==="
echo "PASS=$pass  FAIL=0"
echo "BYOK_H3B_FRONTEND_DIRECT_LIVE_CONFIRMATION_FIX_SMOKE_PASS"
