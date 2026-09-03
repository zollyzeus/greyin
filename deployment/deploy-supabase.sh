#!/bin/bash
# ============================================================
# Supabase Deployment Script for Docker Swarm
# ============================================================
# 
# This script deploys self-hosted Supabase to Docker Swarm
# and integrates with existing Traefik reverse proxy.
#
# Prerequisites:
#   - Docker Swarm initialized
#   - Traefik running on edjitsu-prod_edjitsu-network
#   - DNS A records configured for all domains
#   - .env file configured with all required variables
#
# Usage:
#   chmod +x deploy-supabase.sh
#   ./deploy-supabase.sh
#
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================
# Functions
# ============================================================

print_header() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# ============================================================
# Pre-flight Checks
# ============================================================

print_header "Supabase Deployment - Pre-flight Checks"

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_error "Please do not run as root"
    exit 1
fi
print_success "Not running as root"

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi
print_success "Docker is installed"

# Check Swarm
if ! docker info --format '{{.Swarm.LocalNodeState}}' | grep -q "active"; then
    print_error "Docker Swarm is not initialized"
    print_info "Run: docker swarm init"
    exit 1
fi
print_success "Docker Swarm is active"

# Check for .env file
if [ ! -f ".env" ]; then
    print_error ".env file not found"
    print_info "Copy .env.example to .env and configure it"
    exit 1
fi
print_success ".env file found"

# Load environment variables
print_info "Loading environment variables..."
set -a
source .env
set +a
print_success "Environment variables loaded"

# Validate required variables
REQUIRED_VARS=(
    "POSTGRES_PASSWORD"
    "JWT_SECRET"
    "ANON_KEY"
    "SERVICE_ROLE_KEY"
    "API_DOMAIN"
    "STUDIO_DOMAIN"
    "TRAEFIK_NETWORK"
)

for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        print_error "Required variable $VAR is not set in .env"
        exit 1
    fi
done
print_success "All required environment variables are set"

# Check if Traefik network exists
if ! docker network ls --format '{{.Name}}' | grep -q "^${TRAEFIK_NETWORK}$"; then
    print_error "Traefik network '${TRAEFIK_NETWORK}' not found"
    print_info "Available networks:"
    docker network ls --format "  - {{.Name}}"
    exit 1
fi
print_success "Traefik network found: ${TRAEFIK_NETWORK}"

# Check if Kong config exists
if [ ! -f "config/kong.yml" ]; then
    print_error "Kong configuration file not found: config/kong.yml"
    exit 1
fi
print_success "Kong configuration found"

# ============================================================
# Cleanup Old Deployment
# ============================================================

print_header "Cleanup"

# Check if stack already exists
if docker stack ps supabase &> /dev/null; then
    print_warning "Existing Supabase stack found"
    read -p "Do you want to remove it and redeploy? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Removing existing stack..."
        docker stack rm supabase
        print_info "Waiting for services to stop..."
        sleep 20
        print_success "Old stack removed"
    else
        print_error "Deployment cancelled"
        exit 0
    fi
else
    print_info "No existing stack found"
fi

# ============================================================
# Pull Required Docker Images
# ============================================================

print_header "Pulling Docker Images"

# List of required images (matching supabase-stack.yml)
IMAGES=(
    "supabase/postgres:15.1.0.117"
    "kong:2.8.1"
    "postgrest/postgrest:v12.0.1"
    "supabase/gotrue:v2.132.3"
    "supabase/realtime:v2.25.35"
    "supabase/storage-api:v0.43.11"
    "darthsim/imgproxy:v3.8.0"
    "supabase/postgres-meta:v0.68.0"
    "supabase/studio:20240101-5e5586d"
    "supabase/logflare:1.4.0"
)

print_info "Attempting to pull images (will continue if already cached)..."
PULL_FAILED=0

for IMAGE in "${IMAGES[@]}"; do
    print_info "Pulling $IMAGE..."
    if docker pull "$IMAGE" 2>&1 | grep -q "up to date\|Downloaded newer image"; then
        print_success "$IMAGE ready"
    else
        # Check if image exists locally
        if docker image inspect "$IMAGE" &> /dev/null; then
            print_success "$IMAGE already cached locally"
        else
            print_warning "Could not pull $IMAGE (may hit rate limit)"
            PULL_FAILED=1
        fi
    fi
done

if [ $PULL_FAILED -eq 1 ]; then
    print_warning "Some images could not be pulled, but deployment will continue"
    print_info "Docker will attempt to use cached images or pull during service creation"
fi

echo ""
print_success "Image check complete"

# ============================================================
# Deploy Supabase Stack
# ============================================================

print_header "Deploying Supabase Stack"

