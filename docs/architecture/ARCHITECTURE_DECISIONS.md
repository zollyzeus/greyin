# Greyin Architecture — Technical Decision Record

**Document Type:** Architecture Decision Log (ADL)  
**Last Updated:** 2026-09-07  
**Target Audience:** Developers, architects, stakeholders

---

## ADR-001: Supabase Self-Hosted vs. Commercial PaaS

**Decision:** Self-hosted Supabase (PostgreSQL + Kong + PostgREST + GoTrue)

**Rationale:**
- **Cost:** $27-42/month vs. $500-2000/month SaaS alternatives (5-year TCO: $80K vs. $145K+)
- **Lock-in:** Open source components (LGPL v3, GPL v2, Apache 2.0) enable exit
- **Control:** Full database access for complex queries, triggers, RLS
- **Scale:** Can handle 1000+ concurrent users on $24/mo VPS
- **Vendor risk:** No single vendor controlling user data

**Alternatives Considered:**
- Firebase (Firestore): No complex SQL, limited RLS, vendor lock-in
- Directus: Headless CMS focused, not ideal for StackWorks/FlexPro business logic
- PocketBase: Single-file SQLite, insufficient for >100 concurrent users
- Frappe/ERPNext: ERP focused, heavyweight for a marketplace platform

**Trade-offs:**
- ✗ Operational overhead: manual upgrades, backup management, monitoring
- ✗ DevOps skill requirement (Docker, PostgreSQL, Kong configuration)
- ✓ Unlimited SQL complexity and custom functions
- ✓ Transparent cost per feature (can see LLM spend, storage usage)

---

## ADR-002: 6-Pillar Microapp Architecture vs. Monolith

**Decision:** Separate Next.js apps (deepedge, greymatters, flexpro, stackworks, saltnpepper-community, longlist) + shared Hub

**Rationale:**
- **Independent Deployment:** Each app can ship features on its own cadence (no blocking)
- **Isolated State:** Apps can be deleted/paused without affecting others (e.g., pause GreyMatters, keep others live)
- **Distinct UX:** Each app can optimize UI for its specific workflow (job search ≠ forum discussion)
- **Team Scaling:** Multiple teams can own separate pillars without coordination overhead
- **Skill Variety:** Recruit engineers with deep expertise in marketplace (FlexPro team), community (Salt & Pepper team), etc.

**Alternatives Considered:**
- Single monolithic Next.js app: easier initial deployment, harder to scale teams
- Shared component library: all apps share SiteHeader, EcosystemWidget, auth middleware

**Trade-offs:**
- ✗ Code duplication risk: each app has its own SiteHeader (mitigated by shared git commit discipline)
- ✗ Deployment coordination: 7 apps to deploy, not 1
- ✓ Clear boundaries: DeepEdge team owns `/candidates/[id]` view and Greyin Score, no conflicts
- ✓ Fast development: feature ship → test → deploy can happen in parallel

**Mitigation:**
- Shared GitHub commit message conventions for cross-app changes
- Dedicated "Ecosystem Sync" PR reviews that touch 3+ apps
- Automated tests verify Greyin Score, notifications work identically across all apps

---

## ADR-003: Greyin Score: Bayesian Shrinkage vs. Simple Average

**Decision:** Bayesian shrinkage toward population mean (Migration 036)

**Rationale:**
- **Noisy Signal Reduction:** A user with 1 StackWorks outcome scoring 95/100 doesn't deserve 95 points (could be outlier)
- **Shrinkage Formula:** Pulls high-outlier scores down, low-outlier scores up toward population mean
- **Headcount Weight:** More outcomes = less shrinkage = more weight to actual performance
- **Fairness:** A candidate with 10 verified outcomes at 70 points is more trustworthy than one with 1 outcome at 100

**Alternatives Considered:**
- Simple average: incentivizes gaming with few high-quality outcomes (not representative)
- Median: robust but ignores magnitude of accomplishments
- Weighted average by recency: complex to tune, adds time-decay

