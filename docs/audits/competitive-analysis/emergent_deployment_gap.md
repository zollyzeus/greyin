# Emergent Deployment vs. Greyin Platform — Feature Gap Analysis

**Date:** 2026-08-26 (re-audited 2026-08-31 — see addendum at the bottom)
**Sources compared:**
- `greyin-requirements-traceability.xlsx` (this project — 64 functional requirements, 6 Next.js apps on self-hosted Supabase)
- `greyin_requirements.csv` (Emergent-based implementation's own requirements tracker)
- `emergent-greyin.txt` (Emergent-based implementation's feedback/enhancement backlog)

Method: cross-referenced both documents pillar by pillar, then verified the most significant claimed differences directly against this project's actual codebase (grep for the real routes/tables/components) rather than trusting either document at face value.

---

## Confirmed genuine gaps (verified in code)

### 1. No self-service job close/reopen for employers — HIGH priority
Emergent flags this as their "most-impactful known issue." Checked here: `jobs.status` already has a `'closed'` enum value, but the only route that ever sets it (`api/admin/jobs/close/route.ts`) is gated to `role === 'admin'` — an employer can't close their own filled role. There's no reopen at all. This is a real, verifiable gap, not a documentation artifact.

### 2. Application withdrawal is a dead enum value — MEDIUM-HIGH priority
`applications.status` includes `'withdrawn'` and the UI even has a CSS class for it, but no route or button anywhere ever sets it. A candidate can't withdraw an application today. Schema anticipated this feature; it was never finished.

### 3. No Google OAuth — MEDIUM priority
Confirmed via grep: zero `signInWithOAuth` usage anywhere across all 6 apps. Email/password only. Emergent has it. Real friction for signup conversion.

### 4. Notifications are a full-page navigation, not a live bell — MEDIUM priority
Confirmed: notifications only render on a dedicated `/notifications` page (`app/notifications/page.tsx`), no bell-dropdown component exists, and no `.channel()`/`postgres_changes` Realtime subscription anywhere in the codebase. Same for DMs. Emergent has WebSocket push + bell dropdown + unread badges. This project relies on page load/reload to see new activity.

### 5. No pre-publish content moderation in Salt & Pepper — MEDIUM priority (trust/safety)
This project has `FR-SP-04`: an AI *quality* sweep on a periodic interval, after the fact. Emergent has AI *moderation* that flags inappropriate posts *before* they go live. These solve different problems — periodic quality review vs. proactive safety gate. Worth having both, arguably the pre-publish gate matters more for a real community launch.

### 6. No general user feedback mechanism — MEDIUM priority
Confirmed: no feedback-submission table or route exists anywhere in this project. Emergent has a full loop (submit → admin sees it → admin replies → user gets notified). This project has nothing comparable for collecting user-reported issues/ideas post-launch.

### 7. No feature-request/wishlist system — LOW-MEDIUM priority (nice differentiator)
A distinct, genuinely novel feature in Emergent's backlog: public wishlist with upvoting, admin panel, CSV export. Not present here at all. Could be a good community-engagement feature but isn't core.

### 8. AI gig-listing quality assist at post-time — LOW-MEDIUM priority
This project's `FR-FA-06` reviews *completed deliverables*. Emergent's version scores the gig *listing itself* at posting time and offers improvement suggestions to the seller. Different lifecycle moment, non-overlapping value.

### 9. No onboarding/guided tour — LOW priority for launch, useful long-term
Genuinely useful for real first-time users, not just demo judges: an annotated walkthrough of one key workflow. This project has nothing like it.

### 10. No "your activity" summary cards on the dashboard — LOW priority
Emergent shows personalized cards like "You have 3 open project asks" on the landing/overview tab. This project's dashboards are more static per what's been seen so far — worth a closer look, possibly already partially covered by existing dashboard widgets.

---

## What was deliberately excluded as not portable

Most of the txt file is Emergent's own contest/demo-specific backlog and doesn't translate: `TEST_`-prefixed data cleanup scripts, named demo personas ("Sam Morgan" landing card), visitor-counter reset buttons, tour highlight-ring CSS polish, favicon/logo theming rules, and a long tail of seed-data tasks (populate Salt & Pepper with fake posts, seed salary benchmarks, etc.) — these exist because Emergent's build needs to look populated for a live demo/judging session, which isn't this project's situation.

Also **not** gaps: Emergent's own CSV admits `FR-PW-05` (unified cross-pillar search) and `FR-PW-10` (worked-together) are only "partial" on *their* side — this project's versions are more complete already. And `FR-PW-17` (dedicated company pages) is partial on both sides equally — not a differential.

---

## Recommended priority order

1. ~~Employer self-service job close + reopen (+ notify affected applicants on reopen)~~ -- **Done, 2026-09-02.**
2. ~~Application withdrawal (wire up the existing enum value)~~ -- **Done, 2026-09-02.**
3. Pre-publish Salt & Pepper content moderation
4. Real-time notification bell (Realtime subscription + dropdown, replacing the full-page-only pattern)
5. General user feedback submission + admin reply loop
6. ~~Google OAuth~~ -- **Parked at user direction, 2026-09-02** (needs a provider decision -- Google Cloud Console app registration -- that's the user's call, not a unilateral pick).
7. Gig-listing AI quality assist at post-time
8. ~~Onboarding tour for real first-time users~~ -- **Parked at user direction, 2026-09-02.**
9. Feature wishlist system
10. Dashboard "your activity" summary cards

---

## UI/UX Comparison (live deployments)

Visited https://wisdom-link-8.emergent.host/ and all 6 live Greyin apps directly (Playwright, full-page screenshots, 1440×900 viewport) rather than inferring from docs. Screenshots saved alongside this file in `emergent-comparison-screenshots/`.

### 1. Brand identity — CRITICAL, highest user impact

Emergent's landing page (`emergent-landing.png`) has a single, deliberate visual identity carried through the whole page: dark navy background, a warm gold/cream accent, a serif display headline ("Better questions. Better company."), restrained typography, and copy written specifically for the "senior professional network" positioning ("A considered network for people who have built, led, and learned").

This project's 6 landing pages (`greyin-hub-landing.png`, `expertedge-landing.png`, `freeagent-landing.png`, `saltnpepper-landing.png`, `stackedge-landing.png`, `greymatters-landing.png`) each use a **different bright gradient hero** (indigo/purple on the Hub, orange on FreeAgent, purple-to-pink on Salt & Pepper, teal on StackEdge, blue on GreyMatters) with generic rounded icon-in-a-box feature cards and a default sans-serif typeface. Visited together, the 6 apps don't read as one platform — they read as 6 different unrelated products that happen to link to each other. The login screen (`expertedge-login.png`) drops the brand identity entirely: a plain white card on a pale gradient, indistinguishable from any default SaaS auth template.

Copy quality is also inconsistent between apps: StackEdge's hero ("Build with senior peers. Earn a verified record." / "Real asks, not busywork" / "No experience floor") is genuinely strong, specific writing. FreeAgent's ("1000+ Services", "Top Rated", "Fair Pricing") and Salt & Pepper's ("Active Discussions", "Community Members", "Support & Learn") read as unedited placeholder copy — generic enough to belong to any freelance marketplace or forum, undermining the "senior professional" positioning the rest of the platform is built around.

**This is the single highest-leverage improvement available**: a real design pass — one shared visual language (color, type, spacing) applied consistently across all 6 apps including the auth screens, plus an editing pass on FreeAgent/Salt & Pepper's hero copy to match StackEdge's quality bar.

### 2. Live production data hygiene — CRITICAL, immediate

GreyMatters' public blog feed (`greymatters-landing.png`) is currently dominated by leftover e2e test posts — the most recent ~10 articles a real visitor sees are all titled `"E2E AI Quality Post <timestamp>"` with body text `"Exercises the AI quality scoring pipeline end to end."` and author "Anonymous," pushing any real published content below the fold. This is not a documentation gap or a hypothetical — it's what the live public site shows right now to anyone who visits.

The same pattern is very likely present elsewhere given how extensively this project's own e2e suite creates real signups/posts/orders against prod (confirmed throughout this session's own work) — Salt & Pepper discussions, StackEdge projects, and FreeAgent gigs are the other high-risk spots given the same test methodology touches all of them.

**Recommended immediate action**: add an admin-triggered cleanup route (matching the pattern Emergent itself built — `POST /api/admin/cleanup-test-data`, idempotent, safe to re-run) that removes known e2e-generated content by a recognizable marker (title prefix, or a dedicated `is_test_data` flag set by the e2e helpers going forward), and run it once now to clear the current backlog. This is a two-line problem with an outsized effect on how the live site looks to a first real visitor.

### 3. Empty-state / cold-start experience — HIGH impact

ExpertEdge's own landing page shows live stat counters: **"0 Open Jobs / 8 Companies / 0 Candidates"** (`expertedge-landing.png`). FreeAgent, Salt & Pepper, and StackEdge's "One login, four more platforms" cards on the Hub similarly show "0 gigs listed / 0 discussions / 0 verified outcomes" (`greyin-hub-landing.png`). A platform whose own homepage advertises zero activity reads as abandoned or broken to a first-time visitor, regardless of how complete the underlying feature set actually is.

Emergent solves this two ways this project currently has neither of: (a) real seed content sized appropriately for a cold-start deployment (a handful of real-feeling jobs, posts, articles — not test junk, genuine placeholder-quality content), and (b) the guided-tour + demo-account pattern (see below) that lets a first visitor experience a *populated* version of the product immediately without needing the live counters to be non-zero at all.

### 4. Onboarding — no equivalent exists

Emergent's landing page has a full "Walk through the platform" section: numbered steps (1–5) narrating one real workflow end-to-end, a persona switcher (Senior Professional / Advisor / StackEdge Collaborator / Admin), and four "Launch Demo" buttons that drop a visitor straight into a fully-populated account for that persona with zero signup friction (`emergent-landing.png`). This project has no equivalent anywhere — a new visitor has to sign up for real and build their own context from an empty account before understanding what the platform does. This matters for conversion (a visitor who can't quickly grasp the value proposition bounces) independent of the "for judges" framing it originated from in Emergent's backlog.

