#!/bin/bash
# Generate secure passwords and JWT keys for Greyin Platform
# This script creates a properly configured .env file

set -e

echo "🔐 Generating Secure Credentials for Greyin Platform"
echo ""

# Generate random passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-64)

echo "✓ Generated PostgreSQL password"
echo "✓ Generated JWT secret"

# Generate JWT tokens
# Note: These are sample tokens. In production, use proper JWT signing.
# For now, using base64 encoded placeholder that includes the role

# ANON_KEY - Public key for anonymous access
ANON_PAYLOAD='{"iss":"supabase","ref":"greyin","role":"anon","iat":1689088000,"exp":1846768000}'
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.$(echo -n "$ANON_PAYLOAD" | base64 | tr -d '=' | tr '+/' '-_').SIGNATURE"

# SERVICE_ROLE_KEY - Private key for backend access
SERVICE_PAYLOAD='{"iss":"supabase","ref":"greyin","role":"service_role","iat":1689088000,"exp":1846768000}'
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.$(echo -n "$SERVICE_PAYLOAD" | base64 | tr -d '=' | tr '+/' '-_').SIGNATURE"

echo "✓ Generated API keys"
echo ""

# Create .env file
cat > .env << EOF
# Greyin & GreyMatters Environment Configuration
# Self-Hosted Supabase Deployment with Traefik
# Generated: $(date)

# ============================================================
# DOMAINS
# ============================================================
MAIN_DOMAIN=greyin.net
BLOG_DOMAIN=greymatters.greyin.net
COMMUNITY_DOMAIN=saltnpepper.greyin.net
FLEXPRO_DOMAIN=flexpro.greyin.net
API_DOMAIN=api.greyin.net
STUDIO_DOMAIN=studio.greyin.net

# ============================================================
# TRAEFIK CONFIGURATION
# ============================================================
# Existing Traefik network (from edjitsu-prod stack)
TRAEFIK_NETWORK=edjitsu-prod_edjitsu-network

# ============================================================
# SUPABASE - SECURITY KEYS (AUTO-GENERATED)
# ============================================================

# PostgreSQL password (auto-generated)
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# JWT Secret (auto-generated)
JWT_SECRET=${JWT_SECRET}

# Anonymous API Key (public, safe to expose)
ANON_KEY=${ANON_KEY}

# Service Role Key (private, server-side only)
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

# Dashboard credentials
DASHBOARD_USERNAME=admin@greyin.net
DASHBOARD_PASSWORD=Infy@121238

# ============================================================
# SUPABASE - AUTHENTICATION
# ============================================================
SITE_URL=https://greyin.net
ADDITIONAL_REDIRECT_URLS=https://greymatters.greyin.net,https://flexpro.greyin.net,https://saltnpepper.greyin.net

# JWT expiry (in seconds)
JWT_EXPIRY=3600
JWT_DEFAULT_GROUP_NAME=authenticated

# Enable email confirmations
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false

# ============================================================
# SUPABASE - DATABASE
# ============================================================
POSTGRES_HOST=supabase_db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# Connection pooling
PGRST_DB_SCHEMAS=public,storage,graphql_public
PGRST_DB_ANON_ROLE=anon
PGRST_DB_USE_LEGACY_GUCS=false
PGRST_APP_SETTINGS_JWT_SECRET=\${JWT_SECRET}
PGRST_APP_SETTINGS_JWT_EXP=\${JWT_EXPIRY}

# ============================================================
# SUPABASE - STORAGE
# ============================================================
STORAGE_BACKEND=file
FILE_SIZE_LIMIT=52428800
STORAGE_FILE_PATH=/var/lib/storage
TENANT_ID=greyin

# Image transformation
IMGPROXY_ENABLE_WEBP_DETECTION=true

# ============================================================
# SMTP CONFIGURATION (Hostinger)
# ============================================================
SMTP_ADMIN_EMAIL=admin@greyin.net
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=admin@greyin.net
SMTP_PASS=Infy@121238
SMTP_SENDER_NAME=Greyin Platform

# GoTrue SMTP settings
GOTRUE_SMTP_HOST=smtp.hostinger.com
GOTRUE_SMTP_PORT=587
GOTRUE_SMTP_USER=admin@greyin.net
GOTRUE_SMTP_PASS=Infy@121238
GOTRUE_SMTP_ADMIN_EMAIL=admin@greyin.net
GOTRUE_SMTP_SENDER_NAME=Greyin Platform

# ============================================================
# SUPABASE - API URLS (Internal)
# ============================================================
API_EXTERNAL_URL=https://api.greyin.net
SUPABASE_PUBLIC_URL=https://api.greyin.net

KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

# ============================================================
# FRONTEND - NEXT.JS APPS
# ============================================================
NEXT_PUBLIC_SUPABASE_URL=https://api.greyin.net
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}

# ============================================================
# ANALYTICS & MONITORING (Optional)
# ============================================================
ENABLE_ANALYTICS=false
ANALYTICS_BACKEND=postgres

# ============================================================
# ADMIN CREDENTIALS
# ============================================================
ADMIN_EMAIL=admin@greyin.net
ADMIN_PASSWORD=Infy@121238
EOF

echo "✅ .env file created successfully!"
echo ""
echo "📋 Generated Credentials:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "PostgreSQL Password: ${POSTGRES_PASSWORD}"
echo "JWT Secret: ${JWT_SECRET}"
echo ""
echo "Dashboard Login:"
echo "  URL: https://studio.greyin.net"
echo "  Email: admin@greyin.net"
echo "  Password: Infy@121238"
echo ""
echo "API Configuration (for frontends):"
echo "  NEXT_PUBLIC_SUPABASE_URL=https://api.greyin.net"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT: Store these credentials securely!"
echo "⚠️  The JWT_SECRET and SERVICE_ROLE_KEY must be kept private!"
echo ""
echo "Next step: Run ./deploy-supabase.sh to deploy the backend"
echo ""
