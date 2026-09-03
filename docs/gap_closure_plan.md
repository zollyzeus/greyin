# Gap Closure Plan

**Created:** 2026-09-01 · **Updated:** 2026-09-01 (business-model tiering + full code sweep)
**Source:** `greyin-requirements-traceability.xlsx` (73 functional requirements, 21 non-functional, 38 security findings, 30 pending/partial/deferred items) + the Emergent code-level audit (`emergent_deployment_gap.md`, `emergent_code_audit.html`).

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

1. **GreyMatters test-data cleanup.** Still open. Last checked, the public blog was showing 20+ leftover `E2E AI Quality Post` entries and climbing every time the suite runs. Build the idempotent `POST /api/admin/cleanup-test-data` route (matching the pattern already scoped), tag e2e-created content with a recognizable marker going forward, run it once now.

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

---

## What "as implementation progresses" means in practice

For each item above, when it's picked up:
1. Schema/migration first, verified directly via SQL (RLS positive *and* negative cases) before any app code — and specifically, **force-reload PostgREST's schema cache after every migration** (`docker service update --force supabase_rest`) before testing through the app. Longlist's own build just re-discovered this the hard way: `NOTIFY pgrst` alone silently didn't take effect, and every write through the Supabase JS client failed with `PGRST204` for a table/columns that worked fine over raw SQL. This is now a standing checklist item, not just a one-time note in NFR-OPS-01.
2. App code, `tsc --noEmit` clean, real build.
3. Deploy via `docker stack deploy` + `docker service update --force` on the specific service (`:latest` tags don't trigger Swarm's own change detection).
4. A real Playwright spec against prod, run in isolation first, not just full-suite.
5. Traceability matrix updated and regenerated in the same pass the feature ships in, not deferred to a cleanup session.

No implementation has started on Priority 2 onward — Priority 1 (GreyMatters cleanup) is the natural next pick given it's the only item actively degrading on its own.
