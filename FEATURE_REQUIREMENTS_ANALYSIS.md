# Greyin Ecosystem - Comprehensive Feature Requirements Analysis

**Generated:** August 6, 2026  
**Purpose:** Deep-dive analysis and implementation roadmap for all 4 platforms

---

## 📊 Overview

This document provides a detailed analysis of feature requirements from the business plan and maps them to implementation tasks for each platform in the Greyin ecosystem.

---

## 🎯 PILLAR 1: GREYIN B2B PORTAL

**URL:** https://greyin.net  
**Target Audience:** Enterprise clients, hiring managers, corporate HR  
**Core Value Proposition:** Age-blind senior talent placement (12+ years), fractional leadership, outplacement services

### Current Implementation Status
- ✅ Homepage with hero section
- ✅ Basic navigation structure
- ✅ Database schema (companies, jobs, candidates, applications)
- ❌ Job browsing/posting functionality
- ❌ Company profiles
- ❌ Candidate search and filtering
- ❌ Application management
- ❌ Fractional leadership marketplace
- ❌ Outplacement package system

### Required Features (from Business Plan)

#### A. Job Management System
**Priority:** HIGH  
**Business Value:** Core revenue driver (10% placement fee)

Features:
1. **Job Posting Dashboard** (Companies)
   - Rich text editor for job descriptions
   - Skills/experience tagging
   - Salary range (optional/hidden to reduce ageism)
   - Employment type: Full-time, Fractional, Contract, Advisory
   - Location: Remote, Hybrid, On-site
   - Years of experience: Minimum threshold
   - Application deadline
   - Draft/Published status

2. **Job Browsing** (Candidates)
   - Advanced filtering:
     - Skills & tech stack
     - Experience level (Junior/Mid/Senior/Principal)
     - Employment type
     - Location & remote options
     - Salary range
     - Company size
   - Search by keywords
   - Saved jobs/bookmarks
   - Job recommendations based on profile
   - Email alerts for matching jobs

3. **Application System**
   - One-click apply with profile
   - Cover letter (optional)
   - Resume upload
   - Application status tracking:
     - Submitted → Reviewed → Shortlisted → Interview → Offered → Accepted/Rejected
   - Application history
   - Withdraw application option

#### B. Company Profiles
**Priority:** HIGH  
**Business Value:** Trust & credibility for talent

Features:
1. Company dashboard with:
   - Logo, description, industry
   - Company size, founding year
   - Tech stack & tools used
   - Culture & values
   - Benefits offered
   - Office locations
   - Website & social links
2. Active job listings
3. Company reviews (optional future enhancement)
4. Hiring team members

#### C. Candidate Profiles & Search
**Priority:** HIGH  
**Business Value:** Core product for enterprise clients

Features:
1. **Candidate Profile Builder**
   - Professional summary
   - Skills & expertise (tags)
   - Work experience timeline
   - Education & certifications
   - Portfolio/GitHub/LinkedIn links
   - Availability: Immediately, 2 weeks, 1 month, etc.
   - Preferred roles: Full-time, Fractional, Advisory
   - Expected compensation range
   - Age-blind by default (no DOB field)

2. **Age-Blind Talent Search** (For companies)
   - Filter by:
     - Skills & tech stack
     - Years of experience (not age!)
     - Current role/seniority
     - Location preferences
     - Availability
   - Boolean search operators
   - Save search queries
   - Bulk messaging to candidates

#### D. Fractional Leadership Marketplace
**Priority:** MEDIUM  
**Business Value:** Differentiator, higher-value placements

Features:
1. Fractional role listings:
   - Fractional CTO, VP Engineering, Product Lead, etc.
   - Hours per week: 10h, 20h, 30h
   - Duration: 3 months, 6 months, ongoing
   - Hourly rate or monthly retainer
2. Expert directory:
   - Browse fractional leaders by domain
   - Availability calendar
   - Past fractional engagements
3. Engagement workflow:
   - Discovery call scheduling
   - Scope of work definition
   - Contract templates
   - Monthly reporting

#### E. Corporate Outplacement Packages
**Priority:** MEDIUM  
**Business Value:** B2B contract revenue ($2,500+ per package)

