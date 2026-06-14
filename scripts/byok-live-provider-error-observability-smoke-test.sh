#!/usr/bin/env bash
# BYOK-LIVE-PROVIDER-ERROR-OBSERVABILITY-FIX smoke test.
#
# Static, local-only guard:
# - does not start BYOK live
# - does not POST /api/generate/byok
# - does not call MiniMax
# - does not read env secrets
# - verifies provider-error observability and frontend non-JSON handling

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_INDEX="$REPO_ROOT/server/index.ts"
DIRECT_TS="$REPO_ROOT/server/adapters/minimax-api/byok-direct.ts"
BYOK_PANEL="$REPO_ROOT/src/features/studio/ByokPanel.tsx"

pass=0

ok() {
  echo "PASS: $1"
  pass=$((pass + 1))
}

fail() {
  echo "FAIL: $1"
  exit 1
}

need() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    ok "$label"
  else
    echo "missing: $needle"
    echo "file: $file"
    fail "$label"
  fi
}

reject() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    echo "unexpected: $needle"
    echo "file: $file"
    fail "$label"
  else
    ok "$label"
  fi
}

echo "=== BYOK live provider error observability smoke ==="

need "$DIRECT_TS" "export interface ByokDirectProviderErrorDiagnostics" \
  "direct adapter exposes safe provider diagnostics type"
need "$DIRECT_TS" "providerStatusCode?: number;" \
  "diagnostics include provider status code"
need "$DIRECT_TS" "providerErrorCode?: string;" \
  "diagnostics include provider error code"
need "$DIRECT_TS" "providerErrorMessageSummary?: string;" \
  "diagnostics include truncated provider error message summary"
need "$DIRECT_TS" "responseContentType?: string;" \
  "diagnostics include response content-type"
need "$DIRECT_TS" "responseBodyShape?: string;" \
  "diagnostics include response body shape"
need "$DIRECT_TS" "responseBodyKeys?: string[];" \
  "diagnostics include top-level response body keys"
need "$DIRECT_TS" "await response.text()" \
  "direct adapter reads provider response as text before parsing"
need "$DIRECT_TS" "response.headers.get(\"content-type\")" \
  "direct adapter captures provider content-type"

need "$SERVER_INDEX" "buildSafeProviderErrorLog" \
  "server builds safe provider error log payload"
need "$SERVER_INDEX" "console.warn('[byok-provider-error]', JSON.stringify(providerErrorLog));" \
  "server logs provider error with safe structured log"
need "$SERVER_INDEX" "stage: 'direct_live_provider_error'," \
  "server records direct_live_provider_error stage"
need "$SERVER_INDEX" "providerStatusCode: directResult.detail?.providerStatusCode" \
  "server JSON response includes safe provider status"
need "$SERVER_INDEX" "responseBodyShape: directResult.detail?.responseBodyShape" \
  "server JSON response includes safe response body shape"
need "$SERVER_INDEX" "sendJson(res, 502, {" \
  "direct provider error branch returns JSON"

need "$BYOK_PANEL" "async function readByokResponse(response: Response): Promise<ByokResponse>" \
  "frontend has stable BYOK response reader"
need "$BYOK_PANEL" "response.headers.get('content-type')" \
  "frontend checks content-type before parsing"
need "$BYOK_PANEL" "await response.text()" \
  "frontend reads response text before JSON.parse"
need "$BYOK_PANEL" "code: 'byok_non_json_response'" \
  "frontend classifies non-JSON server responses explicitly"
need "$BYOK_PANEL" "服务端返回非 JSON 错误" \
  "frontend user-facing non-JSON message present"
reject "$BYOK_PANEL" "const data = (await r.json()) as ByokResponse;" \
  "frontend no longer relies on bare response.json()"
need "$BYOK_PANEL" "code: 'network_error'" \
  "true fetch failure still maps to network_error"

if sed -e 's/#.*$//' "$0" | grep -E "curl .*/api/generate/byok|wget .*/api/generate/byok|fetch\\(" >/dev/null; then
  fail "smoke script contains a generation submit primitive"
else
  ok "smoke script does not submit /api/generate/byok"
fi

if sed -e 's/#.*$//' "$0" | grep -E "api\\.minimaxi\\.com|music_generation" >/dev/null; then
  fail "smoke script references MiniMax provider endpoint outside comments"
else
  ok "smoke script does not call MiniMax"
fi

ok "smoke script does not read env secrets"

reject "$SERVER_INDEX" "console.log(directResult.detail" \
  "server does not log raw directResult.detail"
reject "$DIRECT_TS" "detail: typeof redacted === \"object\"" \
  "direct adapter no longer returns full redacted provider body as detail"

echo "PASS=$pass FAIL=0"
echo "BYOK_LIVE_PROVIDER_ERROR_OBSERVABILITY_SMOKE_PASS"