### 5. Feedback capture — no equivalent exists

Emergent's landing page ends with a live feedback widget: a star rating, a free-text box, and a "Suggest a feature" link, submittable without an account (`emergent-landing.png`). This project has no feedback mechanism anywhere in the product (confirmed via code search — no feedback table/route exists). For a pre-launch platform, this is a meaningful gap in the ability to collect real signal from actual early users once it does go live.

### Priority order for UI/UX specifically

1. Clean up e2e/test-generated content from the live GreyMatters feed (and audit Salt & Pepper/StackEdge/FreeAgent for the same); add the idempotent cleanup route so it doesn't recur silently
2. Unify visual identity across all 6 apps + the login screens (one palette, one type system) — the single highest-leverage design change available
3. Editing pass on FreeAgent/Salt & Pepper's hero copy to match StackEdge's quality bar
4. Real, modest seed content per pillar sized for a cold-start deployment (not test data)
5. A short guided tour / demo-account entry point for first-time visitors
6. A lightweight feedback widget on the landing page

---

*This UI/UX section reflects a live snapshot taken 2026-08-26. Both deployments will have changed by the time this is read — treat the screenshots as evidence of the state observed, not a permanently current comparison.*

---

## Re-audit — 2026-08-31

Re-read both source documents fresh (`emergent-greyin.txt`, `greyin_requirements.csv`) and re-verified every claim directly against the current codebase and live prod, rather than trusting the 2026-08-26 write-up. Net result: the 10 functional gaps and the 6 UI/UX findings above are **all still accurate and still open** — nothing above was stale. Four items below are new or corrected.

