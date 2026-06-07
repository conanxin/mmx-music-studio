#!/bin/bash
# scripts/weapp-domain-readiness-check.sh
# Phase 3E: 域名就绪检查脚本
# 不真实生成，不调用 MiniMax API，不消耗额度
# 用法：DOMAIN=music.yourdomain.com bash scripts/weapp-domain-readiness-check.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== mmx-music-studio: 域名就绪检查 ==="
echo ""

# ── 1. 本地 server health ──────────────────────────────────────────────────
echo "[1] 检查本地 server (localhost:8787)..."
LOCAL_HEALTH=$(curl -s --max-time 5 "http://localhost:8787/api/health" 2>/dev/null || echo '{"status":"offline"}')
if echo "$LOCAL_HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('status')=='ok' else 1)" 2>/dev/null; then
  echo "  ✅ localhost:8787 在线"
  echo "     $LOCAL_HEALTH"
else
  echo "  ⚠️  localhost:8787 未运行或无响应"
  echo "     运行: cd $PROJECT_ROOT && npm run start"
fi
echo ""

# ── 2. 公网 HTTP IP health ─────────────────────────────────────────────────
echo "[2] 检查公网 HTTP IP (http://118.195.129.137:8787)..."
PUBLIC_HEALTH=$(curl -s --max-time 5 "http://118.195.129.137:8787/api/health" 2>/dev/null || echo '{"status":"offline"}')
if echo "$PUBLIC_HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('status')=='ok' else 1)" 2>/dev/null; then
  echo "  ✅ http://118.195.129.137:8787 在线"
  echo "     $PUBLIC_HEALTH"
else
  echo "  ⚠️  http://118.195.129.137:8787 无响应"
fi
echo ""

# ── 3. HTTPS 域名检查（需要 DOMAIN 环境变量）─────────────────────────────────
if [ -z "$DOMAIN" ]; then
  echo "[3] DOMAIN 未提供，跳过 HTTPS 检查"
  echo "    用法: DOMAIN=music.yourdomain.com bash scripts/weapp-domain-readiness-check.sh"
  echo ""
  echo "✅ 所有本地/公网检查完成"
  echo ""
  echo "后续步骤："
  echo "  1. 配置 HTTPS 域名（见 docs/WEAPP_DOMAIN_HTTPS_GUIDE.md）"
  echo "  2. 使用 Caddy 或 Nginx 反代（见 deploy/Caddyfile.example / nginx.mmx-music-studio.conf.example）"
  echo "  3. 在微信公众平台配置 request/downloadFile 合法域名"
  echo "  4. 更新小程序 API Base 为 HTTPS 域名"
  echo "  5. 重新编译: npm run weapp:build"
else
  echo "[3] 检查 HTTPS 域名: https://$DOMAIN"

  # DNS 解析检查
  echo "  [3a] DNS 解析..."
  RESOLVED_IP=$(dig +short "$DOMAIN" 2>/dev/null | tail -1)
  if [ -n "$RESOLVED_IP" ]; then
    echo "      ✅ $DOMAIN → $RESOLVED_IP"
  else
    echo "      ❌ DNS 解析失败，域名可能未生效"
  fi
  echo ""

  # HTTPS health 检查
  echo "  [3b] HTTPS health..."
  HTTPS_HEALTH=$(curl -s --max-time 10 -o /dev/null -w "%{http_code} %{content_type} %{time_total}s" "https://$DOMAIN/api/health" 2>/dev/null || echo "000 error")
  HTTP_CODE=$(echo "$HTTPS_HEALTH" | awk '{print $1}')
  if [ "$HTTP_CODE" = "200" ]; then
    BODY=$(curl -s --max-time 10 "https://$DOMAIN/api/health" 2>/dev/null || echo '{}')
    echo "      ✅ HTTPS health 返回 200"
    echo "      $BODY"
  else
    echo "      ❌ HTTPS health 失败 (HTTP $HTTP_CODE)"
    if [ "$HTTP_CODE" = "000" ]; then
      echo "      原因: 连接失败 — 检查域名解析 / HTTPS 配置 / 防火墙"
    fi
  fi
  echo ""

  # TLS 证书检查
  echo "  [3c] TLS 证书..."
  TLS_RESULT=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -dates -issuer 2>/dev/null || echo "FAILED")
  if echo "$TLS_RESULT" | grep -q "notAfter"; then
    NOT_AFTER=$(echo "$TLS_RESULT" | grep notAfter | cut -d= -f2)
    echo "      ✅ TLS 证书有效，到期时间: $NOT_AFTER"
  else
    echo "      ⚠️  无法获取 TLS 证书信息"
  fi
  echo ""

  echo "✅ HTTPS 域名检查完成"
fi

echo ""
echo "=== 检查完成 ==="
echo "当前阶段: Phase 3E（不真实生成，不消耗额度）"