Features:
1. **Package Tiers:**
   - Basic ($2,500): Profile optimization, resume review, 2 coaching sessions
   - Professional ($5,000): + Interview prep, job matching, 4 coaching sessions
   - Executive ($10,000): + Executive branding, leadership placement, 8 sessions

2. **Outplacement Dashboard** (For HR teams)
   - Bulk enrollment of departing employees
   - Progress tracking per employee
   - Success metrics (placement rate, time-to-hire)
   - Reporting for stakeholders

3. **Candidate Experience:**
   - Onboarding wizard
   - Coaching session scheduling
   - Resource library (resume templates, interview guides)
   - Job matching recommendations
   - Progress milestones

---

## 📝 PILLAR 2: GREYMATTERS BLOG

**URL:** https://greymatters.greyin.net  
**Target Audience:** Domain practitioners, engineering VPs, hiring executives  
**Core Value Proposition:** Deep technical content, SEO-driven lead generation

### Current Implementation Status
- ✅ Homepage with post listing
- ✅ Database schema (posts, categories, comments)
- ✅ Markdown support in schema
- ❌ Individual post pages
- ❌ Rich Markdown rendering
- ❌ Category pages
- ❌ Author profiles
- ❌ Comment system
- ❌ Search functionality
- ❌ RSS feed
- ❌ Newsletter signup
- ❌ Related posts

### Required Features (from Business Plan)

#### A. Editorial Publishing System
**Priority:** HIGH  
**Business Value:** TOFU organic acquisition engine

Features:
1. **Post Creation/Editing** (Admin/Authors)
   - Rich Markdown editor with live preview
   - Code syntax highlighting
   - Image upload & embedding
   - Cover image selection
   - SEO meta fields:
     - Meta title
     - Meta description
     - OG tags (social sharing)
   - Category & tag selection
   - Publication scheduling
   - Draft/Published/Archived states
   - Slug auto-generation from title

2. **Content Types:**
   - **Architecture Teardowns:**
     - Examples: "AUTOSAR Zonal Architecture vs Centralized Compute"
     - "Local LLM Deployments on On-Prem Hardware"
     - Technical diagrams, code samples
   - **Career Insights:**
     - "Navigating Ageism in Tech After 40"
     - "Transitioning from Embedded Hardware to AI/ML"
     - "Fractional Leadership: A Guide for 15+ Year Veterans"
   - **Community Spotlights:**
     - Highlighting Salt & Pepper member projects
     - FreeAgent success stories
     - Senior builder MVPs

3. **Post Reading Experience**
   - Clean, readable typography
   - Table of contents for long articles
   - Reading time estimate
   - Share buttons (LinkedIn, Twitter, Email)
   - Print-friendly view
   - Bookmark/save for later
   - View counter
   - Related posts sidebar

#### B. Category & Tag System
**Priority:** MEDIUM  
**Business Value:** Content discovery, SEO

Features:
1. Category pages with:
   - Category description
   - Post count
   - Latest posts in category
   - Subcategory support
2. Tag cloud/index
3. Tag-based filtering
4. Breadcrumb navigation

#### C. Comment & Engagement System
**Priority:** MEDIUM  
**Business Value:** Community engagement, SEO (user-generated content)

Features:
1. Nested comment threads
2. Upvoting/liking comments
3. Author badges (GreyMatters Team, Community Member, Verified Expert)
4. Markdown support in comments
5. Moderation dashboard:
   - Approve/reject comments
   - Flag spam
   - Ban users
6. Email notifications for replies

#### D. Search & Discovery
**Priority:** MEDIUM  
**Business Value:** Content findability, retention

Features:
1. Full-text search across posts
2. Filter by:
   - Category
   - Author
   - Date range
   - Reading time
3. Sort by:
   - Newest
   - Most popular (views)
   - Most commented
   - Trending (views in last 7 days)
4. Search suggestions/autocomplete
5. Recent searches

#### E. Lead Capture & Conversion
**Priority:** HIGH  
**Business Value:** Drive signups to other platforms

Features:
1. **Embedded CTAs in Posts:**
   - After intro paragraph
   - End of article
   - Sidebar widget
2. **CTA Types:**
   - "Join Salt & Pepper Community" → saltnpepper.greyin.net
   - "Browse Senior Talent" → greyin.net/candidates
   - "Post a Gig on FreeAgent" → freeagent.greyin.net
