# Greyin Platform - Self-Hosted Supabase Implementation Plan

## Executive Summary

**Platform**: Supabase (Open Source Backend-as-a-Service)  
**License**: Apache 2.0  
**Architecture**: Microservices (Kong + PostgreSQL + PostgREST + GoTrue + Realtime + Storage)  
**Timeline**: 8-10 weeks to MVP  
**Total Cost**: ~$40/month infrastructure + development  

---

## Why Supabase?

### Advantages Over Odoo
✅ **Modern Stack**: PostgreSQL + TypeScript/Node.js  
✅ **Total Frontend Freedom**: Build any UI with React/Vue/Next.js  
✅ **Scalable**: PostgreSQL clustering, horizontal API scaling  
✅ **Developer Experience**: Instant REST + GraphQL APIs  
✅ **Real-time**: WebSocket subscriptions out of the box  
✅ **Row-Level Security**: Enterprise-grade permissions  
✅ **No Master Password Issues**: Standard PostgreSQL auth  

### What You Get
- **Instant APIs**: REST + GraphQL auto-generated from database schema
- **Authentication**: Email, OAuth (Google, GitHub, etc.), magic links
- **Storage**: S3-compatible file uploads with image transformations
- **Realtime**: Subscribe to database changes via WebSockets
- **Admin UI**: Supabase Studio for database management
- **Edge Functions**: Deno-based serverless functions

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRAEFIK (Existing)                       │
│                    edjitsu-prod_edjitsu-network                 │
│         Ports: 80/443 | SSL: Let's Encrypt (letsencrypt)       │
└─────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────┬───────────┼────────────┬──────────────┐
        │             │           │            │              │
        ▼             ▼           ▼            ▼              ▼
┌───────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────────┐
│  greyin   │ │greymat...│ │freeagent │ │saltnpepper│ │  studio    │
│   .net    │ │.greyin...|│.greyin...│ │.greyin... │ │.greyin.net │
└───────────┘ └──────────┘ └──────────┘ └───────────┘ └────────────┘
      │             │            │             │             │
      │             │            │             │             │
      ▼             ▼            ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        KONG API GATEWAY                         │
│                      (API Router + Auth)                        │
└─────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────┬───────────┼────────────┬──────────────┐
        │             │           │            │              │
        ▼             ▼           ▼            ▼              ▼
