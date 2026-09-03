# 🚀 Greyin Platform - Complete Deployment Guide

This guide provides step-by-step instructions to deploy the complete Greyin platform including:
- **Backend**: Supabase (PostgreSQL, Kong, Auth, Storage, Realtime, Studio)
- **Frontends**: 4 Next.js applications (Greyin B2B, GreyMatters, FreeAgent, Salt & Pepper)

## 📋 Prerequisites

- Ubuntu server with Docker and Docker Swarm initialized
- Traefik reverse proxy running on `edjitsu-prod_edjitsu-network`
- DNS A records configured for all domains (pointing to your server IP):
  - greyin.net
  - greymatters.greyin.net
  - freeagent.greyin.net
  - saltnpepper.greyin.net
  - api.greyin.net
  - studio.greyin.net
- SMTP credentials (Hostinger configured: admin@greyin.net)

## 🎯 Quick Start (Complete Deployment)

```bash
cd /media/anand/WD\ BLACK/projects2/greyin/deployment

# Step 1: Deploy Supabase Backend
chmod +x deploy-supabase.sh
./deploy-supabase.sh

# Step 2: Run Database Migrations
# Access https://studio.greyin.net
# Login with: admin@greyin.net / Infy@121238
# Navigate to SQL Editor
# Copy and paste contents of migrations/001_initial_schema.sql
# Execute the SQL

# Step 3: Build and Deploy Frontend Applications
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

That's it! Your complete platform will be deployed.

## 📦 What Gets Deployed

### Backend Services (Supabase Stack)
- **PostgreSQL 15**: Main database with all tables and RLS policies
- **Kong API Gateway**: Routes all API requests (api.greyin.net)
- **PostgREST**: REST API for database
- **GoTrue**: Authentication and user management
- **Realtime**: WebSocket server for real-time features
- **Storage**: File uploads and image serving
- **Studio**: Admin dashboard (studio.greyin.net)
- **Analytics**: Usage tracking (optional)

### Frontend Applications
1. **Greyin B2B** (greyin.net)
   - Company registration and profiles
   - Job posting and management
   - Candidate registration and profiles
   - Job search and applications
   - Application tracking dashboard

2. **GreyMatters Blog** (greymatters.greyin.net)
   - Blog post listings with categories
   - Post detail pages with comments
   - Author profiles
   - Tag navigation and search

3. **FreeAgent Marketplace** (freeagent.greyin.net)
   - Freelancer gig listings
   - Service categories
   - Order placement and management
   - Reviews and ratings

4. **Salt & Pepper Community** (saltnpepper.greyin.net)
   - Community discussions
   - Forum threads and replies
   - User interactions

## 📝 Detailed Step-by-Step Instructions

### Phase 1: Backend Deployment (10-15 minutes)

```bash
cd /media/anand/WD\ BLACK/projects2/greyin/deployment

# Verify prerequisites
docker info | grep Swarm
docker network ls | grep edjitsu-prod_edjitsu-network

# Deploy Supabase
./deploy-supabase.sh
```

**Expected Output:**
- All pre-flight checks pass ✓
- 9 services deployed (supabase_db, kong, rest, auth, realtime, storage, imgproxy, meta, studio, analytics)
- Services reach "Running" state
- PostgreSQL health check passes

**Verify Deployment:**
```bash
docker stack ps supabase
docker service logs supabase_supabase_db
curl -I https://api.greyin.net
curl -I https://studio.greyin.net
```

### Phase 2: Database Setup (5 minutes)

1. **Access Supabase Studio:**
   - Navigate to: https://studio.greyin.net
   - Login: admin@greyin.net
   - Password: Infy@121238

2. **Run Migrations:**
   - Click "SQL Editor" in left sidebar
   - Click "New query"
   - Copy entire contents of `migrations/001_initial_schema.sql`
   - Paste and click "Run"
   - Verify: "Success. No rows returned"

3. **Verify Tables Created:**
   - Click "Table Editor" in left sidebar
   - You should see tables: profiles, companies, candidates, jobs, applications, posts, comments, gigs, etc.

4. **Check RLS Policies:**
   - Click on any table (e.g., "jobs")
   - Click "Policies" tab
   - Verify policies are enabled (e.g., "Users can view active jobs")

### Phase 3: Frontend Deployment (20-30 minutes)

```bash
cd /media/anand/WD\ BLACK/projects2/greyin/deployment

