# Greyin Implementation - Getting Started

## ✅ What's Been Created

I've set up a complete **local development environment** for the Greyin ecosystem with the following structure:

```
deployment-local/
├── docker-compose.local.yml    # Complete Docker stack
├── .env.local                  # Environment template
├── nginx.local.conf            # HTTP reverse proxy
├── odoo.local.conf             # Odoo dev mode config
├── start.sh                    # Automated startup script ⭐
├── LOCAL_QUICKSTART.md         # Detailed step-by-step guide ⭐
└── README.md                   # Quick reference
```

## 🎯 Your Single Domain Setup

As requested, everything uses **greyin.net** with subdomains:

- **Main Portal**: http://greyin.net → Odoo (enterprise hiring)
- **Blog**: http://greymatters.greyin.net → Odoo (thought leadership)
- **Community**: http://community.greyin.net → Discourse (Salt & Pepper)

## 🚀 Quick Start (Two Options)

### Option 1: Automated (Recommended - 5 minutes)

```bash
cd "/media/anand/WD BLACK/projects2/greyin/deployment-local"
chmod +x start.sh
./start.sh
```

**What it does:**
1. ✅ Checks Docker installation
2. ✅ Creates .env file
3. ✅ Configures /etc/hosts for local domains
4. ✅ Downloads Docker images (~2.5GB)
5. ✅ Starts all services
6. ✅ Shows access URLs

**Time**: ~5-15 minutes (mostly image downloads)

### Option 2: Manual (30-60 minutes)

Follow the detailed guide: [LOCAL_QUICKSTART.md](deployment-local/LOCAL_QUICKSTART.md)

**Recommended if you want to:**
- Understand each step
- Customize the configuration
- Learn the deployment process

## 📋 Prerequisites

Before running `start.sh`, ensure you have:

- ✅ **Docker** installed (version 24.0+)
- ✅ **Docker Compose** installed (version 2.20+)
- ✅ **8GB RAM** minimum (16GB recommended)
- ✅ **20GB free disk space**
- ✅ **Sudo access** (for /etc/hosts configuration)

**Check Docker:**
```bash
docker --version
docker compose version
```

**If not installed:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt-get install docker-compose-plugin
```

## 🎬 After Startup

Once `start.sh` completes, you'll need to:

### 1. Initialize Odoo (5 minutes)
```
1. Open: http://greyin.net
2. Create database named "greyin"
3. Set admin email: admin@greyin.net
4. Set admin password: (choose strong password)
```

### 2. Install Odoo Modules (10 minutes)
```
Install these modules in Odoo:
- Website (main portal)
- Blog (GreyMatters)
- Recruitment (candidate database)
- CRM (enterprise clients)
- Portal (client dashboards)
```

### 3. Configure Multi-Website (5 minutes)
```
1. Settings → Enable Multi-website
2. Create "GreyMatters" website
3. Set domain: greymatters.greyin.net
```

### 4. Initialize Discourse (5 minutes)
```
1. Open: http://community.greyin.net
2. Create admin account
3. Set site name: "Salt & Pepper Lounge"
4. Configure as private community
```

**Total setup time**: ~30 minutes after Docker images download

## 📚 Documentation Files

| File | Use Case |
|------|----------|
| **[LOCAL_QUICKSTART.md](deployment-local/LOCAL_QUICKSTART.md)** | Complete step-by-step guide with screenshots |
| **[README.md](deployment-local/README.md)** | Quick reference & commands |
| **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** | Full 8-phase production roadmap |
| **[PLATFORM_RECOMMENDATIONS.md](PLATFORM_RECOMMENDATIONS.md)** | Architecture & platform specs |

## 🆘 Troubleshooting

**Docker not installed:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

**Permission denied:**
```bash
sudo usermod -aG docker $USER
newgrp docker
```

**Port 80 in use:**
```bash
sudo lsof -i :80
sudo systemctl stop apache2  # If Apache running
```

**View logs:**
```bash
cd "/media/anand/WD BLACK/projects2/greyin/deployment-local"
docker compose -f docker-compose.local.yml logs -f
```

## 🎯 What You Get

After complete setup:

✅ **Greyin Portal** (http://greyin.net)
- Homepage with enterprise hiring features
- Job posting system
- Candidate database
- CRM for client management

✅ **GreyMatters Blog** (http://greymatters.greyin.net)
- Separate branded blog site
- SEO-optimized publishing
- Author profiles
- Tag/category system

✅ **Salt & Pepper Community** (http://community.greyin.net)
- Private discussion forums
- User trust levels
- Moderation tools
- Category organization

✅ **All Services Connected**
- Single Sign-On ready (configure later)
- Unified user management
- Shared branding capability

## 🔄 Next Steps After Local Setup

### Immediate (Week 1)
1. ✅ Complete local deployment
2. 📝 Create first blog post
3. 👥 Add sample job positions
4. 🎨 Customize themes/branding

### Short-term (Week 2-3)
1. 🔗 Set up SSO between Odoo ↔ Discourse
2. 💬 Configure Discourse categories
3. 📊 Add sample data (candidates, clients)
4. 🧪 Test end-to-end workflows

### Long-term (Month 2+)
1. 🛠️ Build FreeAgent marketplace module
2. 📈 Populate real data
3. 🚀 Deploy to production server
4. 🌐 Configure real greyin.net domain

## 💡 Key Differences: Local vs Production

| Feature | Local Dev | Production |
|---------|-----------|------------|
| **SSL/HTTPS** | ❌ HTTP only | ✅ Let's Encrypt SSL |
| **Domains** | /etc/hosts entries | Real DNS (greyin.net) |
| **Email** | ❌ Disabled | ✅ SendGrid/SMTP |
| **Backups** | Manual only | ✅ Automated daily |
| **Performance** | Dev mode (slow) | 4+ workers (fast) |
| **Security** | Minimal | Firewall + fail2ban |

## 📞 Support Resources

- **Odoo Docs**: https://www.odoo.com/documentation/18.0/
- **Discourse Docs**: https://meta.discourse.org/
- **Docker Compose**: https://docs.docker.com/compose/
- **Troubleshooting**: See LOCAL_QUICKSTART.md

---

## 🚀 Ready to Start?

Run this command:

```bash
cd "/media/anand/WD BLACK/projects2/greyin/deployment-local"
chmod +x start.sh
./start.sh
```

**Then follow the on-screen instructions!**

For detailed manual setup, see [LOCAL_QUICKSTART.md](deployment-local/LOCAL_QUICKSTART.md).
