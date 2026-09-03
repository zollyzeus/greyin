# Implementation vs Business Plan Requirements

**Last revised:** August 18, 2026
**Status:** Live in production, five pillars, restored to the original age-blind/12+-years thesis after a course correction (see §6), plus fractional leadership/outplacement and a cross-domain pivoter track (§6.5-6.6)

This supersedes the August 9, 2026 version of this document, which predates three major changes: **Prolab** (a fifth pillar, launched after that revision), **cross-pillar SSO** (a shared `.greyin.net` cookie domain plus `pillar_memberships`), and the **Verified Expert revamp** (§6) — a deliberate correction after an audit found Greyin B2B had drifted into a generic, ungated job board with no monetization, while Salt & Pepper and FreeAgent had come to look like the same audience doing the same thing. Sections 1-5 below are kept as the historical record of the pre-revamp hardening work; §6 describes what changed since and supersedes any claim below that it contradicts (flagged inline). §7 covers an unrelated infrastructure finding from the same work.

---

## 1. Four-Pillar Architecture

| Business Plan | Implementation | Status |
|---|---|---|
| **GREYIN** — Enterprise B2B Portal | `greyin-b2b` (Next.js 14) | Live at greyin.net |
| **GREYMATTERS** — Thought Leadership Blog | `greymatters-blog` (Next.js 14) | Live at greymatters.greyin.net |
| **SALT & PEPPER** — Community Lounge | `saltnpepper-community` (Next.js 14) | Live at saltnpepper.greyin.net |
| **FREEAGENT** — 0%-Commission Freelancing | `freeagent-marketplace` (Next.js 14) | Live at freeagent.greyin.net |
| **PROLAB** — verified-track-record builder studio (added after this table was first written) | `prolab` (Next.js 14) | Live at prolab.greyin.net |

Technology diverges from the original plan (NocoBase 2.0) in favor of self-hosted Supabase (PostgreSQL + GoTrue + PostgREST + Kong + Storage) behind Next.js App Router frontends, on Docker Swarm + Traefik with Let's Encrypt TLS. This was already the case at the prior revision of this document and hasn't changed; what has changed is that the implementation underneath it has been substantially repaired and extended since then.

All five apps share one Supabase project (one `auth.users`/`profiles` table) and, since §6, one cookie domain (`.greyin.net`) — a session started on any pillar is recognized on all the others without a second login, and `pillar_memberships` tracks which pillars a given person is actually active on.

---

## 2. What the plan called for, pillar by pillar

### 2.1 GREYIN — age-blind candidate search, fractional leadership placement, corporate outplacement

| Capability | State |
|---|---|
| Employer job posting | Working. Was previously filtering on statuses (`active`/`published`) that don't exist in the schema, so no job ever appeared publicly — fixed. |
| Candidate application flow | Working. `/jobs/[id]/apply` and `/dashboard/applications` didn't exist at all in the original build (dangling links) — built from scratch, including candidate and employer sides and status-update notifications. |
| Company directory | Working (`/companies`). |
| Candidate search (employer-only) | Working (`/candidates`), gated to `role = 'employer'`. |
| Admin moderation of listings | **New, beyond the plan.** `/admin` can close a job listing and manage user roles. |
| Password reset | **New, beyond the plan.** OTP-based, matching the signup UX. |
| In-app notifications | **New, beyond the plan.** New application → employer notified; application status change → candidate notified. |
| Fractional leadership placement / outplacement packages | Was not built at the time this table was written — now live, see §6.5. |

### 2.2 GREYMATTERS — SEO-driven thought-leadership blog, editorial engine

| Capability | State |
|---|---|
| Public post reading, categories, search | Working. |
| Comments | Working — the "Post Comment" button was previously dead UI (no handler, no route) — built the full comment flow including author notifications. |
| **In-app authoring (CMS)** | **New, beyond the plan.** The original build had no way to create or edit a post except writing directly into the database via Supabase Studio. `/posts`, `/posts/new`, `/posts/[slug]/edit` now give authors (`role = 'author'`) a full create/edit/publish/delete flow, including cover-image upload to object storage. |
| Newsletter signup | Working (`newsletter_subscribers` + subscribe API), didn't exist in the original build. |
| Admin moderation | **New, beyond the plan.** Unpublish any post, delete any comment, manage user roles. |
| Password reset, notifications | Same as above, per-app. |

### 2.3 SALT & PEPPER — private 12+ Yrs peer lounge, "The Lab" project showcase