# Build and deploy all frontend apps
./deploy-frontend.sh
```

**What Happens:**
1. Builds 4 Docker images (this takes ~5-10 min per app):
   - deepedge:latest
   - greymatters-blog:latest
   - flexpro:latest
   - saltnpepper-community:latest

2. Deploys greyin-frontend stack with 4 services

3. Traefik automatically:
   - Detects services via labels
   - Requests Let's Encrypt SSL certificates
   - Routes traffic to correct services

**Verify Deployment:**
```bash
docker stack ps greyin-frontend
docker service ls | grep greyin-frontend
```

### Phase 4: Verification (5 minutes)

Visit each application and verify it loads:

```bash
# Test all domains
curl -I https://greyin.net
curl -I https://greymatters.greyin.net
curl -I https://freeagent.greyin.net
curl -I https://saltnpepper.greyin.net
```

**Browser Testing:**
1. **Greyin B2B** (https://greyin.net)
   - Home page loads with hero section
   - Click "Get Started" → Registration form appears
   - Click "Browse Jobs" → Jobs page loads (empty initially)

2. **GreyMatters Blog** (https://greymatters.greyin.net)
   - Home page loads with blog layout
   - Categories sidebar visible
   - "No posts yet" message (expected, no content)

3. **FreeAgent** (https://freeagent.greyin.net)
   - Marketplace home page loads
   - Service categories visible

4. **Salt & Pepper** (https://saltnpepper.greyin.net)
   - Community home page loads
   - Discussion categories visible

## 🔑 Credentials

### Supabase Admin
- **URL**: https://studio.greyin.net
- **Email**: admin@greyin.net
- **Password**: Infy@121238

### Database (Internal)
- **Host**: supabase_db (Docker network)
- **Database**: postgres
- **User**: postgres
- **Password**: (auto-generated in .env)

### API Keys (for Frontend)
- **Supabase URL**: https://api.greyin.net
- **Anon Key**: (in .env as NEXT_PUBLIC_SUPABASE_ANON_KEY)
- **Service Role Key**: (in .env as SERVICE_ROLE_KEY - keep private!)

## 🔧 Troubleshooting

### Backend Issues

**Services not starting:**
```bash
# Check service logs
docker service logs supabase_supabase_db
docker service logs supabase_kong
docker service logs supabase_auth

# Check service status
docker service ps supabase_supabase_db --no-trunc
```

**Database connection errors:**
```bash
# Restart database service
docker service update --force supabase_supabase_db

# Check PostgreSQL logs
docker service logs supabase_supabase_db --tail 100
```

**Kong/API not responding:**
```bash
# Check Kong configuration
docker service logs supabase_kong

# Verify Kong config file
cat config/kong.yml

# Restart Kong
docker service update --force supabase_kong
```

### Frontend Issues

**Services not starting:**
```bash
# Check specific service logs
docker service logs greyin-frontend_deepedge_web
docker service logs greyin-frontend_greymatters_web

# Rebuild and redeploy specific app
cd ../apps/deepedge
docker build -t deepedge:latest .
docker service update --force greyin-frontend_deepedge_web
```

**SSL certificate not issued:**
- Wait 2-5 minutes for Let's Encrypt
- Check Traefik logs: `docker service logs edjitsu-prod_traefik`
- Verify DNS records point to server: `dig greyin.net +short`

**Application shows connection error:**
- Verify environment variables: `docker service inspect greyin-frontend_deepedge_web --format '{{.Spec.TaskTemplate.ContainerSpec.Env}}'`
- Check Supabase API is accessible: `curl https://api.greyin.net`
- Restart frontend service: `docker service update --force greyin-frontend_deepedge_web`

## 📊 Monitoring

**View all services:**
```bash
docker stack ps supabase
docker stack ps greyin-frontend
```

**Monitor logs:**
```bash
# Backend
docker service logs -f supabase_supabase_db
docker service logs -f supabase_kong

# Frontend
docker service logs -f greyin-frontend_deepedge_web
docker service logs -f greyin-frontend_greymatters_web
```

**Resource usage:**
```bash
docker stats
```

## 🔄 Updates and Maintenance

**Update backend:**
```bash
cd /media/anand/WD\ BLACK/projects2/greyin/deployment
docker stack deploy -c supabase-stack.yml supabase
```

**Update specific frontend app:**
```bash
cd ../apps/deepedge
docker build -t deepedge:latest .
docker service update --image deepedge:latest greyin-frontend_deepedge_web
```

**Database backups:**
```bash
# Create backup
docker exec $(docker ps -q -f name=supabase_supabase_db) pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup_20250120.sql | docker exec -i $(docker ps -q -f name=supabase_supabase_db) psql -U postgres postgres
```

## 🎉 Next Steps

1. **Create test user:**
   - Go to https://greyin.net
   - Click "Get Started"
   - Register as candidate or company
   - Check email for verification link

2. **Post sample content:**
   - Login to Studio: https://studio.greyin.net
   - Navigate to Table Editor → posts
   - Insert sample blog post
   - Visit https://greymatters.greyin.net to see it

3. **Configure email templates:**
   - In Studio, go to Authentication → Email Templates
   - Customize welcome, reset password emails

4. **Set up storage buckets:**
   - In Studio, go to Storage
   - Create buckets: resumes, avatars, blog-images, gig-images
   - Configure access policies

5. **Monitor usage:**
   - Check Analytics in Studio
   - Review logs for errors
   - Monitor server resources

## 📞 Support

For issues or questions:
- Check logs: `docker service logs <service_name>`
- Review Supabase docs: https://supabase.com/docs
- Check Next.js docs: https://nextjs.org/docs

## 🎯 Summary

You now have a complete, production-ready platform with:
- ✅ Self-hosted Supabase backend with PostgreSQL, Auth, Storage, Realtime
- ✅ 4 Next.js frontend applications with SSR and optimized builds
- ✅ Automatic SSL via Let's Encrypt
- ✅ Professional routing via Traefik
- ✅ Complete database schema with RLS security
- ✅ Email integration via SMTP
- ✅ Admin dashboard for management
- ✅ Scalable Docker Swarm deployment

**Total deployment time: ~45 minutes**

Congratulations! 🎊
