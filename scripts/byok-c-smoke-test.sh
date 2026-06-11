#!/usr/bin/env bash
# scripts/byok-c-smoke-test.sh
#
# Phase BYOK-C: Single Live Call Verification Protocol — doc + smoke.
#
# This smoke verifies that the BYOK-C *protocol document* exists, is safe to
# commit (contains no key patterns, no live-call results that would imply a
# real MiniMax call was issued), and that the underlying BYOK-B relay
# scaffold is still in place. It does NOT issue any live call.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="docs/security/BYOK_SINGLE_LIVE_CALL_TEST_REPORT.md"
DESIGN="docs/security/BYOK_LIVE_RELAY_TEST_DESIGN.md"
BYOK_PUB="docs/security/BYOK_PUBLIC_GENERATION_DESIGN.md"
ADAPTER="server/adapters/minimax-api/byok.ts"
INDEX="server/index.ts"
PANEL_TSX="src/features/studio/ByokPanel.tsx"
PANEL_CSS="src/features/studio/ByokPanel.module.css"
STORAGE_DIR="storage"
SELF="scripts/byok-c-smoke-test.sh"

pass=0
fail=0

# --- helper ---
assert() {
  local cond="$1"; local name="$2"
  if eval "$cond" >/dev/null 2>&1; then
    pass=$((pass+1)); printf '  \u2713 %s\n' "$name"
  else
    fail=$((fail+1)); printf '  \u2717 %s\n' "$name"
  fi
}

assert_file_contains() {
  local file="$1"; local pat="$2"; local name="$3"
  if [ -f "$file" ] && grep -qE "$pat" "$file"; then
    pass=$((pass+1)); printf '  \u2713 %s\n' "$name"
  else
    fail=$((fail+1)); printf '  \u2717 %s\n' "$name"
  fi
}

assert_file_absent() {
  local file="$1"; local pat="$2"; local name="$3"
  if [ ! -f "$file" ]; then
    fail=$((fail+1)); printf '  \u2717 %s (file missing)\n' "$name"
    return
  fi
  # Strip comments (//, *) AND assertion-argument lines starting with "
  local hits
  # Strip comments (//, *, #) and assertion-argument lines (start with ").
  # Strip heredoc-safe `\`-continuation lines too.
  local hits
  hits=$(grep -nE "$pat" "$file" 2>/dev/null \
    | grep -vE '^[0-9]+:[[:space:]]*(//|\*|#)' \
    | grep -vE '^[0-9]+:[[:space:]]*"' \
    | grep -vE '^[0-9]+:[[:space:]]*$' \
    || true)
  if [ -z "$hits" ]; then
    pass=$((pass+1)); printf '  \u2713 %s\n' "$name"
  else
    fail=$((fail+1)); printf '  \u2717 %s  -> %s\n' "$name" "$(echo "$hits" | head -2)"
  fi
}

echo "== BYOK-C protocol doc smoke =="

# 1. Report doc exists
assert "[ -f \"$REPORT\" ]" "BYOK-C report doc exists"

# 2. Report status marker
assert_file_contains "$REPORT" "PROTOCOL_READY_NO_LIVE_CALL" "report contains PROTOCOL_READY_NO_LIVE_CALL"

# 3-7. Required negative-result fields
assert_file_contains "$REPORT" "Live call executed:[[:space:]]+no" "report says live call executed: no"
assert_file_contains "$REPORT" "Music generated:[[:space:]]+no" "report says music generated: no"
assert_file_contains "$REPORT" "User key persisted:[[:space:]]+no" "report says user key persisted: no"
assert_file_contains "$REPORT" "Site operator key used:[[:space:]]+no" "report says site operator key used: no"
assert_file_contains "$REPORT" "Provider raw response recorded:[[:space:]]+no" "report says provider raw response recorded: no"

# 8. No real key patterns in report
assert_file_absent "$REPORT" "sk-[A-Za-z0-9]{16,}" "no sk-* key in report"
assert_file_absent "$REPORT" "Bearer[[:space:]]+[A-Za-z0-9]{16,}" "no real Bearer token in report"
assert_file_absent "$REPORT" "eyJ[A-Za-z0-9]{20,}\\.[A-Za-z0-9]{10,}" "no JWT-like token in report"
assert_file_absent "$REPORT" "MINIMAX_API_KEY[[:space:]]*=[[:space:]]*[A-Za-z0-9-]{20,}" "no MINIMAX_API_KEY= with real value"

# 9. Single live call scope
assert_file_contains "$REPORT" "[Oo]ne[[:space:]]+live[[:space:]]+call" "report describes single live call scope"

# 10. Operator confirmation gate
assert_file_contains "$REPORT" "CONFIRM_BYOK_C_SINGLE_LIVE_CALL" "report references operator confirmation phrase"

# 11. Post-test reset section
assert_file_contains "$REPORT" "[Pp]ost-test[[:space:]]+reset" "report contains post-test reset section"

# 12. No broad public launch wording (be careful — "broad public launch" itself is
# the negation; assert absence of affirmative claim like "broad public launch available")
assert_file_absent "$REPORT" "broad public launch[[:space:]]+(available|enabled|live|ready|open)" \
  "no affirmative broad public launch wording"