**Trade-offs:**
- ✗ Harder to explain to users (Bayesian statistics)
- ✗ Score may feel low to high-performing early users
- ✓ Resistant to gaming/sockpuppeting
- ✓ Score improves as users build history (incentivizes long-term engagement)

**Validation:**
- Score shown with breakdown (e.g., "StackWorks: 75/100 from 3 outcomes")
- Transparency tooltip: "How is this calculated?" shows Bayesian formula
- A/B testing: compared against simple average, Bayesian version reduced employer complaints about unqualified candidates

---

## ADR-004: Row-Level Security (RLS) vs. Application-Layer Authorization

**Decision:** Database-layer RLS (enforced by PostgreSQL, not app code)

**Rationale:**
- **Unhackable by App Bug:** An RLS bug in auth.ts can't bypass database policy
- **Audit Trail:** Every SELECT/UPDATE logged by PostgreSQL, not buried in app logs
- **Scaling:** Authorization logic doesn't scale with N apps (all 6 pillar apps obey same RLS)
- **Consistency:** No chance of DeepEdge implementing permission check slightly differently from FlexPro

**Alternatives Considered:**
- App-layer auth: filter results in Next.js middleware (faster? no, PostgREST already applies RLS)
- Hybrid: RLS + app-layer (defense in depth, but adds complexity)

**Trade-offs:**
- ✗ RLS policies harder to debug (not reflected in IDE syntax highlighting)
- ✗ Requires SQL knowledge to understand policies
- ✓ No way to accidentally expose data via app bug
- ✓ Admin can query logs and see if RLS was ever bypassed

**Implementation:**
```sql
-- Every user-scoped table has policy like:
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own applications"
  ON applications FOR SELECT
  USING (auth.uid() = candidate_id OR auth.uid() = (SELECT id FROM jobs WHERE jobs.id = applications.job_id AND jobs.company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())));
```

---

## ADR-005: Synchronous LLM Scoring vs. Async Job Queue

**Decision:** Synchronous blocking calls for user-facing features (resume parsing, gig quality), async jobs for batch (digests, reputation scoring)

**Rationale:**
- **User Feedback:** Resume parsing blocks upload completion, but users expect instant feedback
- **Cost Control:** Async allows rate limiting (e.g., daily digest job runs once/day, not once per post)
- **Fallback Path:** If LLM provider down, upload still succeeds (quality missing, but not blocked)
- **Complexity Trade-off:** Sync is simpler; async adds job queue burden

**Alternatives Considered:**
- All sync: low latency but high LLM costs (every feature call = every endpoint)
- All async: cheap but users see "pending" states, poor UX for immediate features

**Trade-offs:**
- ✗ Sync calls can timeout (handled via try/catch, degrades gracefully)
- ✗ Cost spike if LLM provider fails to rate-limit (mitigated by admin toggling feature flags)
- ✓ Immediate user feedback for upload completion
- ✓ Batch operations keep costs low

**Feature-Specific Decision:**
| Feature | Sync/Async | Reason |
|---------|-----------|--------|
| Resume parsing | Sync (2s timeout) | Upload completion UX |
| Post quality | Sync (blocking gate) | Pre-publish QA |
| Outcome verification | Sync (creator review) | Happens during human review |
| Gig quality assist | Sync (suggestions) | Non-blocking, seller sees immediately |
| Digests | Async (nightly) | Batch operation |
| Salary trends | Async (hourly) | Pre-computed materialized view |

---

## ADR-006: Shared Cookie Domain (SSO) vs. Per-App Logins

**Decision:** Shared `.greyin.net` cookie domain (login once, all 6 apps authenticated)

**Rationale:**
- **User Friction:** Login once → access all 6 apps without re-authenticating
- **Token Refresh:** All apps share same JWT refresh token cookie, no desync
- **Real-World Usage:** Users switch between apps during a session (e.g., post StackWorks project, then share on GreyMatters)

**Alternatives Considered:**
- Per-app login: each app gets its own JWT (duplicated auth state)
- OAuth federation: 3rd party manages SSO (introduces vendor dependency)

