#!/bin/bash
#
# Greyin & GreyMatters Platform Deployment Script
# Automated setup for Ubuntu 22.04/24.04 LTS
#
# Usage: 
#   chmod +x deploy.sh
#   ./deploy.sh
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    log_error "Please do not run as root. Use sudo when needed."
    exit 1
fi

# Banner
echo "=================================="
echo "  Greyin & GreyMatters Platform"
echo "  Automated Deployment Script"
echo "=================================="
echo ""

# ===========================
# Step 1: System Update
# ===========================
log_info "Step 1: Updating system packages..."
sudo apt update && sudo apt upgrade -y
log_success "System updated successfully"

# ===========================
# Step 2: Install Docker
# ===========================
log_info "Step 2: Installing Docker..."

if command -v docker &> /dev/null; then
    log_warning "Docker already installed, skipping..."
else
    # Install dependencies
    sudo apt install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release

    # Add Docker's official GPG key
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    # Set up repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    log_success "Docker installed successfully"
    log_warning "You may need to logout and login again for docker group to take effect"
fi

# ===========================
# Step 3: Create Directory Structure
# ===========================
log_info "Step 3: Creating directory structure..."

INSTALL_DIR="/opt/greyin"
sudo mkdir -p $INSTALL_DIR
sudo chown $USER:$USER $INSTALL_DIR

cd $INSTALL_DIR

# Create subdirectories
mkdir -p config nginx/conf.d addons certbot/conf certbot/www backups logs/odoo logs/nginx logs/discourse scripts

log_success "Directory structure created at $INSTALL_DIR"

# ===========================
# Step 4: Copy Configuration Files
# ===========================
log_info "Step 4: Setting up configuration files..."

# Copy files from deployment directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
    cp "$SCRIPT_DIR/docker-compose.yml" $INSTALL_DIR/
    log_success "Copied docker-compose.yml"
fi

if [ -f "$SCRIPT_DIR/.env.example" ]; then
    cp "$SCRIPT_DIR/.env.example" $INSTALL_DIR/.env.example
    
    # Create .env if it doesn't exist
    if [ ! -f "$INSTALL_DIR/.env" ]; then
        cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
        log_warning "Created .env file from example. PLEASE EDIT IT BEFORE PROCEEDING!"
    fi
fi

if [ -f "$SCRIPT_DIR/nginx.conf" ]; then
    cp "$SCRIPT_DIR/nginx.conf" $INSTALL_DIR/nginx/conf.d/greyin.conf
    log_success "Copied nginx configuration"
fi

if [ -f "$SCRIPT_DIR/odoo.conf" ]; then
    cp "$SCRIPT_DIR/odoo.conf" $INSTALL_DIR/config/odoo.conf
    log_success "Copied Odoo configuration"
fi

# ===========================
# Step 5: Generate Secrets
# ===========================
log_info "Step 5: Generating secure secrets..."

generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

if [ -f "$INSTALL_DIR/.env" ]; then
    # Generate passwords
    ODOO_DB_PASS=$(generate_password)
    DISCOURSE_DB_PASS=$(generate_password)
    SSO_SECRET=$(openssl rand -hex 32)
    ADMIN_PASS=$(generate_password)
    
    # Update .env file
    sed -i "s/CHANGE_THIS_ODOO_DB_PASSWORD_456!/$ODOO_DB_PASS/g" $INSTALL_DIR/.env
    sed -i "s/CHANGE_THIS_DISCOURSE_DB_PASSWORD_789!/$DISCOURSE_DB_PASS/g" $INSTALL_DIR/.env
    sed -i "s/CHANGE_THIS_SSO_SECRET_64_CHARS_DEF!/$SSO_SECRET/g" $INSTALL_DIR/.env
    sed -i "s/CHANGE_THIS_STRONG_PASSWORD_123!/$ADMIN_PASS/g" $INSTALL_DIR/.env
    
    log_success "Generated secure passwords and secrets"
    log_warning "Admin password: $ADMIN_PASS (save this!)"
fi

# ===========================
# Step 6: Configure Firewall
# ===========================
log_info "Step 6: Configuring firewall..."

if command -v ufw &> /dev/null; then
    sudo ufw --force enable
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    log_success "Firewall configured"
else
    log_warning "UFW not found, skipping firewall configuration"
fi

# ===========================
# Step 7: Install Fail2ban
# ===========================
log_info "Step 7: Installing Fail2ban for security..."

if ! command -v fail2ban-client &> /dev/null; then
    sudo apt install -y fail2ban
    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban
    log_success "Fail2ban installed and started"
