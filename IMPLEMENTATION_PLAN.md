# Greyin & GreyMatters Implementation Plan
## Odoo 18 Community Edition + Discourse Deployment

**Platform Decision**: Odoo Community Edition 18 + Discourse (see PLATFORM_RECOMMENDATIONS.md)
**Timeline**: 6-8 weeks to full production
**Cost**: $0 licensing + $27-42/month infrastructure

---

## Phase 1: Infrastructure Setup (Week 1)

### 1.1 Server Provisioning

**Provider: Hetzner Cloud** (Best price/performance for European/global traffic)

**Recommended Configurations**:
- **MVP/Staging**: CPX31 (4 vCPU, 8GB RAM, 160GB SSD) → €11.90/month (~$13)
- **Production**: CPX41 (8 vCPU, 16GB RAM, 240GB SSD) → €23.90/month (~$26)

For US-centric traffic:
- DigitalOcean Premium AMD Droplet: $48/month (8GB RAM)
- Linode Dedicated 8GB: $48/month

**Initial Server Setup:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Create application directory
sudo mkdir -p /opt/greyin
sudo chown $USER:$USER /opt/greyin
cd /opt/greyin
```

---

### 1.2 Domain Configuration

Purchase/configure domains:
- `greyin.io` → Main enterprise portal
- `greymatters.io` → Blog/content engine
- `community.greyin.io` → Salt & Pepper lounge (Discourse)

**DNS Records (Example for Cloudflare):**
```
Type    Name                    Content             TTL    Proxy
A       greyin.io              YOUR_SERVER_IP       Auto   Yes
A       greymatters.io         YOUR_SERVER_IP       Auto   Yes
A       community.greyin.io    YOUR_SERVER_IP       Auto   Yes
```

---

## Phase 2: Odoo Deployment (Week 1-2)

### 2.1 Odoo Docker Setup

Create `/opt/greyin/docker-compose.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  db:
    image: postgres:16
    container_name: greyin_postgres
    environment:
      POSTGRES_DB: postgres
      POSTGRES_USER: odoo
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - greyin_network
    restart: unless-stopped

  # Odoo Application
  odoo:
    image: odoo:18.0
    container_name: greyin_odoo
    depends_on:
      - db
    environment:
      HOST: db
      USER: odoo
      PASSWORD: ${DB_PASSWORD}
    volumes:
      - odoo_web_data:/var/lib/odoo
      - ./config:/etc/odoo
      - ./addons:/mnt/extra-addons
    ports:
      - "8069:8069"
    networks:
      - greyin_network
    restart: unless-stopped
    command: -- --dev=reload

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: greyin_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx:/etc/nginx/conf.d
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    networks:
      - greyin_network
    depends_on:
      - odoo
    restart: unless-stopped

  # Let's Encrypt SSL
  certbot:
    image: certbot/certbot
    container_name: greyin_certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    networks:
      - greyin_network

networks:
  greyin_network:
    driver: bridge

volumes:
  postgres_data:
  odoo_web_data:
```

### 2.2 Environment Configuration

Create `/opt/greyin/.env`:

```env
# Database
DB_PASSWORD=CHANGE_THIS_STRONG_PASSWORD_123!

# Odoo Admin
ADMIN_PASSWORD=CHANGE_THIS_ADMIN_PASSWORD_456!

# Domains
MAIN_DOMAIN=greyin.io
BLOG_DOMAIN=greymatters.io
```

### 2.3 Nginx Configuration

Create `/opt/greyin/nginx/greyin.conf`:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name greyin.io greymatters.io;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# Main Greyin Portal (HTTPS)
server {
    listen 443 ssl http2;
    server_name greyin.io;
    
    ssl_certificate /etc/letsencrypt/live/greyin.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/greyin.io/privkey.pem;
    
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://odoo:8069;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_redirect off;
    }
    
    location /longpolling {
        proxy_pass http://odoo:8072;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# GreyMatters Blog (HTTPS)
server {
    listen 443 ssl http2;
    server_name greymatters.io;
    
    ssl_certificate /etc/letsencrypt/live/greymatters.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/greymatters.io/privkey.pem;
    
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://odoo:8069;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host greymatters.io;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_redirect off;
    }
}
```

