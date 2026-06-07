#!/usr/bin/env bash
# production-readiness-check.sh — 正式发布前检查
# 不触发真实生成，不消耗额度

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "${GREEN}  ✅ $1${NC}"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}  ❌ $1${NC}"; FAIL=$((FAIL+1)); }
warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; WARN=$((WARN+1)); }
info() { echo -e "${BLUE}  ℹ️  $1${NC}"; }

echo "═══════════════════════════════════════════════"
echo "  mmx-music-studio — Production Readiness Check"
echo "═══════════════════════════════════════════════"
echo ""

cd "$PROJECT_ROOT"

# ── 1. TypeScript 编译 ─────────────────────────────────
echo "▸ TypeScript 编译检查..."
if npm run typecheck &>/dev/null; then
  pass "tsc --noEmit 通过"
else
  fail "tsc --noEmit 失败（详见上方错误）"
fi

# ── 2. Vite 构建 ───────────────────────────────────────
echo ""
echo "▸ Vite 生产构建..."
if npm run build &>/dev/null; then
  pass "vite build 通过"
else
  fail "vite build 失败（详见上方错误）"
fi

# ── 3. Release 检查 ────────────────────────────────────
echo ""
echo "▸ 发布完整性检查..."
if bash scripts/release-check.sh &>/dev/null; then
  pass "release:check 通过"
else
  fail "release:check 失败"
fi

# ── 4. Manifest 审计 ───────────────────────────────────
echo ""
echo "▸ manifest.json 审计..."
if npm run manifest:audit 2>&1 | grep -q "PASS"; then
  pass "manifest:audit 通过"
else
  warn "manifest:audit 有警告（见上方详情）"
fi