**Trade-offs:**
- ✗ If one app logs you out, all apps log you out (intentional security feature)
- ✗ Cookie theft = access to all 6 apps (mitigated by httpOnly + secure flags)
- ✓ No session desync between apps
- ✓ True unified platform experience

**Implementation:**
```
Cookie: __Secure-sb-access-token
Domain: .greyin.net
Path: /
HttpOnly: true
Secure: true
SameSite: Lax
Max-Age: 3600

Refresh Token:
Domain: .greyin.net
Max-Age: 34560000  (400 days)
```

---

## ADR-007: Materialized Views for Greyin Score vs. Real-Time Calculation

**Decision:** Materialized view (computed once per hour via pg_cron, cached)

**Rationale:**
- **Query Speed:** Pre-computed greyin_scores view responds in <100ms (vs. 5+ second calculation from raw data)
- **Consistency:** All views of a user's score within an hour are identical (no race conditions)
- **LLM Cost:** Score calculation doesn't invoke LLM (would be expensive per-request)
- **Admin Insight:** Materialized view can include debugging columns (e.g., per-platform breakdowns)

**Alternatives Considered:**
- Real-time calculation: `SELECT calculate_greyin_score(user_id)` on every profile view (3-5s latency, poor UX)
- Lazy calculation on first access: score computed once, then cached (unpredictable latency on first user visiting)

**Trade-offs:**
- ✗ Score lags real activity by up to 1 hour
- ✗ Requires pg_cron for refresh (adds operational complexity)
- ✓ Fast profile page loads
- ✓ Employers can search by score without slow queries

**Refresh Schedule:**
```sql
SELECT cron.schedule('refresh_greyin_scores', '0 * * * *',  -- every hour
  'REFRESH MATERIALIZED VIEW CONCURRENTLY greyin_scores');
```

---

## ADR-008: k-Anonymity for Salary Trends vs. Raw Aggregates

**Decision:** k-anonymity (minimum 3 submissions per group before showing aggregate)

**Rationale:**
- **Privacy:** With only 2 salaries at "Senior Engineer, NYC", you can identify individuals
- **Business Confidence:** Employers trust aggregates more when based on 10+ samples vs. 2
- **Regulatory:** GDPR/privacy regulations expect k-anonymity on demographic data
- **Transparency:** Users know aggregates are robust (3+ samples shown in UI)

**Alternatives Considered:**
- Differential privacy: add noise to aggregates (complex, harder to explain)
- Top-line only: never show individual salaries (less useful, less transparent)

**Trade-offs:**
- ✗ Early platform has gaps (rare job titles below k=3 threshold)
- ✗ Requires tracking salary submissions (privacy risk if breached)
- ✓ Candidates trust salary data as representative
- ✓ No way to reverse-engineer individual salaries

**Query Pattern:**
```sql
SELECT
    role_level, location, years_experience,
    AVG(salary) as avg_salary,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY salary) as q1,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY salary) as q3,
    COUNT(*) as sample_size
FROM employment_history
WHERE years_experience >= 10
GROUP BY role_level, location, years_experience
HAVING COUNT(*) >= 3
```

---

## ADR-009: LLM Provider Registry vs. Hardcoded Provider

**Decision:** Pluggable registry (admin can switch between Anthropic/OpenAI/Ollama)

**Rationale:**
- **Vendor Optionality:** If Anthropic prices spike, switch to OpenAI
- **Cost Optimization:** Route different features to different providers (fast features → cheaper model)
- **Local Inference:** Support Ollama for on-premise deployments
- **Feature Flags:** Admin can disable a feature's LLM scoring (e.g., disable post quality if budget is tight)

**Alternatives Considered:**
- Hardcoded Anthropic: simpler, but vendor lock-in and no cost optimization
- Multi-model ensemble: always call 3 providers, vote (expensive and overkill)

**Trade-offs:**
- ✗ Admin overhead: configure providers, monitor costs, toggle flags
- ✗ Latency variance (Ollama may be slower than API endpoints)
- ✓ Cost control and vendor independence
- ✓ Can experiment with cheaper models for specific features

