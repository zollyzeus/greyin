#!/bin/bash
# Greyin Platform - Production Deployment
# Quick deployment script

set -e

echo "========================================="
echo "Greyin Platform - Production Deployment"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Navigate to deployment directory
cd "$(dirname "$0")/deployment" || exit 1
echo -e "${GREEN}✅ In deployment directory${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker found${NC}"

# Check Docker Compose
if docker compose version &> /dev/null; then
    DC="docker compose"
elif command -v docker-compose &> /dev/null; then
    DC="docker-compose"
else
    echo -e "${RED}❌ Docker Compose not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose found ($DC)${NC}"

# Archive local deployment if exists
if [ -d "../deployment-local" ]; then
    echo -e "${YELLOW}⚠️  Archiving old local deployment...${NC}"
    mv ../deployment-local ../deployment-local-archived-$(date +%Y%m%d) 2>/dev/null || true
    echo -e "${GREEN}✅ Local deployment archived${NC}"
fi

# Check .env
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Creating from template..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env file first!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ .env file exists${NC}"

# Load environment
source .env

# Check Traefik network
echo ""
echo -e "${BLUE}Checking Traefik network...${NC}"
TRAEFIK_NET="${TRAEFIK_NETWORK:-traefik_proxy}"

if docker network inspect "$TRAEFIK_NET" &> /dev/null; then
    echo -e "${GREEN}✅ Traefik network '$TRAEFIK_NET' exists${NC}"
else
    echo -e "${YELLOW}⚠️  Traefik network '$TRAEFIK_NET' not found${NC}"
    echo "Available networks:"
    docker network ls
    echo ""
    read -p "Create network '$TRAEFIK_NET'? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker network create "$TRAEFIK_NET"
        echo -e "${GREEN}✅ Created network '$TRAEFIK_NET'${NC}"
    else
        echo -e "${RED}❌ Deployment cancelled - please update TRAEFIK_NETWORK in .env${NC}"
        exit 1
    fi
fi

# Create directories
echo ""
echo "Creating required directories..."
mkdir -p config addons backups
echo -e "${GREEN}✅ Directories created${NC}"

# DNS check
echo ""
echo -e "${BLUE}DNS Configuration Check:${NC}"
echo "Please ensure these domains point to your server IP:"
echo "  - $MAIN_DOMAIN"
echo "  - $BLOG_DOMAIN"
echo "  - $FREEAGENT_DOMAIN"
echo "  - $COMMUNITY_DOMAIN (Salt & Pepper Lounge)"
echo ""

# Confirm deployment
echo "========================================="
echo "Ready to deploy:"
echo "  Main Portal:       https://$MAIN_DOMAIN"
echo "  Blog:              https://$BLOG_DOMAIN"
echo "  FreeAgent:         https://$FREEAGENT_DOMAIN"
echo "  Salt & Pepper:     https://$COMMUNITY_DOMAIN"
echo "  Traefik Net:   $TRAEFIK_NET"
echo "========================================="
echo ""
read -p "Proceed with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Pull images
echo ""
echo -e "${BLUE}Pulling Docker images...${NC}"
$DC pull

# Start services
echo ""
echo -e "${BLUE}Starting services...${NC}"
$DC up -d

# Wait for startup
echo ""
echo "Waiting for services to start..."
sleep 5

# Show status
echo ""
echo "========================================="
echo "Service Status:"
echo "========================================="
$DC ps

# Final instructions
echo ""
echo "========================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "========================================="
echo ""
echo "Monitor logs:"
echo "  cd deployment && $DC logs -f"
echo ""
echo "Access points (after DNS propagation):"
echo "  Main Portal:       https://$MAIN_DOMAIN"
echo "  Blog:              https://$BLOG_DOMAIN"
echo "  FreeAgent:         https://$FREEAGENT_DOMAIN"
echo "  Salt & Pepper:     https://$COMMUNITY_DOMAIN"
echo ""
echo "Startup times:"
echo "  Databases:  ~10-15 seconds"
echo "  Odoo:       ~60 seconds (first run: 2-3 minutes)"
echo "  Discourse:  ~2-3 minutes (bootstraps on first run)"
echo ""
echo "Initial Setup:"
echo "  1. Visit https://$MAIN_DOMAIN"
echo "     - Create database 'greyin'"
echo "     - Set admin credentials"
echo "     - Install: Website, Blog, Recruitment, CRM, Portal"
echo ""
echo "  2. Visit https://$COMMUNITY_DOMAIN"
echo "     - Create admin account"
echo "     - Configure as private community"
echo ""
echo -e "${YELLOW}Note: SSL certificates via Traefik may take a few minutes${NC}"
echo ""