### 2.4 Launch Odoo

```bash
cd /opt/greyin

# Create directories
mkdir -p config addons nginx certbot/conf certbot/www

# Get SSL certificates (before starting nginx with SSL)
docker-compose run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  -d greyin.io \
  -d greymatters.io \
  --email your@email.com \
  --agree-tos \
  --no-eff-email

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f odoo
```

**Access Odoo:**
- Navigate to: `http://YOUR_SERVER_IP:8069`
- Create master database: `greyin_production`
- Set admin email/password
- Install modules: Website, CMS, HR Recruitment, CRM, Project

---

## Phase 3: Odoo Configuration (Week 2-3)

### 3.1 Install Required Modules

**Core Modules to Install:**
1. **Website** → Homepage builder
2. **Blog** → GreyMatters content engine
3. **HR Recruitment** → Candidate management
4. **CRM** → Enterprise lead tracking
5. **Project** → Salt & Pepper showcases
6. **Portal** → Client/candidate dashboards
7. **Contacts** → Member database
8. **eCommerce** (optional) → Outplacement packages

**Installation via Odoo UI:**
```
Apps → Remove "Apps" filter → Search "Website" → Install
Apps → Search "Blog" → Install
Apps → Search "HR Recruitment" → Install
Apps → Search "CRM" → Install
Apps → Search "Project" → Install
```

### 3.2 Multi-Website Setup

**Goal:** Serve two brands from one Odoo instance

1. **Settings → Technical → Websites**
2. Create websites:
   - **Greyin Portal:** Domain = `greyin.io`
   - **GreyMatters Blog:** Domain = `greymatters.io`

### 3.3 GreyMatters Blog Configuration

**Website → Blogs → Create:**
- Name: `GreyMatters - Because Grey Matters`
- Subtitle: `Architecture Teardowns, Career Insights & Domain Deep-Dives`

**Blog Post Template:**
```markdown
Title: AUTOSAR Zonal Architecture vs. Centralized Compute

Subtitle: A Deep Dive into Automotive E/E Evolution

Author: Senior Domain Expert

Tags: Automotive, AUTOSAR, System Design

---

[Article Content in Markdown...]

---

**Join Salt & Pepper Lounge** → [CTA Button]
**Hire Senior Talent via Greyin** → [CTA Button]
```

### 3.4 HR Recruitment Setup

**Navigate to: Recruitment → Configuration**

**Create Job Positions:**
- Principal Software Architect (12+ Yrs)
- Fractional CTO/VP Engineering
- Senior Embedded Systems Engineer
- AI/ML Domain Lead

**Custom Fields for Candidates:**
```
Years of Experience: Integer
LinkedIn Profile: URL
GitHub/Portfolio: URL
Domain Expertise: Tags (Automotive, AI/ML, Embedded, etc.)
Availability: Selection (Full-time, Fractional, Consulting)
Verified Senior (12+ Yrs): Checkbox
```

**Add via Settings → Technical → Database Structure → Models:**
- Model: `hr.applicant`
- Add custom fields

### 3.5 Client Portal Setup

**Enable Portal Access:**
1. Settings → Users & Companies → Portal
2. Create portal user groups:
   - **Senior Talent Portal** (candidates)
   - **Enterprise Client Portal** (hiring companies)

**Portal Features:**
- View job matches
- Update profile/resume
- Track application status
- Browse GreyMatters articles
- Access Salt & Pepper (via SSO to Discourse)

---

## Phase 4: Discourse Community (Week 3)

### 4.1 Discourse Docker Setup

Add to `/opt/greyin/docker-compose.yml`:

