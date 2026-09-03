#!/bin/bash
# Deploy Traefik with Let's Encrypt support

set -e

echo "========================================="
echo "Deploying Traefik Reverse Proxy"
echo "========================================="

cd "$(dirname "$0")"

# Create network if it doesn't exist
if ! docker network inspect traefik_proxy &> /dev/null; then
    echo "Creating traefik_proxy network..."
    docker network create traefik_proxy
fi

# Create letsencrypt directory and acme.json
mkdir -p letsencrypt
touch letsencrypt/acme.json
chmod 600 letsencrypt/acme.json

echo "Starting Traefik..."
docker compose up -d

echo ""
echo "========================================="
echo "Traefik Deployed Successfully!"
echo "========================================="
echo ""
echo "Dashboard: http://localhost:8080 (if enabled)"
echo ""
echo "Check status: docker compose logs -f"
echo ""
