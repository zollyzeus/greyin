# Gap Closure Plan

**Created:** 2026-09-01 · **Updated:** 2026-09-08 (pitch-readiness 3-item plan shipped: demo login, referral system + GreyMatters likes, consolidated admin panel — see `~/.claude/plans/wild-jumping-dream.md`)
**Source:** `greyin-requirements-traceability.xlsx` (104 functional requirements, 22 non-functional, 41 security findings, 69 pending/partial/deferred items as of 2026-09-08) + the Emergent code-level audit (`emergent_deployment_gap.md`, `emergent_code_audit.html`).

This is the standing backlog going forward. As each item ships, update four things together, not just the code: **UI/UX** (the actual page), **the e2e suite** (a real spec, not a claim), **this plan** (move the item to Done with what actually happened, including anything found along the way), and **the traceability matrix** (`build-requirements.js` → regenerate the xlsx). That loop is now the default working pattern for this project, not a one-off for Longlist.

## Business model, restated (2026-09-01)

The pitch deck now leads with this, and it's worth stating here too since it reframes how several pillars should be read going forward: Greyin runs on two tiers, not seven equal platforms.

- **Primary (revenue) tier** — three enterprise offerings, each a distinct employer budget line: **Outplacement** (FR-EE-13, sales-led/invoiced, restructuring budget), **Coaching/Mentorship** (FR-PW-19/20, live paid sessions/cohorts/packages, L&D budget), **Future Hiring Pipeline / Longlist** (FR-LL-01/02, AI-matched anticipatory access, workforce-planning budget — no real incumbent in this category today).
- **Supporting tier** — ExpertEdge's core hiring/candidate database, FreeAgent, StackEdge, Salt & Pepper, GreyMatters. Free, adoption-maximizing, and its real product is the Greyin Score signal the Primary tier actually sells — a StackEdge outcome makes a Longlist match more accurate; a GreyMatters article makes a coaching booking more credible.

A full code sweep (below) found that Outplacement — now a headline Primary-tier line — had shipped, was fully e2e-tested, and had **zero row in the traceability matrix**. That's now fixed (FR-EE-12/13), but it's the reason this plan calls out re-checking the matrix against the deck's business narrative specifically, not just against the codebase in isolation, going forward.

## Full code sweep — 2026-09-01

Prompted by that Outplacement gap. Method: diffed every migration (001–088) against every migration number actually cited anywhere in the traceability generator, read the ones that came back uncited or only passingly mentioned, and separately ran a route-vs-spec cross-reference across all 127 API routes (noisy — most hits were false positives, since specs test through UI flows rather than literal route strings — but useful for triage).

**Result: 6 documentation gaps, zero implementation gaps, zero test gaps.** Every feature found was already correctly built and already had real e2e coverage — the gap was always in the traceability matrix, never in the product:

- FR-EE-12 (Fractional Leadership Placement) and FR-EE-13 (Outplacement) — sales-led enterprise offerings, migration 044, tested by `enterprise-solutions.spec.ts`.
- FR-PW-23 (personal cross-pillar activity calendar on the Hub dashboard) — migrations 046/047, tested by `hub-dashboard.spec.ts`.
- FR-GM-06 (admin-triggered real-email newsletter digest send) — migration 052, tested by `admin-digest-send.spec.ts`.
- FR-SP-01 and FR-SE-03's migration citations were incomplete (missing 025, and 032–034 respectively) — fixed, not just the new rows added.

All six are now in the traceability matrix with correct migration and spec citations. Full account of the sweep method and findings is in the matrix's own "Pending/Partial/Deferred" sheet, not duplicated here.

---

## Priority 1 — live and getting worse, no dependency on anything else

1. ~~**GreyMatters test-data cleanup.**~~ **DONE (2026-09-07)**, platform-wide rather than GreyMatters-only, and via a different mechanism than originally scoped here: instead of the `POST /api/admin/cleanup-test-data` route, removed all 380 accumulated test/diagnostic accounts (357 `test+*@greyin.net` + 23 older ad-hoc ones) directly via a dry-run-verified SQL pass, cascading through every table they owned. No recognizable-marker tagging was added for future e2e runs — accounts created by the suite going forward will accumulate again the same way unless that's built separately; the one-time cleanup itself is what's done. Full account in `deployment/seed-demo-data.sql`'s own PHASE 0 and the traceability matrix's "Pitch-demo scrutiny pass" entry.