### Already closed since the original analysis (not gaps — confirmed done, FYI)

Separately from this gap list, four Emergent-parity features were built and shipped in the days since (`written_recommendations`, `company_reviews`, `platform_people_index` + NL search, `collaborators`/worked-together — migrations 057–060, live in all relevant apps, e2e-covered). These map to Emergent's `FR-PW-13/14`, `FR-EE-06`, `FR-PW-05/06`, `FR-PW-10`. None of these were on the original 10-item gap list to begin with (this project already had equivalents or they were addressed as part of other work), so this isn't a correction — just confirming that thread is done and not still pending.

### Corrected: test-data pollution is worse, and confirmed isolated to one app

Re-checked live prod directly (not just GreyMatters — checked FreeAgent's `/gigs`, Salt & Pepper's `/discussions`, StackEdge's `/projects`, and ExpertEdge's `/jobs` too). Result:
- GreyMatters' public blog now shows **20 `"E2E AI Quality Post <timestamp>"` entries** (up from ~10 on 2026-08-26) — this has continued accumulating from ongoing e2e runs and is actively getting worse, not static.
- The other four apps show **no equivalent pollution** on their live listing pages — the original write-up flagged this as "very likely present elsewhere" as a guess; that guess was wrong. It's isolated to GreyMatters.

This sharpens the recommendation: the `/api/admin/cleanup-test-data` route (still not built — confirmed via code search, zero `is_test_data`/`cleanup-test-data` references anywhere) is still worth building for future-proofing, but the *immediate* fix only needs to target GreyMatters, and it needs doing soon given the count is actively climbing on a live public page.

### New item found: no "Events & Resources" content pillar at all — LOW priority

Emergent has an Events & Resources section (its own tracker flags it as a static/hardcoded placeholder, `KI-05` — not a real feature even on their side). This project has no equivalent pillar whatsoever. Given Emergent itself doesn't consider its version done, this isn't an urgent gap — noting it for completeness since the ask was to catch anything missed, not because it's actionable soon.

### Checked and confirmed NOT a gap: company URL routing

Emergent's own tracker flags `KI-01`: company names used as raw URL path segments, breaking on special characters. This project already uses id-based routing (`companies/[id]`) — confirmed via the actual route folder structure. Not a gap; this project is ahead here.

### Re-confirmed unchanged: brand identity fragmentation

Pulled the live hero gradient classes from all 4 non-hub apps directly: FreeAgent `orange-600→amber-500`, Salt & Pepper `purple-600→pink-600`, StackEdge `teal-600→emerald-600`, GreyMatters `sky-600→cyan-600`. Exactly as before — no unification work has happened since 2026-08-26 (expected, since all work in between was backend/security-focused). Still the highest-leverage open item on the UI/UX side.

### Bottom line

No previously-listed item can be marked done. One new low-priority item added (Events & Resources — likely not worth doing given Emergent's own version is a placeholder). One finding sharpened (test-data pollution: worse, but single-app, not platform-wide). Full priority order is unchanged from the two lists above; GreyMatters cleanup remains the one item worth treating as urgent regardless of what else is picked, since it's the only one actively degrading on its own.

---

## Full code-level re-audit — 2026-08-31

The two passes above compared trackers (CSV, txt backlog, xlsx) and, for UI/UX, live screenshots. This pass goes one level deeper: read Emergent's actual source at `/media/anand/WD BLACK/projects2/emergent-greyin-main` (FastAPI/Mongo backend routers, React frontend) against Greyin's actual source, rather than trusting either side's own tracker. Full pillar-by-pillar tables (Functional / Non-Functional / UI-UX, gaps *and* orphans *and* unbuilt-on-both-sides backlog ideas) are published as an artifact: **https://claude.ai/code/artifact/bb926e18-9b9e-46e8-8c7c-b2ae73db423e** — this section is the summary; the artifact has full evidence (exact route/file/line per row) and a filter to show only gaps, only orphans, or only backlog ideas.

### Corrected from the 2026-08-26/31 doc-only passes

- **"Events & Resources" was mis-scoped as low-priority.** The earlier note assumed Emergent's own `KI-05` ("Resource library is static") covered the whole area. Reading the code shows two separate things: a static resource-library placeholder (matches KI-05, genuinely unfinished on Emergent's side too) *and* a fully real, functional events/RSVP feature (`GET/POST /events`, `POST /events/{id}/rsvp`) that Greyin has zero equivalent of. Re-filed as a real MEDIUM gap, not a skippable LOW one.
- **Salt & Pepper pre-publish moderation and FreeAgent gig-quality-at-listing** were flagged from Emergent's tracker text before; both are now confirmed at the function-call level (`moderate_post()` blocking a 422 before insert; `score_gig()` called synchronously in `POST /gigs`), raising confidence from "documented" to "code-verified."
- **Onboarding tour** confirmed as a real shipped component (`frontend/src/TourOverlay.jsx`), not just backlog copy.