3. **Newsletter Signup:**
   - Email collection form
   - Double opt-in
   - Weekly digest of new posts
   - Welcome email sequence
4. **Exit Intent Popup:**
   - "Wait! Get our best career insights in your inbox"
   - Subtle, dismissable

#### F. SEO Optimization
**Priority:** HIGH  
**Business Value:** Organic traffic acquisition

Features:
1. Auto-generated sitemap.xml
2. Robots.txt configuration
3. Schema.org structured data:
   - Article schema
   - Breadcrumb schema
   - Author schema
4. Open Graph tags for social sharing
5. Canonical URLs
6. Internal linking suggestions
7. RSS feed for subscribers

---

## 🎨 PILLAR 3: SALT & PEPPER COMMUNITY

**URL:** https://saltnpepper.greyin.net  
**Target Audience:** Senior professionals (12+ years experience)  
**Core Value Proposition:** Age-verified peer community, "The Lab" project showcase, recruiter-free zone

### Current Implementation Status
- ✅ Basic homepage
- ✅ Database schema (profiles, comments)
- ❌ Discussion forums
- ❌ "The Lab" project showcase
- ❌ Age/experience verification
- ❌ Peer review system
- ❌ Referral network
- ❌ Direct messaging

### Required Features (from Business Plan)

#### A. Age/Experience Verification
**Priority:** HIGH  
**Business Value:** Trust, exclusivity, quality community

Features:
1. **Registration Flow:**
   - LinkedIn verification (extract work history)
   - Manual review by admins
   - Experience threshold: 12+ years minimum
   - Verification badge on profile
2. **Verification Criteria:**
   - LinkedIn profile shows 12+ years total experience
   - OR GitHub contributions spanning 12+ years
   - OR portfolio with dated projects
   - Manual override for edge cases
3. **Rejection Flow:**
   - Polite rejection email
   - "Come back when you have 12+ years"
   - Newsletter signup to stay connected

#### B. Discussion Forums
**Priority:** HIGH  
**Business Value:** Daily engagement, retention

Features:
1. **Forum Categories:**
   - **Architecture Reviews:** Critique system designs, code reviews
   - **Career Transitions:** Navigating job changes, pivots
   - **Tool Evaluations:** Honest reviews of frameworks, platforms
   - **War Stories:** Production incidents, lessons learned
   - **The Lab:** Project showcase and feedback (dedicated category)
   - **Referrals & Intros:** Job referrals, peer introductions

2. **Discussion Threads:**
   - Rich text editor with Markdown
   - Code snippet highlighting
   - Image/file attachments
   - Upvote/downvote
   - Best answer marking
   - Thread tagging
   - Thread watching/following

3. **Moderation:**
   - Report inappropriate content
   - Ban recruiters (zero tolerance)
   - Community guidelines enforcement
   - Moderator dashboard

#### C. "The Lab" - Project Showcase
**Priority:** HIGH  
**Business Value:** Differentiation, portfolio building, referral engine

Features:
1. **Project Submission:**
   - Project title & description
   - Tech stack tags
   - GitHub repo link
   - Live demo URL
   - Screenshots/images
   - Status: Idea, In Progress, Completed, Archived
   - Looking for: Collaborators, Feedback, Hiring, None
   - License type

2. **Project Browsing:**
   - Filter by:
     - Tech stack
     - Status
     - Looking for collaborators
   - Sort by:
     - Newest
     - Most upvoted
     - Most commented
   - Search by keywords

3. **Project Pages:**
   - Full description with Markdown
   - Image gallery
   - Comments/feedback section
   - Upvoting
   - "Interested in collaborating" button
   - Share project externally

4. **Integration with FreeAgent:**
   - "Hire me for similar work" CTA
   - Link to creator's FreeAgent profile/gigs

#### D. Peer Referral Network
**Priority:** MEDIUM  
**Business Value:** Hidden job market access, member value

Features:
1. **Referral Board:**
   - "I'm hiring at XYZ Corp - need a senior backend engineer"
   - Company name, role, experience needed
   - "DM me for referral"
   - Referral bonus info (optional)
2. **Referral Requests:**
   - "Looking for intro to Head of Engineering at ABC"
   - Community members offer connections
