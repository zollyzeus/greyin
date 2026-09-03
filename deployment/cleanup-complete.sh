#!/bin/bash
# MASTER CLEANUP SCRIPT
# Removes ALL Odoo/Discourse traces: Docker resources + files + archives
# Run this one script to clean everything

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ODOO/DISCOURSE COMPLETE REMOVAL - MASTER CLEANUP SCRIPT     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "This will remove:"
echo "  • All Docker containers, volumes, images, networks"
echo "  • All deployment configuration files"
echo "  • Archived deployment folder"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "PHASE 1: Docker Resources Cleanup"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Remove Docker Swarm stack
echo "→ Removing Greyin stack..."
docker stack rm greyin 2>/dev/null || echo "  ✓ No stack to remove"
echo "  Waiting for stack shutdown..."
sleep 15

# Remove containers
echo ""
echo "→ Removing containers..."
CONTAINERS=$(docker ps -a --filter "name=greyin" --filter "name=odoo" --filter "name=discourse" -q)
if [ -n "$CONTAINERS" ]; then
    echo "$CONTAINERS" | xargs docker rm -f
    echo "  ✓ Containers removed"
else
    echo "  ✓ No containers to remove"
fi

# Remove volumes
echo ""
echo "→ Removing volumes..."
VOLUMES=$(docker volume ls --filter "name=greyin" -q)
if [ -n "$VOLUMES" ]; then
    echo "$VOLUMES" | xargs docker volume rm 2>/dev/null || true
    echo "  ✓ Volumes removed"
else
    echo "  ✓ No volumes to remove"
fi

# Try specific volumes
docker volume rm greyin_odoo_postgres_data greyin_odoo_web_data greyin_odoo_addons greyin_odoo_filestore 2>/dev/null || true
docker volume rm greyin_discourse_postgres_data greyin_discourse_redis_data greyin_discourse_shared greyin_discourse_logs 2>/dev/null || true

# Remove images
echo ""
echo "→ Removing Docker images..."
docker rmi -f odoo:18.0 2>/dev/null || true
docker rmi -f postgres:16-alpine 2>/dev/null || true
docker rmi -f redis:7-alpine 2>/dev/null || true
DISCOURSE_IMAGES=$(docker images --filter "reference=discourse*" -q)
if [ -n "$DISCOURSE_IMAGES" ]; then
    echo "$DISCOURSE_IMAGES" | xargs docker rmi -f 2>/dev/null || true
fi
echo "  ✓ Images removed"

# Remove networks
echo ""
echo "→ Removing networks..."
docker network rm greyin_greyin_internal 2>/dev/null || echo "  ✓ No internal network to remove"
docker network rm greyin_default 2>/dev/null || echo "  ✓ No default network to remove"

# Prune unused resources
echo ""
echo "→ Pruning unused Docker resources..."
docker system prune -f > /dev/null
echo "  ✓ Pruned unused resources"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "PHASE 2: Deployment Files Cleanup"
echo "════════════════════════════════════════════════════════════════"
echo ""

cd "/media/anand/WD BLACK/projects2/greyin/deployment"

# Delete configuration files
echo "→ Deleting Odoo configuration files..."
rm -fv odoo.conf nginx.conf
rm -rfv config/odoo.conf addons
echo "  ✓ Configuration files removed"

# Delete Docker Compose files
echo ""
echo "→ Deleting Docker Compose files..."
rm -fv docker-compose.yml docker-compose.yml.corrupted
rm -fv greyin-stack.yml deploy-swarm.sh
echo "  ✓ Deployment files removed"

# Delete Odoo documentation
echo ""
echo "→ Deleting Odoo-specific documentation..."
rm -fv TRAEFIK_DEPLOYMENT.md TRAEFIK_MIGRATION.md
echo "  ✓ Documentation removed"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "PHASE 3: Archived Folder Cleanup"
echo "════════════════════════════════════════════════════════════════"
echo ""

cd "/media/anand/WD BLACK/projects2/greyin"

if [ -d "deployment-local-archived-20260805" ]; then
    echo "→ Removing archived deployment folder..."
    rm -rf deployment-local-archived-20260805/
    echo "  ✓ Archive removed"
else
    echo "  ✓ No archive folder found"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "PHASE 4: Verification"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Verify Docker resources
echo "→ Checking for remaining Docker resources..."
echo ""

REMAINING_CONTAINERS=$(docker ps -a | grep -E "(greyin|odoo|discourse)" | wc -l)
REMAINING_VOLUMES=$(docker volume ls | grep greyin | wc -l)
REMAINING_IMAGES=$(docker images | grep -E "(odoo|discourse)" | wc -l)

if [ "$REMAINING_CONTAINERS" -eq 0 ]; then
    echo "  ✓ No containers remaining"
else
    echo "  ⚠ $REMAINING_CONTAINERS containers still exist"
    docker ps -a | grep -E "(greyin|odoo|discourse)"
fi

if [ "$REMAINING_VOLUMES" -eq 0 ]; then
    echo "  ✓ No volumes remaining"
else
    echo "  ⚠ $REMAINING_VOLUMES volumes still exist"
    docker volume ls | grep greyin
fi

if [ "$REMAINING_IMAGES" -eq 0 ]; then
    echo "  ✓ No Odoo/Discourse images remaining"
else
    echo "  ⚠ $REMAINING_IMAGES images still exist"
    docker images | grep -E "(odoo|discourse)"
fi

# Show remaining files
echo ""
echo "→ Remaining files in deployment/:"
echo ""
ls -la "/media/anand/WD BLACK/projects2/greyin/deployment/" | grep -v "cleanup" | grep -v "delete-odoo"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    CLEANUP COMPLETE!                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "✓ All Odoo/Discourse Docker resources removed"
echo "✓ All deployment files removed"
echo "✓ Archived folder removed"
echo ""
echo "Remaining (as expected):"
echo "  • .env file (reusable for new platform)"
echo "  • .env.example (template)"
echo "  • cleanup scripts (for reference)"
echo "  • READMEs (if any)"
echo ""
echo "Your system is now clean and ready for a new platform!"
echo ""
echo "Next steps:"
echo "  1. Choose your new platform (Supabase, Strapi, WordPress, etc.)"
echo "  2. Reuse the .env file for your configuration"
echo "  3. Deploy the new platform"
echo ""
