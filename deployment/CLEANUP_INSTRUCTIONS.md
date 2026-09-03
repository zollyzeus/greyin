# Complete Odoo/Discourse Cleanup Instructions

## Overview
This guide will help you completely remove all traces of the Odoo trial deployment, including:
- Docker containers and services
- Docker volumes (data)
- Docker images
- Docker networks
- Configuration files
- Deployment files
- Archived files

## Step 1: Run Docker Cleanup Script

This removes all Docker resources (containers, volumes, images, networks):

```bash
cd "/media/anand/WD BLACK/projects2/greyin/deployment"
chmod +x cleanup-odoo.sh
./cleanup-odoo.sh
```

**What it removes:**
- ✓ Greyin Docker Swarm stack
- ✓ All Odoo and Discourse containers
- ✓ All volumes (greyin_odoo_*, greyin_discourse_*)
- ✓ Docker images (odoo:18.0, postgres:16-alpine, redis:7-alpine, discourse)
- ✓ Internal networks (greyin_greyin_internal)

## Step 2: Run File Deletion Script

This removes all configuration and deployment files:

```bash
cd "/media/anand/WD BLACK/projects2/greyin/deployment"
chmod +x delete-odoo-files.sh
./delete-odoo-files.sh
```

**What it removes:**
- ✓ odoo.conf (Odoo configuration)
- ✓ nginx.conf (nginx configuration)
- ✓ docker-compose.yml (Odoo stack definition)
- ✓ docker-compose.yml.corrupted (corrupted version)
- ✓ greyin-stack.yml (Swarm stack definition)
- ✓ deploy-swarm.sh (deployment script)
- ✓ config/odoo.conf/ (Odoo config directory)
- ✓ addons/ (empty Odoo addons directory)
- ✓ TRAEFIK_DEPLOYMENT.md, TRAEFIK_MIGRATION.md (Odoo docs)

**What it keeps:**
- ✓ .env (will be reused for new platform)
- ✓ .env.example (template)
- ✓ cleanup scripts (for reference)

## Step 3: Remove Archived Deployment (Optional)

Remove the old local deployment archive:

```bash
cd "/media/anand/WD BLACK/projects2/greyin"
rm -rf deployment-local-archived-20260805/
```

## Step 4: Clean Up Documentation (Optional)

If you want to remove Odoo-specific documentation:

```bash
cd "/media/anand/WD BLACK/projects2/greyin"
rm -f PLATFORM_COMPARISON_ODOO_VS_DIRECTUS_VS_POCKETBASE.md
rm -f DEPLOY_NOW.sh
rm -f IMPLEMENTATION_PLAN.md
```

**Note:** Keep these if you want to reference the platform comparison later.

## Step 5: Verify Cleanup

Run these commands to verify everything is removed:

```bash
# Check for containers
docker ps -a | grep -E "(greyin|odoo|discourse)"
# Should return nothing

# Check for volumes
docker volume ls | grep greyin
# Should return nothing

# Check for images
docker images | grep -E "(odoo|discourse)"
# Should return nothing

# Check for networks
docker network ls | grep greyin
# Should return nothing (except edjitsu-prod_edjitsu-network which should remain)

# Check for files
ls -la "/media/anand/WD BLACK/projects2/greyin/deployment/"
# Should only show .env, cleanup scripts, and READMEs
```

## What Remains After Cleanup

After complete cleanup, you'll have:

1. **Clean Docker environment** - No Odoo/Discourse containers, volumes, or images
2. **Reusable configuration** - .env file with your domains, SMTP, passwords (reuse for new platform)
3. **Existing infrastructure** - Traefik still running on edjitsu-prod network
4. **DNS records** - Still configured on Hostinger (ready to use)
5. **Clean deployment folder** - Ready for new platform setup

## Ready for New Platform

Your system is now clean and ready for whichever platform you choose:
- Supabase
- Strapi
- WordPress
- NocoDB
- Payload CMS
- Or any other alternative

The .env file contains all your configuration (domains, SMTP, passwords) that can be reused for the new platform.

---

## Quick Cleanup (One Command)

If you want to run everything at once:

```bash
cd "/media/anand/WD BLACK/projects2/greyin/deployment" && \
chmod +x cleanup-odoo.sh delete-odoo-files.sh && \
./cleanup-odoo.sh && \
./delete-odoo-files.sh && \
cd .. && \
rm -rf deployment-local-archived-20260805/ && \
echo "Cleanup complete!"
```

---

## Troubleshooting

### "Volume is in use" error
If volumes won't delete:
```bash
docker stack rm greyin
sleep 30  # Wait longer for stack to fully stop
docker volume rm greyin_odoo_postgres_data  # Try again
```

### "Network has active endpoints" error
If network won't delete:
```bash
docker ps -a | grep greyin  # Find any remaining containers
docker rm -f <container_id>  # Force remove them
docker network rm greyin_greyin_internal  # Try again
```

### Permission denied on file deletion
```bash
sudo rm -rf "/media/anand/WD BLACK/projects2/greyin/deployment/config"
```
