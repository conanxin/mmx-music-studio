#!/usr/bin/env bash
# run-local-behind-proxy.sh — 让 mmx-music-studio 只监听本机，供 Caddy/Nginx 反代
#
# 用途：
#   - 生产环境：server 只给本机反代用，不对外暴露端口
#   - 默认 mock 模式，不消耗额度
#   - 不输出任何 key/token/secret
#
# 用法：
#   HOST=127.0.0.1 PORT=8787 bash scripts/run-local-behind-proxy.sh
#
# 或配合 systemd：
#   Environment="HOST=127.0.0.1"
#   Environment="PORT=8787"
#   Environment="MINIMAX_BACKEND=mock"
#   Environment="REAL_GENERATION_ENABLED=false"

set -euo pipefail

# 默认值
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8787}"
MINIMAX_BACKEND="${MINIMAX_BACKEND:-mock}"
REAL_GENERATION_ENABLED="${REAL_GENERATION_ENABLED:-false}"
MOCK_GENERATION_ENABLED="${MOCK_GENERATION_ENABLED:-true}"
PREVIEW_ACCESS_ENABLED="${PREVIEW_ACCESS_ENABLED:-false}"
GENERATION_ACCESS_ENABLED="${GENERATION_ACCESS_ENABLED:-false}"

echo "=== mmx-music-studio (反代模式) ==="
echo "  HOST: $HOST"
echo "  PORT: $PORT"
echo "  MINIMAX_BACKEND: $MINIMAX_BACKEND"
echo "  REAL_GENERATION_ENABLED: $REAL_GENERATION_ENABLED"
echo "  MOCK_GENERATION_ENABLED: $MOCK_GENERATION_ENABLED"
echo "  PREVIEW_ACCESS_ENABLED: $PREVIEW_ACCESS_ENABLED"
echo "  GENERATION_ACCESS_ENABLED: $GENERATION_ACCESS_ENABLED"
echo ""

# 检查端口是否已被占用
if ss -ltnp 2>/dev/null | grep -q ":${PORT} " || netstat -ltnp 2>/dev/null | grep -q ":${PORT} "; then
    echo "[WARN] 端口 $PORT 已被占用，可能有其他进程在监听"
else
    echo "[OK] 端口 $PORT 可用"
fi

# 启动服务
echo "[INFO] 启动 mmx-music-studio server..."
npm run start
