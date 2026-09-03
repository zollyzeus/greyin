# Greyin Platform - Self-Hosted Supabase Deployment

Complete deployment guide for the Greyin 4-pillar platform using self-hosted Supabase on Docker Swarm with Traefik integration.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Detailed Setup](#detailed-setup)
5. [Post-Deployment](#post-deployment)
6. [Troubleshooting](#troubleshooting)
7. [Architecture](#architecture)

---

## 🎯 Overview

**Platform**: Supabase (Self-Hosted)  
**Stack**: PostgreSQL + Kong + PostgREST + GoTrue + Realtime + Storage + Studio  
**Deployment**: Docker Swarm  
**Reverse Proxy**: Traefik (existing edjitsu-prod)  
**Domains**: 
- `greyin.net` (Main B2B Platform)
- `greymatters.greyin.net` (Blog)
- `freeagent.greyin.net` (Marketplace)
- `saltnpepper.greyin.net` (Community)
- `api.greyin.net` (Supabase API)
- `studio.greyin.net` (Supabase Admin UI)

---

## ✅ Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04+ or similar Linux
- **RAM**: 8GB minimum (16GB recommended)
- **Storage**: 50GB free space
- **Docker**: 20.10+
- **Docker Swarm**: Initialized
- **Traefik**: Running on `edjitsu-prod_edjitsu-network`

### DNS Configuration

All domains must have A records pointing to your server IP:

```
greyin.net                 → YOUR_SERVER_IP
greymatters.greyin.net     → YOUR_SERVER_IP
freeagent.greyin.net       → YOUR_SERVER_IP
saltnpepper.greyin.net     → YOUR_SERVER_IP
api.greyin.net             → YOUR_SERVER_IP
studio.greyin.net          → YOUR_SERVER_IP
```

✅ **Status**: Confirmed configured on Hostinger

### Existing Infrastructure

- ✅ Docker Swarm active
- ✅ Traefik running with Let's Encrypt
- ✅ Network: `edjitsu-prod_edjitsu-network`
- ✅ SMTP: Hostinger (admin@greyin.net)

---

## 🚀 Quick Start

### Step 1: Deploy Supabase

```bash
cd "/media/anand/WD BLACK/projects2/greyin/deployment"

# Make deployment script executable
chmod +x deploy-supabase.sh

# Run deployment
./deploy-supabase.sh
```

The script will:
- ✅ Check prerequisites
- ✅ Deploy all Supabase services
- ✅ Configure Traefik routing
- ✅ Wait for services to start
- ✅ Display access information

### Step 2: Access Supabase Studio

```bash
# Open in browser
https://studio.greyin.net

# Login with:
Username: admin@greyin.net
Password: Infy@121238
```

### Step 3: Create Database Schema

1. In Studio, go to **SQL Editor**
2. Open `migrations/001_initial_schema.sql`
3. Copy and paste the entire file
4. Click **Run**

This creates all tables for:
- User profiles
- Recruitment (jobs, applications)
- Blog (posts, comments)
- Marketplace (gigs, orders)

### Step 4: Verify API

```bash
# Test REST API
curl https://api.greyin.net/rest/v1/

# Test Auth
curl https://api.greyin.net/auth/v1/health

# Should return: {"status":"ok"}
```

✅ **Done!** Supabase is now running.

---

## 📖 Detailed Setup

### Configuration Files

| File | Purpose |
|------|---------|
| `.env` | Environment variables (domains, passwords, secrets) |
| `supabase-stack.yml` | Docker Swarm stack definition |
| `config/kong.yml` | API Gateway routing configuration |
| `deploy-supabase.sh` | Automated deployment script |
| `migrations/001_initial_schema.sql` | Database schema |

### Environment Variables

Key variables in `.env`:

```bash
# Domains
API_DOMAIN=api.greyin.net
STUDIO_DOMAIN=studio.greyin.net

# Security (CHANGE THESE IN PRODUCTION!)
POSTGRES_PASSWORD=...          # Database password
JWT_SECRET=...                 # JWT signing key
ANON_KEY=...                   # Public API key
SERVICE_ROLE_KEY=...           # Private API key

# Network
TRAEFIK_NETWORK=edjitsu-prod_edjitsu-network

# SMTP
SMTP_HOST=smtp.hostinger.com
SMTP_USER=admin@greyin.net
```

### Service Architecture

```
Traefik (edjitsu-prod)
    ↓
Kong (API Gateway)
    ├─→ PostgREST (REST API)      → PostgreSQL
    ├─→ GoTrue (Auth)              → PostgreSQL
    ├─→ Realtime (WebSocket)       → PostgreSQL
    ├─→ Storage (Files)            → Local Storage + PostgreSQL
    ├─→ Meta (DB Management)       → PostgreSQL
    └─→ Studio (Admin UI)          → Meta

PostgreSQL (Main Database)
    ├─ auth schema (GoTrue)
    ├─ storage schema (Storage API)
    └─ public schema (Your app data)
```

### Services Deployed

| Service | Port | Purpose | URL |
|---------|------|---------|-----|
| Kong | 8000 | API Gateway | api.greyin.net |
| Studio | 3000 | Admin UI | studio.greyin.net |
| PostgreSQL | 5432 | Database | Internal |
| PostgREST | 3000 | REST API | Internal |
| GoTrue | 9999 | Auth | Internal |
| Realtime | 4000 | WebSocket | Internal |
| Storage | 5000 | Files | Internal |

---

## 🔧 Post-Deployment

### 1. Access Studio UI

Navigate to: https://studio.greyin.net

Features:
- **Table Editor**: Create/edit tables visually
- **SQL Editor**: Run custom SQL queries
- **Authentication**: Manage users
- **Storage**: Manage file buckets
- **API**: View auto-generated API docs
- **Database**: View schema and relationships

### 2. Create Storage Buckets

For file uploads (resumes, images, etc.):

```sql
-- In Studio SQL Editor
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('resumes', 'resumes', false),
  ('gig-images', 'gig-images', true),
  ('blog-images', 'blog-images', true);

-- Set storage policies
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 3. Configure Email Templates

In Studio:
1. Go to **Authentication** → **Email Templates**
2. Customize:
   - Confirm signup email
   - Password reset email
   - Magic link email

### 4. Enable OAuth Providers (Optional)

For Google/GitHub/LinkedIn login:

1. Go to **Authentication** → **Providers**
2. Enable desired providers
3. Add OAuth credentials

### 5. Test Database Connection

```bash
# Install PostgreSQL client
sudo apt-get install postgresql-client

# Connect to database
PGPASSWORD="your_postgres_password" psql \
  -h localhost \
  -p 5432 \
  -U postgres \
  -d postgres

# List tables
\dt public.*
```

---

## 🎨 Frontend Development

### Next.js Setup

Install Supabase client:

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

Create Supabase client:

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://api.greyin.net'
const supabaseAnonKey = 'your_anon_key_from_env'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Example usage:

```typescript
// app/jobs/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export default async function JobsPage() {
  const supabase = createServerComponentClient({ cookies })
  
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      *,
      company:companies(name, logo_url),
      applications_count:applications(count)
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  
  return <JobsList jobs={jobs} />
}
```

### Authentication

```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: {
      full_name: 'John Doe'
    }
  }
})

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
})

