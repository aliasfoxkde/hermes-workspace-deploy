# Hermes Workspace — Cloudflare Tunnel Deployment

## Overview

```
Internet → Cloudflare CDN/Tunnel → :8080 (Caddy HTTP)
                                         ↓
                                    localhost:3001 (React PWA)
                                    localhost:8642 (Hermes Gateway)
```

## Components

| File | Purpose |
|------|---------|
| `caddy/Caddyfile` | Reverse proxy config (HTTP :8080, HTTPS :8443) |
| `cloudflared/config.yml` | System-wide cloudflared tunnel ingress |
| `cloudflared/tunnel-hermes-workspace-config.yml` | Per-tunnel config for hermes-workspace |
| `cloudflared/hermes-workspace-credentials.json` | Tunnel credentials (UUID-based) |
| `systemd/cloudflared.service` | Systemd unit for cloudflared |
| `setup-tunnel.sh` | One-shot setup script |
| `verify-tunnel.sh` | Verification script |

## Prerequisites

- Cloudflared installed (`cloudflared version` → confirm)
- Caddy installed (`caddy version` → confirm)
- Domain DNS managed by Cloudflare
- Cloudflare API token with `zone:edit` permission

## Quick Setup

```bash
# 1. Install cloudflared (if needed)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# 2. Install Caddy (if needed)
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy

# 3. Run setup
chmod +x setup-tunnel.sh
./setup-tunnel.sh

# 4. Verify
./verify-tunnel.sh
```

## DNS Setup

The setup script will attempt to create the DNS CNAME record automatically.
If it fails, create manually in Cloudflare dashboard:

| Field | Value |
|-------|-------|
| Type | `CNAME` |
| Name | `agents` |
| Target | `<tunnel-id>.cfargotunnel.com` |
| Proxy status | Proxied (orange cloud) |

Get tunnel ID from: `cloudflared tunnel list`

## Architecture Notes

- Cloudflare Tunnel provides HTTPS — Caddy receives plain HTTP on :8080
- Caddy does NOT request its own TLS cert for `agents.taskwizer.com`
- `hermes-workspace.com` block on :8443 is for direct HTTPS (not used via tunnel)
- API routes `/v1/*` get Bearer token injected by Caddy before proxying to Gateway
- SPA routes (all other paths) proxy directly to the React PWA on :3001
- PWA runs on Vite dev server at localhost:3001

## Mobile Access

PWA is served at `https://agents.taskwizer.com`. Add to home screen on mobile for app-like experience. Service worker registered for offline support.
