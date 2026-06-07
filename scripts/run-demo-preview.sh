#!/usr/bin/env bash
# run-demo-preview.sh — 启动 Demo Preview（安全预览模式）
# 不真实生成，不消耗额度

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "═══════════════════════════════════════════"
echo "  mmx-music-studio — Demo Preview"
echo "  安全预览模式 · 不消耗额度 · 不真实生成"
echo "═══════════════════════════════════════════"

# 检查 .env.demo 是否存在
if [[ ! -f "$PROJECT_ROOT/.env.demo" ]]; then
  echo ""
  echo "⚠️  未找到 .env.demo，正在从 .env.demo.example 创建..."
  if [[ -f "$PROJECT_ROOT/.env.demo.example" ]]; then
    cp "$PROJECT_ROOT/.env.demo.example" "$PROJECT_ROOT/.env.demo"
    echo "✅ 已创建 .env.demo（请编辑其中的 PIN 和 KEY 占位符）"
    echo ""
    echo "请编辑 $PROJECT_ROOT/.env.demo 填入真实值后，重新运行："
    echo "  bash scripts/run-demo-preview.sh"
    exit 1
  else
    echo "❌ 未找到 .env.demo.example，请确认项目完整性"
    exit 1
  fi
fi

echo ""
echo "📋 当前配置："
echo "   模式：安全预览（Demo Preview）"
echo "   真实生成：关闭"
echo "   后端：本地模拟"
echo "   额度消耗：无"
echo ""

# 检查端口是否占用
if command -v ss &>/dev/null; then
  if ss -tuln | grep -q ':8787 '; then
    echo "⚠️  端口 8787 已被占用，尝试查找进程..."
    ss -tuln | grep ':8787 '
    echo ""
    echo "请先停止占用端口的进程，或修改 .env 中的 PORT"
    exit 1
  fi
fi

echo "🚀 启动安全预览模式..."
echo "   访问地址：http://localhost:8787"
echo "   或 http://<服务器IP>:8787"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

cd "$PROJECT_ROOT"
exec npm run start