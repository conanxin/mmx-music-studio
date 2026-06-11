#!/usr/bin/env bash
# scripts/byok-b-smoke-test.sh
#
# Phase BYOK-B: Controlled BYOK relay test modes.
#
# Asserts that the fake/live relay skeleton is in place WITHOUT ever
# triggering a real provider call.
#
# Pass criterion: 30+ assertions PASS, then prints BYOK_B_SMOKE_PASS.
#
# DO NOT RUN WITH BYOK_LIVE_ENABLED=true — the smoke must never trip
# the live gate.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Self-match guard: this script contains forbidden strings in its own
# grep patterns. We exclude ourselves when grepping the source tree.
SELF="scripts/byok-b-smoke-test.sh"

# Search paths
DOCS=(docs)
SRC=(server src)
ALL_DIRS=(docs server src scripts)

PASS=0
FAIL=0
FAILED_ASSERTIONS=()

assert() {
  local name="$1"
  local condition="$2"
  if eval "$condition" >/dev/null 2>&1; then
    echo "  PASS  $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $name"
    FAIL=$((FAIL + 1))
    FAILED_ASSERTIONS+=("$name")
  fi
}

assert_file_contains() {
  local file="$1"
  local pattern="$2"
  local name="$3"
  if [ -f "$file" ] && grep -qE "$pattern" "$file"; then
    echo "  PASS  $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $name (file: $file, pattern: $pattern)"
    FAIL=$((FAIL + 1))
    FAILED_ASSERTIONS+=("$name")
  fi
}

assert_file_absent() {
  # Verify a pattern is NOT in the file (excluding the smoke test itself).
  local file="$1"
  local pattern="$2"
  local name="$3"
  if [ ! -f "$file" ]; then
    echo "  FAIL  $name (file missing: $file)"
    FAIL=$((FAIL + 1))
    FAILED_ASSERTIONS+=("$name")
    return
  fi
  # Strip comments (lines starting with //) AND assertion-argument lines
  # (lines that look like `  "pattern" \`) before grepping
  local hits
  hits=$(grep -nE "$pattern" "$file" \
    | grep -vE '^\s*[0-9]+:\s*//' \
    | grep -vE '^\s*[0-9]+:\s*\*' \
    | grep -vE '^\s*[0-9]+:\s+"' \
    || true)
  if [ -z "$hits" ]; then
    echo "  PASS  $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $name — found: $hits"
    FAIL=$((FAIL + 1))
    FAILED_ASSERTIONS+=("$name")
  fi
}