3. **Referral Tracking:**
   - Track referrals sent/received
   - Success rate
   - Leaderboard (top referrers)

#### E. Member Profiles
**Priority:** MEDIUM  
**Business Value:** Networking, credibility

Features:
1. Profile fields:
   - Display name & avatar
   - Title & current company (optional)
   - Location
   - Tech stack expertise
   - Years of experience (verified)
   - GitHub, LinkedIn, personal site
   - Bio/About me
   - Current availability: Open to opportunities, Not looking, Open to freelance
2. Activity feed:
   - Recent discussions
   - Projects in The Lab
   - Comments & contributions
3. Reputation system:
   - Points for helpful answers
   - Badges (Top Contributor, Helpful, Veteran, etc.)

#### F. Direct Messaging
**Priority:** LOW  
**Business Value:** Private networking, collaboration

Features:
1. Send DMs to other verified members
2. Message threads
3. File sharing in DMs
4. Message notifications
5. Block/report users

---

## 💼 PILLAR 4: FREEAGENT MARKETPLACE

**URL:** https://freeagent.greyin.net  
**Target Audience:** Community members offering freelance services  
**Core Value Proposition:** 0% platform commission, full earnings retention

### Current Implementation Status
- ✅ Basic homepage
- ✅ Database schema (gigs, gig_orders, gig_reviews, gig_categories)
- ✅ Razorpay payment integration ready
- ❌ Gig browsing/posting
- ❌ Order management
- ❌ Review system
- ❌ Freelancer profiles
- ❌ Search and filtering

### Required Features (from Business Plan)

#### A. Gig Creation & Management
**Priority:** HIGH  
**Business Value:** Core marketplace functionality

Features:
1. **Create Gig:**
   - Gig title
   - Category selection (from gig_categories)
   - Description (Markdown)
   - Deliverables (what client gets)
   - Pricing tiers:
     - Basic (e.g., $500): Core deliverable
     - Standard (e.g., $1,000): + Extra features
     - Premium (e.g., $2,000): + Priority support
   - Delivery time: 1 day, 3 days, 1 week, 2 weeks, etc.
   - Revisions included
   - Requirements from client (form fields)
   - Portfolio samples (images/files)
   - Tags for discovery
   - Active/Paused status

2. **Gig Dashboard (Freelancer):**
   - All gigs list
   - Edit/pause/delete gigs
   - Active orders
   - Order history
   - Earnings overview
   - Analytics: Views, clicks, conversion rate

#### B. Gig Marketplace & Discovery
**Priority:** HIGH  
**Business Value:** Client acquisition

Features:
1. **Browse Gigs:**
   - Category navigation
   - Featured gigs (top-rated, new)
   - Filter by:
     - Category
     - Price range
     - Delivery time
     - Seller level (new, verified, top-rated)
     - Seller location
   - Sort by:
     - Relevance
     - Best selling
     - Newest
     - Price (low to high, high to low)
   - Search by keywords

2. **Gig Detail Page:**
   - Full description
   - Pricing tiers comparison table
   - Seller info:
     - Avatar, name, title
     - Member since
     - Verified badge (Salt & Pepper member)
     - Response time
     - Languages
   - Reviews & ratings
   - FAQs (optional)
   - "Contact seller" button
   - "Order now" buttons for each tier

#### C. Order Management & Payment Flow
**Priority:** HIGH  
**Business Value:** Revenue flow (via Razorpay ~2%)

Features:
1. **Order Placement:**
   - Select tier (Basic/Standard/Premium)
   - Fill requirement form
   - Review order summary
   - Razorpay checkout
   - Payment capture to escrow

2. **Order Workflow:**
   ```
   Pending → In Progress → Delivered → Revision Requested → Completed
                                     ↓
                                  Disputed
   ```

3. **Freelancer Order Dashboard:**
   - New orders alert
   - Accept/decline order (24h window)
   - Upload deliverables
   - Request deadline extension
   - Mark as delivered
   - Chat with client

4. **Client Order Dashboard:**
   - Track order status
   - Download deliverables
   - Request revisions (within limit)
   - Mark as complete (releases payment)
   - Leave review
   - Dispute/refund request

