#!/usr/bin/env bash
# domain-readiness-check.sh — 域名就绪检查脚本（Phase 4E-A）
#
# 用法：
#   bash scripts/domain-readiness-check.sh                        # 本地基础检查
#   DOMAIN=music.yourdomain.com bash scripts/domain-readiness-check.sh  # 含域名检查
#
# 注意：
#   - 不真实生成，不消耗额度
#   - 不检查证书私钥
#   - 不输出任何 key/token/PIN

set -uo pipefail

DOMAIN="${DOMAIN:-}"
PORT="${PORT:-8787}"
LOCAL_URL="http://127.0.0.1:${PORT}"
PUBLIC_IP="${PUBLIC_IP:-118.195.129.137}"
PUBLIC_URL="http://${PUBLIC_IP}:${PORT}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
info() { echo -e "[INFO] $1"; }

echo "============================================"
echo "  mmx-music-studio Domain Readiness Check"
echo "============================================"
echo ""

# --- 1. Local Health ---
info "1. Local health check (127.0.0.1:${PORT})"
if curl -sf --max-time 5 "${LOCAL_URL}/api/health" > /tmp/mmx-dr-local-health.json 2>/dev/null; then
    pass "Local server is up"
    BACKEND=$(python3 -c "import json; d=json.load(open('/tmp/mmx-dr-local-health.json')); print(d.get('backend','?'))" 2>/dev/null || echo "?")
    REAL_GEN=$(python3 -c "import json; d=json.load(open('/tmp/mmx-dr-local-health.json')); print(d.get('realGenerationEnabled','?'))" 2>/dev/null || echo "?")
    MOCK_GEN=$(python3 -c "import json; d=json.load(open('/tmp/mmx-dr-local-health.json')); print(d.get('mockGenerationEnabled','?'))" 2>/dev/null || echo "?")
    echo "    backend: $BACKEND | realGeneration: $REAL_GEN | mockGeneration: $MOCK_GEN"
else
    fail "Local server is NOT running on ${PORT}. Run: npm run start"
fi
echo ""

# --- 2. Public Health ---
info "2. Public health check (${PUBLIC_URL})"
if curl -sf --max-time 10 "${PUBLIC_URL}/api/health" > /tmp/mmx-dr-public-health.json 2>/dev/null; then
    pass "Public server is reachable"
    echo "    $(cat /tmp/mmx-dr-public-health.json | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"phase={d.get("phase","?")} backend={d.get("backend","?")}")' 2>/dev/null)"
else
    warn "Public server not reachable (可能安全组未开放 ${PORT} 端口)"
fi
echo ""

# --- 3. Port 8787 ---
info "3. Port ${PORT} status"
if ss -ltnp 2>/dev/null | grep -q ":${PORT} " || netstat -ltnp 2>/dev/null | grep -q ":${PORT} "; then
    LISTENER=$(ss -ltnp 2>/dev/null | grep ":${PORT} " | head -1 || netstat -ltnp 2>/dev/null | grep ":${PORT} " | head -1)
    pass "Port ${PORT} is LISTENING"
    echo "    $LISTENER"
else
    fail "Port ${PORT} is NOT listening"
fi
echo ""

# --- 4. Port 80 ---
info "4. Port 80 status"
if ss -ltnp 2>/dev/null | grep -q ':80 ' || netstat -ltnp 2>/dev/null | grep -q ':80 '; then
    LISTENER=$(ss -ltnp 2>/dev/null | grep ':80 ' | head -1 || netstat -ltnp 2>/dev/null | grep ':80 ' | head -1)
    warn "Port 80 is occupied by another service"
    echo "    $LISTENER"
    echo "    -> 建议：关闭或迁移占用 80 端口的服务"
else
    pass "Port 80 is FREE (可用 Caddy auto-HTTPS)"
fi
echo ""

# --- 5. Port 443 ---
info "5. Port 443 status"
if ss -ltnp 2>/dev/null | grep -q ':443 ' || netstat -ltnp 2>/dev/null | grep -q ':443 '; then
    LISTENER=$(ss -ltnp 2>/dev/null | grep ':443 ' | head -1 || netstat -ltnp 2>/dev/null | grep ':443 ' | head -1)
    warn "Port 443 is occupied"
    echo "    $LISTENER"
else
    pass "Port 443 is FREE (可用 Caddy auto-HTTPS)"
fi
echo ""

# --- 6. Caddy ---
info "6. Caddy availability"
if command -v caddy >/dev/null 2>&1; then
    CADDY_VER=$(caddy version 2>/dev/null | head -1 || echo "unknown")
    pass "Caddy is installed: $CADDY_VER"