## Priority 2 — highest-severity functional gaps (code-verified against a comparable implementation)

2. **ExpertEdge: employer self-service job close.** Currently admin-only.
3. **ExpertEdge: employer job reopen.** Doesn't exist at all — closed is terminal today.
4. **ExpertEdge: candidate self-service application withdrawal.** The `'withdrawn'` status exists in the schema and the UI's CSS map; no route lets a candidate set it.

These three share one migration and one pair of routes on `apps/greyin-b2b` — worth doing together.

## Priority 3 — UI/UX, highest leverage available

5. **Brand identity unification across all 7 apps + login screens.** Four (now effectively six, counting Longlist's own new palette) unrelated gradients. Still the single biggest visual-consistency fix on the table, unchanged since first flagged.
6. **Cold-start empty states.** "0 Open Jobs / 0 Candidates" reads as abandoned. Either real seed content or a waitlist-gated framing (see the earlier positioning conversation — this doubles as the honest pre-incorporation posture, not just a look-and-feel fix).

## Priority 4 — remaining functional gaps from the original 13-item audit

7. Real-time notification bell (Supabase Realtime — build it already-scalable, not the in-memory-socket trap the comparable implementation fell into).
8. General feedback submission + admin reply loop.
9. Google OAuth.
10. Salt & Pepper pre-publish AI moderation (currently only a post-hoc quality sweep).
11. FreeAgent AI gig-quality assist at listing time (currently only reviews completed deliverables).
12. Community events + RSVP (found in the second audit pass — a real, shipped feature on the comparable implementation with zero equivalent here).
13. Onboarding tour.
14. Feature wishlist + upvote + admin review panel.
15. Dashboard "your activity" personalized summary cards.

## Priority 5 — Longlist's own two uncovered requirements

16. **FR-LL-04** — e2e coverage for the AI-matching candidate set (needs a spec that enables the `longlist_candidate_matching` feature flag first, since it ships off by default).
17. **FR-LL-05** — e2e coverage for role filled/expired + subscriber notification.

## Priority 6 — infra, only when a real trigger fires (not now)

Per the standing hosting decision: stay on the current server until a real paying customer needs an uptime guarantee, the server genuinely runs out of headroom, or a compliance/customer ask requires it. When one does, the plan and the gaps in it already exist (`greyin_aws_migration_plan.html`). Two small, cheap, no-hyperscaler-required items from that plan are worth doing regardless of timing:

18. Basic uptime/health monitoring on the current server.
19. Swap the SMTP provider off Hostinger's 500/hr cap (Resend or SES, standalone, no migration required).

## Priority 7 — security backlog, both still explicitly deferred by prior user choice, not due for a revisit

- SEC-017 (captcha provider) — deferred pending a provider decision.
- SEC-038 (Next.js 14→16) — flagged out-of-scope, needs its own dedicated pass given the regression risk already seen from the smaller 14.2.4→14.2.35 bump.
- SEC-016 (session cookie not httpOnly) — the traceability matrix's own status field says "Fixed," which overstates it: `secure`/`sameSite` were added, but httpOnly deliberately was not, since every app's header does a client-side `getUser()` call to decide Sign-In-vs-logged-in display, and an httpOnly cookie is invisible to that call — closing this for real needs a genuine refactor (server-rendered auth-state props across all 6 apps), not a cookie-flag change. Tracked here as the real remaining gap behind that label.

## Priority 8 — found via a pitch-demo scrutiny pass (2026-09-07), not previously tracked here

Surfaced while auditing what could attract scrutiny in a live investor/pitch walkthrough, cross-checked against this plan and the traceability matrix to avoid duplicating Priority 6/7 above (SMTP provider swap and the two SEC items already listed there stay where they are).

20. **Referral bonus tracking.** Not built — no monetary payout tracking for referrals exists anywhere on the platform. Needs a hire-and-tenure gate decided before building, since every other monetized signal on the platform requires a verified transaction; this would be the first one that doesn't unless that gate is added.
21. **3-tier subscriptions: 5 of DeepEdge's 6 credit types unwired.** `job_post`, `contact_view`, `job_invite`, `outplacement_post`, and `placement_request` are priced and admin-configurable (096) but not wired to any real enforcement point — a deliberate, already-documented scope boundary (job posting stays free per the earlier 038/039 hybrid-gate decision), not silently incomplete. Revisit only if the free-posting policy itself is ever revisited.
22. **Peer-confirmed projects (089): 7 named hardening gaps, pre-dating this pass but re-surfaced by it.** (a) reciprocity detection is pairwise-only — a 3+-account round-robin ring evades both `peer_rater_reliability` and `peer_project_reciprocity_flags` entirely; (b) no rate limiting on peer-project/tag/rating creation; (c) no path for a confirmed member to withdraw confirmation later; (d) company name is free text with no employer attestation; (e) the 50%-mutual-rating threshold is an unvalidated heuristic; (f) `peer_score`'s Bayesian-shrinkage constant (m=3) was pattern-matched from StackWorks, not derived from real data; (g) e2e coverage is happy-path only — declining a tag and the creator-edit-lock are untested.
23. **Public activity feed v1 (unauthenticated).** Not built. Explicitly excluded from the original benchmark scope, not forgotten — the ethos audit also flagged a raw public feed as tension-prone, so this would need a curated-highlights design, not a straight port, if ever picked up.
24. **Hourly contracts (FlexPro).** Not built — FlexPro supports fixed-price gigs only. Explicitly excluded from original benchmark scope; no work planned unless re-scoped.
25. **Unreproduced report: a browser tab shows signed-in after signing out elsewhere.** Unreproduced after 6 independent attempts (3 scripted, 3 randomized fuzzer runs) — no fix applied since the root cause couldn't be isolated. A permanent randomized fuzzer (`session-monkey.spec.ts`) stays in the e2e suite specifically to catch a recurrence; if it fires again, check whether the `sb-api-auth-token` cookie is actually present at the moment of stale state, to distinguish a stale-cookie cause from a stale-render one.

## Priority 9 — found auditing the pitch-deck cost model (2026-09-08)

26. **Admin subscription-tier management: edit-only, no add/remove.** Confirmed while fixing SEC-041 (below): `/admin/subscription-tiers` in both DeepEdge and FlexPro only maps over existing `subscription_tiers` rows with a Save-per-row form — there's no create-tier or delete-tier UI/route. Adding a 4th tier or retiring one still requires a direct DB insert/delete. Not urgent (3 tiers per pillar has been the assumption since 096), but worth a create/delete admin flow if the pricing model ever needs a 4th tier or an A/B pricing experiment.
27. ~~**SEC-041: admin tier price change didn't invalidate the cached Razorpay plan.**~~ **FIXED 2026-09-08.** A tier's `razorpay_plan_id` is created lazily on first checkout and cached forever (Razorpay plans are immutable); the admin price-update route never cleared it, so every checkout after a price change kept silently billing the old price. Fixed in both apps' `admin/subscription-tiers/update` routes — clears the cached plan id only when `price_inr` actually changed. See the traceability matrix's SEC-041 entry for full detail; `subscription-tier-price-update.spec.ts` (both apps) is the permanent regression guard.

---

## What "as implementation progresses" means in practice

For each item above, when it's picked up:
1. Schema/migration first, verified directly via SQL (RLS positive *and* negative cases) before any app code — and specifically, **force-reload PostgREST's schema cache after every migration** (`docker service update --force supabase_rest`) before testing through the app. Longlist's own build just re-discovered this the hard way: `NOTIFY pgrst` alone silently didn't take effect, and every write through the Supabase JS client failed with `PGRST204` for a table/columns that worked fine over raw SQL. This is now a standing checklist item, not just a one-time note in NFR-OPS-01.
2. App code, `tsc --noEmit` clean, real build.
3. Deploy via `docker stack deploy` + `docker service update --force` on the specific service (`:latest` tags don't trigger Swarm's own change detection).
4. A real Playwright spec against prod, run in isolation first, not just full-suite.
5. Traceability matrix updated and regenerated in the same pass the feature ships in, not deferred to a cleanup session.

No implementation has started on Priority 2 onward. Priority 1 (test-data cleanup) is now done (2026-09-07); Priority 8's item 20 (referral bonus tracking) and item 22 (peer-projects hardening) are the next items with no external decision blocking them, if picking up new work here rather than from Priority 2-6.