```yaml
  # Discourse (Salt & Pepper Lounge)
  discourse_redis:
    image: redis:7-alpine
    container_name: discourse_redis
    volumes:
      - discourse_redis_data:/data
    networks:
      - greyin_network
    restart: unless-stopped

  discourse_postgres:
    image: postgres:16
    container_name: discourse_postgres
    environment:
      POSTGRES_DB: discourse
      POSTGRES_USER: discourse
      POSTGRES_PASSWORD: ${DISCOURSE_DB_PASSWORD}
    volumes:
      - discourse_postgres_data:/var/lib/postgresql/data
    networks:
      - greyin_network
    restart: unless-stopped

  discourse:
    image: discourse/discourse:latest
    container_name: discourse
    depends_on:
      - discourse_postgres
      - discourse_redis
    environment:
      DISCOURSE_HOSTNAME: community.greyin.io
      DISCOURSE_DB_HOST: discourse_postgres
      DISCOURSE_DB_NAME: discourse
      DISCOURSE_DB_USERNAME: discourse
      DISCOURSE_DB_PASSWORD: ${DISCOURSE_DB_PASSWORD}
      DISCOURSE_REDIS_HOST: discourse_redis
      DISCOURSE_DEVELOPER_EMAILS: admin@greyin.io
      DISCOURSE_SMTP_ADDRESS: smtp.sendgrid.net
      DISCOURSE_SMTP_PORT: 587
      DISCOURSE_SMTP_USER_NAME: apikey
      DISCOURSE_SMTP_PASSWORD: ${SENDGRID_API_KEY}
    volumes:
      - discourse_shared:/shared
    ports:
      - "8080:80"
    networks:
      - greyin_network
    restart: unless-stopped

volumes:
  discourse_redis_data:
  discourse_postgres_data:
  discourse_shared:
```

Update nginx config for `community.greyin.io`:

```nginx
# Salt & Pepper Community (HTTPS)
server {
    listen 443 ssl http2;
    server_name community.greyin.io;
    
    ssl_certificate /etc/letsencrypt/live/community.greyin.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/community.greyin.io/privkey.pem;
    
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://discourse:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_redirect off;
    }
}
```

### 4.2 Discourse SSO with Odoo

**Odoo Side (Custom Module Required):**

Create custom module: `/opt/greyin/addons/greyin_discourse_sso/`

```python
# __manifest__.py
{
    'name': 'Greyin Discourse SSO',
    'version': '1.0',
    'depends': ['website', 'portal'],
    'data': ['views/sso_views.xml'],
}

# controllers/main.py
from odoo import http
from odoo.http import request
import hmac
import hashlib
import base64
from urllib.parse import parse_qs, urlencode

class DiscourseSSO(http.Controller):
    
    @http.route('/discourse/sso', type='http', auth='user', website=True)
    def discourse_sso(self, **kwargs):
        """Handle Discourse SSO authentication"""
        sso = kwargs.get('sso')
        sig = kwargs.get('sig')
        
        # Shared secret (set in Discourse admin)
        secret = request.env['ir.config_parameter'].sudo().get_param('discourse.sso.secret')
        
        # Verify signature
        expected_sig = hmac.new(
            secret.encode('utf-8'),
            sso.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        if sig != expected_sig:
            return request.render('website.403')
        
        # Decode payload
        decoded = base64.b64decode(sso).decode('utf-8')
        params = parse_qs(decoded)
        nonce = params['nonce'][0]
        
        # Get user data
        user = request.env.user
        
        # Build response
        response_params = {
            'nonce': nonce,
            'email': user.email,
            'external_id': str(user.id),
            'username': user.login.split('@')[0],
            'name': user.name,
            'avatar_url': f'/web/image/res.users/{user.id}/image_128',
        }
        
        # Add custom fields
        if hasattr(user, 'years_experience'):
            response_params['custom.years_experience'] = user.years_experience
        
        response_payload = base64.b64encode(urlencode(response_params).encode('utf-8')).decode('utf-8')
        response_sig = hmac.new(
            secret.encode('utf-8'),
            response_payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return request.redirect(
            f"{params['return_sso_url'][0]}?sso={response_payload}&sig={response_sig}"
        )
```

