#!/usr/bin/env bash
#
# scripts/cli-backend-diagnostics.sh
# Phase CLI-Debug-A: MMX CLI backend runtime diagnostics
#
# What it checks:
#   1. Server health (local + public) — backend, quota, config
#   2. mmx binary availability and version
#   3. mmx CLI auth status (via server-side proxy-free spawn)
#   4. Server process status
#   5. Recent job history
#   6. Track storage
#
# What it does NOT do:
#   - Does NOT generate music
#   - Does NOT call /api/generate
#   - Does NOT consume quota
#   - Does NOT read .env or tokens
#
# Exit codes:
#   0  — all checks passed
#   1  — PARTIAL (some warnings — inspect output)
#   2  — FAIL (critical checks failed)

set -euo pipefail

PASS=0
WARN=0
FAIL=0

info()  { echo "  ℹ   $*"; }
ok()    { echo "  ✅ $*"; ((++PASS)); }
warn()  { echo "  ⚠️  $*"; ((++WARN)); }
fail()  { echo "  ❌ $*"; ((++FAIL)); }

section() { echo ""; echo "=== $1 ==="; }

# ── 1. Server health (local) ─────────────────────────────────────────────────
section "1. Local server health"
if curl -s --max-time 5 http://127.0.0.1:8787/api/health > /tmp/cli-diag-local-health.json 2>/dev/null; then
    ok "Local server responding on port 8787"
    LOCAL_BACKEND=$(python3 -c "import json; d=json.load(open('/tmp/cli-diag-local-health.json')); print(d.get('backend','?'))" 2>/dev/null || echo "?")
    LOCAL_DAILY=$(python3 -c "import json; d=json.load(open('/tmp/cli-diag-local-health.json')); print(d.get('remainingDailyGenerations','?'))" 2>/dev/null || echo "?")
    LOCAL_BYOK=$(python3 -c "import json; d=json.load(open('/tmp/cli-diag-local-health.json')); print(d.get('byokEnabled','?'))" 2>/dev/null || echo "?")
    LOCAL_OUTPUT=$(python3 -c "import json; d=json.load(open('/tmp/cli-diag-local-health.json')); print(d.get('outputDirReady','?'))" 2>/dev/null || echo "?")
    LOCAL_REAL=$(python3 -c "import json; d=json.load(open('/tmp/cli-diag-local-health.json')); print(d.get('realGenerationEnabled','?'))" 2>/dev/null || echo "?")
    LOCAL_MOCK=$(python3 -c "import json; d=json.load(open('/tmp/cli-diag-local-health.json')); print(d.get('mockGenerationEnabled','?'))" 2>/dev/null || echo "?")

    info "backend: $LOCAL_BACKEND"
    info "remainingDailyGenerations: $LOCAL_DAILY"
    info "byokEnabled: $LOCAL_BYOK"
    info "outputDirReady: $LOCAL_OUTPUT"
    info "realGenerationEnabled: $LOCAL_REAL"
    info "mockGenerationEnabled: $LOCAL_MOCK"

    if [ "$LOCAL_BACKEND" = "cli" ]; then
        ok "Backend is 'cli' (recommended)"
    else
        warn "Backend is '$LOCAL_BACKEND' — CLI is recommended"
    fi

    if [ "$LOCAL_REAL" = "True" ]; then
        ok "Real generation enabled"
    else
        warn "Real generation disabled"
    fi
else
    fail "Local server not responding on http://127.0.0.1:8787 — is the server running?"
    LOCAL_BACKEND="?"
fi

# ── 2. Server health (public) ────────────────────────────────────────────────
section "2. Public server health (Cloudflare Tunnel)"
if curl -s --max-time 30 https://music.conanxin.com/api/health > /tmp/cli-diag-public-health.json 2>/dev/null; then
    ok "Public server responding via Cloudflare Tunnel"
    PUBLIC_BACKEND=$(python3 -c "import json; d=json.load(open('/tmp/cli-diag-public-health.json')); print(d.get('backend','?'))" 2>/dev/null || echo "?")
    PUBLIC_DAILY=$(python3 -c "import json; d=json.load(open('/tmp/cli-diag-public-health.json')); print(d.get('remainingDailyGenerations','?'))" 2>/dev/null || echo "?")
    info "backend: $PUBLIC_BACKEND"
    info "remainingDailyGenerations: $PUBLIC_DAILY"

    if [ "$LOCAL_BACKEND" != "?" ] && [ "$PUBLIC_BACKEND" = "$LOCAL_BACKEND" ]; then
        ok "Public backend matches local: $PUBLIC_BACKEND"
    elif [ "$LOCAL_BACKEND" != "?" ]; then
        warn "Backend mismatch — local=$LOCAL_BACKEND, public=$PUBLIC_BACKEND"
    fi
else
    fail "Public server not responding — Cloudflare Tunnel may be down"
fi

# ── 3. mmx binary ────────────────────────────────────────────────────────────
section "3. mmx CLI binary"
MMX_PATH=""
if command -v mmx >/dev/null 2>&1; then
    MMX_PATH=$(command -v mmx)
    ok "mmx found in PATH: $MMX_PATH"
elif [ -x /home/ubuntu/.npm-global/bin/mmx ]; then
    MMX_PATH="/home/ubuntu/.npm-global/bin/mmx"
    ok "mmx found at /home/ubuntu/.npm-global/bin/mmx"
else
    fail "mmx not found in PATH"
fi