┌───────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────────┐
│ PostgREST │ │  GoTrue  │ │ Realtime │ │  Storage  │ │   Studio   │
│(REST API) │ │  (Auth)  │ │(WebSocket│ │  (Files)  │ │  (Admin)   │
└───────────┘ └──────────┘ └──────────┘ └───────────┘ └────────────┘
      │             │            │             │             │
      └─────────────┴────────────┴─────────────┴─────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │    PostgreSQL 15         │
                    │  (Main Database)         │
                    │  + pgvector + pg_cron    │
                    └──────────────────────────┘
```

### Frontend Applications (Separate Deployments)

```
┌──────────────────────────────────────────────────────────────┐
│                   Frontend Applications                       │
│                  (Next.js 14 App Router)                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Greyin B2B (greyin.net)                                  │
│     - Candidate portal                                       │
│     - Client dashboard                                       │
│     - Job matching system                                    │
│     - Next.js + Tailwind + shadcn/ui                        │
│                                                               │
│  2. GreyMatters Blog (greymatters.greyin.net)               │
│     - Content CMS                                            │
│     - Article management                                     │
│     - Next.js + MDX                                          │
│                                                               │
│  3. FreeAgent Marketplace (freeagent.greyin.net)            │
│     - Gig listings                                           │
│     - Freelancer profiles                                    │
│     - Search & filter                                        │
│     - Next.js + React                                        │
│                                                               │
│  4. Salt & Pepper Community (saltnpepper.greyin.net)        │
│     - Option A: Custom forum (Next.js)                      │
│     - Option B: Discourse integration                        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                           │
                           │ Supabase Client SDK
                           │ (REST/GraphQL/Realtime)
                           │
                           ▼
              ┌────────────────────────┐
              │   Supabase Backend     │
              │   (api.greyin.net)     │
              └────────────────────────┘
```

---

## Infrastructure Components

### 1. Supabase Stack (Docker Swarm)

| Service | Purpose | Image | Resources |
|---------|---------|-------|-----------|
| **Kong** | API Gateway | kong:2.8 | 512MB RAM |
| **PostgreSQL** | Main Database | supabase/postgres:15.1.0.117 | 2GB RAM |
| **PostgREST** | REST API | postgrest/postgrest:v12.0.1 | 256MB RAM |
| **GoTrue** | Authentication | supabase/gotrue:v2.132.3 | 256MB RAM |
| **Realtime** | WebSocket Server | supabase/realtime:v2.25.35 | 256MB RAM |
| **Storage** | File Uploads | supabase/storage-api:v0.43.11 | 256MB RAM |
| **Studio** | Admin UI | supabase/studio:20240101 | 256MB RAM |
| **Meta** | Migrations | supabase/postgres-meta:v0.68.0 | 128MB RAM |

**Total Resources**: ~4GB RAM, 2 vCPU  
**Recommended VPS**: $40/month (8GB RAM, 4 vCPU)

### 2. Frontend Applications (Separate Containers)

| Service | Framework | Domain | Resources |
|---------|-----------|--------|-----------|
| Greyin B2B | Next.js 14 | greyin.net | 512MB |
| GreyMatters | Next.js 14 | greymatters.greyin.net | 256MB |
| FreeAgent | Next.js 14 | freeagent.greyin.net | 512MB |
| Community | Next.js/Discourse | saltnpepper.greyin.net | 256MB |

**Total Frontend**: ~1.5GB RAM

---

## Database Schema Design

### Core Tables

#### 1. Users & Auth (managed by Supabase Auth)
```sql
-- auth.users (built-in Supabase table)
-- Extended with public.profiles

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('candidate', 'client', 'freelancer', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
```

#### 2. Greyin B2B - Recruitment

```sql
-- Candidates
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  skills TEXT[] DEFAULT '{}',
  experience_years INTEGER,
  resume_url TEXT,
  linkedin_url TEXT,
  availability TEXT CHECK (availability IN ('immediate', '2weeks', '1month', 'not_available')),
  expected_salary_min INTEGER,
  expected_salary_max INTEGER,
  location TEXT,
  remote_preference TEXT CHECK (remote_preference IN ('remote', 'hybrid', 'onsite', 'flexible')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients/Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  size TEXT CHECK (size IN ('1-10', '11-50', '51-200', '201-500', '500+')),
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Postings
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  skills_required TEXT[] DEFAULT '{}',
  experience_min INTEGER,
  experience_max INTEGER,
  salary_min INTEGER,
  salary_max INTEGER,
  location TEXT,
  remote_type TEXT CHECK (remote_type IN ('remote', 'hybrid', 'onsite')),
  status TEXT CHECK (status IN ('draft', 'open', 'closed', 'filled')) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs NOT NULL,
  candidate_id UUID REFERENCES candidates NOT NULL,
  status TEXT CHECK (status IN ('submitted', 'reviewing', 'interview', 'offer', 'rejected', 'accepted')) DEFAULT 'submitted',
  cover_letter TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, candidate_id)
);
```

#### 3. GreyMatters Blog

```sql
-- Blog Posts
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES comments ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. FreeAgent Marketplace

```sql
-- Gigs
CREATE TABLE gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id UUID REFERENCES profiles NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  pricing_type TEXT CHECK (pricing_type IN ('fixed', 'hourly', 'project')),
  price_min INTEGER,
  price_max INTEGER,
  delivery_days INTEGER,
  tags TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('active', 'paused', 'closed')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gig Orders
CREATE TABLE gig_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID REFERENCES gigs NOT NULL,
  client_id UUID REFERENCES profiles NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'delivered', 'completed', 'cancelled')) DEFAULT 'pending',
  requirements TEXT,
  delivery_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Implementation Phases

### **Phase 1: Infrastructure Setup** (Week 1)

**Goal**: Deploy self-hosted Supabase stack with Traefik integration

**Tasks**:
- [x] Clean up Odoo deployment
- [ ] Create Supabase Docker Swarm stack file
- [ ] Configure environment variables (.env)
- [ ] Deploy Supabase services
- [ ] Configure Traefik routing (api.greyin.net, studio.greyin.net)
- [ ] Verify SSL certificates (Let's Encrypt)
- [ ] Test API endpoints
- [ ] Access Supabase Studio admin UI

**Deliverables**:
- ✅ Supabase running on edjitsu-prod network
- ✅ PostgreSQL accessible
- ✅ Studio UI at studio.greyin.net
- ✅ API at api.greyin.net
- ✅ All services healthy

**Testing**:
```bash
# Test API
curl https://api.greyin.net/rest/v1/

# Test Auth
curl https://api.greyin.net/auth/v1/health

# Test Storage
curl https://api.greyin.net/storage/v1/

# Access Studio
open https://studio.greyin.net
```

---

### **Phase 2: Database Schema & Migrations** (Week 2)

**Goal**: Design and implement database schema for all 4 pillars

**Tasks**:
- [ ] Create database migrations (SQL files)
- [ ] Implement profiles table with RLS policies
- [ ] Create Greyin B2B schema (candidates, companies, jobs, applications)
- [ ] Create GreyMatters schema (posts, comments, categories)
- [ ] Create FreeAgent schema (gigs, orders, reviews)
- [ ] Set up Row-Level Security (RLS) policies for all tables
- [ ] Create database functions (PostgreSQL)
- [ ] Test CRUD operations via PostgREST API

**Deliverables**:
- ✅ All tables created with proper relationships
- ✅ RLS policies enforcing security
- ✅ Database functions for complex queries
- ✅ API endpoints auto-generated

**Example RLS Policy**:
```sql
-- Only candidates can update their own profile
CREATE POLICY "Candidates update own data"
  ON candidates FOR UPDATE
  USING (user_id = auth.uid());

-- Companies can view applications for their jobs
CREATE POLICY "Companies view applications"
  ON applications FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE company_id IN (
        SELECT id FROM companies WHERE user_id = auth.uid()
      )
    )
  );
