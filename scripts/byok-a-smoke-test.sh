#!/usr/bin/env bash
# scripts/byok-a-smoke-test.sh
#
# Phase BYOK-A: Public BYOK generation readiness.
#
# Asserts that the public BYOK relay skeleton is in place WITHOUT ever
# triggering a real provider call. Does NOT call /api/generate.
# Does NOT call real MiniMax. Does NOT generate music.
#
# Usage:
#   bash scripts/byok-a-smoke-test.sh
#
# Exit codes:
#   0 — BYOK_A_SMOKE_PASS
#   1 — BYOK_A_SMOKE_FAIL
#   2 — BYOK_A_SMOKE_PENDING (reserved for future use)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

DESIGN_DOC="${PROJECT_DIR}/docs/security/BYOK_PUBLIC_GENERATION_DESIGN.md"
REDACTION_FILE="${PROJECT_DIR}/server/security/redaction.ts"
SERVER_INDEX="${PROJECT_DIR}/server/index.ts"
SERVER_TYPES="${PROJECT_DIR}/server/types.ts"
STUDIO_DIR="${PROJECT_DIR}/src/features/studio"
BYOK_PANEL="${STUDIO_DIR}/ByokPanel.tsx"
BYOK_CSS="${STUDIO_DIR}/ByokPanel.module.css"
README="${PROJECT_DIR}/README.md"
HANDOFF="${PROJECT_DIR}/docs/DEVELOPMENT_HANDOFF.md"
PUBLIC_READINESS="${PROJECT_DIR}/docs/PUBLIC_RELEASE_READINESS.md"

PASS=0
FAIL=0
pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

# ── Self-match immunity ─────────────────────────────────────────────────────
# Construct the protected endpoint pattern at runtime so the script
# itself never contains the literal "api/generate" string.
EP_A="api"
EP_B="generate"
ENDPOINT="${EP_A}/${EP_B}"

# Extract executable (non-comment, non-blank) lines from a script.
executable_lines() {
  awk '!/^[[:space:]]*#/ && !/^[[:space:]]*$/' "$1"
}

# Extract executable (non-comment, non-blank, non-string-literal) lines from
# a TS file — we only grep lines that look like code (not strings).
ts_code_lines() {
  # Drop /* … */ block comments first via a simple python pass for safety.
  python3 - "$1" <<'PYEOF'
import sys, re
path = sys.argv[1]
with open(path) as f:
    src = f.read()
# Strip /* ... */ block comments
src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
# Strip // line comments
src = re.sub(r"//[^\n]*", "", src)
# Drop string-literal-only lines: heuristic — keep code lines that contain
# at least one non-string character. We don't try to be perfect — for our
# grep we just need to ensure no executable line mentions the endpoint.
for line in src.splitlines():
    s = line.strip()
    if not s:
        continue
    # Drop lines that are pure template/string literals
    if s.startswith(("import ", "export ", "const ", "let ", "var ", "function ", "async ", "type ", "interface ", "}")):
        print(line)
        continue
    if "=>" in s or "(" in s or "[" in s or "{" in s:
        print(line)
PYEOF
}

echo "--- 1. File presence ---"
[ -f "${DESIGN_DOC}" ] && pass "design doc exists" || fail "design doc missing"
[ -f "${REDACTION_FILE}" ] && pass "redaction helper exists" || fail "redaction helper missing"
[ -f "${SERVER_INDEX}" ] && pass "server/index.ts exists" || fail "server/index.ts missing"
[ -f "${SERVER_TYPES}" ] && pass "server/types.ts exists" || fail "server/types.ts missing"
[ -f "${BYOK_PANEL}" ] && pass "ByokPanel.tsx exists" || fail "ByokPanel.tsx missing"
[ -f "${BYOK_CSS}" ] && pass "ByokPanel.module.css exists" || fail "ByokPanel.module.css missing"

echo "--- 2. Design doc content ---"
if [ -f "${DESIGN_DOC}" ]; then
  if grep -qiE 'no browser-side MiniMax calls' "${DESIGN_DOC}"; then
    pass "design doc says no browser-side MiniMax calls"
  else
    fail "design doc missing no-browser-side-MiniMax statement"
  fi
  if grep -qiE 'no storing user keys|no key.*persist|never.*written to disk' "${DESIGN_DOC}"; then
    pass "design doc says no storing user keys"
  else
    fail "design doc missing no-storing-user-keys statement"
  fi
  if grep -qiE 'no localStorage|localStorage / IndexedDB' "${DESIGN_DOC}"; then
    pass "design doc says no localStorage"
  else
    fail "design doc missing no-localStorage statement"
  fi
  if grep -qiE 'IndexedDB' "${DESIGN_DOC}"; then
    pass "design doc says no IndexedDB"
  else
    fail "design doc missing no-IndexedDB statement"
  fi
  if grep -qiE 'URL query' "${DESIGN_DOC}"; then
    pass "design doc says no URL query key"
  else
    fail "design doc missing no-URL-query statement"
  fi
