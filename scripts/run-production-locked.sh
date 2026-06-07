#!/usr/bin/env bash
# run-production-locked.sh — 启动 Production Locked（生产锁定模式）
# 开启访问保护 PIN，真实生成暂时锁定

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "═══════════════════════════════════════════"
echo "  mmx-music-studio — Production Locked"
echo "  生产锁定模式 · 访问保护已开启 · 真实生成关闭"
echo "═══════════════════════════════════════════"

# 检查 .env.production-locked 是否存在
if [[ ! -f "$PROJECT_ROOT/.env.production-locked" ]]; then
  echo ""
  echo "⚠️  未找到 .env.production-locked，正在从 .env.production-locked.example 创建..."
  if [[ -f "$PROJECT_ROOT/.env.production-locked.example" ]]; then
    cp "$PROJECT_ROOT/.env.production-locked.example" "$PROJECT_ROOT/.env.production-locked"
    echo "✅ 已创建 .env.production-locked（请编辑其中的 PIN）"
    echo ""
    echo "请编辑 $PROJECT_ROOT/.env.production-locked 设置 PREVIEW_ACCESS_PIN"
    echo "然后重新运行："
    echo "  bash scripts/run-production-locked.sh"
    exit 1
  fi
fi

# 验证 PREVIEW_ACCESS_PIN 是否已设置（非占位符）
PIN_VALUE=$(grep '^PREVIEW_ACCESS_PIN=' "$PROJECT_ROOT/.env.production-locked" 2>/dev/null | cut -d'=' -f2 | tr -d ' "' || true)
if [[ -z "$PIN_VALUE" || "$PIN_VALUE" == "<"* ]]; then
  echo "❌ PREVIEW_ACCESS_PIN 未设置或仍为占位符"
  echo ""
  echo "请编辑 $PROJECT_ROOT/.env.production-locked"
  echo "将 PREVIEW_ACCESS_PIN=<your_preview_pin> 改为真实值"
  echo ""
  echo "示例："
  echo "  PREVIEW_ACCESS_PIN=MySecurePass2024"
  exit 1
fi
echo "   ✅ PREVIEW_ACCESS_PIN 已设置"

echo ""
echo "📋 当前配置："
echo "   模式：Production Locked（生产锁定）"
echo "   真实生成：关闭"
echo "   后端：本地模拟"
echo "   访问保护：PIN 已启用"
echo "   额度消耗：无"
echo ""

echo "🚀 启动 Production Locked 模式..."
echo "   访问地址：http://localhost:8787"
echo "   首次访问需要输入 PIN"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

cd "$PROJECT_ROOT"
exec npm run start