// Get current user
const { data: { user } } = await supabase.auth.getUser()
```

### Real-time Subscriptions

```typescript
// Subscribe to new jobs
supabase
  .channel('jobs')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'jobs'
  }, (payload) => {
    console.log('New job posted:', payload.new)
  })
  .subscribe()
```

### File Uploads

```typescript
// Upload file
const { data, error } = await supabase.storage
  .from('resumes')
  .upload(`${userId}/resume.pdf`, file)

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('avatars')
  .getPublicUrl('user123/avatar.jpg')
```

---

## 🛠 Management & Monitoring

### View Service Status

```bash
# List all services
docker stack services supabase

# Check specific service
docker service ps supabase_supabase_db

# View logs
docker service logs supabase_supabase_db -f
docker service logs supabase_kong -f
docker service logs supabase_studio -f
```

### Service Logs

```bash
# Database logs
docker service logs supabase_supabase_db --tail 100

# API Gateway logs
docker service logs supabase_kong --tail 100

# Auth logs
docker service logs supabase_auth --tail 100

# Storage logs
docker service logs supabase_storage --tail 100
```

### Database Backups

```bash
# Create backup
docker exec $(docker ps -q -f name=supabase_db) \
  pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# Restore from backup
cat backup_20260805.sql | docker exec -i $(docker ps -q -f name=supabase_db) \
  psql -U postgres postgres