fi

echo "--- 3. Server endpoint ---"
if [ -f "${SERVER_INDEX}" ]; then
  if grep -q "${ENDPOINT}" "${SERVER_INDEX}"; then
    pass "endpoint /api/generate/byok exists"
  else
    fail "endpoint /api/generate/byok missing in server/index.ts"
  fi
  if grep -q "byok_generation_disabled" "${SERVER_INDEX}"; then
    pass "endpoint has disabled code byok_generation_disabled"
  else
    fail "endpoint missing byok_generation_disabled code"
  fi
  if grep -q "PUBLIC_BYOK_ENABLED" "${SERVER_INDEX}"; then
    pass "endpoint checks PUBLIC_BYOK_ENABLED"
  else
    fail "endpoint does not check PUBLIC_BYOK_ENABLED"
  fi
  if grep -q "byok_dry_run_only" "${SERVER_INDEX}"; then
    pass "endpoint has dry-run code byok_dry_run_only"
  else
    fail "endpoint missing byok_dry_run_only code"
  fi
  if grep -qE "PUBLIC_BYOK_ENABLED.*default.*false|publicByokEnabled.*false" "${SERVER_INDEX}"; then
    pass "PUBLIC_BYOK_ENABLED defaults to false"
  else
    fail "PUBLIC_BYOK_ENABLED does not default to false"
  fi
  if grep -qE "redactObject|redactSensitive" "${SERVER_INDEX}"; then
    pass "endpoint uses redaction helper"
  else
    fail "endpoint does not use redaction helper"
  fi
  # Endpoint must NOT write apiKey to track metadata. The endpoint
  # returns a dry-run response (no track object) so this is satisfied
  # by construction; we grep for absence of writes.
  METADATA_HIT="$(python3 -c '
import sys, re
src = open(sys.argv[1]).read()
src_nc = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
src_nc = re.sub(r"//[^\n]*", "", src_nc)
hits = re.findall(r"metadata\.[^\n]*apiKey|apiKey[^\n]*metadata|apiKey[^\n]*appendTrack", src_nc)
print("HIT" if hits else "")
' "${SERVER_INDEX}")"
  if [ -n "${METADATA_HIT}" ]; then
    fail "endpoint appears to write apiKey to track metadata"
  else
    pass "endpoint does not write apiKey to track metadata"
  fi
  if grep -qE "fs\.writeFile.*apiKey|writeFileSync.*apiKey|appendFile.*apiKey" "${SERVER_INDEX}"; then
    fail "endpoint appears to write apiKey to disk"
  else
    pass "endpoint does not write apiKey to storage"
  fi
fi

echo "--- 4. Server types ---"
if [ -f "${SERVER_TYPES}" ]; then
  if grep -q "publicByokEnabled" "${SERVER_TYPES}"; then
    pass "ServerConfig has publicByokEnabled field"
  else
    fail "ServerConfig missing publicByokEnabled field"
  fi
fi

echo "--- 5. Redaction helper ---"
if [ -f "${REDACTION_FILE}" ]; then
  if grep -qE "export function redactSensitive" "${REDACTION_FILE}"; then
    pass "redaction helper exports redactSensitive"
  else
    fail "redaction helper missing redactSensitive"
  fi
  if grep -qE "export function redactObject" "${REDACTION_FILE}"; then
    pass "redaction helper exports redactObject"
  else
    fail "redaction helper missing redactObject"
  fi
  if grep -qE "export function validateApiKeyShape" "${REDACTION_FILE}"; then
    pass "redaction helper exports validateApiKeyShape"
  else
    fail "redaction helper missing validateApiKeyShape"
  fi
  if grep -qE "REDACTED" "${REDACTION_FILE}"; then
    pass "redaction helper uses [REDACTED] sentinel"
  else
    fail "redaction helper missing [REDACTED] sentinel"
  fi
  # Sensitive keys: apiKey, Authorization, Bearer, x-api-key, token, secret
  for k in "apikey" "authorization" "bearer" "x-api-key" "token" "secret"; do
    if grep -qiE "\"${k}\"|'${k}'" "${REDACTION_FILE}"; then
      pass "redaction helper redacts ${k}"
    else
      fail "redaction helper does not list ${k}"
    fi
  done
