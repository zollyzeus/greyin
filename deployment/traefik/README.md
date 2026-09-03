# Traefik Setup for Greyin Platform

## Quick Start

```bash
cd /media/anand/WD\ BLACK/projects2/greyin/deployment/traefik
chmod +x deploy.sh
./deploy.sh
```

## What This Does

- **Automatic HTTPS**: Let's Encrypt certificates for all domains
- **HTTP → HTTPS redirect**: All HTTP traffic redirected to HTTPS
- **Docker integration**: Automatically discovers containers with Traefik labels
- **Certificate storage**: `/letsencrypt/acme.json` (backed up automatically)

## Configuration

### traefik.yml
- Static configuration for Traefik
- Defines entrypoints (ports 80, 443)
- Configures Let's Encrypt with HTTP challenge
- Email: admin@greyin.net

### docker-compose.yml
- Traefik container definition
- Exposes ports 80 (HTTP), 443 (HTTPS), 8080 (dashboard)
- Mounts Docker socket for service discovery
- Connected to `traefik_proxy` network

## Domains Configured

After Traefik is running, these will get automatic SSL:
- https://greyin.net (Odoo main portal)
- https://greymatters.greyin.net (Odoo blog)
- https://flexpro.greyin.net (freelance marketplace)
- https://saltnpepper.greyin.net (Discourse community)

## Troubleshooting

### Check Traefik logs
```bash
docker logs traefik -f
```

### Check certificate generation
```bash
cat letsencrypt/acme.json | jq
```

### Verify network
```bash
docker network inspect traefik_proxy
```

### Common Issues

**Certificates not generating:**
- Ensure DNS A records point to your server's public IP
- Ensure ports 80 and 443 are open in firewall
- Check Traefik logs for ACME errors

**Services not accessible:**
- Verify containers are on `traefik_proxy` network
- Check Traefik labels in service docker-compose.yml
- Ensure `traefik.enable=true` is set

## Dashboard Access (Optional)

If you want to access Traefik dashboard:
1. Add DNS A record: `traefik.greyin.net` → your server IP
2. Visit: https://traefik.greyin.net
3. Secure it with authentication (recommended for production)

## Important Files

- `traefik.yml` - Static configuration
- `docker-compose.yml` - Container definition  
- `letsencrypt/acme.json` - Certificate storage (chmod 600!)
- `deploy.sh` - Deployment script