5. **Payment Release:**
   - Auto-release after 3 days of delivery (if no action)
   - Manual release by client
   - Disputed orders: Admin review
   - Freelancer receives 100% (Razorpay already deducted ~2%)

#### D. Review & Rating System
**Priority:** HIGH  
**Business Value:** Trust & quality assurance

Features:
1. **Leave Review:**
   - 5-star rating
   - Written review
   - Optional: Recommend to others checkbox
   - Only after order completion
2. **Review Display:**
   - Average rating on gig card
   - Total reviews count
   - Reviews list on gig page
   - Filter by rating (5 stars, 4 stars, etc.)
3. **Seller Response:**
   - Reply to reviews
   - Thank reviewers
4. **Review Moderation:**
   - Flag inappropriate reviews
   - Admin review for spam

#### E. Freelancer Profiles
**Priority:** MEDIUM  
**Business Value:** Seller branding, trust

Features:
1. Profile page showing:
   - Avatar, cover image
   - Display name, tagline
   - Description/bio
   - Skills & expertise
   - Languages spoken
   - Member since date
   - Salt & Pepper verified badge
   - Response time average
   - Total orders completed
   - Total earnings (optional, hidden by default)
   - All active gigs
   - Reviews received
   - Social links
2. Public portfolio:
   - Past work samples
   - Client testimonials
   - Case studies

#### F. 0% Commission Positioning
**Priority:** HIGH  
**Business Value:** Competitive advantage, community alignment

Features:
1. **Messaging in UI:**
   - "Keep 100% of your earnings"
   - "No platform fees - only Razorpay processing (~2%)"
   - Comparison table: FreeAgent 0% vs Upwork 10% vs Fiverr 20%
2. **Transparent Pricing:**
   - Show breakdown on checkout:
     - Gig price: ₹5,000
     - Razorpay fee: ₹100 (2%)
     - Platform fee: ₹0 (0% commission!)
     - Total: ₹5,100
   - Freelancer receives: ₹5,000
3. **Trust Badges:**
   - "Zero platform fees"
   - "Community-first marketplace"
   - "Built for Salt & Pepper members"

#### G. Messaging System
**Priority:** MEDIUM  
**Business Value:** Pre-sale questions, clarifications

Features:
1. Real-time chat between client and seller
2. Message threads per gig inquiry
3. File attachments
4. Order context in conversation
5. Typing indicators
6. Read receipts
7. Email notifications for new messages

---

## 🔄 Cross-Platform Integration

### A. Unified Authentication
- ✅ Single sign-on across all 4 platforms
- ✅ Supabase Auth handles sessions

### B. Unified Profile
- One profile across all platforms
- Role-based access:
  - Candidate on Greyin B2B
  - Author on GreyMatters
  - Community Member on Salt & Pepper
  - Freelancer on FreeAgent

### C. Cross-Platform Navigation
- ✅ Implemented dropdown menu on all homepages
- Ecosystem showcase section

### D. Data Sharing
- GreyMatters posts can highlight:
  - Salt & Pepper projects
  - FreeAgent success stories
  - Greyin placement case studies
- Salt & Pepper "The Lab" projects link to FreeAgent gigs
- Greyin candidate profiles show FreeAgent availability

---

## 📈 Implementation Priority Matrix

| Feature | Platform | Priority | Effort | Impact | Status |
|---------|----------|----------|--------|--------|--------|
| Job browsing & posting | Greyin B2B | HIGH | High | High | 🔴 Not started |
| Company profiles | Greyin B2B | HIGH | Medium | High | 🔴 Not started |
| Candidate search | Greyin B2B | HIGH | High | High | 🔴 Not started |
| Application system | Greyin B2B | HIGH | Medium | High | 🔴 Not started |
| Post reading pages | GreyMatters | HIGH | Medium | High | 🔴 Not started |
| Markdown rendering | GreyMatters | HIGH | Low | High | 🔴 Not started |
| Comment system | GreyMatters | MEDIUM | Medium | Medium | 🔴 Not started |
| Gig marketplace | FreeAgent | HIGH | High | High | 🔴 Not started |
| Order management | FreeAgent | HIGH | High | High | 🔴 Not started |
| Payment flow | FreeAgent | HIGH | Medium | High | 🟡 Schema ready |
| Discussion forums | Salt & Pepper | HIGH | High | High | 🔴 Not started |
| The Lab showcase | Salt & Pepper | HIGH | Medium | High | 🔴 Not started |
| Age verification | Salt & Pepper | MEDIUM | Medium | Medium | 🔴 Not started |
| Fractional leadership | Greyin B2B | MEDIUM | High | Medium | 🔴 Not started |
| Outplacement packages | Greyin B2B | MEDIUM | High | Medium | 🔴 Not started |
| Newsletter signup | GreyMatters | MEDIUM | Low | Medium | 🔴 Not started |
| Peer referrals | Salt & Pepper | MEDIUM | Medium | Medium | 🔴 Not started |
| Direct messaging | All | LOW | High | Low | 🔴 Not started |

