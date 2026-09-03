#!/bin/bash
# Complete Odoo/Discourse cleanup script
# Run this to remove all traces of the Odoo trial deployment

set -e

echo "=========================================="
echo "Odoo/Discourse Complete Cleanup Script"
echo "=========================================="
echo ""

# 1. Remove Docker Swarm stack if running
echo "1. Removing Greyin stack..."
docker stack rm greyin 2>/dev/null || echo "   No stack to remove"
sleep 10

# 2. Remove any standalone containers
echo ""
echo "2. Removing containers..."
docker ps -a --filter "name=greyin" --filter "name=odoo" --filter "name=discourse" -q | xargs -r docker rm -f 2>/dev/null || echo "   No containers to remove"

# 3. Remove Docker volumes
echo ""
echo "3. Removing volumes..."
docker volume ls --filter "name=greyin" -q | xargs -r docker volume rm 2>/dev/null || echo "   No volumes to remove"

# Specifically try these volumes
docker volume rm greyin_odoo_postgres_data 2>/dev/null || true
docker volume rm greyin_odoo_web_data 2>/dev/null || true
docker volume rm greyin_odoo_addons 2>/dev/null || true
docker volume rm greyin_odoo_filestore 2>/dev/null || true
docker volume rm greyin_discourse_postgres_data 2>/dev/null || true
docker volume rm greyin_discourse_redis_data 2>/dev/null || true
docker volume rm greyin_discourse_shared 2>/dev/null || true
docker volume rm greyin_discourse_logs 2>/dev/null || true

# 4. Remove Docker images
echo ""
echo "4. Removing Docker images..."
docker images --filter "reference=odoo*" -q | xargs -r docker rmi -f 2>/dev/null || echo "   No Odoo images to remove"
docker images --filter "reference=discourse*" -q | xargs -r docker rmi -f 2>/dev/null || echo "   No Discourse images to remove"

# Specifically try these images
docker rmi odoo:18.0 2>/dev/null || true
docker rmi postgres:16-alpine 2>/dev/null || true
docker rmi redis:7-alpine 2>/dev/null || true

# 5. Remove networks
echo ""
echo "5. Removing networks..."
docker network rm greyin_greyin_internal 2>/dev/null || echo "   No internal network to remove"
docker network rm greyin_default 2>/dev/null || echo "   No default network to remove"

# 6. Prune unused Docker resources
echo ""
echo "6. Pruning unused Docker resources..."
docker system prune -f

echo ""
echo "=========================================="
echo "Cleanup Summary"
echo "=========================================="
docker ps -a | grep -E "(greyin|odoo|discourse)" || echo "✓ No containers remaining"
echo ""
docker volume ls | grep greyin || echo "✓ No volumes remaining"
echo ""
docker images | grep -E "(odoo|discourse)" || echo "✓ No images remaining"
echo ""
docker network ls | grep greyin || echo "✓ No networks remaining"

echo ""
echo "=========================================="
echo "Cleanup Complete!"
echo "=========================================="
echo ""
echo "All Odoo/Discourse containers, volumes, images, and networks have been removed."
echo "Configuration files still remain in deployment/ directory."
echo "Run the file deletion script to remove those as well."