### New, higher-confidence findings only visible from code

- **Emergent's salary-benchmark k-anonymity is currently disabled in the live app.** The k≥3 threshold is written in the aggregation pipeline but commented out — `{"$gte": 1}` with the comment `"Show all for demo; in prod use $gte: 3"` (`platform.py:389`). A single salary submission's exact figure is exposed through the "aggregate." Greyin enforces `HAVING COUNT(*) >= 3` at the database view level (migration 055) — not app logic that can be silently left in demo mode. This is the single highest-confidence finding of this pass, quoted directly from Emergent's own source.
- **Emergent's own endorsement-gating code admits it's a placeholder**: `"our MVP stand-in for FR-PW-11's 'real verified interaction' gate until StackEdge/FreeAgent-style collaborations exist"` (`endorsements.py:44`) — the actual gate is just a mutual, unverified "connection" accept. Greyin's equivalent (endorsements, skill ratings, written recommendations) all require a real completed StackEdge collaboration or FreeAgent order via the `collaborators` view.
- **Emergent's own security backlog (`seed_security_wishlist.py`) lists 5 findings, all still `status: open`** — including a live IDOR (`GET /payments/status/{session_id}` returns any user's payment status, not just the owner's) and an open admin-takeover path (registering the admin email before its real owner does, with no ownership verification). Greyin's own 38-item security audit (SEC-001–038) is fully closed and individually verified. Not a criticism of Emergent's project stage — but a real, current gap between the two live deployments today.
- **Emergent's own unbuilt wishlist file** surfaces 16 ideas neither platform has actually built (dark mode, PWA, vanity profile URLs, profile-as-PDF, 2FA, author analytics, calendar integration, percentile salary charts, etc.) — listed in the artifact for completeness, explicitly *not* gaps since Emergent hasn't shipped them either.
- **Cross-pillar unified search is a place Greyin is ahead, not level** — Emergent's own CSV marks `FR-PW-05` "partial" (no real unified results page), while Greyin's `platform_search_index` (migrations 024/037) is built and shipped. Worth stating explicitly since a casual read of the two CSVs side by side could suggest parity.

### Updated gap count

13 gaps (up from 10 — added: community events/RSVP, admin cleanup-test-data route as its own line, and split job-close/job-reopen into two rows since they're independent fixes), 17 orphans (features/hardening Greyin has that Emergent doesn't), 16 backlog ideas neither side has built. Full detail, evidence, and the live filter view are in the artifact linked above.

---

## Update — 2026-09-02: test-data hygiene closed

Re-verified every top item directly against the current codebase and live prod before acting (nothing else on the list had changed since 2026-08-31 -- confirmed via spot-check: job close/reopen still admin-only with no reopen route at all, application withdrawal still an unwired enum value with no candidate-facing button, GreyMatters pollution still live). Only item #2 (live production data hygiene) was addressed this pass, at the user's explicit direction.

**What was found, beyond what the 2026-08-31 re-audit caught**: the live GreyMatters feed actually had *two* polluted title patterns, not one -- the previously-known "E2E AI Quality Post" (10 rows, matching the doubled grep count from live HTML rendering both a desktop and mobile nav copy) plus a second, previously-undetected "E2E Verified Expert Only Post" pattern (35 rows), both `published` and both live on the public page. A platform-wide sweep also turned up 183 "E2E*"-titled `builder_projects` on StackWorks (status `idea` throughout, so never actually reached the public `/projects` listing, but still stale test rows sitting in a live production table) and 217 cascading `project_asks` beneath them. All other apps (discussions, gigs, jobs, future_roles, companies) came back clean.

**Verified safe before deleting**: checked cascade behavior (`ON DELETE CASCADE` on every relevant FK) and confirmed zero real user engagement attached (no comments, no verified_outcomes -- meaning no Greyin Score impact from the StackWorks cleanup). All 228 rows removed (45 posts + 183 builder_projects); live pages re-checked directly afterward and confirmed clean across all 5 apps.