print_info "Stack file: supabase-stack.yml"
print_info "Network: ${TRAEFIK_NETWORK}"
print_info "API Domain: ${API_DOMAIN}"
print_info "Studio Domain: ${STUDIO_DOMAIN}"

# Deploy the stack
print_info "Deploying services..."
docker stack deploy -c supabase-stack.yml supabase

print_success "Stack deployment command executed"

# ============================================================
# Wait for Services
# ============================================================

print_header "Waiting for Services to Start"

print_info "This may take 2-3 minutes..."
echo ""

# Wait for services to be running
TIMEOUT=180
ELAPSED=0
INTERVAL=5

while [ $ELAPSED -lt $TIMEOUT ]; do
    RUNNING=$(docker stack ps supabase --filter "desired-state=running" --format "{{.Name}}" 2>/dev/null | wc -l)
    TOTAL=$(docker stack ps supabase --format "{{.Name}}" 2>/dev/null | wc -l)
    
    if [ $TOTAL -gt 0 ]; then
        echo -ne "\r  Services: $RUNNING/$TOTAL running   "
        
        # Check if all services are running
        if [ $RUNNING -eq $TOTAL ]; then
            echo ""
            print_success "All services are running!"
            break
        fi
    fi
    
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo ""
    print_warning "Timeout waiting for services"
    print_info "Services may still be starting. Check with: docker stack ps supabase"
fi

# ============================================================
# Service Status
# ============================================================

print_header "Service Status"

docker stack ps supabase --format "table {{.Name}}\t{{.CurrentState}}\t{{.Error}}"

# ============================================================
# Health Checks
# ============================================================

print_header "Health Checks"

sleep 10

# Check database
print_info "Checking PostgreSQL..."
if docker exec $(docker ps -q -f name=supabase_supabase_db) pg_isready -U postgres &> /dev/null; then
    print_success "PostgreSQL is healthy"
else
    print_warning "PostgreSQL health check failed (may still be starting)"
fi

# ============================================================
# Access Information
# ============================================================

print_header "Deployment Complete!"

echo ""
echo -e "${GREEN}Supabase is now deployed!${NC}"
echo ""
echo "Access your services:"
echo ""
echo -e "  ${BLUE}API Endpoint:${NC}     https://${API_DOMAIN}"
echo -e "  ${BLUE}Studio (Admin UI):${NC} https://${STUDIO_DOMAIN}"
echo ""
echo "API Keys (add to your frontend):"
echo ""
echo -e "  ${BLUE}SUPABASE_URL:${NC}      https://${API_DOMAIN}"
echo -e "  ${BLUE}SUPABASE_ANON_KEY:${NC} ${ANON_KEY}"
echo ""
echo "Studio Login:"
echo ""
echo -e "  ${BLUE}Username:${NC} ${DASHBOARD_USERNAME}"
echo -e "  ${BLUE}Password:${NC} ${DASHBOARD_PASSWORD}"
echo ""

# ============================================================
# Next Steps
# ============================================================

print_header "Next Steps"

echo "1. Verify services are healthy:"
echo "   ${BLUE}docker stack ps supabase${NC}"
echo ""
echo "2. Access Supabase Studio:"
echo "   ${BLUE}https://${STUDIO_DOMAIN}${NC}"
echo ""
echo "3. Test API endpoint:"
echo "   ${BLUE}curl https://${API_DOMAIN}/rest/v1/${NC}"
echo ""
echo "4. Create your database schema:"
echo "   - Use Studio UI to create tables"
echo "   - Or run SQL migrations"
echo ""
echo "5. Build your frontend applications:"
echo "   - Install Supabase client: npm install @supabase/supabase-js"
echo "   - Use SUPABASE_URL and SUPABASE_ANON_KEY"
echo ""

# ============================================================
# Troubleshooting
# ============================================================

print_header "Troubleshooting"

echo "View service logs:"
echo "  ${BLUE}docker service logs supabase_supabase_db${NC}    # PostgreSQL"
echo "  ${BLUE}docker service logs supabase_kong${NC}           # API Gateway"
echo "  ${BLUE}docker service logs supabase_rest${NC}           # REST API"
echo "  ${BLUE}docker service logs supabase_auth${NC}           # Authentication"
echo "  ${BLUE}docker service logs supabase_storage${NC}        # File Storage"
echo "  ${BLUE}docker service logs supabase_studio${NC}         # Admin UI"
echo ""
echo "View all services:"
echo "  ${BLUE}docker stack services supabase${NC}"
echo ""
echo "Remove stack:"
echo "  ${BLUE}docker stack rm supabase${NC}"
echo ""

print_success "Deployment script completed!"
echo ""