```

---

### **Phase 3: Frontend - Greyin B2B** (Weeks 3-4)

**Goal**: Build recruitment platform frontend

**Tech Stack**:
- Next.js 14 (App Router)
- Tailwind CSS + shadcn/ui components
- Supabase JS Client
- React Query (data fetching)
- Zustand (state management)

**Features**:

**Candidate Portal**:
- [ ] Registration & profile setup
- [ ] Resume upload (Supabase Storage)
- [ ] Job search & filters
- [ ] Apply to jobs
- [ ] Application tracking dashboard

**Client Portal**:
- [ ] Company profile setup
- [ ] Post job openings
- [ ] View applications
- [ ] Candidate search
- [ ] Interview scheduling

**Admin Dashboard**:
- [ ] User management
- [ ] Job approval workflow
- [ ] Analytics & reporting

**Example Code**:
```typescript
// app/jobs/page.tsx
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function JobsPage() {
  const supabase = createClientComponentClient()
  
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      *,
      company:companies(name, logo_url),
      applications_count:applications(count)
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  
  return <JobList jobs={jobs} />
}
```

**Deliverables**:
- ✅ Working Greyin B2B application at greyin.net
- ✅ User authentication (email + OAuth)
- ✅ Job posting & application flow
- ✅ Real-time notifications (Realtime subscriptions)

---

### **Phase 4: Frontend - GreyMatters Blog** (Week 5)

**Goal**: Build content platform

**Features**:
- [ ] Blog post listing & detail pages
- [ ] MDX support for rich content
- [ ] Author profiles
- [ ] Comments system
- [ ] Tag-based navigation
- [ ] Search functionality
- [ ] RSS feed

**Tech Stack**:
- Next.js 14 with MDX
- Contentlayer (MDX processing)
- Supabase (metadata + comments)
- Tailwind Typography

**Example**:
```typescript
// app/blog/[slug]/page.tsx
export default async function BlogPost({ params }) {
  const supabase = createClient()
  
  const { data: post } = await supabase
    .from('posts')
    .select(`
      *,
      author:profiles(full_name, avatar_url),
      comments(*, user:profiles(full_name, avatar_url))
    `)
    .eq('slug', params.slug)
    .single()
  
  return <PostLayout post={post} />
}
```

**Deliverables**:
- ✅ Blog at greymatters.greyin.net
- ✅ Content management via Studio
- ✅ Comments with real-time updates
- ✅ SEO optimized

---

### **Phase 5: Frontend - FreeAgent Marketplace** (Week 6-7)

**Goal**: Build gig marketplace

**Features**:
- [ ] Gig listings with search & filters
- [ ] Freelancer profiles
- [ ] Gig detail pages
- [ ] Order management
- [ ] File delivery system
- [ ] Review & rating system
- [ ] Payment integration (Stripe - future)

**Example**:
```typescript
// app/gigs/page.tsx
export default function GigsPage() {
  const { data: gigs } = useQuery({
    queryKey: ['gigs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('gigs')
        .select(`
          *,
          freelancer:profiles(full_name, avatar_url),
          reviews:gig_reviews(rating)
        `)
        .eq('status', 'active')
      
      return data
    }
  })
  
  return <GigGrid gigs={gigs} />
}
```

**Deliverables**:
- ✅ Marketplace at freeagent.greyin.net
- ✅ Gig creation & management
- ✅ Order workflow
- ✅ File uploads via Storage

---

### **Phase 6: Community Platform** (Week 8)

**Goal**: Deploy community forum

**Option A: Custom Forum (Next.js)**
- Build with Supabase
- Threads, replies, upvotes
- Real-time updates

**Option B: Discourse Integration** (Recommended)
- Reuse Discourse from previous attempt
- Integrate auth with Supabase (JWT SSO)
- Simpler than building from scratch

**Deliverables**:
- ✅ Community at saltnpepper.greyin.net
- ✅ User authentication synced
- ✅ Forum categories configured

---

### **Phase 7: Email & Notifications** (Week 9)

**Goal**: Set up transactional emails

**Services**:
- Supabase Edge Functions (Deno)
- Resend.com or SMTP (Hostinger)
- React Email (email templates)

**Email Types**:
- Welcome emails
- Job application notifications
- New gig alerts
- Password reset
- Comment notifications

**Example Edge Function**:
```typescript
// supabase/functions/send-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { to, subject, html } = await req.json()
  
  // Send via SMTP
  await sendEmail({ to, subject, html })
  
  return new Response(JSON.stringify({ success: true }))
})
```

---

### **Phase 8: Testing & Launch** (Week 10)

**Goal**: Production readiness

**Tasks**:
- [ ] E2E testing (Playwright)
- [ ] Load testing (k6)
- [ ] Security audit (RLS policies)
- [ ] Performance optimization
- [ ] Monitoring setup (Sentry, PostHog)
- [ ] Backup automation
- [ ] Documentation

**Launch Checklist**:
- ✅ All 4 domains working with SSL
- ✅ Authentication flows tested
- ✅ Database backups automated
- ✅ Error monitoring active
- ✅ Performance benchmarks met
- ✅ User documentation ready

---

## Deployment Strategy

### Docker Swarm Stack

**File**: `supabase-stack.yml`

**Services**:
1. PostgreSQL (database)
2. Kong (API gateway)
3. PostgREST (REST API)
4. GoTrue (auth)
5. Realtime (WebSocket)
6. Storage (files)
7. Studio (admin)
8. Meta (migrations)

### Traefik Integration

**Labels** (on Kong service):
```yaml
traefik.enable: "true"
traefik.http.routers.supabase-api.rule: "Host(`api.greyin.net`)"
traefik.http.routers.supabase-api.tls.certresolver: "letsencrypt"
```

### Frontend Deployment

**Options**:

**Option 1: Docker Containers** (with Traefik)
- Build Next.js apps as Docker images
- Deploy as Swarm services
- Integrate with edjitsu-prod network

**Option 2: Vercel/Netlify** (easier)
- Deploy frontends to edge network
- Point to self-hosted API (api.greyin.net)
- Better performance, zero config

**Recommendation**: Option 1 for full control, Option 2 for speed

---

## Cost Breakdown

### Infrastructure (Monthly)

| Item | Cost |
|------|------|
| VPS (8GB RAM, 4 vCPU) | $40 |
| Domain (greyin.net) | $0 (existing) |
| SSL Certificates | $0 (Let's Encrypt) |
| Backups (Backblaze B2) | $5 |
| Email (Hostinger SMTP) | $0 (existing) |
| **Total Monthly** | **$45** |

### Development (One-Time)

| Phase | Hours | Cost @$100/hr |
|-------|-------|---------------|
| Infrastructure Setup | 20 | $2,000 |
| Database Schema | 30 | $3,000 |
| Greyin B2B Frontend | 120 | $12,000 |
| GreyMatters Frontend | 40 | $4,000 |
| FreeAgent Frontend | 80 | $8,000 |
| Community Setup | 20 | $2,000 |
| Email & Functions | 30 | $3,000 |
| Testing & Launch | 40 | $4,000 |
| **Total Development** | **360 hrs** | **$36,000** |

### 5-Year TCO

- Infrastructure: $45 × 60 = $2,700
- Development: $36,000
- **Total**: **$38,700**

**vs Odoo**: $80,200 (you save $41,500!)

---

## Success Metrics

### Week 4 (MVP)
- ✅ Supabase deployed and accessible
- ✅ Greyin B2B working (basic job posting + application)
- ✅ 10 test users can register and use the platform

### Week 8 (Beta)
- ✅ All 4 pillars deployed
- ✅ 100 users onboarded
- ✅ 50 job postings
- ✅ 20 gigs listed

### Week 12 (Production)
- ✅ 500+ users
- ✅ 200+ jobs
- ✅ 100+ gigs
- ✅ Blog publishing regularly
- ✅ Community active

---

## Next Steps

1. **Review this plan** - Approve architecture and timeline
2. **Deploy Supabase** - Run the stack deployment (30 minutes)
3. **Test API access** - Verify all services working
4. **Create database schema** - Run initial migrations (Week 2)
5. **Start frontend development** - Begin with Greyin B2B (Week 3)

---

## Files to Create

1. ✅ `supabase-stack.yml` - Docker Swarm configuration
2. ✅ `.env.supabase` - Supabase environment variables
3. ✅ `deploy-supabase.sh` - Deployment script
4. ✅ `migrations/` - Database migration files
5. ✅ `frontend/` - Next.js applications (4 apps)

Ready to proceed? I'll create the Supabase stack file and deployment script next.