**Admin Panel:**
- `/admin/llm` on Hub: add/delete providers, toggle feature flags, view cost attribution
- Cost tracking: every LLM request logged with latency, token count, cost

---

## ADR-010: Peer-Confirmed Projects vs. Verification-Only Achievements

**Decision:** Separate peer_score (from peer-confirmed projects) from platform-verified greyin_score

**Rationale:**
- **Evidence Types:** In-platform verified outcomes (StackWorks/FlexPro) are gold-standard; off-platform collaboration is weaker signal
- **Reciprocal Rating Fraud:** Without gating, two friends could collude to rate each other 5 stars (detected via flags)
- **Transparency:** Employers see both scores, can weight as they choose
- **Safety:** Peer projects don't affect hiring (Verified Expert gate), only informational

**Alternatives Considered:**
- Blend peer_score into greyin_score: increases score but enables gaming
- Peer-score only (no platform evidence required): loses the value of StackWorks/FlexPro verification

**Trade-offs:**
- ✗ More complex scoring system (two separate scores, not one)
- ✗ Harder to explain to users
- ✓ Resistant to gaming via collusion
- ✓ Preserves integrity of StackWorks/FlexPro evidence

**Fraud Detection (Migration 090, 091):**
```sql
-- Flag projects where both participants rated each other 4-5 stars
CREATE VIEW peer_project_reciprocity_flags AS
SELECT
    ppr1.project_id,
    ppr1.rater_id as participant_1,
    ppr2.rater_id as participant_2,
    ppr1.rating as p1_rating_of_p2,
    ppr2.rating as p2_rating_of_p1
FROM peer_project_ratings ppr1
JOIN peer_project_ratings ppr2
  ON ppr1.project_id = ppr2.project_id
  AND ppr1.rater_id = ppr2.ratee_id
  AND ppr1.ratee_id = ppr2.rater_id
WHERE ppr1.rating >= 4 AND ppr2.rating >= 4;
```

Employer UI displays "⚠ Possible reciprocal rating" badge on candidate profiles.

---

## ADR-011: Idle Session Timeout vs. Persistent Sessions

**Decision:** 20-minute idle timeout → 2-minute warning → sign-out (FR-PW-34)

**Rationale:**
- **Security:** Unattended browsers can't be hijacked indefinitely
- **User Control:** 2-minute warning allows recovery (browser tab refresh / "Stay signed in" button)
- **AWS/Salesforce Pattern:** Industry standard, users expect it
- **Multi-Tab Aware:** Activity in any tab resets idle timer for all tabs

**Alternatives Considered:**
- No timeout: simpler UX, but security risk
- Passive timeout (no warning): harsh, user loses work without notice

**Trade-offs:**
- ✗ Users on long-form tasks (writing ask descriptions) may be timed out
- ✗ Passive activity (mousemove) does NOT dismiss warning (intentional AWS pattern, some users dislike)
- ✓ Prevents unattended-browser takeover
- ✓ Users can explicitly "Stay signed in" (not silent)

**Implementation:**
- Client-side only, no schema change
- localStorage timestamp `greyin:lastActivityAt` polled every second
- Warning modal appears at 22-minute mark, sign-out at 24-minute mark
- Both events trigger redirect to `/login` with message "You were signed out after inactivity"

---

## ADR-012: Dark Mode Toggle Application vs. System Preference Only

**Decision:** Toggle + system preference fallback (FR-PW-40, FR-PW-41, FR-PW-42, FR-PW-43)

**Rationale:**
- **User Choice:** Some users prefer light mode always, others dark mode always
- **System Preference Fallback:** If no toggle used, inherit OS setting (macOS/Windows/iOS dark mode)
- **No Flash:** Inline `<script>` in layout `<head>` applies theme before paint (no FOUC)
- **Persistent:** localStorage key survives page reloads and app switching

**Alternatives Considered:**
- System preference only: simpler, but no user override
- Always light mode: reduces design work but limits accessibility

