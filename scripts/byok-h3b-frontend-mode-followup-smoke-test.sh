#!/usr/bin/env bash
# Phase BYOK-H3B-FRONTEND-MODE-FOLLOWUP smoke test.
# Asserts:
#   1. Frontend (ByokPanel/Studio/serverApi) live-ready health fields + isByokLiveReady
#   2. Submit payload sends explicit mode (live-ready => direct-live; else fake)
#   3. CSS liveWindowBadge class exists
#   4. Server defensive block byok_live_mode_required (no MiniMax call, no attempt consume)
#   5. Docs: retry-5 root cause, no MiniMax, no music
#   6. No raw secrets
# This smoke does NOT execute a live call, does NOT call MiniMax,
# does NOT generate music.
set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

pass() {
  PASS=$((PASS + 1))
  echo "PASS: $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo "FAIL: $1"
}

# need: file must contain needle
need() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if [ -f "$file" ] && grep -Fq -- "$needle" "$file"; then
    pass "$label"
  else
    fail "$label (file: $file, needle: $needle)"
  fi
}

# need_regex: file must contain regex
need_regex() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if [ -f "$file" ] && grep -Eq -- "$pattern" "$file"; then
    pass "$label"
  else
    fail "$label (file: $file, pattern: $pattern)"
  fi
}

# reject: file must NOT contain needle
reject() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if [ ! -f "$file" ]; then
    fail "$label (file missing: $file)"
  elif grep -Fq -- "$needle" "$file"; then
    fail "$label (unexpected: $needle in $file)"
  else
    pass "$label"
  fi
}

echo "=========================================="
echo "Phase BYOK-H3B-FRONTEND-MODE-FOLLOWUP smoke"
echo "=========================================="

echo
echo "[1/8] serverApi.ts: live health fields"
need "$REPO/src/lib/serverApi.ts" "byokLiveEnabled" "HealthInfo.byokLiveEnabled"
need "$REPO/src/lib/serverApi.ts" "byokLiveConfirmationConfigured" "HealthInfo.byokLiveConfirmationConfigured"
need "$REPO/src/lib/serverApi.ts" "byokLiveAttemptsRemaining" "HealthInfo.byokLiveAttemptsRemaining"
need "$REPO/src/lib/serverApi.ts" "byokLiveAudioRemaining" "HealthInfo.byokLiveAudioRemaining"

echo
echo "[2/8] ByokPanel.tsx: isByokLiveReady computation"
need "$REPO/src/features/studio/ByokPanel.tsx" "isByokLiveReady" "ByokPanel defines isByokLiveReady"
need "$REPO/src/features/studio/ByokPanel.tsx" "props.byokLiveEnabled === true" "Checks byokLiveEnabled === true"
need "$REPO/src/features/studio/ByokPanel.tsx" "props.byokLiveConfirmationConfigured === true" "Checks byokLiveConfirmationConfigured === true"
need "$REPO/src/features/studio/ByokPanel.tsx" "props.byokLiveAttemptsRemaining > 0" "Checks attemptsRemaining > 0"
need "$REPO/src/features/studio/ByokPanel.tsx" "props.byokLiveAudioRemaining > 0" "Checks audioRemaining > 0"

echo
echo "[3/8] ByokPanel.tsx: submit payload mode"
need "$REPO/src/features/studio/ByokPanel.tsx" "mode: isByokLiveReady ? 'direct-live' : 'fake'" "Submit sends direct-live when live-ready, else fake"
reject "$REPO/src/features/studio/ByokPanel.tsx" "The body never carries the explicit 'mode'" "Old no-mode comment removed"

echo
echo "[4/8] ByokPanel.tsx: live-ready button copy"
need "$REPO/src/features/studio/ByokPanel.tsx" "submitIdleDryRun" "submitIdleDryRun constant exists"
need "$REPO/src/features/studio/ByokPanel.tsx" "submitIdleLive" "submitIdleLive constant exists"
need "$REPO/src/features/studio/ByokPanel.tsx" "isByokLiveReady ? COPY.submitIdleLive : COPY.submitIdleDryRun" "Button copy switches on live-ready"
reject "$REPO/src/features/studio/ByokPanel.tsx" "submitIdle: '使用我的 Key 试调一次" "Old single submitIdle line removed"

echo
echo "[5/8] ByokPanel.tsx + CSS: live window badge"
need "$REPO/src/features/studio/ByokPanel.tsx" "styles.liveWindowBadge" "ByokPanel uses styles.liveWindowBadge class"
need "$REPO/src/features/studio/ByokPanel.tsx" "受控 live 窗口已就绪" "Live window badge text in Chinese"
need "$REPO/src/features/studio/ByokPanel.module.css" ".liveWindowBadge" "CSS class .liveWindowBadge exists"

