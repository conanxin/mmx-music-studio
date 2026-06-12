#!/usr/bin/env bash
# byok-h2d-ux-copy-smoke-test.sh
#
# Verifies that Phase BYOK-H2D's UX/copy polish is properly in place.
# Does NOT modify production env, does NOT execute live calls,
# does NOT call MiniMax, does NOT generate music.
#
# Asserts (≥ 30):
# - ByokPanel.tsx exists and contains the H2D copy markers
# - ByokPanel.module.css exists and contains H2D styles
# - All required data-h2d anchors are present
# - All required result-code mappings are preserved (no logic change)
# - No token / key is written to localStorage / sessionStorage / IndexedDB / URL
# - Docs mention H2D UX/copy polish
# - Docs say no live call / no music / H3 requires explicit approval
#
# Output: BYOK_H2D_UX_COPY_SMOKE_PASS / BYOK_H2D_UX_COPY_SMOKE_FAIL

set -uo pipefail

REPO_ROOT="/home/ubuntu/projects/mmx-music-studio"
BYOK_TSX="$REPO_ROOT/src/features/studio/ByokPanel.tsx"
BYOK_CSS="$REPO_ROOT/src/features/studio/ByokPanel.module.css"
README="$REPO_ROOT/README.md"
HANDOFF="$REPO_ROOT/docs/DEVELOPMENT_HANDOFF.md"
READINESS="$REPO_ROOT/docs/PUBLIC_RELEASE_READINESS.md"
H2_PLAN="$REPO_ROOT/docs/launch/BYOK_H2_DRY_RUN_PILOT_PLAN.md"
H2C_EVIDENCE="$REPO_ROOT/docs/launch/BYOK_H2C_DRY_RUN_PILOT_EVIDENCE_REPORT.md"

PASS=0
FAIL=0
FAILED_ASSERTIONS=()

assert_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if [ ! -f "$file" ]; then
    FAIL=$((FAIL + 1))
    FAILED_ASSERTIONS+=("MISSING_FILE: $file ($label)")
    printf "  FAIL: %s — file not found\n" "$label"
    return 1
  fi
  if LC_ALL=C grep -aFq -- "$needle" "$file"; then
    PASS=$((PASS + 1))
    printf "  PASS: %s\n" "$label"
    return 0
  else
    FAIL=$((FAIL + 1))
    FAILED_ASSERTIONS+=("MISSING_NEEDLE: $label  (expected: '$needle' in $file)")
    printf "  FAIL: %s — needle not found\n" "$label"
    return 1
  fi
}

assert_not_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if [ ! -f "$file" ]; then
    FAIL=$((FAIL + 1))
    FAILED_ASSERTIONS+=("MISSING_FILE: $file ($label)")
    printf "  FAIL: %s — file not found\n" "$label"
    return 1
  fi
  # Use a regex-safe check
  if LC_ALL=C grep -aEq -- "$pattern" "$file"; then
    FAIL=$((FAIL + 1))
    FAILED_ASSERTIONS+=("FORBIDDEN_MATCH: $label  (forbidden pattern: '$pattern' in $file)")
    printf "  FAIL: %s — forbidden pattern found\n" "$label"
    return 1
  else
    PASS=$((PASS + 1))
    printf "  PASS: %s\n" "$label"
    return 0
  fi
}

echo "=== BYOK-H2D UX/Copy smoke test ==="
echo "Repo: $REPO_ROOT"
echo

# ── [Section 1] ByokPanel.tsx structure (10 assertions) ──
echo "[1/8] ByokPanel.tsx exists + H2D header docs"
assert_contains "$BYOK_TSX" "Phase BYOK-H2D" "H2D header documentation in tsx"
echo

# ── [Section 2] ByokPanel.tsx copy content (12 assertions) ──
echo "[2/8] ByokPanel.tsx copy content"
assert_contains "$BYOK_TSX" "不会生成音乐" "Dry-run 'no music' copy"
assert_contains "$BYOK_TSX" "不会调用 MiniMax" "Dry-run 'no MiniMax call' copy"
assert_contains "$BYOK_TSX" "费用由你自己的 MiniMax 账户承担" "Cost-on-user copy"
assert_contains "$BYOK_TSX" "不写入浏览器本地存储或服务器持久化" "No-save key copy"
assert_contains "$BYOK_TSX" "sk-FAKE" "Fake key example in copy"
assert_contains "$BYOK_TSX" "人机验证" "Turnstile human-verification copy"
assert_contains "$BYOK_TSX" "不是 MiniMax 登录" "Turnstile-not-login copy"
assert_contains "$BYOK_TSX" "Token 不显示、不保存、不复用" "Token privacy copy"
assert_contains "$BYOK_TSX" "敏感内容" "Sensitive-prompt warning copy"
assert_contains "$BYOK_TSX" "当前为 dry-run，不会产生真实费用" "Confirm-label dry-run note"
assert_contains "$BYOK_TSX" "安全链路已通过" "Dry-run result explainer"
assert_contains "$BYOK_TSX" "Phase BYOK-H2D · dry-run UX/copy polish" "H2D footer line"
echo