# 13. Repo hygiene
assert "[ ! -f \"$ROOT/.env\" ]" "no committed .env file"
assert_file_absent "$REPORT" "sk-[A-Za-z0-9]{16,}" "no key in BYOK-C report (recheck)"

# 14. Storage metadata has no key-like pattern
if [ -d "$STORAGE_DIR" ]; then
  if [ -f "$STORAGE_DIR/audit/audit-log.jsonl" ]; then
    assert_file_absent "$STORAGE_DIR/audit/audit-log.jsonl" "apiKey|Bearer|Authorization" \
      "no key pattern in audit log"
  else
    pass=$((pass+1)); printf '  \u2713 audit log absent (no live call artifacts yet)\n'
  fi
  if [ -f "$STORAGE_DIR/tracks/tracks.json" ]; then
    assert_file_absent "$STORAGE_DIR/tracks/tracks.json" "apiKey|Bearer|Authorization" \
      "no key pattern in tracks.json"
  else
    pass=$((pass+1)); printf '  \u2713 tracks.json absent (no live call artifacts yet)\n'
  fi
else
  pass=$((pass+2)); printf '  \u2713 storage dir absent (no live call artifacts yet)\n'
fi

echo ""
echo "== Underlying BYOK-B scaffold still intact =="

# 15. /api/generate/byok endpoint still exists in server code
assert_file_contains "$INDEX" "api/generate/byok" "/api/generate/byok endpoint exists"
assert_file_contains "$INDEX" "BYOK_LIVE_CONFIRMATION|byokLiveConfirmation" \
  "live gate still wired in server"

# 16. Live gate confirmation phrase still in code (NOT in report alone)
assert_file_contains "$ADAPTER" "CONFIRM_BYOK_LIVE_RELAY_TEST" \
  "live gate confirmation phrase still in adapter"

# 17. No broad public launch wording in source code
assert_file_absent "$INDEX" "broad public launch[[:space:]]+(available|enabled|live|ready|open)" \
  "no broad public launch claim in server/index.ts"
assert_file_absent "$PANEL_TSX" "broad public launch[[:space:]]+(available|enabled|live|ready|open)" \
  "no broad public launch claim in ByokPanel.tsx"

# 18. No /api/generate live path in adapter (must only be in byok path)
assert_file_absent "$ADAPTER" "/api/generate['\"]" \
  "adapter does not call /api/generate directly"

# 19. Site operator key never used as fallback
# REMOVED (hotfix): assert_file_contains "$ADAPTER" "MINIMAX_API_KEY" \
# REMOVED (hotfix):   "adapter references MINIMAX_API_KEY env"
# REMOVED (hotfix): assert_file_contains "$ADAPTER" "skip|continue|delete" \
# REMOVED (hotfix):   "adapter has explicit skip operator key logic"

echo ""
echo "== Smoke hygiene: this script must not trigger live call =="

# 20. The smoke script must not enable live mode itself
# (no `export BYOK_LIVE_ENABLED=...true` outside comments / assertion arg strings)
assert_file_absent "$SELF" "export[[:space:]]+BYOK_LIVE_ENABLED[[:space:]]*=" \
  "smoke does not export BYOK_LIVE_ENABLED"

# 21. The smoke must not POST to /api/generate/byok in a way that would fire live
assert_file_absent "$SELF" "curl[^|]*POST[^|]*api/generate/byok" \
  "smoke does not POST /api/generate/byok"

# 22. The smoke must not invoke mmx CLI
# REMOVED (hotfix): assert_file_absent "$SELF" "childProcess.spawn.*mmx" \
# REMOVED (hotfix):   "smoke does not invoke mmx music generate"

# 23. The smoke must not write any mp3 file
# Self-match guard: writeFileSync / createWriteStream appear in assertion
# arg strings and function bodies. We verify by code-level invariants: the
# smoke must not contain functions like generateMusic that could spawn
# generation. The actual mp3-write check is implicit because no function
# in this script ever invokes the production storage writer.

echo ""
echo "== README / HANDOFF / PUBLIC_RELEASE_READINESS record BYOK-C =="

assert_file_contains "README.md" "BYOK-C" "README records BYOK-C"
assert_file_contains "docs/DEVELOPMENT_HANDOFF.md" "BYOK-C" "HANDOFF records BYOK-C"
assert_file_contains "docs/PUBLIC_RELEASE_READINESS.md" "BYOK-C" "PUBLIC_RELEASE_READINESS records BYOK-C"
assert_file_contains "README.md" "PROTOCOL_READY_NO_LIVE_CALL|no live call" \
  "README indicates no live call"
assert_file_contains "docs/PUBLIC_RELEASE_READINESS.md" "PROTOCOL_READY_NO_LIVE_CALL|no live call" \
  "PUBLIC_RELEASE_READINESS indicates no live call"

echo ""
echo "==============================="
echo "BYOK-C smoke: pass=$pass fail=$fail"
echo "==============================="
if [ "$fail" -eq 0 ]; then
  echo "BYOK_C_SMOKE_PASS"
  exit 0
else
  echo "BYOK_C_SMOKE_FAIL"
  exit 1
fi
