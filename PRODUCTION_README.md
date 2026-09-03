# Greyin Platform - Production Deployment

## Quick Start

```bash
cd /media/anand/WD\ BLACK/projects2/greyin

# Make script executable
chmod +x DEPLOY_NOW.sh

# Run deployment
./DEPLOY_NOW.sh
```

## What This Does

1. ✅ Archives old `deployment-local/` directory
2. ✅ Validates environment configuration
3. ✅ Checks/creates Traefik network
4. ✅ Pulls latest Docker images
5. ✅ Starts all services:
   - PostgreSQL (Odoo)
   - PostgreSQL (Discourse)
   - Redis (Discourse)
   - Odoo
   - Discourse

## Environment Configuration

Pre-configured in `deployment/.env`:
- **Database passwords**: Auto-generated strong passwords
- **Domains**: greyin.net, greymatters.greyin.net, community.greyin.net
- **Traefik network**: traefik_proxy (modify if different)
- **Admin email**: admin@greyin.net (update if needed)

## Before Deployment

### 1. Verify Traefik is Running

```bash
docker ps | grep traefik
docker network ls | grep traefik
```

### 2. Configure DNS

Point these A records to your server IP:
```
greyin.net              → YOUR_SERVER_IP
greymatters.greyin.net  → YOUR_SERVER_IP
freeagent.greyin.net    → YOUR_SERVER_IP
saltnpepper.greyin.net  → YOUR_SERVER_IP
```

### 3. (Optional) Update .env

```bash
nano deployment/.env
```

Update if needed:
- `ADMIN_EMAIL` (default: admin@greyin.net)
- `ADMIN_PASSWORD` (for initial Odoo setup)
- `TRAEFIK_NETWORK` (if different from traefik_proxy)
- `SMTP_*` variables (pre-configured for Hostinger: smtp.hostinger.com)

## After Deployment

### Monitor Startup

```bash
cd deployment
docker compose logs -f
```

### Initial Setup

**Odoo (https://greyin.net):**
1. Create database named `greyin`
2. Set admin credentials
3. Install modules:
   - Website
   - Blog
   - HR Recruitment
   - CRM
   - Portal

**Discourse (https://saltnpepper.greyin.net):**
1. Create admin account
2. Set site name: "Salt & Pepper Lounge"
3. Configure as private community
4. (Later) Enable SSO with Odoo

## Troubleshooting

### Services not accessible

**Check Traefik routes:**
```bash
docker logs <traefik-container> | grep greyin
```

**Check container status:**
```bash
cd deployment
docker compose ps
```

**View service logs:**
```bash
docker compose logs odoo
docker compose logs discourse
```

### Traefik network issues

**List networks:**
```bash
docker network ls
```

**Inspect Traefik network:**
```bash
docker network inspect traefik_proxy
# Should show greyin_odoo and discourse containers
```

**Update .env if network name is different:**
```bash
nano deployment/.env
# Change TRAEFIK_NETWORK=your_network_name
docker compose down
docker compose up -d
```

### SSL certificates not working

1. Check DNS propagation: `dig greyin.net`
2. Verify Traefik has Let's Encrypt configured
3. Check Traefik logs: `docker logs <traefik-container>`
4. Wait 2-5 minutes for certificate issuance

## Management Commands

### View all logs
```bash
cd deployment
docker compose logs -f
```

### Restart a service
```bash
docker compose restart odoo
docker compose restart discourse
```

### Stop all services
```bash
docker compose down
```

### Stop and remove data (⚠️ destructive)
```bash
docker compose down -v
```

### Backup databases
```bash
# Odoo
docker exec greyin_postgres pg_dump -U odoo postgres > backups/odoo_$(date +%Y%m%d).sql

# Discourse
docker exec discourse_postgres pg_dump -U discourse discourse > backups/discourse_$(date +%Y%m%d).sql
```

## Architecture

```
Internet → Traefik (ports 80/443) → Services

Traefik Routes:
├─ greyin.net                  → odoo:8069
├─ greymatters.greyin.net      → odoo:8069
├─ freeagent.greyin.net        → odoo:8069
├─ */longpolling               → odoo:8072
└─ saltnpepper.greyin.net      → discourse:80

Backend (internal network):
├─ odoo_db (PostgreSQL)
├─ discourse_db (PostgreSQL)
└─ discourse_redis (Redis)
```

## Documentation

- [TRAEFIK_DEPLOYMENT.md](deployment/TRAEFIK_DEPLOYMENT.md) - Complete deployment guide
- [TRAEFIK_MIGRATION.md](deployment/TRAEFIK_MIGRATION.md) - Changes from Nginx to Traefik
- [PLATFORM_RECOMMENDATIONS.md](PLATFORM_RECOMMENDATIONS.md) - Platform architecture
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) - 8-phase rollout plan

## Next Steps

1. ✅ Complete initial Odoo setup
2. ✅ Complete initial Discourse setup
3. 📝 Create first blog post on GreyMatters
4. 👥 Configure user roles (Candidates, Employers, Community Members)
5. 🔗 Set up SSO between Odoo ↔ Discourse
6. 🎨 Customize branding and themes
7. 📊 Add sample job postings
8. 🚀 Invite beta users

## Support

- **Odoo**: https://www.odoo.com/documentation/18.0/
- **Discourse**: https://meta.discourse.org/
- **Traefik**: https://doc.traefik.io/traefik/