# ── [Section 3] data-h2d anchors (8 assertions) ──
echo "[3/8] data-h2d anchors in JSX"
assert_contains "$BYOK_TSX" 'data-h2d="dry-run-badge"' "dry-run-badge anchor"
assert_contains "$BYOK_TSX" 'data-h2d="api-key-hint"' "api-key-hint anchor"
assert_contains "$BYOK_TSX" 'data-h2d="prompt-no-sensitive"' "prompt-no-sensitive anchor"
assert_contains "$BYOK_TSX" 'data-h2d="turnstile-human-only"' "turnstile-human-only anchor"
assert_contains "$BYOK_TSX" 'data-h2d="turnstile-retry-hint"' "turnstile-retry-hint anchor"
assert_contains "$BYOK_TSX" 'data-h2d="turnstile-token-privacy"' "turnstile-token-privacy anchor"
assert_contains "$BYOK_TSX" 'data-h2d="result-block"' "result-block anchor"
assert_contains "$BYOK_TSX" 'data-h2d="dry-run-explain"' "dry-run-explain anchor"
assert_contains "$BYOK_TSX" 'data-h2d="footer-line"' "footer-line anchor"
echo

# ── [Section 4] result-code mappings preserved (5 assertions) ──
echo "[4/8] result-code mappings preserved (no logic regression)"
assert_contains "$BYOK_TSX" "byok_dry_run_only" "byok_dry_run_only mapping"
assert_contains "$BYOK_TSX" "turnstile_required" "turnstile_required mapping"
assert_contains "$BYOK_TSX" "turnstile_invalid" "turnstile_invalid mapping"
assert_contains "$BYOK_TSX" "byok_generation_disabled" "byok_generation_disabled mapping"
assert_contains "$BYOK_TSX" "byok_live_not_enabled" "byok_live_not_enabled mapping"
echo

# ── [Section 5] No token/key persistence to client storage (4 forbidden) ──
echo "[5/8] No token/key writes to client storage"
# These should NOT match (look for assignment / write to localStorage/sessionStorage/IndexedDB/URL with token/apiKey)
assert_not_contains "$BYOK_TSX" 'localStorage.*[aA]pi[_-]?[kK]ey' "no localStorage apiKey write"
assert_not_contains "$BYOK_TSX" 'localStorage.*[tT]oken' "no localStorage token write"
assert_not_contains "$BYOK_TSX" 'sessionStorage.*[aA]pi[_-]?[kK]ey' "no sessionStorage apiKey write"
assert_not_contains "$BYOK_TSX" 'sessionStorage.*[tT]oken' "no sessionStorage token write"
# We allow "does not write" / "not persist" as comments, but no actual setItem calls with token/apiKey.
assert_not_contains "$BYOK_TSX" 'setItem.*[aA]pi[_-]?[kK]ey' "no setItem with apiKey"
assert_not_contains "$BYOK_TSX" 'setItem.*[tT]oken' "no setItem with token"
assert_not_contains "$BYOK_TSX" 'indexedDB.*[aA]pi[_-]?[kK]ey' "no IndexedDB apiKey write"
assert_not_contains "$BYOK_TSX" 'indexedDB.*[tT]oken' "no IndexedDB token write"
# URL persistence: no apiKey= or turnstileToken= in href/assign
assert_not_contains "$BYOK_TSX" 'apiKey=' "no apiKey in URL"
assert_not_contains "$BYOK_TSX" 'turnstileToken=' "no turnstileToken in URL"
echo

# ── [Section 6] CSS module has H2D styles (3 assertions) ──
echo "[6/8] ByokPanel.module.css has H2D classes"
assert_contains "$BYOK_CSS" ".dryRunBadge" ".dryRunBadge class"
assert_contains "$BYOK_CSS" ".hint" ".hint class"
assert_contains "$BYOK_CSS" ".confirmDryRunNote" ".confirmDryRunNote class"
echo

# ── [Section 7] Docs mention H2D (5 assertions) ──
echo "[7/8] Docs mention H2D UX/copy polish"
assert_contains "$README" "Phase BYOK-H2D" "README mentions H2D"
assert_contains "$HANDOFF" "Phase BYOK-H2D — Dry-Run UX/Copy Polish" "HANDOFF H2D section"
assert_contains "$READINESS" "Phase BYOK-H2D" "READINESS mentions H2D"
assert_contains "$H2_PLAN" "Phase BYOK-H2D follow-up" "H2 plan mentions H2D"
assert_contains "$H2C_EVIDENCE" "Phase BYOK-H2D follow-up" "H2C evidence mentions H2D"
echo

# ── [Section 8] Docs say no live / no music / H3 gate (3 assertions) ──
echo "[8/8] Docs reiterate boundary"
assert_contains "$HANDOFF" "未启用 BYOK live" "HANDOFF says no live"
assert_contains "$HANDOFF" "H3 (controlled live pilot) still requires explicit operator approval" "HANDOFF says H3 needs explicit approval"
assert_contains "$READINESS" "H2D does **not** open the live gate" "READINESS says H2D does not open live gate"
echo

echo
echo "=== Summary ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
if [ $FAIL -gt 0 ]; then
  echo
  echo "Failed assertions:"
  for f in "${FAILED_ASSERTIONS[@]}"; do
    echo "  - $f"
  done
  echo
  echo "BYOK_H2D_UX_COPY_SMOKE_FAIL"
  exit 1
fi
echo
echo "BYOK_H2D_UX_COPY_SMOKE_PASS"
exit 0