echo
echo "[6/8] Studio.tsx: live health fields plumbing"
need "$REPO/src/features/studio/Studio.tsx" "byokLiveEnabled={healthInfo?.byokLiveEnabled}" "Studio passes byokLiveEnabled"
need "$REPO/src/features/studio/Studio.tsx" "byokLiveConfirmationConfigured={healthInfo?.byokLiveConfirmationConfigured}" "Studio passes byokLiveConfirmationConfigured"
need "$REPO/src/features/studio/Studio.tsx" "byokLiveAttemptsRemaining={healthInfo?.byokLiveAttemptsRemaining}" "Studio passes byokLiveAttemptsRemaining"
need "$REPO/src/features/studio/Studio.tsx" "byokLiveAudioRemaining={healthInfo?.byokLiveAudioRemaining}" "Studio passes byokLiveAudioRemaining"

echo
echo "[7/8] server/index.ts: byok_live_mode_required defensive block"
need "$REPO/server/index.ts" "byok_live_mode_required" "Server has byok_live_mode_required code"
need "$REPO/server/index.ts" "blocked_live_mode_required" "Server records blocked_live_mode_required outcome"
need "$REPO/server/index.ts" "live_mode_required" "Server records live_mode_required stage"
need "$REPO/server/index.ts" "sendJson(res, 400" "Server returns 400 for live_mode_required"
need "$REPO/server/index.ts" "当前为受控 BYOK live 窗口，客户端必须使用 live/direct-live mode" "Server error message in Chinese"
# 防御性检查: live_mode_required 块必须早于 fake/live CLI adapter 调用
# 直接调: exclude direct-live branch (line 2252 await generateByokDirectMusic)
# 找 "const adapterResult = await generateByokMusic" 这一行 (fake/live CLI path)
line_adapter_call=$(grep -n "const adapterResult = await generateByokMusic" "$REPO/server/index.ts" 2>/dev/null | head -1 | cut -d: -f1 || echo "0")
line_required=$(grep -n "live_mode_required" "$REPO/server/index.ts" 2>/dev/null | head -1 | cut -d: -f1 || echo "0")
if [ -n "$line_required" ] && [ -n "$line_adapter_call" ] && [ "$line_adapter_call" != "0" ] && [ "$line_required" -lt "$line_adapter_call" ]; then
  pass "live_mode_required check (line $line_required) occurs before fake/live CLI adapter call (line $line_adapter_call)"
else
  fail "live_mode_required check line: $line_required, fake/live CLI adapter call line: $line_adapter_call"
fi

echo
echo "[8/8] server/adapters: type extension"
need "$REPO/server/adapters/minimax-api/byok.ts" "live_mode_required" "ByokSubmitStage has live_mode_required"
need "$REPO/server/adapters/minimax-api/byok.ts" "blocked_live_mode_required" "ByokSubmitOutcome has blocked_live_mode_required"

echo
echo "[9/9] docs: retry-5 root cause + boundary statements"
RETRY5="$REPO/docs/launch/BYOK_H3B_LIVE_T1_MICROPILOT_RETRY5_20260613.md"
if [ ! -f "$RETRY5" ]; then
  fail "Retry-5 evidence doc missing: $RETRY5"
else
  need "$RETRY5" "client request was sent with" "Retry-5 mentions client fake mode root cause"
  need_regex "$RETRY5" "frontend.*(mode|direct-live)" "Retry-5 mentions frontend mode fix"
  need "$RETRY5" "does not call MiniMax" "Retry-5 says no MiniMax call"
  need "$RETRY5" "does not generate music" "Retry-5 says no music generation"
  need "$RETRY5" "live_mode_required" "Retry-5 references live_mode_required"
fi

echo
echo "[10/10] secrets + boundary"
# doc comment 中可以提及 "Authorization / Bearer" 作为安全设计说明
# 但禁止实际 fetch header 注入 (regex: headers.*Authorization, headers.*Bearer, "Authorization: )
reject_regex() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if [ ! -f "$file" ]; then
    fail "$label (file missing: $file)"
  elif grep -Eq -- "$pattern" "$file"; then
    fail "$label (pattern matched in $file)"
  else
    pass "$label"
  fi
}
# 检测 "headers.*Authorization" / "headers.*Bearer" 实际注入
reject_regex "$REPO/src/features/studio/ByokPanel.tsx" "headers[\\s\\S]{0,200}Authorization" "No Authorization header injection in ByokPanel"
reject_regex "$REPO/src/features/studio/ByokPanel.tsx" "headers[\\s\\S]{0,200}Bearer" "No Bearer header injection in ByokPanel"
# sk- 是真实 key 特征
reject_regex "$REPO/src/features/studio/ByokPanel.tsx" "sk-[a-zA-Z0-9]{20,}" "No real sk- key in ByokPanel"
reject_regex "$REPO/server/index.ts" "sk-[a-zA-Z0-9]{20,}" "No real sk- key in server/index.ts"

echo
echo "=========================================="
TOTAL=$((PASS + FAIL))
echo "Summary: PASS=$PASS FAIL=$FAIL TOTAL=$TOTAL"
echo "=========================================="
if [ "$FAIL" -eq 0 ]; then
  echo "BYOK_H3B_FRONTEND_MODE_FOLLOWUP_SMOKE_PASS ($PASS/$TOTAL)"
  exit 0
else
  echo "BYOK_H3B_FRONTEND_MODE_FOLLOWUP_SMOKE_FAIL ($PASS/$TOTAL, $FAIL failures)"
  exit 1
fi
