#!/usr/bin/env bash
# Phase BYOK-H3B-PROVIDER-SELECTION-FOLLOWUP smoke test.
# Asserts the post-retry-4 follow-up:
#   - byok.ts: explicit isConfirmedByokLiveProviderPath() helper exists
#     with every gate condition (PUBLIC_BYOK, BYOK_DRY_RUN_ONLY,
#     BYOK_LIVE_ENABLED, BYOK_LIVE_CONFIRMATION, BYOK_LIVE_WINDOW_ID,
#     BYOK_DIRECT_LIVE_ENABLED, BYOK_DIRECT_LIVE_CONFIRMATION, user key)
#   - byok.ts: generateByokMusic() now has a confirmed-live branch that
#     delegates to the HTTPS direct adapter (not the CLI live path)
#   - byok.ts: hardcoded "byok_live_provider_path_disabled" still kept
#     as the unconfirmed-live fallback
#   - byok.ts: still references byok_fake_relay_ok for fake mode
#   - server/index.ts: route uses isConfirmedByokLiveProviderPath() to
#     pick the live mode, and forwards the env snapshot to the adapter
#   - fake relay preserved for dry-run / fake / disabled / missing-gate
#   - no operator key fallback
#   - no raw key / token / Authorization logging
#   - docs record retry-4 root cause (live gate passed but adapter
#     returned fake_relay_ok)
#   - docs say no MiniMax call in this phase
set -euo pipefail
IFS=$'\n\t'

REPO="/home/ubuntu/projects/mmx-music-studio"
BYOK_TS="$REPO/server/adapters/minimax-api/byok.ts"
SERVER_TS="$REPO/server/index.ts"
EXEC_DOC="$REPO/docs/launch/BYOK_H3B_EXECUTION_INSTRUCTIONS.md"
RETRY4_DOC="$REPO/docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY4_20260613.md"

PASS=0
FAIL=0
total_assertions=0

assert_grep() {
  local file="$1" pattern="$2" label="$3"
  total_assertions=$((total_assertions + 1))
  if grep -qE "$pattern" "$file"; then
    echo "  PASS  $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $label  (needle: $pattern)"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_grep() {
  local file="$1" pattern="$2" label="$3"
  total_assertions=$((total_assertions + 1))
  if grep -qE "$pattern" "$file"; then
    echo "  FAIL  $label  (forbidden needle found: $pattern)"
    FAIL=$((FAIL + 1))
  else
    echo "  PASS  $label"
    PASS=$((PASS + 1))
  fi
}

echo "==[1/8] byok.ts: confirmed-live helper present=="
assert_grep "$BYOK_TS" "isConfirmedByokLiveProviderPath" "isConfirmedByokLiveProviderPath defined"
assert_grep "$BYOK_TS" "ByokConfirmedLiveProviderEnv" "env type defined"

echo "==[2/8] byok.ts: helper checks every gate condition=="
assert_grep "$BYOK_TS" "env\\.publicByokEnabled !== true" "checks publicByokEnabled"
assert_grep "$BYOK_TS" "env\\.byokDryRunOnly !== false" "checks byokDryRunOnly"
assert_grep "$BYOK_TS" "env\\.byokLiveEnabled !== true" "checks byokLiveEnabled"
assert_grep "$BYOK_TS" "env\\.byokLiveConfirmation !== BYOK_LIVE_CONFIRMATION_PHRASE" "checks byokLiveConfirmation"
assert_grep "$BYOK_TS" "env\\.byokLiveWindowId" "checks byokLiveWindowId"
assert_grep "$BYOK_TS" "env\\.byokDirectLiveEnabled !== true" "checks byokDirectLiveEnabled"
assert_grep "$BYOK_TS" "env\\.byokDirectLiveConfirmation" "checks byokDirectLiveConfirmation"
assert_grep "$BYOK_TS" "userApiKey.*length.*20" "checks user apiKey presence"

echo "==[3/8] byok.ts: generateByokMusic uses helper + delegates to HTTPS=="
assert_grep "$BYOK_TS" "isConfirmedByokLiveProviderPath\\(env, input\\.apiKey\\)" "re-verifies inside adapter"
assert_grep "$BYOK_TS" "generateByokDirectMusic\\(" "delegates to HTTPS direct adapter"
assert_grep "$BYOK_TS" "byok_live_relay_ok" "live success code defined"

echo "==[4/8] byok.ts: hardcoded fail-closed preserved for unconfirmed live=="
assert_grep "$BYOK_TS" "byok_live_provider_path_disabled" "unconfirmed-live still fail-closed"
assert_grep "$BYOK_TS" "byok_fake_relay_ok" "fake relay code still present"

echo "==[5/8] byok.ts: no operator key fallback, no raw key logging=="
assert_not_grep "$BYOK_TS" "process\\.env\\.MINIMAX_API_KEY" "no operator key propagation"
assert_not_grep "$BYOK_TS" "console\\.log.*apiKey" "no apiKey logging"
assert_not_grep "$BYOK_TS" "console\\.log.*Bearer" "no Bearer logging"

echo "==[6/8] server/index.ts: route uses new helper=="
assert_grep "$SERVER_TS" "isConfirmedByokLiveProviderPath" "imported in route"
assert_grep "$SERVER_TS" "liveProviderEnv:" "forwards env snapshot to adapter"
assert_grep "$SERVER_TS" "confirmedLiveProviderPath:" "forwards confirmed flag to adapter"

echo "==[7/8] docs: root cause and no-MiniMax-call recorded=="
assert_grep "$RETRY4_DOC" "fake_relay_ok" "retry-4 doc records fake_relay_ok outcome"
assert_grep "$RETRY4_DOC" "Provider result.*fake_relay_ok" "retry-4 provider result recorded"
assert_grep "$EXEC_DOC" "BYOK-H3B-PROVIDER-SELECTION-FOLLOWUP" "execution doc references the follow-up"
assert_grep "$EXEC_DOC" "No MiniMax call" "execution doc says no MiniMax call in this phase"

echo "==[8/8] no operator key in any staged/server file=="
assert_not_grep "$BYOK_TS" "operator key" "no operator-key mention in byok.ts"
assert_not_grep "$BYOK_TS" "fallback.*operator" "no operator fallback in byok.ts"

echo "=========================================="
echo "PASS=$PASS  FAIL=$FAIL  total=$total_assertions"
echo "=========================================="
if [ "$FAIL" -gt 0 ]; then
  echo "BYOK_H3B_PROVIDER_SELECTION_FOLLOWUP_SMOKE_FAIL"
  exit 1
fi
echo "BYOK_H3B_PROVIDER_SELECTION_FOLLOWUP_SMOKE_PASS"