else
    info "Caddy is NOT installed"
    echo "    -> 安装: curl https://getcaddy.com | bash"
    echo "    -> 或:  sudo apt install -y caddy"
fi
echo ""

# --- 7. Nginx ---
info "7. Nginx availability"
if command -v nginx >/dev/null 2>&1; then
    NGINX_VER=$(nginx -v 2>&1 | head -1 || echo "unknown")
    pass "Nginx is installed: $NGINX_VER"
else
    info "Nginx is NOT installed"
    echo "    -> 安装: sudo apt install -y nginx certbot"
fi
echo ""

# --- 8. DNS check (if DOMAIN provided) ---
if [[ -n "$DOMAIN" ]]; then
    info "8. DNS resolution for $DOMAIN"
    RESOLVED_IP=$(python3 -c "import socket; print(socket.gethostbyname('$DOMAIN'))" 2>/dev/null || echo "FAILED")
    if [[ "$RESOLVED_IP" == "$PUBLIC_IP" ]]; then
        pass "DNS OK: $DOMAIN -> $RESOLVED_IP (正确)"
    elif [[ "$RESOLVED_IP" != "FAILED" ]]; then
        fail "DNS 指向错误: $DOMAIN -> $RESOLVED_IP (期望: $PUBLIC_IP)"
    else
        fail "DNS 解析失败: $DOMAIN"
    fi
    echo ""

    # --- 9. HTTPS check (if DOMAIN provided) ---
    info "9. HTTPS health check for https://$DOMAIN"
    HTTPS_STATUS=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "https://${DOMAIN}/api/health" 2>/dev/null || echo "FAILED")
    if [[ "$HTTPS_STATUS" == "200" ]]; then
        pass "HTTPS OK: https://$DOMAIN 返回 $HTTPS_STATUS"
    else
        warn "HTTPS 尚未就绪: https://$DOMAIN 返回 $HTTPS_STATUS"
        echo "    -> 请完成 DNS 解析 + Caddy/Nginx 配置 + 证书申请"
        echo "    -> Caddy 自动申请证书（端口 80 必须可用）"
    fi
    echo ""

    # --- 10. Domain firewall check ---
    info "10. Tencent Cloud security group check"
    echo "    需要在腾讯云安全组开放："
    echo "    - TCP 80 (Caddy ACME HTTP-01 验证)"
    echo "    - TCP 443 (HTTPS)"
    echo "    当前 $PORT 已开放，但正式 HTTPS 建议只开放 80/443"
else
    info "8-9. DOMAIN not provided — skipping DNS/HTTPS checks"
    echo "    用法: DOMAIN=music.yourdomain.com bash scripts/domain-readiness-check.sh"
fi
echo ""

# --- Summary ---
echo "============================================"
echo "  Summary"
echo "============================================"
echo "  Local server:        $(ss -ltnp 2>/dev/null | grep -q ":${PORT} " && echo -e "${GREEN}UP${NC}" || echo -e "${RED}DOWN${NC}") (port ${PORT})"
echo "  Port 80:             $(ss -ltnp 2>/dev/null | grep -q ':80 ' && echo -e "${YELLOW}occupied${NC}" || echo -e "${GREEN}free${NC}")"
echo "  Port 443:            $(ss -ltnp 2>/dev/null | grep -q ':443 ' && echo -e "${YELLOW}occupied${NC}" || echo -e "${GREEN}free${NC}")"
echo "  Caddy:               $(command -v caddy >/dev/null 2>&1 && echo -e "${GREEN}installed${NC}" || echo -e "${YELLOW}not installed${NC}")"
echo "  Nginx:               $(command -v nginx >/dev/null 2>&1 && echo -e "${GREEN}installed${NC}" || echo -e "${YELLOW}not installed${NC}")"
if [[ -n "$DOMAIN" ]]; then
    echo "  Domain:              $DOMAIN -> $RESOLVED_IP"
    echo "  HTTPS:               $HTTPS_STATUS"
fi
echo ""
info "下一步："
echo "  1. 准备域名（如已有，跳过）"
echo "  2. 开放腾讯云安全组 TCP 80/443"
echo "  3. 安装 Caddy: curl https://getcaddy.com | bash"
echo "  4. 配置 Caddyfile: cp deploy/Caddyfile.safe-preview.example Caddyfile"
echo "  5. 修改 Caddyfile 中的 music.yourdomain.com"
echo "  6. 运行: caddy run --config Caddyfile"
echo "============================================"
