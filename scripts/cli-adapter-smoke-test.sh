#!/usr/bin/env bash
# Phase 2D.1 CLI Adapter Smoke Test (safe, no real generation)
set -euo pipefail

RESULT_DIR="/tmp/mmx-cli-smoke"
mkdir -p "$RESULT_DIR"

# Non-fatal command runner
run_cmd() {
  local label="$1"; shift
  local out="$RESULT_DIR/${label}.txt"
  local err_out="$RESULT_DIR/${label}_stderr.txt"
  set +e
  "$@" > "$out" 2> "$err_out"
  local ec=$?
  set -e
  echo "$ec" > "$RESULT_DIR/${label}.ec"
  echo "  - $label: exit=$ec"
}

echo "=== CLI Adapter Smoke Test (Phase 2D.1) ==="
echo "Base: http://localhost:8787"

run_cmd cmd_which     command -v mmx
run_cmd mmx_version   mmx --version
run_cmd mmx_auth      mmx auth status
run_cmd mmx_config    mmx config show
run_cmd mmx_quota     mmx quota
run_cmd mmx_gen_help  mmx music generate --help
run_cmd mmx_cover_help mmx music cover --help

echo ""
echo "=== Server debug/cli ==="
curl -s http://localhost:8787/api/debug/cli | head -c 1000 > "$RESULT_DIR/debug_cli.txt" 2>/dev/null || echo "failed" > "$RESULT_DIR/debug_cli.txt"
echo "  - debug/cli: $(wc -c < "$RESULT_DIR/debug_cli.txt") bytes"

echo ""
echo "=== Secret Scan ==="
SECRET_LEAK="false"
for f in "$RESULT_DIR"/*.txt "$RESULT_DIR"/*.ec; do
  if grep -E 'sk-[a-zA-Z0-9]{20,}' "$f" 2>/dev/null; then
    SECRET_LEAK="true"
    echo "!! SECRET LEAK in $f !!" >&2
  fi
done
echo "  leak check: $SECRET_LEAK"

# Determine result
MMX_VERSION_EC=$(cat "$RESULT_DIR/mmx_version.ec" 2>/dev/null || echo 99)

if [[ "$SECRET_LEAK" == "true" ]]; then
  echo "final_result: FAIL (secret leak detected)"
  exit 1
fi

if [[ "$MMX_VERSION_EC" != "0" ]]; then
  echo "final_result: PARTIAL_AUTH_OR_CONFIG_ERROR (mmx --version exit=$MMX_VERSION_EC, auth needs repair)"
  exit 0
fi

echo "final_result: PASS"
exit 0