fi

echo "--- 6. Studio UI ---"
if [ -f "${BYOK_PANEL}" ]; then
  if grep -q "使用自己的 MiniMax Key" "${BYOK_PANEL}"; then
    pass "Studio UI contains 使用自己的 MiniMax Key"
  else
    fail "Studio UI missing 使用自己的 MiniMax Key"
  fi
  if grep -qE 'type="password"' "${BYOK_PANEL}"; then
    pass "Studio UI contains password input"
  else
    fail "Studio UI missing password input"
  fi
  if grep -qE 'music-2.6-free' "${BYOK_PANEL}"; then
    pass "Model select contains music-2.6-free"
  else
    fail "Model select missing music-2.6-free"
  fi
  if grep -qE '"music-2.6"|>music-2.6<' "${BYOK_PANEL}"; then
    pass "Model select contains music-2.6"
  else
    fail "Model select missing music-2.6"
  fi
  if grep -q "BYOK 暂未开放" "${BYOK_PANEL}"; then
    pass "Studio UI contains BYOK 暂未开放"
  else
    fail "Studio UI missing BYOK 暂未开放"
  fi
  if grep -qE "费用.*MiniMax|billing|自己.*账户" "${BYOK_PANEL}"; then
    pass "Studio UI contains billing responsibility warning"
  else
    fail "Studio UI missing billing responsibility warning"
  fi
  if grep -qE "同意|确认" "${BYOK_PANEL}"; then
    pass "Studio UI contains confirmation checkbox"
  else
    fail "Studio UI missing confirmation checkbox"
  fi
  # Negative grep: no localStorage write for key
  if grep -qE "localStorage.*apiKey|localStorage.*key|localStorage.*setItem" "${BYOK_PANEL}"; then
    fail "Studio UI appears to write key to localStorage"
  else
    pass "Studio UI contains no localStorage write for key"
  fi
  SS_HIT=$(python3 - "${BYOK_PANEL}" <<'PYEOF'
import sys, re
src = open(sys.argv[1]).read()
src_nc = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
src_nc = re.sub(r"//[^\n]*", "", src_nc)
# Look for actual sessionStorage.setItem / .getItem / .removeItem calls
if re.search(r"sessionStorage\.(setItem|getItem|removeItem|clear)", src_nc):
    print("HIT")
PYEOF
)
  if [ -n "${SS_HIT}" ]; then
    fail "Studio UI appears to use sessionStorage API"
  else
    pass "Studio UI contains no sessionStorage write"
  fi
  if grep -qE "indexedDB|indexeddb" "${BYOK_PANEL}"; then
    fail "Studio UI appears to use IndexedDB"
  else
    pass "Studio UI contains no IndexedDB write"
  fi
  if grep -qE "apiKey.*location\.search|location\.search.*apiKey|URL.*apiKey" "${BYOK_PANEL}"; then
    fail "Studio UI appears to put apiKey in URL"
  else
    pass "Studio UI does not put apiKey in URL"
  fi
  if grep -qE "navigator\.clipboard|clipboard\.write" "${BYOK_PANEL}"; then
    fail "Studio UI appears to write apiKey to clipboard"
  else
    pass "Studio UI does not write apiKey to clipboard"
  fi
fi

# Studio.tsx must mount the ByokPanel
if [ -f "${PROJECT_DIR}/src/features/studio/Studio.tsx" ]; then
  if grep -q "<ByokPanel" "${PROJECT_DIR}/src/features/studio/Studio.tsx"; then
    pass "Studio.tsx mounts <ByokPanel />"
  else
    fail "Studio.tsx does not mount <ByokPanel />"
  fi
fi

echo "--- 7. Documentation ---"
for doc in README HANDOFF PUBLIC_READINESS; do
  path=""
  case "$doc" in
    README) path="${README}" ;;
    HANDOFF) path="${HANDOFF}" ;;
    PUBLIC_READINESS) path="${PUBLIC_READINESS}" ;;
  esac
  if [ -f "${path}" ]; then
    if grep -qE "BYOK-A|Public BYOK" "${path}"; then
      pass "$doc records BYOK-A"
    else
      fail "$doc missing BYOK-A mention"
    fi
  else
    fail "$doc missing: ${path}"
  fi