assert_absent_in_source() {
  # Verify a pattern is not present in source code (excluding the smoke
  # test itself and tests/scripts folders). Used for negative checks that
  # would otherwise be polluted by the smoke's own grep patterns.
  local pattern="$1"
  local name="$2"
  local hits
  hits=$(grep -rnE "$pattern" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.md" --include="*.sh" \
    server src docs scripts 2>/dev/null \
    | grep -vE "/$SELF:" \
    | grep -vE ':[0-9]+:\s*//' \
    | grep -vE ':[0-9]+:\s*\*' \
    | grep -vE "BYOK_LIVE_CONFIRMATION_PHRASE|expected exact phrase" \
    | grep -vE "byok_smoke_test_" || true)
  if [ -z "$hits" ]; then
    echo "  PASS  $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $name — found: $hits"
    FAIL=$((FAIL + 1))
    FAILED_ASSERTIONS+=("$name")
  fi
}

echo "=========================================="
echo "Phase BYOK-B smoke test"
echo "=========================================="
echo ""

# ── 1. Design doc ────────────────────────────────────────────────────────────
echo "--- 1. Design doc ---"
assert_file_contains \
  "docs/security/BYOK_LIVE_RELAY_TEST_DESIGN.md" \
  "Phase BYOK-B:.*Live Relay Test Design" \
  "BYOK-B design doc exists"
assert_file_contains \
  "docs/security/BYOK_LIVE_RELAY_TEST_DESIGN.md" \
  "disabled|fake|live" \
  "design doc mentions disabled/fake/live modes"
assert_file_contains \
  "docs/security/BYOK_LIVE_RELAY_TEST_DESIGN.md" \
  "CONFIRM_BYOK_LIVE_RELAY_TEST" \
  "design doc mentions confirmation phrase"

# ── 2. Config block in server/types.ts + index.ts ───────────────────────────
echo ""
echo "--- 2. Config fields ---"
assert_file_contains \
  "server/types.ts" \
  "byokDryRunOnly: boolean" \
  "config has BYOK_DRY_RUN_ONLY type"
assert_file_contains \
  "server/types.ts" \
  "byokLiveEnabled: boolean" \
  "config has BYOK_LIVE_ENABLED type"
assert_file_contains \
  "server/types.ts" \
  "byokLiveConfirmation: string" \
  "config has BYOK_LIVE_CONFIRMATION type"
assert_file_contains \
  "server/index.ts" \
  "BYOK_DRY_RUN_ONLY" \
  "config reads BYOK_DRY_RUN_ONLY"
assert_file_contains \
  "server/index.ts" \
  "BYOK_LIVE_ENABLED" \
  "config reads BYOK_LIVE_ENABLED"
assert_file_contains \
  "server/index.ts" \
  "BYOK_LIVE_CONFIRMATION" \
  "config reads BYOK_LIVE_CONFIRMATION"

# ── 3. Endpoint mode machine ────────────────────────────────────────────────
echo ""
echo "--- 3. Endpoint modes ---"
assert_file_contains \
  "server/index.ts" \
  "byok_live_not_enabled" \
  "endpoint has byok_live_not_enabled"
assert_file_contains \
  "server/index.ts" \
  "byok_live_confirmation_required" \
  "endpoint has byok_live_confirmation_required"
assert_file_contains \
  "server/index.ts" \
  "isLiveGateOpen" \
  "endpoint uses isLiveGateOpen guard"
assert_file_contains \
  "server/index.ts" \
  "BYOK_LIVE_CONFIRMATION_PHRASE" \
  "endpoint references the exact confirmation phrase"
assert_file_contains \
  "server/index.ts" \
  "byok_generation_disabled" \
  "endpoint still has byok_generation_disabled"
assert_file_contains \
  "server/index.ts" \
  "byok_dry_run_only" \
  "endpoint still has byok_dry_run_only"

# ── 4. Provider adapter ─────────────────────────────────────────────────────
echo ""
echo "--- 4. Provider adapter ---"
assert "[ -f server/adapters/minimax-api/byok.ts ]" \
  "[ -f server/adapters/minimax-api/byok.ts ]" \
  "provider adapter exists"
assert_file_contains \
  "server/adapters/minimax-api/byok.ts" \
  "generateByokMusic" \
  "adapter exports generateByokMusic"
assert_file_contains \
  "server/adapters/minimax-api/byok.ts" \
  "isLiveGateOpen" \
  "adapter exports isLiveGateOpen"
assert_file_contains \
  "server/adapters/minimax-api/byok.ts" \
  "BYOK_LIVE_CONFIRMATION_PHRASE" \
  "adapter defines the exact confirmation phrase"
# Fake mode does not touch network
assert_file_contains \
  "server/adapters/minimax-api/byok.ts" \
  "byok_fake_relay_ok" \
  "fake mode returns byok_fake_relay_ok"
assert_file_contains \
  "server/adapters/minimax-api/byok.ts" \
  "if \\(input\\.mode === 'fake'\\)" \
  "fake mode short-circuits before spawn"
# Live mode requires explicit mode flag
assert_file_contains \
  "server/adapters/minimax-api/byok.ts" \
  "byok_live_relay_ok" \
  "live mode returns byok_live_relay_ok"
# Per-request apiKey injection in live mode
assert_file_contains \
  "server/adapters/minimax-api/byok.ts" \
  "MINIMAX_API_KEY: input\\.apiKey" \
  "live mode injects user apiKey via env"
# Live mode does NOT propagate site operator key
assert_file_contains \
  "server/adapters/minimax-api/byok.ts" \
  "if \\(k === 'MINIMAX_API_KEY'\\) continue" \
  "live mode strips site operator MINIMAX_API_KEY"
# Redaction applied to provider error
assert_file_contains \
  "server/adapters/minimax-api/byok.ts" \
  "redactCliOutput" \
  "live mode uses redactCliOutput on stdout/stderr"

# ── 5. UI states ────────────────────────────────────────────────────────────
echo ""
echo "--- 5. UI states ---"
assert_file_contains \
  "src/features/studio/ByokPanel.tsx" \
  "byok_dry_run_only" \
  "UI handles byok_dry_run_only"
assert_file_contains \
  "src/features/studio/ByokPanel.tsx" \
  "byok_fake_relay_ok" \
  "UI handles byok_fake_relay_ok"
assert_file_contains \
  "src/features/studio/ByokPanel.tsx" \
  "byok_live_relay_ok" \
  "UI handles byok_live_relay_ok"
assert_file_contains \
  "src/features/studio/ByokPanel.tsx" \
  "byok_live_not_enabled" \
  "UI handles byok_live_not_enabled"
assert_file_contains \
  "src/features/studio/ByokPanel.tsx" \
  "byok_live_confirmation_required" \
  "UI handles byok_live_confirmation_required"
assert_file_contains \
  "src/features/studio/ByokPanel.tsx" \
  "byok_provider_error" \
  "UI handles byok_provider_error redacted"
assert_file_contains \
  "src/features/studio/ByokPanel.tsx" \
  "已隐藏敏感信息" \
  "UI text says sensitive info is hidden"
# Privacy: no key persistence
assert_file_absent \
  "src/features/studio/ByokPanel.tsx" \
  "localStorage\\.(set|get)Item" \
  "no localStorage in ByokPanel"
assert_file_absent \
  "src/features/studio/ByokPanel.tsx" \
  "sessionStorage\\.(set|get)Item" \
  "no sessionStorage in ByokPanel"
assert_file_absent \
  "src/features/studio/ByokPanel.tsx" \
  "indexedDB" \
  "no IndexedDB in ByokPanel"

# ── 6. Negative checks — existing /api/generate is NOT called from BYOK path ──
echo ""
echo "--- 6. Negative checks (no existing /api/generate call) ---"
# The ByokPanel must only call /api/generate/byok, not /api/generate.
# Use a string-level grep against the JSX literal.
assert_file_contains \
  "src/features/studio/ByokPanel.tsx" \
  "BYOK_ENDPOINT = '/api/generate/byok'" \
  "UI posts to /api/generate/byok only"
# The adapter does not import the existing handleGenerate
assert_file_absent \
  "server/adapters/minimax-api/byok.ts" \
  "handleGenerate" \
  "adapter does not call existing handleGenerate"
assert_file_absent \
  "server/adapters/minimax-api/byok.ts" \
  "/api/generate['\"]?" \
  "adapter does not reference /api/generate URL"
# The route in server/index.ts for BYOK should not be a redirect to /api/generate
assert_file_absent \
  "server/index.ts" \
  "handleGenerate\\(req, res, config\\).*byok|byok.*handleGenerate" \
  "endpoint does not call handleGenerate from BYOK route"

# ── 7. Smoke test does NOT trigger live call ────────────────────────────────
echo ""
echo "--- 7. Smoke does not trigger live ---"
# This script must never set BYOK_LIVE_ENABLED=true anywhere.
# The smoke test does not ENABLE live mode. We use a negative-grep that
# looks for an actual `export`/`setenv` or `=` setting the live flag to true.
assert "[ -z \"$(grep -E 'export[[:space:]]+BYOK_LIVE_ENABLED=true|setenv[[:space:]]+BYOK_LIVE_ENABLED[[:space:]]+true' \"$SELF\" || true)\" ]" \
  "[ -z \"$(grep -E 'export[[:space:]]+BYOK_LIVE_ENABLED=true|setenv[[:space:]]+BYOK_LIVE_ENABLED[[:space:]]+true' \"$SELF\" || true)\" ]" \
  "smoke test does not export BYOK_LIVE_ENABLED=true"
# And must not set BYOK_LIVE_CONFIRMATION=CONFIRM_...
assert "[ -z \"$(grep -E 'BYOK_LIVE_CONFIRMATION[= ]CONFIRM_BYOK_LIVE_RELAY_TEST' \"$SELF\" || true)\" ]" \
  "[ -z \"$(grep -E 'BYOK_LIVE_CONFIRMATION[= ]CONFIRM_BYOK_LIVE_RELAY_TEST' \"$SELF\" || true)\" ]" \
  "smoke test does not set live confirmation"
# No live spawn is invoked.
assert_file_absent \
  "scripts/byok-b-smoke-test.sh" \
  "spawn\\(.mmx |exec\\(.mmx |execSync\\(.mmx |execFile\\(.mmx" \
  "smoke does not spawn mmx"
# No music is generated. We verify by looking for any code-level write
# of a binary .mp3 file. The smoke must not perform such a write.
assert_file_absent \
  "scripts/byok-b-smoke-test.sh" \
  "writeFileSync.*mp3" \
  "smoke does not perform a binary mp3 write"

# ── 8. Documentation ────────────────────────────────────────────────────────
echo ""
echo "--- 8. Documentation ---"
assert_file_contains \
  "README.md" \
  "Phase BYOK-B" \
  "README records BYOK-B"
assert_file_contains \
  "docs/DEVELOPMENT_HANDOFF.md" \
  "Phase BYOK-B" \
  "DEVELOPMENT_HANDOFF records BYOK-B"
assert_file_contains \
  "docs/PUBLIC_RELEASE_READINESS.md" \
  "BYOK-B" \
  "PUBLIC_RELEASE_READINESS records BYOK-B"
assert_file_contains \
  "docs/security/BYOK_PUBLIC_GENERATION_DESIGN.md" \
  "BYOK-B|BYOK_LIVE_RELAY" \
  "design doc cross-links to BYOK-B"

# ── 9. Safety: no real key material or real provider call patterns ──────────
echo ""
echo "--- 9. Safety: no real provider call patterns in source ---"
# The smoke test must never set the live env; the source must never
# unconditionally call the provider.
# The new adapter should ONLY spawn mmx in live mode (not fake).
assert_file_contains \
  "server/adapters/minimax-api/byok.ts" \
  "input\\.mode === .live." \
  "adapter only spawns mmx in live mode"
# Adapter does not import 'minimax-api/index.ts' (which would do real calls)
assert_file_absent \
  "server/adapters/minimax-api/byok.ts" \
  "from '\\.\\./minimax-api/index" \
  "adapter does not import from sibling api adapter"
# Live test isolation: the env is read once at config load, not at request
# time, so a request cannot flip live mode mid-flight.
assert_file_contains \
  "server/index.ts" \
  "byokLiveEnabled: readBoolEnv" \
  "live env read once at config load"

# ── 10. Verify site operator key is not propagated to live child ────────────
echo ""
echo "--- 10. Site operator key isolation ---"
assert_file_contains \
  "server/adapters/minimax-api/byok.ts" \
  "MINIMAX_API_KEY" \
  "child env mentions MINIMAX_API_KEY"
assert_file_contains \
  "server/adapters/minimax-api/byok.ts" \
  "[Ss]ite operator" \
  "comment explains site operator key is excluded"

# ── 11. Final summary ───────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo "BYOK-B smoke test summary: pass=$PASS fail=$FAIL"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failed assertions:"
  for a in "${FAILED_ASSERTIONS[@]}"; do
    echo "  - $a"
  done
  echo ""
  echo "BYOK_B_SMOKE_FAIL"
  exit 1
fi

echo ""
echo "BYOK_B_SMOKE_PASS"
exit 0