**Trade-offs:**
- ✗ Design effort: 240+ classes darkified (both done via script to avoid 169 file hand-edits)
- ✗ Testing burden: every page must be visually verified in both themes
- ✓ Accessibility: dark mode reduces eye strain for some users
- ✓ User agency: choose theme, toggle at any time

**Technical Implementation:**
```html
<!-- In layout.tsx <head>, before any CSS -->
<script>
  // Apply theme before paint to avoid FOUC
  const theme = localStorage.getItem('greyin:theme') || 
                (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (theme === 'dark') document.documentElement.classList.add('dark');
</script>
```

---

## ADR-013: Explicit Admin Role vs. Attribute-Based Access Control (ABAC)

**Decision:** Explicit `role='admin'` on profiles table, simple RLS policies

**Rationale:**
- **Simplicity:** 3 roles (candidate, employer, admin) covers all use cases
- **RLS Clarity:** Policies easy to read (`WHERE auth.role()='admin'`)
- **No Over-Engineering:** ABAC would add complexity without benefit at this scale
- **Audit Trail:** One boolean switch, clear who is admin and when

**Alternatives Considered:**
- Fine-grained ABAC (e.g., "can_moderate_salt_pepper", "can_view_admin_llm_costs"): future-proof but adds complexity
- Role inheritance (admin > verified_expert > candidate): StackWorks specific, not general

**Trade-offs:**
- ✗ Adding new permission type requires schema migration (not agile)
- ✓ RLS policies are simple and auditable
- ✓ Unlikely to need more than 3 roles (feature-specific gates exist elsewhere, e.g., "can_mentor")

**Expansion Path:**
If complex permissions needed later:
1. Add `roles_pivot` table (user_id, role, permission, granted_at)
2. Update RLS policies to check `EXISTS (SELECT 1 FROM roles_pivot WHERE ...)`
3. No app code changes needed

---

## ADR-014: Synchronous Test Data Cleanup vs. Continuous Filtering

**Decision:** Synchronous admin-triggered cleanup route (FR-PW-28, Migration none — cleanup route only)

**Rationale:**
- **Simplicity:** One-off cleanup after e2e suite pollution detected (not filtering every query)
- **Transparency:** Admin knows exactly what was deleted and when
- **Idempotence:** Route can be run multiple times safely (filters by "E2E " prefix, not by timestamp)
- **Cost:** Avoids adding `is_test_data` flag to every insert (schema bloat)

**Alternatives Considered:**
- Automatic cleanup via cron: runs nightly, hidden from admin visibility
- Continuous filtering: add `WHERE is_test_data IS FALSE` to every public query (schema bloat, RLS doesn't filter it anyway)

**Trade-offs:**
- ✗ Manual trigger required (admin must remember to run it)
- ✗ Can't be run by CI (no automatic cleanup between test runs)
- ✓ Transparent: shows result count on `/admin`
- ✓ No schema pollution

**Route Pattern:**
```
POST /api/admin/cleanup-test-data
Response: { posts_removed: 45, builder_projects_removed: 183, discussions_removed: 0, ... }
```

Filters by title prefix "E2E " across all tables, cascade deletes via FK relationships.

---

## Summary: Architecture Philosophy

**Guiding Principles:**

1. **Simplicity Over Cleverness:** Bayesian shrinkage is the most complex scoring algorithm; everything else is straightforward
2. **Database-Layer Security:** RLS, not app-layer authorization
3. **Transparent Operations:** Every LLM call logged, every cost attributed, every admin action auditable
4. **User Agency:** Idle timeout warning (not forced), dark mode toggle (not system-only)
5. **Vendor Independence:** Pluggable LLM providers, self-hosted Supabase, open source everywhere
6. **Privacy First:** k-anonymity on salary, anonymous peer ratings, RLS everywhere
7. **Scalable Teams:** 6 pillar apps can ship independently, shared Hub enforces consistency

These decisions prioritize long-term maintainability, security, and cost efficiency over short-term implementation speed.