**Discourse Side:**

1. Admin → Settings → Login → Enable SSO
2. Set SSO URL: `https://greyin.io/discourse/sso`
3. Set SSO Secret: (generate random 32-char string, store in Odoo)
4. Enable: `sso overrides email`, `sso overrides username`, `sso overrides avatar`

### 4.3 Salt & Pepper Configuration

**Categories Structure:**
```
📁 Welcome & Guidelines
  └─ Start Here (pinned)
  
📁 Architecture Reviews
  └─ Automotive/Embedded
  └─ AI/ML Systems
  └─ Cloud/Infrastructure
  
📁 The Lab (Project Showcases)
  └─ MVP Demos
  └─ Code Reviews
  └─ Design Critique
  
📁 Career & Transitions
  └─ From IC to Leadership
  └─ Fractional Work
  └─ Consulting
  
📁 Peer Network
  └─ Collaboration Requests
  └─ Skill Exchange
```

**Custom User Fields:**
- Years of Experience (required)
- Primary Domain (dropdown)
- LinkedIn URL
- GitHub/Portfolio

**Trust Levels:**
- TL0: New member (read-only for 2 weeks)
- TL1: Basic (can post after verification)
- TL2: Member (12+ yrs verified)
- TL3: Regular (active contributors)
- TL4: Leader (community moderators)

---

## Phase 5: Custom FreeAgent Module (Week 4-5)

### 5.1 Odoo Custom Module Structure

Create `/opt/greyin/addons/greyin_freeagent/`:

```
greyin_freeagent/
├── __init__.py
├── __manifest__.py
├── models/
│   ├── __init__.py
│   ├── freeagent_gig.py
│   ├── freeagent_proposal.py
│   └── freeagent_contract.py
├── views/
│   ├── freeagent_gig_views.xml
│   ├── freeagent_proposal_views.xml
│   └── menu.xml
├── security/
│   └── ir.model.access.csv
└── data/
    └── freeagent_data.xml
```

### 5.2 Core Model: Gig Marketplace

```python
# models/freeagent_gig.py
from odoo import models, fields, api

class FreeAgentGig(models.Model):
    _name = 'freeagent.gig'
    _description = 'FreeAgent Gig Marketplace'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    
    name = fields.Char('Gig Title', required=True, tracking=True)
    description = fields.Html('Description', required=True)
    client_id = fields.Many2one('res.partner', string='Client', required=True)
    category = fields.Selection([
        ('consulting', 'Technical Consulting'),
        ('architecture', 'Architecture Review'),
        ('code_review', 'Code Review'),
        ('mentoring', 'Mentoring'),
        ('fractional', 'Fractional Leadership'),
    ], string='Category', required=True)
    
    budget_min = fields.Float('Budget Min ($)')
    budget_max = fields.Float('Budget Max ($)')
    duration = fields.Selection([
        ('hourly', 'Hourly'),
        ('daily', 'Daily Rate'),
        ('project', 'Project-Based'),
    ], string='Duration Type')
    
    skills_required = fields.Many2many('hr.skill', string='Skills Required')
    state = fields.Selection([
        ('draft', 'Draft'),
        ('open', 'Open for Proposals'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ], default='draft', tracking=True)
    
    proposal_ids = fields.One2many('freeagent.proposal', 'gig_id', string='Proposals')
    proposal_count = fields.Integer(compute='_compute_proposal_count')
    
    selected_proposal_id = fields.Many2one('freeagent.proposal', string='Selected Proposal')
    
    @api.depends('proposal_ids')
    def _compute_proposal_count(self):
        for record in self:
            record.proposal_count = len(record.proposal_ids)
    
    def action_publish(self):
        self.state = 'open'
        # Send notification to eligible community members
    
    def action_complete(self):
        self.state = 'completed'
        # Trigger payment release
```

### 5.3 Payment Integration (0% Commission)

