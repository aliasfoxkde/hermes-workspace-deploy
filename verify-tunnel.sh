#!/bin/bash
# verify-tunnel.sh — Verify Hermes Workspace tunnel setup

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ERRORS=0

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; ((ERRORS++)); }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

echo "=== Hermes Workspace Tunnel Verification ==="
echo ""

# 1. Cloudflared process
info "Cloudflared process..."
if pgrep -a cloudflared &>/dev/null; then
    pass "cloudflared is running"
else
    fail "cloudflared is NOT running"
fi

# 2. Cloudflared tunnel connections
info "Tunnel connections..."
CONNECTIONS=$(cloudflared tunnel list 2>/dev/null | grep hermes-workspace | awk '{print $NF}')
if [ -n "$CONNECTIONS" ]; then
    pass "Tunnel has connections: $CONNECTIONS"
else
    fail "Tunnel has NO active connections"
fi

# 3. Caddy ports
info "Caddy listening ports..."
if ss -tlnp | grep -q ':8080'; then
    pass ":8080 (Cloudflare Tunnel entry) is listening"
else
    fail ":8080 is NOT listening"
fi

if ss -tlnp | grep -q ':8443'; then
    pass ":8443 (Direct HTTPS) is listening"
else
    info ":8443 is NOT listening (may be expected)"
fi

# 4. Backend services
info "Backend services..."
for SERVICE in "3001 (PWA)" "8642 (Gateway)"; do
    PORT=$(echo $SERVICE | cut -d: -f1)
    NAME=$(echo $SERVICE | cut -d: -f2)
    if ss -tlnp | grep -q ":$PORT "; then
        pass "$NAME is listening on :$PORT"
    else
        fail "$NAME is NOT listening on :$PORT"
    fi
done

# 5. DNS resolution
info "DNS resolution..."
if command -v dig &>/dev/null; then
    DNS_RESULT=$(dig +short agents.taskwizer.com 2>/dev/null | head -1)
    if [ -n "$DNS_RESULT" ]; then
        pass "agents.taskwizer.com → $DNS_RESULT"
    else
        fail "agents.taskwizer.com does not resolve"
    fi
else
    info "dig not available, skipping DNS check"
fi

# 6. HTTP health check via tunnel
info "Health check via Cloudflare Tunnel..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://127.0.0.1:8080/.well-known/health-check 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    pass "Health check returns 200 on :8080"
else
    fail "Health check on :8080 returned $HTTP_CODE"
fi

# 7. HTTPS health check via public URL
info "Health check via public URL (if DNS is set)..."
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 https://agents.taskwizer.com/.well-known/health-check 2>/dev/null)
if [ "$HTTPS_CODE" = "200" ]; then
    pass "https://agents.taskwizer.com returns $HTTPS_CODE"
else
    info "https://agents.taskwizer.com returned $HTTPS_CODE (DNS may not be propagated yet)"
fi

# 8. TLS certificate check
info "TLS certificate (if accessible)..."
TLS_RESULT=$(curl -s --max-time 10 https://agents.taskwizer.com 2>&1 | head -1)
if [ -n "$TLS_RESULT" ]; then
    pass "TLS connection works: $TLS_RESULT"
else
    info "TLS connection failed (DNS or tunnel issue)"
fi

# 9. Caddy config has agents.taskwizer.com
info "Caddy config..."
if curl -s http://127.0.0.1:2019/config/ 2>/dev/null | grep -q "agents.taskwizer.com"; then
    pass "Caddy config includes agents.taskwizer.com"
else
    fail "Caddy config missing agents.taskwizer.com"
fi

# 10. API token injection check
info "API route config..."
if curl -s http://127.0.0.1:2019/config/ 2>/dev/null | grep -q "da949d70d18280da2d703a02fba6e7f4b8c0b5d9d9e6331120412e38ec209e75"; then
    pass "API Bearer token is configured"
else
    fail "API Bearer token NOT found in config"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}$ERRORS check(s) failed.${NC}"
    exit 1
fi