| Capability | State |
|---|---|
| Experience-gated signup (12+ years) | Working — signup rejects under-12-years submissions with a clear message. |
| Discussions | Working — was hijacking the *blog's* `comments` table as a placeholder in the original build; now backed by real `discussions`/`discussion_replies` tables, with reply notifications to the discussion author. |
| "The Lab" project showcase | Working — was 100% hardcoded mock data in the original build; now backed by `builder_projects`/`project_upvotes`. |
| Members directory | Working (`/members`) — was a dangling link. |
| Admin moderation | **New, beyond the plan.** Delete any discussion or project, manage user roles. |

### 2.4 FREEAGENT — 0%-commission freelance marketplace

This pillar needed the most repair. At the prior revision it had **no gig-creation UI at all** and a **payment path that would 500 on every real attempt**.

| Capability | State |
|---|---|
| Gig listing & creation | Built from scratch (`/gigs/new`), including image upload. |
| Checkout via Razorpay | Now works end-to-end on Razorpay test-mode. Two real bugs found and fixed: (1) the server-side `RAZORPAY_KEY_SECRET` was a placeholder, so checkout was broken for every real user, not just tests; (2) the Razorpay `receipt` field exceeded Razorpay's 40-character limit, so **every order creation silently failed with a 500** even after the key fix — found via e2e testing, not visible from reading the code. |
| Order lifecycle, chat, reviews | Working — messaging and reviews were half-built (schema existed, some routes didn't); completed and verified end-to-end. |
| Transactional email | **Fixed.** The order-lifecycle emails (confirmation, payment received, deliverable ready, completed, failed, refund) were fully coded but wired to a Resend API key that was never configured, so every email silently no-op'd to a server log in production. Rewired to the platform's own already-working SMTP relay — no third-party account needed, and email now actually sends. |
| Freelancer payouts | **New, beyond the plan.** The plan's "100% earnings retention" promise had no way to actually get money *out* of the platform. Added an earnings dashboard (balance = completed orders minus the 2% platform service fee, minus already-requested amounts, recomputed server-side on every submission) and a withdrawal-request flow. This is a request/ledger system, not a live bank-transfer integration — an admin marks requests processed once the transfer happens out-of-band, since real payout rails (RazorpayX Payouts or similar) need a separate contract and KYC the platform hasn't set up. |
| Admin moderation | **New, beyond the plan.** Close any gig listing, process withdrawal requests (mark paid/rejected), manage user roles. |

---

## 3. Cross-cutting fixes that don't map to a single pillar

These affected all four apps simultaneously and were the reason the platform was effectively non-functional for real users at the prior revision, despite every page rendering correctly in isolation:

- **Signup was completely broken.** A DB trigger auto-created a placeholder profile row; the app's own signup route then tried to insert a second row with the same ID, which failed silently on the primary-key conflict — so the role a user picked at signup was never actually saved, and outbound SMTP (needed for GoTrue's confirmation email) was blocked at the server firewall. Rebuilt per your explicit spec: email-OTP verified signup, with the profile/company/candidate rows only finalized by a DB trigger once the email is confirmed.
- **The Supabase API keys were fabricated**, not real signed JWTs — Kong's own gateway credentials were a *third*, separately-fabricated value. All three were re-signed with the real project JWT secret.
- **A build-time environment variable bug** meant that changing a config value and restarting the container had no effect — `NEXT_PUBLIC_*` values are baked into the JavaScript bundle at build time, not read at runtime, so every fix in this category required a full rebuild, not just a redeploy.
- **`0.0.0.0:3000` was leaking into redirect URLs** across 23 files, because the standalone server's notion of its own hostname (from the Dockerfile) was being used instead of the real public domain.
- **Eight instances of a systemic data-fetch bug**: `posts`, `discussions`, `discussion_replies`, `builder_projects`, `project_upvotes`, `order_messages`, `order_reviews`, `comments`, `candidates`, and `companies` all had a foreign key pointing at Supabase's internal `auth.users` table instead of the public `profiles` table used everywhere else — which silently killed the *entire* query, not just the field that needed the join, anywhere the code tried to fetch a user's name alongside one of those records.
- **A Postgres RLS gotcha found while building admin moderation**: closing a job, closing a gig, or unpublishing a post all failed silently, because PostgREST always performs `UPDATE ... RETURNING` internally, and Postgres requires the *new* row to remain visible under some read policy for that to succeed — an admin who isn't the row's owner loses all visibility into it the instant its status changes away from "publicly listed." Fixed by giving admins their own unconditional read policy on the affected tables.

---

## 4. Automated verification