# ── 5. API Server 健康状态 ──────────────────────────────
echo ""
echo "▸ API Server 健康检查..."
HEALTH_OUTPUT=$(curl -s --max-time 5 http://localhost:8787/api/health 2>/dev/null || echo "CURL_FAILED")
if echo "$HEALTH_OUTPUT" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  REAL_GEN=$(echo "$HEALTH_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('realGenerationEnabled','?'))" 2>/dev/null)
  BACKEND=$(echo "$HEALTH_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('backend','?'))" 2>/dev/null)
  MOCK_GEN=$(echo "$HEALTH_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('mockGenerationEnabled','?'))" 2>/dev/null)

  echo "     后端: $BACKEND | 真实生成: $REAL_GEN | Mock: $MOCK_GEN"

  if [[ "$REAL_GEN" == "True" || "$REAL_GEN" == "true" ]]; then
    warn "真实生成已开启（会消耗额度）"
  else
    pass "安全模式（不消耗额度）"
  fi

  # 检查是否监听 0.0.0.0
  if command -v ss &>/dev/null; then
    if ss -tln | grep -q ':8787 '; then
      BIND=$(ss -tln | grep ':8787 ' | awk '{print $4}' || echo "未知")
      echo "     监听地址: $BIND"
      if [[ "$BIND" == "0.0.0.0:8787" ]]; then
        pass "监听 0.0.0.0:8787（可外部访问）"
      else
        warn "未监听 0.0.0.0:8787，当前: $BIND"
      fi
    fi
  fi

  pass "API Server 正常运行"
else
  warn "API Server 未运行或无法访问（http://localhost:8787/api/health）"
  info "如未启动服务，此项可跳过"
fi

# ── 6. 安全模式状态 ────────────────────────────────────
echo ""
echo "▸ 安全模式验证..."
SAFE_CONFIG=true
[[ -f ".env" ]] && grep -q "REAL_GENERATION_ENABLED=true" .env 2>/dev/null && SAFE_CONFIG=false
if $SAFE_CONFIG; then
  pass "REAL_GENERATION_ENABLED 未设置为 true（安全）"
else
  warn "REAL_GENERATION_ENABLED=true（将消耗额度，请确认用途）"
fi

# ── 7. Secret 扫描 ─────────────────────────────────────
echo ""
echo "▸ 敏感信息扫描..."
SECRET_ISSUES=$(grep -rE "(sk-[a-zA-Z0-9]{20,}| Bearer [a-zA-Z0-9]{30,}|x-minimax-api-key:\s*[a-zA-Z0-9])" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=apps/weapp/dist \
  --exclude-dir=.git \
  src/ server/ packages/ scripts/ docs/ \
  2>/dev/null | grep -v "\.example" | grep -v "mock" | grep -v "// sk-" | grep -v "sk-..." || true)

if [[ -z "$SECRET_ISSUES" ]]; then
  pass "敏感信息扫描：无真实 key/token/secret"
else
  fail "发现疑似敏感信息："
  echo "$SECRET_ISSUES" | head -5 | sed 's/^/     /'
fi

# ── 8. .env 未提交检查 ─────────────────────────────────
echo ""
echo "▸ .env 未提交到 git..."
if git -C "$PROJECT_ROOT" ls-files --error-unmatch .env 2>/dev/null; then
  fail ".env 已被 git 跟踪（禁止提交 .env）"
else
  pass ".env 未被 git 跟踪（正确）"
fi

# ── 9. 真实音频未提交检查 ────────────────────────────────
echo ""
echo "▸ storage/tracks 音频文件未提交..."
AUDIO_IN_GIT=$(git -C "$PROJECT_ROOT" ls-files 'storage/tracks/*.mp3' 'storage/tracks/*.wav' 2>/dev/null | head -3 || true)
if [[ -z "$AUDIO_IN_GIT" ]]; then
  pass "storage/tracks 音频未被 git 跟踪（正确）"
else
  fail "storage/tracks 音频已被 git 跟踪（禁止提交）："
  echo "$AUDIO_IN_GIT" | sed 's/^/     /'
fi

# ── 10. 必需文档存在性 ─────────────────────────────────
echo ""
echo "▸ 必需文档存在性..."
REQUIRED_DOCS=(
  "docs/RUNTIME_MODES.md"
  ".env.demo.example"
  ".env.private-real.example"
  ".env.production-locked.example"
  "docs/SECURITY.md"
  "docs/DEPLOYMENT.md"
  "README.md"
)
for doc in "${REQUIRED_DOCS[@]}"; do
  if [[ -f "$PROJECT_ROOT/$doc" ]]; then
    pass "存在: $doc"
  else
    fail "缺失: $doc"
  fi
done

# ── 11. Git 状态 ────────────────────────────────────────
echo ""
echo "▸ Git 工作区状态..."
GIT_STATUS=$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null || echo "GIT_FAILED")
if [[ -z "$GIT_STATUS" ]]; then
  pass "Git 工作区干净"
elif [[ "$GIT_STATUS" == "GIT_FAILED" ]]; then
  warn "无法获取 git 状态"
else
  warn "Git 工作区有未提交更改："
  echo "$GIT_STATUS" | head -10 | sed 's/^/     /'
fi

# ── 12. 小程序构建 ─────────────────────────────────────
echo ""
echo "▸ 微信小程序构建..."
if npm run weapp:build &>/dev/null; then
  pass "weapp:build 通过"
else
  warn "weapp:build 失败（详见上方错误）"
fi

# ── Summary ──────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  检查结果汇总"
echo "═══════════════════════════════════════════════"
echo -e "  ${GREEN}✅ PASS:  $PASS${NC}"
echo -e "  ${RED}❌ FAIL:  $FAIL${NC}"
echo -e "  ${YELLOW}⚠️  WARN:  $WARN${NC}"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}❌ 发布检查未通过，请修复上述失败项${NC}"
  exit 1
elif [[ $WARN -gt 0 ]]; then
  echo -e "${YELLOW}⚠️  发布检查完成，有警告项，建议处理${NC}"
  exit 0
else
  echo -e "${GREEN}✅ 所有检查通过，可以正式发布${NC}"
  exit 0
fi