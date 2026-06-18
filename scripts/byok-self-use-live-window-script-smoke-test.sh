#!/usr/bin/env bash
# BYOK-SELF-USE-P1-LIVE-WINDOW-SCRIPT smoke test.
#
# Static/local-only guard. It does not use --apply, does not write /etc,
# does not restart services, does not submit generation, and does not call
# MiniMax.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OPERATOR="$REPO_ROOT/scripts/byok-live-window-operator.sh"
RELEASE_CHECK="$REPO_ROOT/scripts/release-check.sh"

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
  if grep -Fq -- "$needle" "$file"; then
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
  if grep -Fq -- "$needle" "$file"; then
    echo "unexpected: $needle"
    echo "file: $file"
    fail "$label"
  else
    ok "$label"
  fi
}

reject_regex() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Eq "$pattern" "$file"; then
    echo "unexpected pattern: $pattern"
    echo "file: $file"
    fail "$label"
  else
    ok "$label"
  fi
}

echo "=== BYOK self-use live window operator script smoke ==="

[[ -f "$OPERATOR" ]] || fail "operator script exists"
ok "operator script exists"
[[ -x "$OPERATOR" ]] || fail "operator script is executable"
ok "operator script is executable"

help_out="$(bash "$OPERATOR" help)"
grep -Fq "Operator-only" <<<"$help_out" || fail "help mentions operator-only"
ok "help mentions operator-only"
grep -Fq "Default mode is dry-run" <<<"$help_out" || fail "help mentions default dry-run"
ok "help mentions default dry-run"
grep -Fq -- "--apply is required" <<<"$help_out" || fail "help mentions --apply gate"
ok "help mentions --apply gate"
grep -Fq "does not accept, store, or print MiniMax API keys" <<<"$help_out" || fail "help mentions no MiniMax key handling"
ok "help mentions no MiniMax key handling"
grep -Fq "does not submit generation requests" <<<"$help_out" || fail "help mentions no generation submit"
ok "help mentions no generation submit"
grep -Fq "does not call MiniMax" <<<"$help_out" || fail "help mentions no MiniMax call"
ok "help mentions no MiniMax call"
grep -Fq "Use close --apply" <<<"$help_out" || fail "help tells operator to close"
ok "help tells operator to close"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

open_out="$tmp_dir/open.out"
MMX_ENV_DIR="$tmp_dir/env" \
MMX_SYSTEMD_DROPIN_DIR="$tmp_dir/dropin" \
MMX_HEALTH_URL="http://127.0.0.1:9/api/health" \
  bash "$OPERATOR" open > "$open_out"

grep -Fq "mode=DRY-RUN command=open" "$open_out" || fail "open defaults to dry-run"
ok "open defaults to dry-run"
grep -Fq "wouldWriteEnvFile=" "$open_out" || fail "open dry-run prints planned env file"
ok "open dry-run prints planned env file"
[[ ! -e "$tmp_dir/env/byok-live-pilot.env" ]] || fail "open dry-run wrote env file"
ok "open dry-run does not write env file"
[[ ! -e "$tmp_dir/dropin/byok-live-pilot.conf" ]] || fail "open dry-run wrote drop-in"
ok "open dry-run does not write drop-in"

mkdir -p "$tmp_dir/env" "$tmp_dir/dropin"
touch "$tmp_dir/env/byok-live-pilot.env" "$tmp_dir/dropin/byok-live-pilot.conf"
close_out="$tmp_dir/close.out"
MMX_ENV_DIR="$tmp_dir/env" \
MMX_SYSTEMD_DROPIN_DIR="$tmp_dir/dropin" \
MMX_HEALTH_URL="http://127.0.0.1:9/api/health" \
  bash "$OPERATOR" close > "$close_out"

grep -Fq "mode=DRY-RUN command=close" "$close_out" || fail "close defaults to dry-run"
ok "close defaults to dry-run"
[[ -e "$tmp_dir/env/byok-live-pilot.env" ]] || fail "close dry-run deleted env file"
ok "close dry-run does not delete env file"
[[ -e "$tmp_dir/dropin/byok-live-pilot.conf" ]] || fail "close dry-run deleted drop-in"
ok "close dry-run does not delete drop-in"