**The recommended `/api/admin/cleanup-test-data` route is now built** (Greyin Hub, platform-wide admin -- matches the "no pillar affiliation of its own" home already established for the LLM-provider and eligibility-governance panels), covering posts/builder_projects/discussions/gigs/jobs by the `"E2E "` title-prefix convention already consistent across the whole e2e suite (no `is_test_data` column added -- a title-prefix filter gets the same result without retrofitting every insert path across 6 apps' e2e helpers). Idempotent, admin-gated, with a result breakdown shown inline on `/admin`. E2E-covered: a non-admin is blocked, and running it against a real seeded post confirms the post is actually gone afterward, not just that the UI says so.

Items #1, #3–#10 of the original 10-item list, and the 3 additional items from the 2026-08-31 code-level pass (Events & Resources, split job-close/reopen, the cleanup route itself as its own line -- now closed), remain open. See the phased next-steps recommendation given alongside this update for sequencing.

---

## Update — 2026-09-02 (Tier 1): job close/reopen + application withdrawal closed

Both scoped functional gaps recommended as the first Tier-1 pick (small, well-defined, schema already half-anticipated both) are now closed.

**Item #1 (job close/reopen, Emergent's "most-impactful known issue")**: `jobs`' own RLS ("Company owners can update their jobs", 003) already let an employer update any field on their own job unrestricted -- the actual gap was purely missing routes/UI, not schema or RLS. Added `api/jobs/[id]/status/route.ts` (employer-scoped, accepts only `open`/`closed` -- not a general status editor) plus Close/Reopen buttons and a status badge on `/employer/dashboard`. Closing a job now also notifies every candidate with a still-open (non-terminal-status) application that the role has closed, via a new trigger (092) -- addresses the "notify affected applicants" half of the original recommendation, scoped to close rather than reopen (closing is the transition that actually leaves an existing applicant with stale information; reopen doesn't).

**Item #2 (application withdrawal)**: `applications.status` already had a `'withdrawn'` value and the UI already styled it (`STATUS_STYLES`) -- confirmed exactly as originally flagged: no RLS policy or route ever let a candidate set their own application's status, only the employer's status-update policy existed. Added a narrowly-scoped RLS policy (092) that lets a candidate update only their own application, and only to `'withdrawn'` specifically (can't be used to self-promote to `'accepted'` or otherwise forge an employer decision), plus a Withdraw button on `/dashboard/applications` (shown only for non-terminal statuses) and a notification to the employer when it happens.

Both verified end to end via new specs (`application-withdrawal.spec.ts`, `job-close-reopen.spec.ts`) -- real employer+candidate signups, real UI actions, notification delivery confirmed via the actual `/notifications` page, public `/jobs` listing confirmed to correctly drop a closed job. No regression in the existing `jobs-and-applications.spec.ts` (re-run clean after the new RLS policy was added alongside the existing employer-side one).

**Known follow-up, not fixed by this pass**: withdrawal is one-way by design (matches the audit's own scoped ask) -- a candidate who withdraws and later wants to re-apply can't, since `applications`' own `UNIQUE(job_id, candidate_id)` constraint blocks a second row for the same job. Worth a considered decision later, not assumed as part of this fix.

Remaining open: items #3–#10 of the original list, the 3 items from the 2026-08-31 code-level pass, minus the two Tier-1 items just closed here.

---

## Update — 2026-09-02 (recheck): unrelated work landed, gap list unchanged; one new orphan

Re-verified every remaining open item directly against the current codebase before writing anything (same discipline as every prior pass) — fresh grep for each: `moderate`/pre-publish patterns in Salt & Pepper's API (still none), `.channel(`/`postgres_changes` Realtime usage across all 6 apps (still none), any feedback table/route (still none), gig-quality-at-listing scoring (still none), wishlist/feature-request patterns (still none), RSVP/events routes (still none). All confirmed still open, byte-for-byte the same gaps as the 2026-09-02 Tier-1 update left them. The work completed between that update and this recheck (FlexPro/DeepEdge 3-tier metered subscriptions + admin panels, migration 096; the platform-wide "Home" nav link) doesn't touch any item on this list — neither closes anything nor creates a new gap.

**One new orphan worth recording**: checked Emergent's source directly (`emergent-greyin-main`, `emergent-greyin.txt`) for any tiered-subscription or metered-credit concept — there is none. Emergent's own backlog still lists its single employer subscription as "the last PARTIAL/mocked flow in the platform," not yet wired to real Stripe/Razorpay checkout at all. Greyin now has a real, live, 3-tier-per-product subscription system (FlexPro posting + DeepEdge hiring) with admin-configurable pricing and named per-tier credit allowances, atomically enforced (`consume_credit()`), on real Razorpay Subscriptions checkout. Adding this to the "orphans" side of the ledger — a capability gap in Emergent's favor doesn't exist here; if anything this widens Greyin's lead on monetization sophistication specifically.

**Dashboard activity-summary item (#10) — partially resolved, not platform-wide**: rechecked directly this pass (the original write-up had flagged this as worth a closer look). Longlist's `/dashboard` already shows a real personalized line ("You have N future roles posted"). No other app (DeepEdge, FlexPro, Salt & Pepper, StackWorks, GreyMatters) has an equivalent. Downgrading this from "not present" to "present in 1 of 6 apps, worth extending to the rest" — still low priority, but the shape to copy already exists in this codebase rather than needing to be invented from Emergent's example.

---

## Update — 2026-09-02 (Phase 0+1): LLM timeout hardening, dashboard activity cards, gig-quality assist closed

Full 6-phase plan approved this pass to close the 7 remaining items (job
close/reopen and application withdrawal already closed above; test-data
hygiene already closed above). Phase 0 (prerequisite) and Phase 1 (2 quick
wins) are done, verified against prod, and deployed.

**Phase 0**: every app's `lib/llm/client.ts` provider trio
(anthropic/openai/ollama) had zero fetch timeout anywhere -- a hung upstream
(esp. local Ollama) could hang the calling request indefinitely. Added
`AbortSignal.timeout()` (20s anthropic/openai, 30s ollama) across all 18
provider files (6 apps × 3 providers). No app-visible behavior change today,
but a real prerequisite for Phase 2 (moderation) and this phase's own gig-
quality item, both of which put an LLM call on a path a real user is waiting
on synchronously for the first time.

**Item #10 (dashboard activity cards)**: extended Longlist's existing
personalized-count-line pattern to the other 5 apps' `/dashboard` pages
(DeepEdge: real applications count, replacing a hardcoded `0`; FlexPro:
active gigs + pending orders; Salt & Pepper: discussions started; StackWorks:
asks posted, Builder-only; GreyMatters: published posts). All 6 apps now show
real personalized activity, not static placeholders.

**Item #4 (gig-listing AI quality assist)**: new stateless, on-demand "Get AI
suggestions" button on FlexPro's `/gigs/new`, calling a new
`api/gigs/quality-check` route -- informational only, never gates Publish,
and deliberately never calls `consume_credit()` (096) so a suggestions click
can't silently burn a paid posting credit.

Verified via a new cross-platform e2e spec exercising all 6 apps' dashboard
lines plus the gig-quality button. First run surfaced two real bugs, both
fixed and re-verified green: (1) the spec's own `login()` calls passed a bare
relative `expectedUrl` (`'/dashboard'`) alongside an explicit different
`baseUrl` -- every other cross-platform spec in this suite passes a full
absolute URL in that situation; the mismatch made Playwright wait on a URL
under the *project's default* origin that would never be reached, timing out
on every app except the one matching the project's own default base. (2) a
Playwright strict-mode locator violation on DeepEdge's dashboard (`getByText
('Applications')` matched 3 elements) fixed with `exact: true`. Neither was
an app regression -- confirmed both times via the failure screenshots
themselves, which showed the correct page already fully loaded and correct
before the harness-level assertion/wait failed.

Remaining: Phase 2 (pre-publish Salt & Pepper moderation), Phase 3 (Events &
Resources/RSVP), Phase 4 (wishlist + feedback), Phase 5 (notification bell).

---

## Update — 2026-09-02 (Phase 2): pre-publish Salt & Pepper moderation closed

**Item #1**: new `moderation_status` state machine (098/099) on `discussions`
and `discussion_replies` (`passed` | `pending_check` | `flagged_on_retry`),
enforced synchronously in both `api/discussions/create` and
`api/discussions/[id]/reply` via a new `lib/moderation.ts`, modeled directly
on `reply-quality.ts`'s shape. A live BLOCK verdict stops the post before
insert; if the LLM is unreachable/unconfigured the post goes live
immediately (fail-open, confirmed with the user) but is queued as
`pending_check` for automatic retry via a new 15-minute timer tick
(`instrumentation.ts`) once the LLM is back. A retry that comes back BLOCK is
never auto-deleted -- it's surfaced in a new "Moderation review" section on
`/admin` for a human to clear or delete (new RLS: `discussion_replies` had
zero admin policies of any kind before this, not even delete-a-single-reply;
`discussions` had delete but no update). Small adjacent fix bundled in: both
create/reply routes previously never read the `.insert()` error at all.

Verified via 3 new e2e specs (a normal post isn't blocked; a manufactured
`flagged_on_retry` row is visible/clearable in the admin queue; a non-admin
is denied the queue) plus a regression pass on the pre-existing
`discussions.spec.ts`/`admin.spec.ts`/`karma-and-anonymous.spec.ts` suite --
one transient failure in the parallel run (test-created content pushed out
of the admin page's 50-row window by concurrent test volume, not a real
regression) confirmed passing cleanly when re-run in isolation.

Remaining: Phase 3 (Events & Resources/RSVP), Phase 4 (wishlist + feedback),
Phase 5 (notification bell).

---

## Update — 2026-09-02 (Phase 3): Community Events & Resources / RSVP closed

**Item #7** (code-level pass, 2026-08-31): net-new `events` + `event_rsvps`
tables (100), houses on Salt & Pepper per user decision. `/events` browse
(upcoming, soonest first, going-count per card), `/events/new` host form,
`/events/[id]` detail with an RSVP/cancel toggle (capacity-aware, disables
once full) and a "Who's going" list, a `notify_new_rsvp` trigger telling the
host when someone RSVPs (same shape as the existing `notify_new_application`).
`event_rsvps` mirrors `project_upvotes`' exact composite-PK shape; RLS
verified directly (a member can RSVP for themself, blocked from RSVPing as
someone else). "Events" added to Salt & Pepper's nav.

Verified end to end via a new e2e spec: host publishes, event appears on the
public browse listing, a different member RSVPs and is counted (with their
name in "Who's going"), the host receives the real notification, then the
member cancels and the count drops back to 0.

Remaining: Phase 4 (wishlist + feedback), Phase 5 (notification bell).

---

## Update — 2026-09-02 (Phase 4): feature wishlist + centralized feedback closed

**Items #5 and #3**: both platform-wide, house on Greyin Hub (101) --
`feature_requests` + `feature_request_upvotes` (exact `project_upvotes`
composite-PK shape) for the wishlist, `platform_feedback` for feedback
(login required, no anonymous submission, per user decision). `/wishlist`
(public browse sorted by upvotes, submit form, toggle-upvote button) and
`/feedback` (rating + message, own feedback history with any admin reply
shown inline) on Hub; each of the 6 pillar apps' `SiteHeader.tsx` got one new
nav link out to `https://greyin.net/feedback?app=<pillar>` rather than a
duplicated page + route per app (user decision -- SSO makes this frictionless).
Hub `/admin` gets two new sections reusing the LLM-provider-panel
list-with-inline-forms convention: `/admin/wishlist` (status dropdown per
row + save, plus a CSV export route) and `/admin/feedback` (reply queue with
a textarea per open item).

A real cross-pillar notification bug was caught and fixed before this
shipped: the reply-notification trigger's `link` was initially written as a
full absolute URL (`https://greyin.net/feedback`), but every app's
`notification-link.ts` expects `n.link` to be a *relative* path it resolves
against the owning pillar's domain -- an absolute link would have produced a
broken double-URL (`https://<pillar-domain>https://greyin.net/feedback`) for
any recipient reading the notification from a pillar app other than the one
they submitted from. Fixed by storing a relative `/feedback` path and adding
a `greyin_hub` entry to `PILLAR_DOMAINS` plus `feedback_replied: 'greyin_hub'`
to `TYPE_TO_PILLAR` in all 6 apps' `notification-link.ts` (Hub itself was
never one of the 6 pillar apps that map already covered, since it never
wrote to `notifications` before this).

Verified via 3 new e2e specs: full wishlist path (suggest → a different
member upvotes, count updates → admin changes status, reflected on the
public page); full feedback path (member submits → admin replies from the
queue → member sees the reply on `/feedback` *and* receives the real
notification, read from a different pillar app's own `/notifications` page,
proving the cross-pillar link fix); and a non-admin denied both admin panels.

Remaining: Phase 5 (notification bell) -- the last item.

---

## Update — 2026-09-02 (Phase 5 spike): Realtime subsystem has never worked in this deployment -- blocked, not sized

Ran the read-only infra spike the plan required before sizing Phase 5. Result
is materially worse than the plan's contingency ("if the tenant row is
missing, that's an ops task -- resize the phase") anticipated: **the
Realtime container has never successfully connected to Postgres at all, in
this deployment's entire history** -- not a missing-tenant-row issue, a total
subsystem outage that predates and is unrelated to any work this session.

**What was checked, in order:**
1. `pg_publication_tables` for `supabase_realtime` -- publication exists
   (correctly bootstrapped), 0 tables on it (expected, nothing was ever
   added).
2. A `_realtime`/`tenants` table, the usual self-hosted multi-tenant marker
   -- does not exist anywhere on this Postgres server (only `postgres`,
   `template0`, `template1` databases exist; the `realtime` schema inside
   `postgres` exists but is empty).
3. `docker service logs supabase_realtime` -- continuous, ongoing connection
   failures since the earliest retained log entries, recurring identically
   across at least one container restart (different container-id prefixes
   in the log, same error both times):
   `Postgrex.Protocol failed to connect: ** (DBConnection.ConnectionError)
   tcp connect (supabase_db:5432): non-existing domain - :nxdomain`.
4. Ruled out a genuine network/DNS gap directly: `docker service inspect`
   confirms `supabase_realtime` is attached to the identical overlay network
   as `supabase_supabase_db` (whose own alias on that network is literally
   `supabase_db`), the same hostname every other service (PostgREST, GoTrue,
   storage, pg_meta -- all confirmed working all session) already connects
   to successfully. A throwaway container attached to that same network
   resolves `supabase_db` correctly via plain `nslookup`
   (`10.0.2.19`). **This isolates the defect to the Realtime container's own
   Erlang/BEAM runtime failing to resolve a hostname the OS-level resolver
   handles fine** -- a known class of issue with Elixir release images in
   Docker (the BEAM VM's built-in `:inet` resolver doesn't always behave
   like `getaddrinfo`), not a Docker Swarm or Postgres configuration
   problem.

**Why this wasn't pushed further today**: fixing an Erlang-VM-internal DNS
resolution quirk on a live service (likely candidates: `ERL_AFLAGS`/IPv6
preference, `RELEASE_DISTRIBUTION`, or a resolver-backend override) is real
infrastructure debugging against production, not app feature work, and
guessing at it without being confident of the fix risks destabilizing a
currently-idle-but-otherwise-fine service for no offsetting benefit today
(nothing in this platform depends on Realtime yet). Per this session's own
standing discipline (confirm before acting on production infra, don't
trial-and-error against a live service), this is reported rather than
guessed at.

**Status**: Phase 5 (the notification bell) is **blocked on this infra fix**,
not abandoned and not resized down -- the app-code plan (one
`NotificationBell.tsx`, RLS already confirmed workable for an authenticated
subscriber in principle, piloted in one app before copying to the other 5)
is unaffected and ready to execute once Realtime actually connects. This is
now tracked as its own infra item, separate from the feature backlog. All 6
other gap-audit items (functional gaps #1, #3-#10, plus the 2 code-level-pass
items) are closed as of this update.

### What's next — recommended order, unchanged from 2026-08-31/09-02

With Tier 1 (job close/reopen, application withdrawal) and test-data hygiene both closed, the next real picks, ranked:

1. **Pre-publish Salt & Pepper content moderation** (MEDIUM, trust/safety) — a real proactive-safety gap, not just a quality-review gap; Emergent blocks bad posts before they go live (`moderate_post()`, 422 on insert), Greyin only reviews after the fact.
2. **Community Events & Resources / RSVP** (MEDIUM, code-verified 2026-08-31) — a fully real, functional feature on Emergent's side (`GET/POST /events`, RSVP) with zero Greyin equivalent; self-contained net-new feature, doesn't touch existing schema.
3. **Real-time notification bell** (MEDIUM, but the largest lift of the three — a Realtime `postgres_changes` subscription + dropdown component would need to land in all 6 apps, not one).
4. **General user feedback submission + admin reply loop** (MEDIUM) — straightforward net-new table/routes/admin UI, no architecture risk.

Lower priority and unchanged: gig-listing AI quality assist at post-time (#7), feature wishlist system (#9), dashboard activity cards platform-wide (#10, now partially covered). Google OAuth and onboarding tour remain parked at user direction.

---

## Update — 2026-09-02 (Phase 5, unblocked): Realtime infra fixed, notification bell shipped — gap list fully closed

The infra defect this doc's previous update left blocked (`nxdomain` inside the Realtime container's own Erlang/BEAM resolver, isolated but not yet root-caused) was investigated further the same day and fixed all the way through, not just diagnosed. Chain of causes, each only visible after fixing the one before it:

1. **DNS**: the OS-level resolver (`getent hosts supabase_db`, run inside the identical failing container) succeeded with the exact hostname Postgrex was failing on — confirming the BEAM VM's own `:inet` resolver genuinely behaves differently from `getaddrinfo` inside this image, not a red herring. Fixed with a static `/etc/hosts` entry (`docker service update --host-add "supabase_db:<stable Swarm VIP>"`), persisted in `deployment/supabase-stack.yml` via `extra_hosts:` with a comment flagging the VIP as re-verify-if-the-DB-service-is-ever-recreated.
2. **Missing tenant**: once DNS resolved, Realtime v2.x turned out to need its own internal `_realtime` schema (tenants/extensions tables) that only auto-migrates under an AWS ECS Fargate env flag this deployment doesn't set — triggered manually via `/app/bin/migrate`, then registered a tenant row via Realtime's own admin API (`PUT /api/tenants/:external_id`) rather than direct SQL, since it auto-encrypts `db_password`/`jwt_secret` itself — a first attempt that pre-encrypted those fields before sending caused genuine double-encryption and a `Realtime.Helpers.unpad/1` crash, root-caused by reading Realtime's actual v2.25.35 source rather than guessing. The external_id this deployment's client actually requests turned out to be the bare string `realtime`, confirmed from Postgrex query logs, not the common self-hosted convention `realtime-dev`.
3. **Privilege**: the CDC extension's Postgres connection needed a real superuser role (`postgres` here is deliberately not one; `supabase_admin` is) for one specific internal operation — rather than broadly elevating the shared `postgres` role, only Realtime's own CDC connection was pointed at `supabase_admin`.

`ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications` (migration 102) made the `notifications` table changefeed-eligible. `NotificationBell.tsx` (a self-contained client component subscribing to `postgres_changes` scoped to the viewer's own `user_id`) shipped to all 6 apps sharing the notifications table (all but Greyin Hub, which never wrote to it before Phase 4's feedback-reply notifications) — SiteHeader's desktop and mobile nav each mount their own instance, disambiguated by a random `instanceId` appended to the channel topic name after an initial bug where both instances collided on one shared channel name and split badge state unpredictably.

Verified end to end via a new spec per app pattern (`notification-bell.spec.ts`, saltnpepper + greyin-b2b as the two piloted first): sign up, navigate to a `SiteHeader`-bearing page (not `/dashboard`, which has its own bespoke header without the bell — a real routing gotcha caught by the first failed run, not by design review), insert a notification row directly via REST, assert the badge updates to "1" with **no page reload**, click the bell, assert the notification content renders, assert the badge clears. Both pass reliably (~5-6s) after the infra fix; the very first subscription attempt against a freshly-provisioned tenant showed a one-time ~15s cold-start delay (replication slot/catalog setup) that every subsequent attempt didn't reproduce, re-confirmed as cold-start behavior, not a flake, by re-running twice more successfully. Re-confirmed live and working 2026-09-03, after this session's separate internal-identifier rename work moved the app directories/e2e paths these specs live in (`tests/greyin-b2b/` → `tests/deepedge/`) — one of the two specs showed the identical one-time cold-start pattern again on that re-run (passed on retry), the other passed clean.

**This closes the entire original 10-item gap-audit list plus the 3 additional items the 2026-08-31 code-level pass found** (Events & Resources, the split job-close/reopen rows, the cleanup-test-data route). Nothing from the Emergent comparison remains open as an engineering gap. The only two items not built are **Google OAuth** and an **onboarding tour** — both explicitly parked at user direction (the former needs a Google Cloud Console app-registration decision that isn't this session's call to make unilaterally; the latter was a deliberate scope call, not a forgotten item) — carrying these forward as parked, not pending.
