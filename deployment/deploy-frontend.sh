#!/bin/bash
# ============================================================
# Frontend Applications Deployment Script
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# ============================================================
# Pre-flight Checks
# ============================================================

print_header "Frontend Deployment - Pre-flight Checks"

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found"
    exit 1
fi
print_success ".env file found"

# Load environment variables
print_info "Loading environment variables..."
set -a
source .env
set +a
print_success "Environment variables loaded"

# Check Docker Swarm
if ! docker info --format '{{.Swarm.LocalNodeState}}' | grep -q "active"; then
    print_error "Docker Swarm is not initialized"
    exit 1
fi
print_success "Docker Swarm is active"

# Check if Traefik network exists
if ! docker network ls --format '{{.Name}}' | grep -q "^${TRAEFIK_NETWORK}$"; then
    print_error "Traefik network '${TRAEFIK_NETWORK}' not found"
    exit 1
fi
print_success "Traefik network found: ${TRAEFIK_NETWORK}"

# ============================================================
# Build Frontend Applications
# ============================================================

print_header "Building Frontend Applications"

APPS_DIR="../apps"

# Every app's Dockerfile declares NEXT_PUBLIC_SUPABASE_URL /
# NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SITE_URL as build ARGs --
# Next.js inlines NEXT_PUBLIC_* vars into the CLIENT bundle at build time,
# so omitting --build-arg here silently bakes `undefined` into any
# browser-side Supabase call (auth, storage uploads) while server-side
# code keeps working fine off the container's real runtime env -- easy to
# miss since most of an app still "works". Confirmed the hard way: a
# manual `docker build` without these flags broke stackworks's image-upload
# feature while every server-rendered page and route kept passing.

# Build DeepEdge (apps/deepedge codebase -- moved off MAIN_DOMAIN, see
# greyin-hub below for what now lives on MAIN_DOMAIN)
print_info "Building DeepEdge..."
cd ${APPS_DIR}/deepedge
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  --build-arg NEXT_PUBLIC_SITE_URL="https://${DEEPEDGE_DOMAIN}" \
  -t deepedge:latest .
print_success "DeepEdge built successfully"
cd - > /dev/null

# Build Greyin Hub (ecosystem homepage + /pivoting + /reentry + /dashboard)
print_info "Building Greyin Hub..."
cd ${APPS_DIR}/greyin-hub
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  --build-arg NEXT_PUBLIC_SITE_URL="https://${MAIN_DOMAIN}" \
  -t greyin-hub:latest .
print_success "Greyin Hub built successfully"
cd - > /dev/null

# Build GreyMatters Blog
print_info "Building GreyMatters Blog..."
cd ${APPS_DIR}/greymatters-blog
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  --build-arg NEXT_PUBLIC_SITE_URL="https://${BLOG_DOMAIN}" \
  -t greymatters-blog:latest .
print_success "GreyMatters Blog built successfully"
cd - > /dev/null

# Build FlexPro
print_info "Building FlexPro..."
cd ${APPS_DIR}/flexpro
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  --build-arg NEXT_PUBLIC_SITE_URL="https://${FLEXPRO_DOMAIN}" \
  -t flexpro:latest .
print_success "FlexPro built successfully"
cd - > /dev/null

# Build Salt & Pepper Community
print_info "Building Salt & Pepper Community..."
cd ${APPS_DIR}/saltnpepper-community
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  --build-arg NEXT_PUBLIC_SITE_URL="https://${COMMUNITY_DOMAIN}" \
  -t saltnpepper-community:latest .
print_success "Salt & Pepper Community built successfully"
cd - > /dev/null

# Build StackWorks (apps/stackworks codebase)
print_info "Building StackWorks..."
cd ${APPS_DIR}/stackworks
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  --build-arg NEXT_PUBLIC_SITE_URL="https://${STACKWORKS_DOMAIN}" \
  -t stackworks:latest .
print_success "StackWorks built successfully"
cd - > /dev/null

# ============================================================
# Deploy Frontend Stack
# ============================================================

print_header "Deploying Frontend Stack"

# Check if stack already exists
if docker stack ps greyin-frontend &> /dev/null; then
    print_info "Existing frontend stack found"
    read -p "Do you want to update it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Updating stack..."
    else
        print_error "Deployment cancelled"
        exit 0
    fi
fi

# Deploy the stack
print_info "Deploying services..."
docker stack deploy -c frontend-stack.yml greyin-frontend

print_success "Stack deployment command executed"

# ============================================================
# Wait for Services
# ============================================================

print_header "Waiting for Services to Start"

print_info "This may take 2-3 minutes..."
sleep 30

# ============================================================
# Service Status
# ============================================================

print_header "Service Status"

docker stack ps greyin-frontend --format "table {{.Name}}\t{{.CurrentState}}\t{{.Error}}"

# ============================================================
# Access Information
# ============================================================

print_header "Deployment Complete!"

echo ""
echo -e "${GREEN}All frontend applications are now deployed!${NC}"
echo ""
echo "Access your applications:"
echo -e "  • Greyin Hub:         ${BLUE}https://${MAIN_DOMAIN}${NC}"
echo -e "  • DeepEdge:           ${BLUE}https://${DEEPEDGE_DOMAIN}${NC}"
echo -e "  • GreyMatters Blog:   ${BLUE}https://${BLOG_DOMAIN}${NC}"
echo -e "  • FlexPro:            ${BLUE}https://${FLEXPRO_DOMAIN}${NC}"
echo -e "  • Salt & Pepper:      ${BLUE}https://${COMMUNITY_DOMAIN}${NC}"
echo -e "  • StackWorks:         ${BLUE}https://${STACKWORKS_DOMAIN}${NC}"
echo ""
echo -e "${YELLOW}Note: SSL certificates may take a few minutes to be issued.${NC}"
echo ""
echo "Monitor services:"
echo "  docker stack ps greyin-frontend"
echo "  docker service logs greyin-frontend_deepedge_web"
echo ""
