# Hermes Workspace — Cloudflare Tunnel Deployment

## Architecture

```
Internet → Cloudflare CDN → cloudflared Tunnel → :8080 (Caddy HTTP)
                                                         ↓
                                                   localhost:3001 (React PWA)
                                                   localhost:8642 (Hermes Gateway)
```

## Components

| File | Purpose |
|------|---------|
| `caddy/Caddyfile` | Reverse proxy (HTTP :8080, HTTPS :8443) |
| `cloudflared/tunnel-hermes-workspace-config.yml` | Tunnel ingress config |
| `cloudflared/hermes-workspace-credentials.json.template` | Credentials template |
| `systemd/cloudflared-hermes-workspace.service` | Systemd unit |
| `setup-tunnel.sh` | One-shot setup script |
| `verify-tunnel.sh` | Verification script |

## Tunnel Info

- **Tunnel ID:** `73d6f47a-3383-4f06-a923-dddfc5a99d7d`
- **Connections:** Active (multiple CF edge nodes)

## DNS Setup (REQUIRED — one manual step)

The API token available does NOT have `zone:edit` permission.
**You must create these DNS records manually in the Cloudflare dashboard:**

### For agents.taskwizer.com
1. Go to: https://dash.cloudflare.com/090bd34c136b3bb8c23e860746cd5d17/dns/records
2. Add record:
   - **Type:** CNAME
   - **Name:** agents
   - **Target:** `73d6f47a-3383-4f06-a923-dddfc5a99d7d.cfargotunnel.com`
   - **Proxy status:** Proxied (orange cloud)

### For access.cyopsys.com
1. Go to: https://dash.cloudflare.com/bb97b14529bb02514852f3a7c1bbbb14/dns/records
2. Add record:
   - **Type:** CNAME
   - **Name:** access
   - **Target:** `73d6f47a-3383-4f06-a923-dddfc5a99d7d.cfargotunnel.com`
   - **Proxy status:** Proxied (orange cloud)

## Server Status

```
✓ hermes-workspace tunnel: ACTIVE (connections: iad03, iad05, iad09, iad12, iad16)
✓ Caddy :8080: listening (Cloudflare Tunnel entry)
✓ Caddy :8443: listening (Direct HTTPS)
✓ Backend localhost:3001: PWA responds 200
✓ Backend localhost:8642: Gateway API responds 200
✓ API Bearer token injection: configured
```

## Cloudflare API Token Note

The token `<REDACTED>` has:
- `zone:read` ✓
- `zone:edit` ✗ (missing — cannot create DNS records via API)

To enable API DNS management, create a new token at:
https://dash.cloudflare.com/profile/api-tokens
with **Zone → DNS → Edit** permission for the relevant zones.

## Access URLs

- **PWA:** https://agents.taskwizer.com
- **Alt:** https://access.cyopsys.com