**Direct Payment Methods:**
1. **Wise/TransferWise API** → International transfers
2. **Stripe Connect** → Client pays, instant transfer to freelancer
3. **Crypto Escrow** → Smart contract-based (optional)

**Odoo Configuration:**
```python
# Platform earns $0 commission
# Optional: voluntary platform support fund

class FreeAgentContract(models.Model):
    _name = 'freeagent.contract'
    
    gig_id = fields.Many2one('freeagent.gig')
    freelancer_id = fields.Many2one('res.partner')
    client_id = fields.Many2one('res.partner')
    
    amount = fields.Float('Contract Amount')
    platform_fee = fields.Float('Platform Fee', default=0.0)  # Always $0
    freelancer_receives = fields.Float(compute='_compute_freelancer_receives')
    
    @api.depends('amount', 'platform_fee')
    def _compute_freelancer_receives(self):
        for record in self:
            record.freelancer_receives = record.amount  # 100% to freelancer
```

---

## Phase 6: Integration & Testing (Week 5-6)

### 6.1 SSO Flow Testing

**Test Sequence:**
1. User registers on Greyin.io
2. Verifies 12+ years experience (upload resume/LinkedIn)
3. Gains access to Salt & Pepper via SSO
4. Can post projects to FreeAgent from Odoo portal
5. Receives gig notifications in Discourse

### 6.2 Content Workflow

**GreyMatters Publishing:**
1. Writer creates blog post in Odoo CMS
2. SEO optimization (meta tags, keywords)
3. Embedded CTAs → Greyin portal signup
4. Auto-post summary to Discourse "New Articles" category
5. Track conversions: Blog view → Portal signup → Gig/hire

### 6.3 Analytics Setup

**Odoo Built-in:**
- Website Analytics → Traffic, conversions
- CRM Reports → Lead pipeline
- Recruitment Reports → Placements

**External (Optional):**
- Plausible Analytics (privacy-first, self-hosted)
- Matomo (open-source Google Analytics alternative)

---

## Phase 7: Go-Live Checklist (Week 6)

### 7.1 Security Hardening

```bash
# Firewall setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Fail2ban for brute-force protection
sudo apt install fail2ban -y
```

### 7.2 Backup Strategy

```bash
# Daily automated backups
cat > /opt/greyin/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/greyin/backups/$DATE

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec greyin_postgres pg_dumpall -U odoo > $BACKUP_DIR/postgres_dump.sql
docker exec discourse_postgres pg_dumpall -U discourse > $BACKUP_DIR/discourse_dump.sql

# Backup Odoo filestore
docker cp greyin_odoo:/var/lib/odoo $BACKUP_DIR/odoo_data

# Backup Discourse uploads
docker cp discourse:/shared $BACKUP_DIR/discourse_data

# Compress
tar -czf $BACKUP_DIR.tar.gz -C /opt/greyin/backups $DATE
rm -rf $BACKUP_DIR

# Upload to S3/Backblaze (optional)
# aws s3 cp $BACKUP_DIR.tar.gz s3://greyin-backups/

# Retention: keep last 30 days
find /opt/greyin/backups -name "*.tar.gz" -mtime +30 -delete
EOF

chmod +x /opt/greyin/backup.sh

# Add to cron (daily at 2 AM)
echo "0 2 * * * /opt/greyin/backup.sh" | sudo crontab -
```

### 7.3 Performance Tuning

**Odoo Workers:**
```ini
# /opt/greyin/config/odoo.conf
[options]
workers = 4
max_cron_threads = 2
limit_memory_hard = 2684354560
limit_memory_soft = 2147483648
limit_request = 8192
limit_time_cpu = 600
limit_time_real = 1200
```

**PostgreSQL:**
```conf
# Optimize PostgreSQL for Odoo
# Add to docker-compose.yml under postgres service
command: 
  - "postgres"
  - "-c"
  - "shared_buffers=256MB"
  - "-c"
  - "effective_cache_size=1GB"
  - "-c"
  - "work_mem=16MB"
```