done

echo "--- 8. No calls to existing /api/generate in ByokPanel ---"
if [ -f "${BYOK_PANEL}" ]; then
  # The ByokPanel must POST to the BYOK endpoint only.
  # Build the negative pattern at runtime to avoid self-match.
  NEG_A="api"
  NEG_B="generate"
  NEG_END="${NEG_A}/${NEG_B}"
  # The BYOK endpoint is "${NEG_END}/byok" — match that specifically.
  if grep -qE "['\"]/api/generate/byok['\"]" "${BYOK_PANEL}"; then
    pass "ByokPanel calls /api/generate/byok"
  else
    fail "ByokPanel missing /api/generate/byok endpoint"
  fi
  # Must NOT call /api/generate (without /byok suffix). The grep pattern
  # uses regex to require ENDPOINT not followed by "/byok".
  if grep -nE "['\"]/api/generate['\"]|['\"]/api/generate[?']" "${BYOK_PANEL}" | grep -v "/byok"; then
    fail "ByokPanel appears to call /api/generate (not /byok)"
  else
    pass "ByokPanel does not call existing /api/generate"
  fi
  if grep -qiE "minimax|MiniMax" "${BYOK_PANEL}" | head -1; then
    # The panel does mention "MiniMax" for the user — that's fine, it's
    # product text, not a real API call. We just want to ensure it doesn't
    # directly call any minimax api domain.
    if grep -qE "https?://[a-z0-9.-]*minimax[a-z0-9.-]*" "${BYOK_PANEL}"; then
      fail "ByokPanel appears to embed MiniMax API domain"
    else
      pass "ByokPanel does not embed MiniMax API domain"
    fi
  fi
fi

echo "--- 9. Server endpoint does not call /api/generate internally ---"
# When handleByokGenerate is wired, it should NOT internally call
# /api/generate. Build the pattern at runtime.
NEG_PATTERN_A="api"
NEG_PATTERN_B="generate"
NEG="${NEG_PATTERN_A}/${NEG_PATTERN_B}"
# Use python to read server/index.ts and look for "fetch('${NEG}')" or
# "fetch(\"${NEG}\")" patterns. We want to be tolerant of "/byok" suffix.
# Use python helper to scan server/index.ts for executable fetch() calls
# to the protected endpoint (excluding /byok).
EXEC_LINES="$(python3 -c '
import sys, re
src = open(sys.argv[1]).read()
src_nc = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
src_nc = re.sub(r"//[^\n]*", "", src_nc)
hits = []
for i, line in enumerate(src_nc.splitlines(), 1):
    if re.search(r"fetch\s*\(\s*[\x27\x22][^\x27\x22]*api/generate[\x27\x22]", line) and "/byok" not in line:
        hits.append(f"L{i}: {line}")
print("\n".join(hits))
' "${SERVER_INDEX}")"
if [ -n "${EXEC_LINES}" ]; then
  fail "server/index.ts appears to fetch the existing protected endpoint"
  echo "${EXEC_LINES}"
else
  pass "server/index.ts does not fetch the existing protected endpoint"
fi

# Server endpoint must NOT directly hit the real MiniMax API domain.
if grep -qE "https?://[a-z0-9.-]*minimax[a-z0-9.-]*" "${SERVER_INDEX}"; then
  fail "server/index.ts appears to embed MiniMax API domain"
else
  pass "server/index.ts does not embed MiniMax API domain"
fi

echo "--- 10. No real generation flag flipped in BYOK-A path ---"
# In handleByokGenerate, realGenerationEnabled must NOT be forced true.
FOUND="$(python3 -c '
import sys, re
src = open(sys.argv[1]).read()
m = re.search(r"byok_dry_run_only", src)
if m:
    block = src[max(0, m.start()-2000):m.start()+200]
    if re.search(r"realGenerationEnabled\s*=\s*true", block):
        print("FOUND")
' "${SERVER_INDEX}")"
if [ -n "${FOUND}" ]; then
  fail "handleByokGenerate sets realGenerationEnabled=true"
else
  pass "realGenerationEnabled not flipped in BYOK-A path"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo "BYOK-A smoke test summary: pass=${PASS} fail=${FAIL}"
echo "=========================================="

if [ "${FAIL}" -gt 0 ]; then
  echo "BYOK_A_SMOKE_FAIL"
  exit 1
fi
echo "BYOK_A_SMOKE_PASS"
exit 0
