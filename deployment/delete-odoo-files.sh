#!/bin/bash
# Delete all Odoo-related files from deployment directory
# Run this AFTER cleanup-odoo.sh to remove configuration files

set -e

DEPLOY_DIR="/media/anand/WD BLACK/projects2/greyin/deployment"

echo "=========================================="
echo "Odoo File Deletion Script"
echo "=========================================="
echo ""
echo "Deleting files from: $DEPLOY_DIR"
echo ""

cd "$DEPLOY_DIR"

# Delete Odoo configuration files
echo "Deleting configuration files..."
rm -fv odoo.conf
rm -fv nginx.conf
rm -rfv config/odoo.conf
rm -rfv addons

# Delete Docker Compose files
echo ""
echo "Deleting Docker Compose files..."
rm -fv docker-compose.yml
rm -fv docker-compose.yml.corrupted
rm -fv greyin-stack.yml
rm -fv deploy-swarm.sh

# Delete Odoo-specific documentation
echo ""
echo "Deleting Odoo deployment documentation..."
rm -fv TRAEFIK_DEPLOYMENT.md
rm -fv TRAEFIK_MIGRATION.md

echo ""
echo "=========================================="
echo "Remaining files in deployment/:"
echo "=========================================="
ls -la

echo ""
echo "=========================================="
echo "File Deletion Complete!"
echo "=========================================="
echo ""
echo "The following files should remain:"
echo "  - .env (environment variables - will be reused)"
echo "  - .env.example (template)"
echo "  - cleanup-odoo.sh (this cleanup script)"
echo "  - delete-odoo-files.sh (this script)"
echo "  - README.md / QUICKSTART.md (if needed)"
echo ""
echo "All Odoo deployment files have been removed."
echo "You can now proceed with a new platform setup."
