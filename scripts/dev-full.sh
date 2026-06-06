#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "[dev-full] 启动 API Server (端口 8787)..."
npm run dev:server &
SERVER_PID=$!

# Wait for server to be ready
sleep 2

echo "[dev-full] 启动 Web Dev Server (端口 5174)..."
npm run dev &
WEB_PID=$!

echo "[dev-full] 两个服务已启动"
echo "  API Server: http://localhost:8787 (PID $SERVER_PID)"
echo "  Web:        http://localhost:5174 (PID $WEB_PID)"
echo ""
echo "按 Ctrl+C 停止两个服务"

trap "echo '正在关闭...'; kill $SERVER_PID $WEB_PID 2>/dev/null || true; wait 2>/dev/null; exit 0" EXIT

wait