---

## 🚀 Recommended Implementation Phases

### Phase 1: Core Marketplace Features (Week 1-2)
**Goal:** Enable basic functionality on all platforms

1. **Greyin B2B:**
   - Job browsing page
   - Job detail page
   - Job posting form
   - Company profile page
   - Application submission

2. **GreyMatters:**
   - Post detail page with Markdown
   - Category pages
   - Search functionality

3. **FreeAgent:**
   - Gig browsing page
   - Gig detail page
   - Gig creation form
   - Order placement (without payment)

4. **Salt & Pepper:**
   - Discussion forum structure
   - Thread creation/viewing
   - Basic project showcase

### Phase 2: User Management & Engagement (Week 3)
**Goal:** Build user profiles and engagement loops

1. Candidate profile builder (Greyin)
2. Company dashboard (Greyin)
3. Comment system (GreyMatters)
4. Member profiles (Salt & Pepper)
5. Freelancer profiles (FreeAgent)
6. Review system (FreeAgent)

### Phase 3: Payment & Advanced Features (Week 4)
**Goal:** Enable monetization and differentiation

1. Razorpay payment integration (FreeAgent)
2. Order management system (FreeAgent)
3. Application tracking (Greyin)
4. Fractional leadership marketplace (Greyin)
5. The Lab project showcase (Salt & Pepper)
6. Age verification system (Salt & Pepper)

### Phase 4: SEO & Lead Generation (Week 5)
**Goal:** Drive organic traffic and conversions

1. SEO optimization (GreyMatters)
2. Newsletter signup (GreyMatters)
3. Lead capture CTAs (All platforms)
4. Cross-platform linking
5. Sitemap & robots.txt

---

## 🎨 Design System Requirements

### Shared Components Needed
1. **Navigation:** Header with logo, menu, user dropdown
2. **Cards:** Job card, Gig card, Post card, Project card
3. **Forms:** Search filters, Input fields, Rich text editor
4. **Buttons:** Primary, Secondary, Ghost, Danger
5. **Modals:** Confirmation, Forms, Lightbox
6. **Tables:** Data tables with sorting/pagination
7. **Badges:** Status badges, Category tags
8. **Avatars:** User avatars with fallback
9. **Loading States:** Skeletons, Spinners
10. **Empty States:** No results, No data

### Typography
- **Headings:** Bold, clear hierarchy (H1-H6)
- **Body:** Readable, 16px base, 1.6 line-height
- **Code:** Monospace for technical content

### Color Palette
- **Greyin B2B:** Blue primary (#2563eb), professional
- **GreyMatters:** Blue-cyan gradient, editorial
- **FreeAgent:** Blue-purple gradient, creative
- **Salt & Pepper:** Purple-pink gradient, community

---

## 📊 Success Metrics

### Greyin B2B
- Jobs posted per month
- Applications submitted per month
- Placements made (10% fee)
- Average time-to-hire
- Client retention rate

### GreyMatters
- Monthly unique visitors
- Average time on page
- Newsletter signups
- Click-through rate to other platforms
- SEO ranking for target keywords

### FreeAgent
- Gigs posted per month
- Orders placed per month
- GMV (Gross Merchandise Value)
- Average order value
- Repeat order rate
- Seller retention rate

### Salt & Pepper
- New member signups
- Daily active users
- Threads created per week
- Projects showcased in The Lab
- Referrals made

---

**Next Steps:** Begin Phase 1 implementation with core features for all 4 platforms.