```

### Update Supabase

To update to newer versions:

1. Update image tags in `supabase-stack.yml`
2. Redeploy:

```bash
./deploy-supabase.sh
```

---

## 🐛 Troubleshooting

### Services Not Starting

```bash
# Check service status
docker stack ps supabase --no-trunc

# Check if Traefik network exists
docker network ls | grep edjitsu

# Verify environment variables loaded
docker service inspect supabase_kong --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}' | jq
```

### API Not Accessible

```bash
# Test from inside network
docker exec $(docker ps -q -f name=supabase_kong) curl http://localhost:8000

# Check Traefik routing
docker service logs edjitsu-prod_traefik | grep api.greyin.net

# Verify DNS
dig api.greyin.net
nslookup api.greyin.net
```

### SSL Certificate Issues

```bash
# Check Traefik logs
docker service logs edjitsu-prod_traefik | grep -i "certResolver"

# Verify Let's Encrypt
curl -I https://api.greyin.net
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker service ps supabase_supabase_db

# Test connection
docker exec $(docker ps -q -f name=supabase_db) pg_isready -U postgres

# Check logs
docker service logs supabase_supabase_db
```

### Studio Not Loading

```bash
# Check Studio service
docker service ps supabase_studio

# Check logs
docker service logs supabase_studio --tail 50

# Verify Meta service is running
docker service ps supabase_meta
```

### Reset Everything

```bash
# Remove stack
docker stack rm supabase

# Remove volumes (WARNING: deletes all data!)
docker volume rm supabase_supabase_db_data
docker volume rm supabase_supabase_storage_data

# Redeploy
./deploy-supabase.sh
```

---

## 📚 Resources

### Official Documentation

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Self-Hosting](https://supabase.com/docs/guides/self-hosting)
- [PostgREST API](https://postgrest.org/en/stable/)
- [Kong Gateway](https://docs.konghq.com/)

### Helpful Links

- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Functions](https://supabase.com/docs/guides/database/functions)
- [Realtime Subscriptions](https://supabase.com/docs/guides/realtime)
- [Storage API](https://supabase.com/docs/guides/storage)

### Support

- **Discord**: https://discord.supabase.com
- **GitHub Issues**: https://github.com/supabase/supabase
- **Stack Overflow**: Tag `supabase`

---

## 🎯 Next Steps

1. ✅ Deploy Supabase (you are here!)
2. ⏳ Run database migrations
3. ⏳ Build frontend applications
4. ⏳ Configure email templates
5. ⏳ Set up monitoring
6. ⏳ Launch in production

---

## 📞 Quick Reference

### Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| **Studio** | https://studio.greyin.net | admin@greyin.net / Infy@121238 |
| **API** | https://api.greyin.net | Use ANON_KEY from .env |

### Useful Commands

```bash
# Deploy
./deploy-supabase.sh

# View services
docker stack services supabase

# View logs
docker service logs supabase_kong -f

# Remove stack
docker stack rm supabase

# Backup database
docker exec $(docker ps -q -f name=supabase_db) pg_dump -U postgres postgres > backup.sql

# Access PostgreSQL
docker exec -it $(docker ps -q -f name=supabase_db) psql -U postgres
```

---

**🎉 Supabase deployment complete! Ready to build your 4-pillar platform.**