A Playwright end-to-end suite (`e2e/`) now covers all four apps against the **live production URLs**, not a local/staging copy — five isolated projects, one throwaway account per test, safe to run in parallel. It has grown alongside the platform: roughly 25 tests at first full coverage, now around 40 covering signup/login/password-reset, the job/application lifecycle, the blog CMS and comments, the community discussions/projects/members flows, the full FreeAgent checkout-through-review lifecycle, freelancer earnings/payouts, in-app notifications, image upload, and admin moderation including role management. Current pass rate on a clean run is in the high 80s–90s percent; the residual failures are attributable to Chromium network-change flakiness under this shared server's background load (independently verified via direct database/API checks each time), not application defects.

---

## 5. What the plan describes that still isn't built

Two claims in this section, as originally written, are now **superseded by §6** and kept here only as historical record — flagged inline. The rest is still accurate:

- ~~**Fractional leadership placement / enterprise outplacement as distinct offerings.**~~ **Superseded, built (§6.5).** Both now have a dedicated `/solutions` page and route through the same sales-led lead-capture pipeline as the Enterprise subscription tier, tagged by service type.
- ~~**Cross-pillar identity.**~~ **Superseded, built.** SSO across all five apps plus `pillar_memberships` (see the note under §1's table) now exists. The Greyin Score (§6.1) is the concrete realization of the plan's "flywheel" — standing on Prolab/FreeAgent/Salt & Pepper now visibly feeds Greyin B2B candidacy and GreyMatters authorship, not just shared login.
- ~~**Direct 1:1 messaging outside of a specific context.**~~ **Superseded, built.** FreeAgent has order-scoped buyer/seller chat; Greyin B2B has general employer↔candidate messaging (`/messages`, beyond status updates); Salt & Pepper has unscoped member-to-member DMs via `api/messages/start` → `get_or_create_conversation`, used from `/members` and (§6.6) `/mentors`.
- **Real payout rail.** As noted above, freelancer withdrawals are request/ledger only — no live bank transfer.
- **Live payment mode.** FreeAgent's gig checkout and Greyin B2B's Starter subscription checkout (§6.2) both intentionally run on Razorpay *test-mode* keys — switching to live keys is a deliberate, separate step before real money moves on either.

See `COMPETITIVE_BENCHMARK.md` for how the current feature set stacks up against comparable platforms serving the same audience, and what that suggests about priority for anything not covered above.

---

## 6. The Verified Expert revamp (August 2026)

An audit against the original business plans (`veterannet_business_plan.html`, `greyin_unified_business_plan.html`) found that Greyin B2B — the flagship product the whole plan is funded around — had drifted from "age-blind network for 12+-years professionals, monetized via employer fees" into a generic, ungated job board with no experience gate and no monetization at all. Salt & Pepper had kept the original exclusivity faithfully, but FreeAgent had no gate either despite being meant for the same population, so it and Salt & Pepper read as the same audience doing two different things instead of one population with two purposes. This section is the corrective build.

### 6.1 Verified Expert status — the shared eligibility gate

`is_verified_expert = years_experience >= 12 OR greyin_score >= 75` (migration 038, thresholds made governance-adjustable in 041 — see §6.4). Computed once in the `greyin_scores` view and reused everywhere, so someone without 12 years on paper can still earn candidacy or authorship through a real cross-platform track record — the Greyin Score itself is a Bayesian-shrunk blend of Prolab verified outcomes, FreeAgent seller rating, and Salt & Pepper reputation, plus a capped experience term.

- **Greyin B2B**: signup stays open (the "allow the account, limit what it can do" model), but applying to jobs and appearing in employer candidate search require Verified Expert status. A dashboard banner nudges ineligible candidates toward Prolab/FreeAgent/Salt & Pepper.
- **FreeAgent**: both freelancer and client signup are now gated to the threshold (previously ungated entirely) — restoring it as the same senior population's paid-services marketplace, not a generic marketplace layered on top of Salt & Pepper.
- **GreyMatters**: authorship is earned (RLS-checked against `is_verified_expert`, not a stored role), not granted to every signup unconditionally as before. Non-qualifying signups land as passive **followers**. Authors can set a per-post view/comment audience (public / followers / verified experts).

### 6.2 Monetization — enterprise subscription, not a placement fee

The plan's own 10%-placement-fee idea was never built as software (confirmed empty in earlier revisions of this document). The revamp replaced it, rather than building it as originally scoped: a **"Confirm Hire" self-reported invoice model was considered and rejected** — it's exploitable, since an employer can simply never confirm a hire and dodge the fee entirely. Instead, payment is collected *before* access is granted:

- Posting jobs, browsing jobs, and reviewing applicants to your own postings stay free — this is deliberate, to preserve the open-board liquidity the hybrid gate decision (§6.1) needs to keep working.
- Proactively searching the Verified Expert candidate pool (`/candidates`) requires an active subscription. Two tiers: **Starter** (self-serve, recurring, Razorpay Subscriptions — the same gateway account FreeAgent already uses for one-time Orders) and **Enterprise** (sales-led lead-capture → an admin manually activates the subscription once invoiced and paid off-platform, no card ever collected in-app).

### 6.3 Peer Referral Bridge

A "Refer a Friend" action on job postings (`/jobs/[id]`). If the referred email already has a Greyin account, they get an in-app notification; otherwise they get an invite email (the platform's own SMTP relay, same pattern as FreeAgent's transactional email). The plan's other named-but-unbuilt feature, the **Domain-to-AI Upskilling Hub, is formally cut** — GreyMatters already covers this ground as editorial content, and a separate vertical product wouldn't add differentiation. This is a deliberate decision, not a silent gap.

### 6.4 Advisory governance voting on the eligibility threshold

Any signed-up member on any pillar can propose where the years/score bar should sit (`/governance/threshold`), tallied into two buckets — already-Verified-Expert vs. everyone else — so admins can see whether the two groups actually agree rather than trusting one blended number a newly-arrived cohort could sway. **Advisory only**: nothing auto-applies a vote result. `platform_gate_settings` is the one live value every gate in the codebase now reads (Greyin B2B, FreeAgent, Salt & Pepper, and Prolab's signup routes all query it instead of hardcoding `12`), and an admin has to deliberately change it via `/admin/threshold-votes` for a vote to take effect anywhere.

### 6.5 Fractional Leadership Placement and Outplacement

The plan's other two named enterprise offerings, alongside age-blind candidate search — both explicitly sales-led in the plan's own language, so neither gets a self-serve checkout. A `/solutions` page presents all three offerings side by side; the two new ones route into the same `enterprise_leads` pipeline the Enterprise subscription tier already uses (migration 044 adds a `service_type` column), so admin triage is one inbox, not three. A subscription lead still gets the existing "Activate" action; a fractional-leadership or outplacement lead gets "Mark Contacted" instead, since there's no in-app state to flip — the engagement itself happens off-platform, by design.

### 6.6 Pivoter track and mentor availability

Support for senior professionals switching domains, not staying in their existing lane — closer to the plan's core displacement thesis than anything else added this session (age + skill obsolescence, not just age). Deliberately not a sixth pillar: `is_pivoter`/`pivot_from_domain`/`pivot_to_domain`/`pivot_status` (migration 042) are cross-pillar profile fields, settable only by existing Verified Experts (keeps pivoters recognizably senior, just in the wrong domain for a given search).

- **Greyin B2B**: pivoters are excluded from the general `/candidates` Verified Expert search (a 15-year finance veteran shouldn't surface in a "senior engineers" search just because the years qualify) but can apply to jobs an employer explicitly flags `open_to_career_changers`, with a "Career Changer" badge shown to the employer instead of a plain Verified Expert line.
- **Prolab**: no new gating — the existing open Supporter track already *is* the way to build a record in a new domain. The People directory just adds a "Pivoting into {domain}" badge.
- **Salt & Pepper**: a new `/mentors` directory, reusing the existing messaging system verbatim. Mentor availability (`is_mentor`/`mentor_domain`/`mentor_note`, migration 043) is deliberately **independent** of having personally pivoted — a lifelong domain expert who never changed careers can list themselves too, not just completed pivoters.

## 7. Infrastructure hardening (August 2026)

A production incident found and fixed during this session's work, unrelated to any single feature: adding a `.from()` PostgREST call as the *first* Supabase operation on a fresh `@supabase/ssr` client instance (no preceding `.auth.*` call) could crash the Node process under real signup load — `TypeError` inside `@supabase/auth-js`'s `_recoverAndRefresh()`, reading a session-storage value that, in a narrow race window (most plausibly concurrent with an in-flight cookie write during signup/login), comes back as a plain string instead of a session object. `.auth.signUp()` itself never touches this code path, so the three FreeAgent/Salt & Pepper/Prolab signup routes that gained a `platform_gate_settings` read for §6.4 were the trigger. Fixed by reading public, session-independent config via a plain stateless `fetch()` instead of the cookie-bound client on those routes, plus three other endpoints found by an app-wide audit for the same pattern (a newsletter-subscribe endpoint and two public read endpoints). One flagged instance (FreeAgent's `gigs/[gigId]/reviews`) was reverted after the same fix broke a real RLS-scoped embed that needs the visiting user's actual session — documented in-code rather than silently left broken or silently left at risk.