else
    log_warning "Fail2ban already installed"
fi

# ===========================
# Step 8: Domain Configuration Check
# ===========================
log_info "Step 8: Checking domain configuration..."

source $INSTALL_DIR/.env

echo ""
echo "======================================"
echo "IMPORTANT: Domain Configuration"
echo "======================================"
echo ""
echo "Please ensure the following DNS records are set:"
echo ""
echo "A     $MAIN_DOMAIN              →  $(curl -s ifconfig.me)"
echo "A     $BLOG_DOMAIN              →  $(curl -s ifconfig.me)"
echo "A     $DISCOURSE_HOSTNAME       →  $(curl -s ifconfig.me)"
echo ""
echo "Press Enter when DNS is configured, or Ctrl+C to exit and configure later..."
read -r

# ===========================
# Step 9: SSL Certificate Setup
# ===========================
log_info "Step 9: Setting up SSL certificates..."

# First, start nginx in HTTP-only mode for Let's Encrypt challenge
log_info "Starting nginx for SSL certificate generation..."

# Temporary nginx config for HTTP-only
cat > $INSTALL_DIR/nginx/conf.d/temp.conf << EOF
server {
    listen 80;
    server_name $MAIN_DOMAIN $BLOG_DOMAIN $DISCOURSE_HOSTNAME;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 200 'Waiting for SSL setup';
        add_header Content-Type text/plain;
    }
}
EOF

# Start nginx temporarily
docker run --rm -d --name temp_nginx \
    -p 80:80 \
    -v $INSTALL_DIR/nginx/conf.d:/etc/nginx/conf.d:ro \
    -v $INSTALL_DIR/certbot/www:/var/www/certbot:ro \
    nginx:alpine

sleep 3

# Get SSL certificates
log_info "Requesting SSL certificates from Let's Encrypt..."

docker run --rm \
    -v $INSTALL_DIR/certbot/conf:/etc/letsencrypt \
    -v $INSTALL_DIR/certbot/www:/var/www/certbot \
    certbot/certbot certonly --webroot \
    -w /var/www/certbot \
    --email $LETSENCRYPT_EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $MAIN_DOMAIN \
    -d $BLOG_DOMAIN \
    -d $DISCOURSE_HOSTNAME

# Stop temporary nginx
docker stop temp_nginx
rm $INSTALL_DIR/nginx/conf.d/temp.conf

log_success "SSL certificates obtained"

# ===========================
# Step 10: Start Services
# ===========================
log_info "Step 10: Starting all services..."

cd $INSTALL_DIR
docker compose up -d

log_success "All services started!"

# ===========================
# Step 11: Wait for Services
# ===========================
log_info "Waiting for services to be ready (this may take 2-3 minutes)..."

# Wait for Odoo
log_info "Waiting for Odoo..."
for i in {1..60}; do
    if docker exec greyin_odoo curl -f http://localhost:8069/web/health > /dev/null 2>&1; then
        log_success "Odoo is ready"
        break
    fi
    sleep 5
done

# Wait for Discourse
log_info "Waiting for Discourse..."
sleep 30  # Discourse takes longer to start
log_success "Discourse should be ready"

# ===========================
# Step 12: Display Summary
# ===========================
echo ""
echo "======================================"
echo "  DEPLOYMENT COMPLETE!"
echo "======================================"
echo ""
echo "Access your platform at:"
echo ""
echo "  Greyin Portal:     https://$MAIN_DOMAIN"
echo "  GreyMatters Blog:  https://$BLOG_DOMAIN"
echo "  Community Lounge:  https://$DISCOURSE_HOSTNAME"
echo ""
echo "Next steps:"
echo ""
echo "1. Visit https://$MAIN_DOMAIN to set up Odoo"
echo "   - Create database: greyin_production"
echo "   - Install modules: Website, Blog, HR Recruitment, CRM"
echo ""
echo "2. Visit https://$DISCOURSE_HOSTNAME to configure Discourse"
echo "   - Create admin account"
echo "   - Enable SSO in settings"
echo ""
echo "3. Review logs:"
echo "   docker compose logs -f odoo"
echo "   docker compose logs -f discourse"
echo ""
echo "4. Enable automatic backups:"
echo "   bash $INSTALL_DIR/scripts/setup_backups.sh"
echo ""
echo "Admin password: $ADMIN_PASS"
echo ""
echo "Documentation: See IMPLEMENTATION_PLAN.md for detailed configuration"
echo ""
echo "======================================"

log_success "Deployment script completed successfully!"
