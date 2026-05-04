#!/bin/bash
# setup-tunnel.sh — Set up Hermes Workspace Cloudflare Tunnel
# Run as: sudo ./setup-tunnel.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TUNNEL_NAME="hermes-workspace"
TUNNEL_ID="73d6f47a-3383-4f06-a923-dddfc5a99d7d"
DOMAIN="taskwizer.com"
SUBDOMAIN="agents"
TARGET_HOST="127.0.0.1"
TARGET_PORT="8080"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; }

# --- Check deps ---
for cmd in cloudflared caddy; do
    if ! command -v $cmd &>/dev/null; then
        err "$cmd not found. Install first."
        exit 1
    fi
done

# --- Create cloudflared config for this tunnel ---
log "Creating tunnel config at ~/.cloudflared/config.yml..."

mkdir -p ~/.cloudflared

cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: TUNNEL_ID
credentials-file: /home/debian/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: SUBDOMAIN.DOMAIN
    service: http://localhost:TARGET_PORT
    originRequest:
      noTLSVerify: true
  - service: http_status:404
EOF

sed -i "s/TUNNEL_ID/$TUNNEL_ID/g; s/SUBDOMAIN/$SUBDOMAIN/g; s/DOMAIN/$DOMAIN/g; s/TARGET_PORT/$TARGET_PORT/g" ~/.cloudflared/config.yml

# --- Install systemd service ---
log "Installing cloudflared systemd service..."
if [ -f /etc/systemd/system/cloudflared.service ]; then
    warn "cloudflared.service already exists, skipping"
else
    cat > /etc/systemd/system/cloudflared.service << 'EOF'
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared --no-autoupdate --config /etc/cloudflared/config.yml tunnel run
Restart=on-failure
RestartSec=5s
User=debian

[Install]
WantedBy=multi-user.target
EOF
fi

systemctl daemon-reload
systemctl enable cloudflared 2>/dev/null || warn "Could not enable cloudflared service"
systemctl restart cloudflared || warn "Could not restart cloudflared service"

# --- Create DNS record via Cloudflare API ---
log "Attempting to create DNS CNAME record..."

# Get API token from env or prompt
CF_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
if [ -z "$CF_TOKEN" ]; then
    warn "CLOUDFLARE_API_TOKEN not set. Skipping DNS record creation."
    warn "Create manually: CNAME $SUBDOMAIN → ${TUNNEL_ID}.cfargotunnel.com (proxied)"
else
    # Get zone ID for the domain
    ZONE_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" \
        -H "Authorization: Bearer $CF_TOKEN" \
        -H "Content-Type: application/json")
    
    ZONE_ID=$(echo "$ZONE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id'] if d.get('result') and d['result'] else '')")
    
    if [ -z "$ZONE_ID" ]; then
        warn "Could not find zone ID for $DOMAIN. Skipping DNS."
    else
        # Check if record already exists
        EXISTING=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=CNAME&name=$SUBDOMAIN.$DOMAIN" \
            -H "Authorization: Bearer $CF_TOKEN")
        
        if echo "$EXISTING" | python3 -q -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('result') else 1)"; then
            log "DNS record already exists for $SUBDOMAIN.$DOMAIN"
        else
            RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
                -H "Authorization: Bearer $CF_TOKEN" \
                -H "Content-Type: application/json" \
                -d "{\"type\":\"CNAME\",\"name\":\"$SUBDOMAIN\",\"content\":\"${TUNNEL_ID}.cfargotunnel.com\",\"proxied\":true,\"ttl\":1}")
            
            if echo "$RESPONSE" | python3 -q -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') else 1)"; then
                log "DNS record created for $SUBDOMAIN.$DOMAIN"
            else
                warn "Failed to create DNS record. Create manually: CNAME $SUBDOMAIN → ${TUNNEL_ID}.cfargotunnel.com"
            fi
        fi
    fi
fi

# --- Deploy Caddyfile ---
log "Deploying Caddyfile..."
mkdir -p ~/.config/caddy
cp "$SCRIPT_DIR/caddy/Caddyfile" ~/.config/caddy/Caddyfile
mkdir -p ~/.local/share/caddy

# Adapt and reload
caddy adapt --config ~/.config/caddy/Caddyfile --adapter caddyfile > /tmp/caddy-new.json 2>/dev/null \
    && curl -s -X POST http://127.0.0.1:2019/load -H "Content-Type: application/json" -d @/tmp/caddy-new.json \
    && log "Caddy config loaded" \
    || warn "Caddy reload failed — check config"

log "Done. Run ./verify-tunnel.sh to confirm."