---

## Phase 8: Launch & Growth (Ongoing)

### 8.1 Content Calendar (GreyMatters)

**Month 1-3 (Foundation):**
- Week 1: "Why Grey Matters: The Case for Senior Talent"
- Week 2: "AUTOSAR Zonal Architecture Deep Dive"
- Week 3: "Transitioning from IC to Fractional CTO"
- Week 4: "Local LLM Deployment: Production Patterns"

**SEO Strategy:**
- Target long-tail keywords: "senior automotive architect", "fractional CTO hiring"
- Backlinks from Discourse discussions
- Guest posts on industry blogs

### 8.2 Community Growth (Salt & Pepper)

**Launch Strategy:**
1. Invite 50 beta members (your network)
2. Weekly "Architecture Teardown Thursday"
3. Monthly "Lab Showcase" for MVPs
4. Quarterly in-person meetups (major tech hubs)

**Gamification:**
- Badges: "First Review", "Lab Builder", "10 Helpful Posts"
- Leaderboard: Top contributors each month
- Rewards: Featured profile on Greyin.io

### 8.3 Revenue Milestones

**Year 1 Goals:**
| Quarter | Target | Revenue |
|---------|--------|---------|
| Q1 | 100 members, 5 placements | $25K |
| Q2 | 250 members, 15 placements | $75K |
| Q3 | 500 members, 30 placements | $150K |
| Q4 | 1000 members, 50 placements | $250K |

**Assumptions:**
- Average placement fee: $5K (10% of $50K avg contract)
- Outplacement packages: $2.5K each (10 per quarter)
- FreeAgent: $0 commission, but drives platform value

---

## Cost Summary

### One-Time Costs
| Item | Cost |
|------|------|
| Domains (2 years) | $50 |
| Initial server setup | $0 (DIY) |
| **Total** | **$50** |

### Monthly Recurring Costs
| Item | Cost |
|------|------|
| Server (Hetzner CPX41) | $24 |
| Email (SendGrid/Postmark) | $15 |
| Backblaze B2 backups (500GB) | $3 |
| Monitoring (UptimeRobot free tier) | $0 |
| **Total** | **$42/month** |

### Optional Enhancements
| Item | Cost |
|------|------|
| Cloudflare Pro (Advanced DDoS) | $20/month |
| Plausible Analytics (hosted) | $9/month |
| Discourse hosting (alternative to self-host) | $100/month |

---

## Timeline Summary

| Week | Phase | Deliverable |
|------|-------|-------------|
| 1 | Infrastructure | Server + Docker + SSL |
| 2 | Odoo Setup | Website + Blog + HR live |
| 3 | Discourse | Community platform + SSO |
| 4-5 | Custom Dev | FreeAgent marketplace module |
| 6 | Testing | End-to-end workflow validation |
| 7+ | Launch | Content publishing + member onboarding |

**Estimated Total Time:** 6-8 weeks (with 1 developer part-time)

---

## Support Resources

### Official Documentation
- Odoo: https://www.odoo.com/documentation/18.0/
- Discourse: https://meta.discourse.org/
- Docker: https://docs.docker.com/

### Community Forums
- Odoo Community: https://www.odoo.com/forum
- Discourse Meta: https://meta.discourse.org/
- Reddit: r/selfhosted, r/odoo

### Recommended Learning
- **Odoo Development:** "Odoo 18 Development Essentials" (book)
- **Discourse Admin:** Official Discourse Howto guides
- **Docker Compose:** Docker Mastery course (Udemy)

---

## Next Steps

1. **Provision server** → Hetzner Cloud account + CPX31 instance
2. **Clone implementation repo** → (will be created in next phase)
3. **Run deployment script** → Automated Docker setup
4. **Configure domains** → DNS + SSL certificates
5. **Customize branding** → Odoo themes + Discourse styling
6. **Invite beta users** → First 50 community members
7. **Publish first article** → GreyMatters launch post

**Ready to start? Let me know which phase you'd like to begin with!**