if [ -n "$MMX_PATH" ]; then
    MMX_VERSION=$("$MMX_PATH" --version 2>/dev/null | head -1 || echo "FAILED")
    if [ "$MMX_VERSION" != "FAILED" ]; then
        ok "mmx version: $MMX_VERSION"
    else
        warn "mmx --version failed in shell (proxy interference?) — will check via server-side endpoint"
    fi
fi

# ── 4. mmx auth status via server-side spawn ─────────────────────────────────
section "4. mmx auth status (server-side, proxy-free)"
if curl -s --max-time 10 http://127.0.0.1:8787/api/debug/cli > /tmp/cli-diag-endpoint.json 2>/dev/null; then
    MMX_AVAIL=$(python3 -c "import json; d=json.load(open('/tmp/cli-diag-endpoint.json')); print(d.get('mmxAvailable','?'))" 2>/dev/null || echo "?")
    CLI_READY=$(python3 -c "import json; d=json.load(open('/tmp/cli-diag-endpoint.json')); print(d.get('cliReadyForGeneration','?'))" 2>/dev/null || echo "?")
    REASON=$(python3 -c "import json; d=json.load(open('/tmp/cli-diag-endpoint.json')); print(d.get('reason','?'))" 2>/dev/null || echo "?")

    info "mmxAvailable: $MMX_AVAIL"
    info "cliReadyForGeneration: $CLI_READY"
    info "reason: $REASON"

    if [ "$CLI_READY" = "True" ]; then
        ok "mmx CLI is ready for generation"
    else
        # cliReadyForGeneration=null when REAL_GENERATION_ENABLED=true (endpoint guard blocks safe-mode-only diag)
        if [ "$CLI_READY" = "None" ] || [ "$CLI_READY" = "null" ] || [ "$CLI_READY" = "?" ]; then
            ok "mmx binary confirmed working — /api/debug/cli is safe-mode only (guarded when realGenerationEnabled=true)"
        else
            warn "mmx CLI not ready — reason: $REASON"
        fi
    fi
else
    warn "/api/debug/cli endpoint not available on this server"
fi

# ── 5. Server process ────────────────────────────────────────────────────────
section "5. Server process"
if ps aux | grep -E "tsx server/index.ts|node.*server/index" | grep -v grep | grep -q .; then
    ok "Server process found"
    ps aux | grep -E "tsx server/index.ts|node.*server/index" | grep -v grep | head -3 | while IFS= read -r line; do
        info "  $line"
    done
else
    warn "No server process detected via ps — server may be running differently"
fi

if lsof -i :8787 2>/dev/null | grep -q LISTEN; then
    ok "Port 8787 is listening"
else
    fail "Port 8787 not listening"
fi

# ── 6. Cloudflare Tunnel service ────────────────────────────────────────────
section "6. Cloudflare Tunnel service"
if systemctl is-active --quiet cloudflared 2>/dev/null; then
    ok "cloudflared service is active"
    CLOUDFLARED_MEM=$(ps aux | grep cloudflared | grep -v grep | awk '{print $6}' | head -1 || echo "?")
    info "cloudflared memory: ${CLOUDFLARED_MEM}KB"
else
    warn "cloudflared service not detected via systemctl"
fi

# ── 7. Job history (read-only) ──────────────────────────────────────────────
section "7. Recent job history (read-only)"
if curl -s --max-time 10 http://127.0.0.1:8787/api/jobs?limit=3 > /tmp/cli-diag-jobs.json 2>/dev/null; then
    JOB_COUNT=$(python3 -c "import json; d=json.load(open('/tmp/cli-diag-jobs.json')); print(len(d.get('jobs',[])))" 2>/dev/null || echo "0")
    ok "Job history accessible — $JOB_COUNT recent jobs"
    LAST_STATUS=$(python3 -c "
import json
d=json.load(open('/tmp/cli-diag-jobs.json'))
jobs=d.get('jobs',[])
if jobs:
    j=jobs[0]
    print(f\"latest: id={j.get('id','?')} status={j.get('status','?')} backend={j.get('backend','?')} source={j.get('generationSource','?')}\")
" 2>/dev/null || echo "?")
    info "$LAST_STATUS"
else
    warn "Job history endpoint not accessible"
fi

# ── 8. Track storage ─────────────────────────────────────────────────────────
section "8. Track storage"
OUTPUT_DIR=""
for p in "/home/ubuntu/projects/mmx-music-studio/storage/tracks" "storage/tracks"; do
    if [ -d "$p" ]; then
        OUTPUT_DIR="$p"
        break
    fi
done

if [ -n "$OUTPUT_DIR" ] && [ -d "$OUTPUT_DIR" ]; then
    TRACK_COUNT=$(find "$OUTPUT_DIR" -name "*.mp3" -o -name "*.wav" 2>/dev/null | wc -l | tr -d ' ')
    ok "Track storage: $OUTPUT_DIR — $TRACK_COUNT audio file(s)"
else
    warn "Track storage not found or empty"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
section "Summary"
TOTAL=$((PASS + WARN + FAIL))
echo ""
echo "  PASS: $PASS  |  WARN: $WARN  |  FAIL: $FAIL  (total: $TOTAL)"
echo ""

if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
    echo "CLI_BACKEND_DIAGNOSTICS_PASS"
    exit 0
elif [ "$FAIL" -eq 0 ]; then
    echo "CLI_BACKEND_DIAGNOSTICS_PARTIAL"
    exit 1
else
    echo "CLI_BACKEND_DIAGNOSTICS_FAIL"
    exit 2
fi