# Greyin & GreyMatters Platform - Quick Start Guide

## Prerequisites

- Ubuntu 22.04/24.04 LTS server (minimum 4GB RAM, 2 vCPU)
- Root or sudo access
- Domain names pointing to your server IP

## 1. Quick Deployment (Automated)

```bash
# Clone or download the deployment files
cd /tmp
git clone YOUR_REPO_URL greyin-deployment
cd greyin-deployment/deployment

# Run automated deployment
chmod +x deploy.sh
./deploy.sh
```

The script will:
- Install Docker & Docker Compose
- Set up directory structure
- Generate secure passwords
- Configure firewall
- Obtain SSL certificates
- Start all services

## 2. Manual Deployment

If you prefer manual setup:

### Step 1: Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login again
```

### Step 2: Create Directory Structure

```bash
# Create installation directory
sudo mkdir -p /opt/greyin
sudo chown $USER:$USER /opt/greyin
cd /opt/greyin

# Create subdirectories
mkdir -p config nginx/conf.d addons certbot/conf certbot/www \
         backups logs/odoo logs/nginx logs/discourse scripts
```

### Step 3: Copy Configuration Files

```bash
# Copy all files from deployment/ directory to /opt/greyin/
cp docker-compose.yml /opt/greyin/
cp .env.example /opt/greyin/.env
cp nginx.conf /opt/greyin/nginx/conf.d/greyin.conf
cp odoo.conf /opt/greyin/config/
cp backup.sh /opt/greyin/scripts/
cp deploy.sh /opt/greyin/scripts/

# Make scripts executable
chmod +x /opt/greyin/scripts/*.sh
```

### Step 4: Configure Environment

```bash
cd /opt/greyin

# Edit .env file
nano .env

# Required changes:
# 1. Set your domains (MAIN_DOMAIN, BLOG_DOMAIN, DISCOURSE_HOSTNAME)
# 2. Generate strong passwords:
#    openssl rand -base64 32
# 3. Set SMTP credentials (SendGrid, AWS SES, etc.)
# 4. Set admin email
```

### Step 5: Configure DNS

Set A records for your domains:

```
A    greyin.io              → YOUR_SERVER_IP
A    greymatters.io         → YOUR_SERVER_IP
A    community.greyin.io    → YOUR_SERVER_IP
```

Wait for DNS propagation (check with `nslookup greyin.io`)

### Step 6: Obtain SSL Certificates

```bash
cd /opt/greyin

# Start temporary nginx for ACME challenge
docker run --rm -d --name temp_nginx \
    -p 80:80 \
    -v $(pwd)/nginx/conf.d:/etc/nginx/conf.d:ro \
    -v $(pwd)/certbot/www:/var/www/certbot:ro \
    nginx:alpine

# Request certificates (replace with your domains and email)
docker run --rm \
    -v $(pwd)/certbot/conf:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
    certbot/certbot certonly --webroot \
    -w /var/www/certbot \
    --email admin@greyin.io \
    --agree-tos \
    --no-eff-email \
    -d greyin.io \
    -d greymatters.io \
    -d community.greyin.io

# Stop temporary nginx
docker stop temp_nginx
```

### Step 7: Start Services

```bash
cd /opt/greyin

# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

## 3. Initial Configuration

### Odoo Setup (Greyin Portal & GreyMatters Blog)

1. Open browser: `https://greyin.io`
2. Create database:
   - Database name: `greyin_production`
   - Email: `admin@greyin.io`
   - Password: (from .env file)
   - Demo data: No
3. Install apps:
   - Website
   - Blog
   - HR Recruitment
   - CRM
   - Project
   - Portal

4. Configure multi-website:
   - Settings → Technical → Websites
   - Create two websites:
     - **Greyin**: Domain = `greyin.io`
     - **GreyMatters**: Domain = `greymatters.io`

### Discourse Setup (Salt & Pepper Lounge)

1. Open browser: `https://community.greyin.io`
2. Create admin account
3. Configure settings:
   - Site Settings → Title: "Salt & Pepper Lounge"
   - Site Settings → Description: "Exclusive community for 12+ years senior professionals"
4. Enable SSO:
   - Settings → Login → Enable SSO
   - SSO URL: `https://greyin.io/discourse/sso`
   - SSO Secret: (from .env: DISCOURSE_SSO_SECRET)
   - Enable: SSO overrides email, username, avatar

## 4. Post-Installation

### Enable Automatic Backups

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/greyin/scripts/backup.sh
```

### Configure Firewall

```bash
# Enable UFW
sudo ufw enable

# Allow necessary ports
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

### Install Monitoring (Optional)

```bash
# Install Netdata for system monitoring
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access: http://YOUR_SERVER_IP:19999
```

## 5. Testing Checklist

- [ ] Greyin.io loads successfully
- [ ] GreyMatters.io loads successfully
- [ ] Community.greyin.io loads successfully
- [ ] All sites have valid SSL certificates
- [ ] Can create Odoo database
- [ ] Can install Odoo modules
- [ ] Can create blog post on GreyMatters
- [ ] Can create Discourse admin account
- [ ] SSO between Odoo and Discourse works
- [ ] Backup script runs successfully

## 6. Troubleshooting

### Check Service Status

```bash
cd /opt/greyin
docker compose ps
docker compose logs odoo
docker compose logs discourse
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart odoo
docker compose restart discourse
```

### SSL Certificate Issues

```bash
# Check certificates
sudo certbot certificates

# Renew manually
docker compose run --rm certbot renew
docker compose restart nginx
```

### Database Connection Issues

```bash
# Check database
docker exec -it greyin_postgres psql -U odoo -l

# Restart database
docker compose restart odoo_db
```

### View Real-Time Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f odoo
docker compose logs -f discourse
docker compose logs -f nginx
```

## 7. Useful Commands

```bash
# Stop all services
docker compose down

# Stop and remove volumes (DANGER: deletes data!)
docker compose down -v

# Update images
docker compose pull
docker compose up -d

# Backup manually
bash /opt/greyin/scripts/backup.sh

# Check disk usage
docker system df

# Clean up unused images
docker system prune -a
```

## 8. Next Steps

After successful deployment:

1. **Customize Branding**: Edit Odoo website themes and Discourse styling
2. **Create Content**: Publish first GreyMatters blog post
3. **Configure FreeAgent**: Install custom Odoo module for marketplace
4. **Invite Beta Users**: First 50 community members
5. **Set Up Analytics**: Plausible or Matomo
6. **Configure Email Templates**: Odoo email templates for job notifications
7. **Create Discourse Categories**: Architecture, Lab, Career, Network

## 9. Support & Documentation

- **Full Implementation Plan**: `IMPLEMENTATION_PLAN.md`
- **Platform Recommendations**: `PLATFORM_RECOMMENDATIONS.md`
- **Odoo Documentation**: https://www.odoo.com/documentation/18.0/
- **Discourse Documentation**: https://meta.discourse.org/
- **Docker Documentation**: https://docs.docker.com/

## 10. Security Checklist

- [ ] Changed all default passwords in .env
- [ ] Firewall enabled (UFW)
- [ ] Fail2ban installed
- [ ] SSL certificates active
- [ ] Automatic backups scheduled
- [ ] Database access restricted (not exposed on 5432)
- [ ] Odoo database list hidden (list_db = False)
- [ ] Strong Discourse SSO secret configured
- [ ] SMTP credentials secured
- [ ] Regular security updates scheduled

---

**Ready to launch?** Follow steps 1-3 above to get your Greyin & GreyMatters platform running!

For questions or issues, consult the detailed IMPLEMENTATION_PLAN.md or open an issue in the project repository.