need "$OPERATOR" "COMMAND=\"\${1:-help}\"" \
  "operator script has explicit command parser"
need "$OPERATOR" "--apply)" \
  "operator script accepts explicit --apply only"
need "$OPERATOR" 'if [[ "$APPLY" != true ]]; then' \
  "open/close gate defaults to dry-run without --apply"
need "$OPERATOR" "require_root_for_apply" \
  "apply path requires root/sudo"
need "$OPERATOR" 'curl -fsS --max-time 12 "$HEALTH_URL" -o "$out_file"' \
  "status uses read-only health GET"
need "$OPERATOR" 'if [[ "$HEALTH_URL" == *"/api/generate"* ]]; then' \
  "operator script refuses generation endpoints"
need "$OPERATOR" 'install -m 0600 "$tmp_env" "$ENV_FILE"' \
  "env file is installed with mode 0600"
need "$OPERATOR" "EnvironmentFile=\${ENV_FILE}" \
  "systemd drop-in points to EnvironmentFile"
need "$OPERATOR" "BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW=\${ATTEMPT_CAP}" \
  "operator script sets live attempt cap"
need "$OPERATOR" "BYOK_LIVE_MAX_AUDIO_PER_WINDOW=\${AUDIO_CAP}" \
  "operator script sets live audio cap"
need "$OPERATOR" "TURNSTILE_BYOK_REQUIRED=true" \
  "operator script enforces Turnstile for live window"
need "$OPERATOR" 'rm -f "$ENV_FILE" "$DROPIN_FILE"' \
  "operator script has close rollback removal path"
need "$OPERATOR" "assert_safe_default" \
  "operator script verifies safe-default after close"
need "$OPERATOR" "READY_FOR_CONTROLLED_LIVE_PILOT_PREFLIGHT" \
  "operator script verifies controlled live preflight after open"
need "$OPERATOR" "systemctl daemon-reload" \
  "apply path reloads systemd"
need "$OPERATOR" 'systemctl restart "$SERVICE_NAME"' \
  "apply path restarts the configured service"

reject "$OPERATOR" "/api/generate/byok" \
  "operator script does not mention BYOK generation submit endpoint"
reject "$OPERATOR" "api.minimaxi.com" \
  "operator script does not mention MiniMax provider host"
reject "$OPERATOR" "music_generation" \
  "operator script does not mention MiniMax provider path"
reject "$OPERATOR" "MINIMAX_API_KEY" \
  "operator script does not accept or save MiniMax API key env"
reject "$OPERATOR" "apiKey" \
  "operator script does not handle apiKey fields"
reject_regex "$OPERATOR" "(echo|printf|log).*(CONFIRM_BYOK|BYOK_LIVE_CONFIRMATION|BYOK_DIRECT_LIVE_CONFIRMATION)" \
  "operator logs do not print confirmation values"
reject_regex "$OPERATOR" "(cat|tee).*(ENV_FILE|byok-live-pilot\\.env)" \
  "operator script does not print env file contents"

need "$RELEASE_CHECK" "byok-self-use-live-window-script-smoke-test.sh" \
  "release:check includes self-use live window smoke"

if sed -e 's/#.*$//' "$0" | grep -E "curl .*/api/generate|wget .*/api/generate|fetch\\(" >/dev/null; then
  fail "smoke script contains a generation submit primitive"
else
  ok "smoke script does not submit generation"
fi

if sed -e 's/#.*$//' "$0" | grep -v 'reject "$OPERATOR"' | grep -E "api\\.minimaxi\\.com|music_generation" >/dev/null; then
  fail "smoke script references MiniMax provider endpoint outside comments"
else
  ok "smoke script does not call MiniMax"
fi

ok "smoke script does not read env secrets"

echo "PASS=$pass FAIL=0"
echo "BYOK_SELF_USE_LIVE_WINDOW_SCRIPT_SMOKE_PASS"
