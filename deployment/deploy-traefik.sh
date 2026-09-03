#!/bin/bash
# Greyin Platform - Production Deployment with Traefik
# Quick deployment script for existing Traefik setup

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "Greyin Platform - Production Deployment"
echo "Using Existing Traefik Proxy"
echo "========================================="
echo ""

# Check Docker Compose
if docker compose version &> /dev/null; then
    DC="docker compose"
elif command -v docker-compose &> /dev/null; then
    DC="docker-compose"
else
    echo -e "${RED}❌ Docker Compose not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose found${NC}"

# Check .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Creating .env from template${NC}"
    cp .env.example .env
    echo ""
    echo -e "${RED}🔴 IMPORTANT: Edit .env before proceeding!${NC}"
    echo ""
    echo "Required variables:"
    echo "  ODOO_DB_PASSWORD=<strong password>"
    echo "  DISCOURSE_DB_PASSWORD=<strong password>"
    echo "  MAIN_DOMAIN=greyin.net"
    echo "  BLOG_DOMAIN=greymatters.greyin.net"
    echo "  FLEXPRO_DOMAIN=flexpro.greyin.net"
    echo "  COMMUNITY_DOMAIN=saltnpepper.greyin.net"
    echo "  TRAEFIK_NETWORK=traefik_proxy"
    echo ""
    echo "Generate passwords: openssl rand -base64 32"
    echo ""
    exit 1
fi
echo -e "${GREEN}✅ .env file found${NC}"

# Source .env
source .env

# Validate
if [ "$ODOO_DB_PASSWORD" == "CHANGE_THIS_STRONG_PASSWORD_123456789" ]; then
    echo -e "${RED}❌ Please change ODOO_DB_PASSWORD in .env${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Configuration validated${NC}"

# Check Traefik network
TRAEFIK_NET="${TRAEFIK_NETWORK:-traefik_proxy}"
if ! docker network inspect "$TRAEFIK_NET" &> /dev/null; then
    echo -e "${YELLOW}⚠️  Creating Traefik network${NC}"
    docker network create "$TRAEFIK_NET"
fi
echo -e "${GREEN}✅ Traefik network ready${NC}"

# Create directories
mkdir -p config addons backups
echo -e "${GREEN}✅ Directories created${NC}"

# Deploy
echo ""
echo "Deploying services..."
$DC pull
$DC up -d

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Access points:"
echo "  https://$MAIN_DOMAIN"
echo "  https://$BLOG_DOMAIN"
echo "  https://$COMMUNITY_DOMAIN"
echo ""
echo "Monitor logs: $DC logs -f"
echo ""
echo "Startup times:"
echo "  Odoo:      ~60 seconds"
echo "  Discourse: ~2-3 minutes"
echo ""
