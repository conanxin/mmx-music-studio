#!/usr/bin/env bash
# run-private-real.sh — 启动 Private Real（私有真实生成模式）
# 真实调用 MiniMax mmx CLI，会消耗 Token Plan 额度

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "═══════════════════════════════════════════"
echo "  mmx-music-studio — Private Real"
echo "  私有真实生成 · 会消耗额度 · 请谨慎使用"
echo "═══════════════════════════════════════════"

# 前置检查
echo ""
echo "🔍 前置检查..."

# 1. mmx CLI 是否存在
if ! command -v mmx &>/dev/null; then
  echo "❌ mmx CLI 未找到"
  echo ""
  echo "请先安装 mmx CLI："
  echo "  npm install -g @minimax/mmx-cli"
  echo "或参考：https://github.com/MiniMax-AI/mmx"
  exit 1
fi
echo "   ✅ mmx CLI 已安装"

# 2. mmx 版本
MMX_VERSION=$(mmx --version 2>/dev/null || echo "未知")
echo "   ✅ mmx 版本: $MMX_VERSION"

# 3. mmx auth 状态
echo ""
echo "🔑 检查 mmx 认证状态..."
AUTH_STATUS=$(mmx auth status 2>/dev/null || echo "AUTH_CHECK_FAILED")
if echo "$AUTH_STATUS" | grep -qi "not logged\|未登录\|not authenticated\|no token"; then
  echo "❌ mmx 未登录或认证已过期"
  echo ""
  echo "请先登录："
  echo "  mmx auth login --recommend --region=cn"
  echo "  # 或 global"
  echo "  mmx auth login --recommend --region=global"
  exit 1
fi
echo "   ✅ mmx 已登录"

# 4. mmx quota
echo ""
echo "💰 检查 Token Plan 额度..."
QUOTA_OUTPUT=$(mmx quota 2>/dev/null || echo "QUOTA_CHECK_FAILED")
if echo "$QUOTA_OUTPUT" | grep -qi "QUOTA_CHECK_FAILED\|error\|failed"; then
  echo "⚠️  无法获取额度信息，请确认 mmx quota 可用"
  echo "   当前输出: $QUOTA_OUTPUT"
  echo ""
  read -p "是否继续启动？（真实生成会消耗额度）[y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消启动"
    exit 1
  fi
else
  echo "   ✅ 额度检查成功"
  # 显示额度摘要（不打印敏感数据）
  echo "   $QUOTA_OUTPUT" | head -5
fi

# 检查 .env.private-real 是否存在
if [[ ! -f "$PROJECT_ROOT/.env.private-real" ]]; then
  echo ""
  echo "⚠️  未找到 .env.private-real，正在从 .env.private-real.example 创建..."
  if [[ -f "$PROJECT_ROOT/.env.private-real.example" ]]; then
    cp "$PROJECT_ROOT/.env.private-real.example" "$PROJECT_ROOT/.env.private-real"
    echo "✅ 已创建 .env.private-real（请检查内容）"
  fi
fi

echo ""
echo "⚠️  警告：即将以真实生成模式启动"
echo "   此模式会真实调用 MiniMax mmx CLI"
echo "   会消耗 Token Plan 额度"
echo "   建议配合访问保护（PREVIEW_ACCESS_PIN）限制公开访问"
echo ""

# 确认启动
read -p "确认启动 Private Real 模式？[y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "已取消启动"
  exit 1
fi

echo ""
echo "🚀 启动 Private Real 模式..."
echo "   访问地址：http://localhost:8787"
echo "   模式：真实生成（MMX CLI）"
echo "   额度：会消耗"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

cd "$PROJECT_ROOT"
exec npm run start