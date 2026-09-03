# Platform Architecture for Greyin & GreyMatters Ecosystem
## Odoo Community Edition 18 + Discourse

## Executive Summary

**Decision**: After comprehensive evaluation (see PLATFORM_COMPARISON document), we are implementing **Odoo Community Edition 18 + Discourse** as the complete technology stack for the Greyin & GreyMatters four-pillar ecosystem.

This is the optimal choice providing 90% of required features out-of-box, fastest time-to-market (1-2 weeks vs 3-6 months for alternatives), and lowest 5-year TCO ($80K vs $145K+ for custom-built alternatives).

## Selected Architecture

### **Odoo Community Edition 18** (Core Platform)
- **License:** LGPL v3 (Free, Open Source)
- **Cost:** $0 (self-hosted)
- **Customization:** Fully brandable, modular architecture
- **Self-Hostable:** Yes (Docker, bare metal, cloud)

**Why Odoo for Greyin Ecosystem:**
- ✅ **CMS Module** → GreyMatters blog with full SEO, publishing workflow
- ✅ **Website Builder** → Greyin enterprise portal with drag-and-drop
- ✅ **HR Recruitment Module** → Candidate database, job postings, placement tracking
- ✅ **Project Management** → Salt & Pepper community showcases
- ✅ **eCommerce/Portal** → B2B client dashboards, outplacement packages
- ✅ **Custom Modules** → Build FreeAgent marketplace as Odoo app
- ✅ **PostgreSQL Backend** → Scalable, robust
- ✅ **REST API** → Integrate with external systems
- ✅ **Multi-company** → Separate Greyin vs GreyMatters branding

**What You Get:**
| Module | Use Case |
|--------|----------|
| Website/CMS | GreyMatters blog + Greyin corporate site |
| HR Recruitment | Talent database, placement tracking |
| Project | Salt & Pepper project showcases ("The Lab") |
| Portal | Client/candidate dashboards |
| Sales/CRM | Enterprise lead management |
| Custom Apps | FreeAgent 0% commission marketplace |

---

### **Discourse** (Community Platform)
- **License:** GPL v2 (Free, Open Source)
- **Cost:** $0 (self-hosted)
- **Use Case:** Salt & Pepper Lounge

**Why Discourse:**
- ✅ Industry-standard community platform (used by Stack Overflow, Mozilla, Rust)
- ✅ Age/seniority verification via custom fields
- ✅ Private groups, categories, trust levels
- ✅ SSO integration with main platform (Odoo/NocoBase)
- ✅ Rich API for syncing user profiles
- ✅ Gamification (badges, leaderboards)
- ✅ Mobile-friendly

---

## Why This Stack (vs Alternatives)

**Evaluated alternatives**: Directus, PocketBase, NocoBase, Strapi+Ghost, Frappe/ERPNext
**Decision rationale**: See detailed comparison in PLATFORM_COMPARISON_ODOO_VS_DIRECTUS_VS_POCKETBASE.md

**Key factors**:
- ✅ **Time to Market**: Launch in 1-2 weeks (vs 3-6 months for Directus)
- ✅ **Feature Completeness**: HR Recruitment + CRM + Blog + Portal = 90% ready
- ✅ **Cost Efficiency**: $80K 5-year TCO (vs $145K Directus, $158K PocketBase)
- ✅ **Business Model Fit**: Built for B2B placement/recruiting businesses
- ✅ **Proven Scale**: 7M+ companies using Odoo worldwide
- ✅ **Risk Mitigation**: Not betting on newer, less mature platforms

### Production Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    GREYIN UNIFIED PLATFORM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │         ODOO 18 COMMUNITY EDITION                    │      │
│  ├──────────────────────────────────────────────────────┤      │
│  │                                                       │      │
│  │  🌐 Website Builder → greyin.io homepage             │      │
│  │  📝 Blog/CMS Module → greymatters.io                │      │
│  │  👔 HR Recruitment → Candidate database              │      │
│  │  💼 CRM → Enterprise client pipeline                 │      │
│  │  🎯 Projects → The Lab (community showcases)         │      │
│  │  🛒 Custom Module → FreeAgent marketplace            │      │
│  │  👤 Portal → Client/candidate dashboards             │      │
│  │  📧 Email Marketing → Lead nurturing                 │      │
│  │  📊 Reporting → Analytics & KPIs                     │      │
│  │                                                       │      │
│  └──────────────────────────────────────────────────────┘      │
│                            ↕ SSO                                │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              DISCOURSE (Community)                   │      │
│  ├──────────────────────────────────────────────────────┤      │
│  │                                                       │      │
│  │  💬 Salt & Pepper Lounge (12+ yrs professionals)     │      │
│  │  🔒 Age-verified private groups                      │      │
│  │  🏆 Architecture reviews & peer collaboration        │      │
│  │  🎖️ Trust levels & reputation system                │      │
│  │  📱 Mobile-responsive community                      │      │
│  │                                                       │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│              PostgreSQL 16 (Odoo + Discourse DBs)               │
│                  Nginx + Let's Encrypt SSL                      │
└─────────────────────────────────────────────────────────────────┘
```

### Benefits of This Architecture:
1. **Single Sign-On**: Users login once, seamless access across all pillars
2. **Enterprise Grade**: Both Odoo and Discourse battle-tested at scale
3. **Zero Licensing Costs**: 100% open source (LGPL v3 + GPL v2)
4. **Full Data Control**: Self-hosted, no vendor lock-in
5. **Proven Scalability**: Companies with 100K+ users run on this stack
6. **Rich Ecosystem**: 40K+ Odoo apps, 1000+ Discourse plugins
7. **Active Communities**: Large support base for troubleshooting

---

## Server Requirements

### Minimum (MVP/Testing)
- **CPU:** 4 cores
- **RAM:** 8GB
- **Storage:** 50GB SSD
- **Bandwidth:** 1TB/month
- **Provider:** Hetzner Cloud (~$15/month)

### Production (1000+ users)
- **CPU:** 8 cores
- **RAM:** 16GB
- **Storage:** 200GB SSD
- **Bandwidth:** 5TB/month
- **Provider:** Hetzner/DigitalOcean (~$50/month)

---

## Tech Stack Summary

| Component | Platform | License | Cost |
|-----------|----------|---------|------|
| **Main Backend** | Odoo 18 Community | LGPL v3 | Free |
| **Community** | Discourse | GPL v2 | Free |
| **Database** | PostgreSQL 16 | PostgreSQL | Free |
| **Reverse Proxy** | Nginx | BSD | Free |
| **SSL/TLS** | Let's Encrypt | Free | Free |
| **Containerization** | Docker + Docker Compose | Apache 2.0 | Free |
| **Email** | Postfix/Sendgrid API | Mixed | $0-15/mo |
| **Storage** | MinIO (S3-compatible) | AGPL v3 | Free |

**Total Monthly Cost:** $15-50 (server only)

---

## Next Steps

See `IMPLEMENTATION_PLAN.md` for:
1. Detailed installation steps
2. Odoo module configuration
3. Discourse setup & SSO integration
4. Custom FreeAgent marketplace development
5. Domain setup & SSL configuration
6. Backup strategy
