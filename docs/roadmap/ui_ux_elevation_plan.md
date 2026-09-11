# UI/UX Elevation Plan — closing the gap to the sidebar-shell benchmark

**Created:** 2026-09-03 · **Reassessed:** 2026-09-05 · **Autonomous execution session:** 2026-09-05 night into 2026-09-06 (see the dated section at the very bottom for what actually shipped — read it before acting on anything above; the color-theme write-up and Phase 3 in the body above are both superseded)
**Baseline:** current Greyin logged-in UX rated ~4.5/10 vs. the Emergent sidebar-SPA benchmark ~8/10, on the axes: navigation/ease of use, visibility, notification handling, high-priority element placement, cross-pillar continuity, brand coherence, onboarding, secondary-action discoverability. Re-scored 2026-09-05 at ~5.1/10; **see the autonomous-session section at the bottom for the latest score**.
**Target:** ≥7 on every axis, ≥8 on the four named above, without collapsing the 6-app architecture into a single SPA.
**Working discipline:** unchanged from `gap_closure_plan.md` — schema first (RLS + PostgREST cache reload) → app code (`tsc --noEmit` clean, real build) → deploy (`docker stack deploy` + `docker service update --force` per service) → a real Playwright spec against prod, isolated run first → update this plan + the traceability matrix in the same pass.

---

## North star

One **authenticated app shell** ("Workspace chrome") rendered on every logged-in page across all 6 apps: a persistent left rail + top bar that pins the five things the current UI scatters or hides — **identity + Greyin Score**, a **cross-pillar switcher** (all 6 always visible), the **notification bell**, **global search**, and **feedback/wishlist** in-context. The public/marketing `SiteHeader` stays exactly as-is for logged-out pages; the shell is authenticated-only, so SSR/SEO on marketing pages is untouched.

This is the ~60% lift. Everything else (notification polish, brand unification, onboarding) hangs off it.

---

## Delivery model — one source of truth

The repo convention today is per-app duplication (each app has its own `SiteHeader.tsx`, `NotificationBell.tsx`, hand-synced `PILLAR_ICONS`). The shell is exactly the thing worth NOT duplicating.

**Decision to confirm in Phase 0:** shared workspace package (`packages/chrome`, consumed by all 6 apps via the existing install setup) vs. a single canonical copy + `scripts/sync-chrome.mjs` that writes it into each app (matching how other cross-app files are already kept in sync). Prefer the package if workspaces are wired; fall back to the sync script. Either way: **write once**, so each phase below is a single implementation, not six.

---

## Phase 0 — Foundations (≈1 day) — unblocks everything

| Task | Detail | Acceptance |
|---|---|---|
| Confirm delivery model | package vs sync-script; set up the chosen mechanism | one app imports the shared module, zero visual diff |
| Design tokens | Extend the new (2026-09-03) Newsreader+Inter typography system into a full token set — color, spacing, radius, shadow, z-index — as one shared CSS-vars + TS module. Commit to the single brand direction: **dark navy ground + gold accent** (the landing-page brand, also the Emergent-proven direction). Dark-mode-aware from day one (respect the existing dark-mode foundation). | tokens consumed by one app, no regression |
| Component inventory | Stub the shell parts: `WorkspaceShell`, `LeftRail`, `TopBar`, `ScoreBadge`, `PillarSwitcher`, `SearchTrigger`, `NotificationBell` (promote existing), `FeedbackButton`, `GuidedTour` | list agreed, props typed |

---

## Phase 1 — The authenticated app shell (≈4 days) — the big lift

**Axes moved:** navigation, visibility, cross-pillar continuity, high-priority element placement.

### 1.1 `<WorkspaceShell>` structure

```
┌───────────────┬─────────────────────────────────────────────┐
│  LEFT RAIL    │  TOP BAR: breadcrumb · ⌘K search · 🔔 · 👤   │
│               ├─────────────────────────────────────────────┤
│  [pillar nav] │                                             │
│   this app's  │              {children}                     │
│   own sections│           (page content region)            │
│  ───────────  │                                             │
│  ACROSS GREYIN│                                             │
│   ◦ DeepEdge  │                                             │
│   ◦ FlexPro   │                                             │
│   ◦ StackWorks│                                             │
│   ◦ Salt&Pep  │                                             │
│   ◦ GreyMatters                                             │
│   ◦ Longlist  │                                             │
│  ───────────  │                                             │
│  [avatar]     │                                             │
│  Name ✓verified                                             │
│  Greyin Score 78 · Trusted   ← pinned, every screen         │
│  Share feedback · Request a feature · Sign out              │
└───────────────┴─────────────────────────────────────────────┘
```

- **Rail top** — the current app's own primary nav (its existing sections), grouped under the pillar name.
- **Rail middle** — divider, then "Across Greyin": all 6 pillars as labelled icon links (`<a href>` cross-domain), current pillar visually active. This alone fixes visibility — a DeepEdge user now always sees StackWorks/FlexPro/etc. exist.
- **Rail footer** — identity block: avatar, name, verified badge, **`greyin_score` + tier from the `greyin_scores` view**, click → profile. This is the single highest-value placement fix: the product's core differentiator becomes visible during normal use instead of only on the profile page.
- **Rail footer** — "Share feedback" / "Request a feature" (in-context modal, Phase 4) / "Sign out".
- **Collapsible** to an icon-only rail; state in `localStorage`, persists across reloads and pillar hops.
- **Mobile** — rail becomes a drawer; reuse the hamburger + drawer pattern `SiteHeader` already ships.

### 1.2 Where it renders

Introduce an `(app)` route group per app so every authenticated page inherits the shell from one `app/(app)/layout.tsx` — no per-page wiring. This is a real but mechanical refactor: **do DeepEdge end-to-end first** (the reference app), prove the pattern, then replicate to the other 5.

### 1.3 Top bar

Breadcrumb (`Pillar › Section`), `⌘K` search trigger (Phase 4), notification bell (Phase 2), avatar menu (profile / settings / sign out).

### Acceptance (e2e, `workspace-shell.spec.ts`)
- Log in on DeepEdge → rail shows DeepEdge sections + all 6 pillars + a numeric Score matching the profile page.
- Collapse rail → reload → still collapsed.
- Click FlexPro in the rail → lands in FlexPro already authenticated, FlexPro rail item active, Score still shown.
- Rail is a drawer at 375px width and every destination is reachable.

---

## Phase 2 — Notification system polish (≈2 days)

**Axis moved:** notification handling (6 → 8).

| Change | From | To |
|---|---|---|
| Mount point | `NotificationBell` mounted twice per app (desktop + mobile nav), needs per-instance channel topic to avoid collision | single mount in the shell top bar; delete the `instanceId` hack |
| Arrival feedback | none | toast on `postgres_changes` INSERT (react-hot-toast already in root layout) |
| Read model | opening the dropdown marks **everything** read | mark-on-click per item + an explicit "Mark all read" action (Emergent parity, non-destructive) |
| Badge correctness | per-app; count can be stale when viewing a different pillar | pillar-agnostic unread query (`notifications` for the user, any `type`) so the badge is right in every app |
| Section badges | none | unread counts on rail items whose `type` maps to a section (Messages, Applications) |
| Unified view | `/notifications` per app | keep, but make it the same query everywhere; link from the bell footer |

Keep the 30s polling fallback — Realtime was historically unreliable in this deployment.

### Acceptance (e2e, `notifications-live.spec.ts`)
- Trigger a notification from app B while the user sits in app A → toast in A, badge +1.
- Click one item → only that one goes read; "Mark all read" clears the rest.
- Badge count identical when the same user opens app A and app B.

---

## Phase 3 — Brand & visual polish (≈1.5–2 days, parallelisable with Phase 2) — SCOPE REVISED 2026-09-05

**Axis moved:** brand coherence (7 → 8+). ~~Originally "5 → 8" and "remove the per-app gradient heroes, unify to one navy+gold system" — superseded, see reassessment. The team shipped a different, sound direction (6 distinct-but-consistent pillar hues on one shared structural/type/dark-mode system) and it's already largely done. Don't reverse it.~~

Remaining scope only:

- **Auth screens** — still a generic centered white card (confirmed in code 2026-09-05: `login/page.tsx` across all 6 apps). Give it the shell's brand treatment: left brand panel + right form, per pillar's own color, matching the login-page gradient it already sits on.
- **Empty states** — verify whether "0 Open Jobs / 0 Candidates"-style counters still exist before building anything; if so, one shared `<EmptyState>` (icon, headline, one action), framed as seeded-preview or waitlist, matching the preview banner already in the layout.
- **Fold into Phase 0's sync mechanism** — the platform-wide icon/color drift found and fixed three separate times (39 files, three waves) is a hand-copy problem; without a real sync mechanism a fourth wave is a when, not an if.
- **Favicon + wordmark** — dark icon everywhere; gold-on-dark only on landing pages (existing rule) — spot-check, not confirmed changed either way.

### Acceptance (Phase 3)
- Screenshot review (Playwright full-page, 1440×900 + 375px): all 6 auth screens carry the new brand panel; empty states (if any remain) use the shared component; a repo-wide grep for the fixed icon/color bug classes stays clean going forward.

### Phase 3 close-out (2026-09-05)

All four remaining items done. No signups were used anywhere in this phase (page navigation + static asset checks only), respecting the same-day pause on signup-driving e2e runs.

**Auth screens** — built one `AuthLayout.tsx` per app (own icon + own gradient, matching each app's `PILLARS` color: DeepEdge indigo/Building2, FlexPro orange-amber/Briefcase, StackWorks teal-emerald/FlaskConical, Salt & Pepper purple-pink/Users, GreyMatters sky-cyan/BookOpen, Longlist amber-stone/Telescope). Left panel (brand, hidden below `lg:`) + right form, matching the shell's existing per-pillar direction rather than reversing it. Converted all 5 auth pages × 6 apps (30 files: login, signup, reset-password, reset-password/confirm, verify) to use it. `title`/`subtitle` typed `React.ReactNode` to allow the verify/confirm pages' inline `<span>` for the target email. Typechecked clean per app, built, deployed via `docker service update --force`, verified via Playwright screenshots (desktop split-screen + mobile single-column fallback) on all 6.
- **Real bug found as a side effect**: StackWorks' `reset-password` and `reset-password/confirm` pages carried a stray `from-blue-50 to-indigo-100` gradient (copy-paste leftover — every other StackWorks auth page correctly used teal/emerald). Silently corrected by the migration onto `AuthLayout`, since it now inherits the app's one true gradient instead of hand-repeating it. This is the exact drift-bug shape the "sync mechanism" item below now guards against.

**Empty states** — verified before building: only DeepEdge's homepage carries "0 X"-style stat counters, and they're currently showing real non-zero seeded numbers (confirmed via an earlier-session screenshot). No empty-state scenario is presently manifesting, so per the plan's own conditional instruction, no `<EmptyState>` component was built. Revisit if/when those counters can legitimately hit zero (e.g. a brand-new company with no postings yet).

**Fold into Phase 0's sync mechanism** — added `deployment/check-brand-sync.sh`, a real, permanent drift-detection script (not a design doc) covering both directions of the bug class:
1. All 6 apps' `EcosystemWidget.tsx` `PILLARS` array data must be byte-identical (confirmed clean: `d4c093eda383fbd1810a97a4756737ad` across all 6, Longlist differing only in a comment).
2. Each app's own `AuthLayout.tsx` brand gradient color must match that same app's own `PILLARS` hex entry (confirmed clean across all 6 after the AuthLayout migration above).

Run it before any cross-app rollout: `bash deployment/check-brand-sync.sh`. It exits non-zero and diffs the offending file on drift. No CI wiring yet (no CI pipeline exists in this repo to hook into) — for now it's a manual pre-rollout gate, same as the rest of this project's verification steps.

**Favicon + wordmark** — spot-check turned up a real gap, not drift: only `greyin-hub` had a favicon configured (`icons: { icon: '/logo.png' }`, plain dark, consistent with the reverted navy+gold theme — confirmed via fresh repo-wide grep that zero `greyin-gold`/`greyin-navy`/`brand-logo`/`brand-cta` references remain anywhere). The other 6 pillar apps had no favicon at all (no `favicon.ico`, no `icon.*` in `src/app/`, no `icons` metadata key) — never built, not a regression. Fixed by adding one Next.js `icon.svg` per app (App Router's automatic-favicon file convention, no layout.tsx changes needed): each app's own Lucide icon from its `AuthLayout.tsx` (Building2/Briefcase/FlaskConical/Users/BookOpen/Telescope), stroked in that app's own `PILLARS` hex — consistent with the "dark icon, per-pillar hue" direction the rest of Phase 3 confirmed, and with `greyin-hub`'s own plain-icon (not wordmark) favicon convention. Built, deployed, and verified live: `curl https://<app>.greyin.net/icon.svg` returns 200 with the correct per-app color, and each page's rendered `<head>` carries `<link rel="icon" href="/icon.svg?..." type="image/svg+xml">`.

---

## Phase 4 — In-context feedback, wishlist, search (≈2 days)

**Axis moved:** secondary-action discoverability (4 → 8).

- **Feedback / wishlist** — move from cross-domain links (`greyin.net/feedback?app=…`) to in-app modals in the shell. The components already exist on greyin-hub; port them as shared shell components hitting the same hub API over the SSO'd session. Feedback modal surfaces the admin reply + shows an unread-reply badge on the rail button.
- **Global search** — a `⌘K` command palette in the shell over the existing `platform_search_index` / `platform_people_index`; results grouped by pillar, keyboard-navigable, Enter navigates. Retires "Ecosystem Search is just a nav item".

### Acceptance (e2e, `command-palette.spec.ts`, `feedback-modal.spec.ts`)
- `⌘K` opens the palette from any page; typing a name returns cross-pillar results; Enter navigates.
- Feedback modal submits; a seeded admin reply shows inside it; the rail badge clears on open.

### Phase 4 close-out (2026-09-05)

Both items shipped to all 6 pillar apps. Neither required a signup-driving or email-invoking test to build or deploy, so this phase respected the same-day pause on further e2e runs against the shared SMTP account — the two acceptance specs below were written but deliberately **not executed**, and are queued for the next full-suite pass instead of run individually.

**Feedback / wishlist** — built as a genuine in-app modal (`FeedbackWishlistModal.tsx`, two tabs) rather than porting Hub's API routes: real SSO (the shared `.greyin.net` cookie) plus the RLS `101_wishlist_and_feedback.sql` already defines means any pillar app's own Supabase client can read/write `platform_feedback` and `feature_requests`/`feature_request_upvotes` directly, identically to Hub's own `/feedback` and `/wishlist` pages — no CORS, no cross-origin fetch, no new API surface, same "per-app duplication, one shared backend" convention as `SectionBadge`/`NotificationBell`. Those two Hub pages stay in place unchanged as the fallback destination for logged-out visitors. Unread-reply badge reuses `SectionBadge` unchanged (`types={['feedback_replied']}`) on a new "Feedback & Ideas" rail item; opening the modal marks `feedback_replied` notifications read, same "mark read on the action that shows it" contract `NotificationBell` already uses.

**Global search** — `CommandPalette.tsx`, a ⌘K/Ctrl+K modal (plus a visible "Search ⌘K" button in the shell's top bar — a real affordance, not just a hidden shortcut) querying `platform_search_index` and `platform_people_index` directly and in parallel. Deliberately does **not** call `parseSearchQuery`'s LLM intent classifier the full `/search` page uses: that's a server-side round-trip meant for one deliberate submit, not something to fire on every keystroke of an instant palette. Person results always resolve to DeepEdge's `/candidates/[id]`, matching `PeopleSearchResults.tsx`'s existing choice ("the one open, cross-pillar-complete profile page on the platform"). `/search` stays in place per-app as the deeper destination for the NL filters (min verified outcomes, availability, location) the palette doesn't attempt. Known pre-existing gap, not introduced here: Longlist's future roles were never added to `platform_search_index` (`future_roles_public`'s anonymity model deliberately keeps them out of a cross-pillar-searchable view), so they don't surface in the palette either — identical to today's `/search` page.

**Verification**: typechecked clean on all 6 apps, full production `docker build` succeeded on all 6 (catches ESLint/build-time issues typecheck alone wouldn't), deployed via `docker service update --force` to all 6 services, and smoke-checked live (homepage 200, `/dashboard` redirect 307 — no server error) on all 6 domains. **Not verified**: interactive browser testing of the palette/modal themselves, which needs an authenticated session — attempting to mint one via the Supabase admin API (resetting an existing confirmed test user's password, no email involved) was blocked by the environment's own auto-mode permission classifier as a credential-modification action, and no workaround was attempted. The two e2e specs above are the acceptance-test substitute; they should be run at the next full-suite pass rather than assumed passing.

---

## Phase 5 — Onboarding / first-run (≈3 days)

**Axis moved:** onboarding (2 → 8).

- `<GuidedTour>` in the shell: spotlight + tooltip + Next/Prev/Skip, driven by a per-pillar step config targeting `data-tour` attributes on rail items and key CTAs.
- Auto-start on first authenticated visit (`localStorage` flag per user); "Replay tour" in profile/settings.
- Persona-aware steps keyed off the profile role (candidate / employer / advisor / admin).
- Pair with modest real seed content per pillar so the tour lands on a populated screen (reuses the Phase 3 empty-state work).

### Acceptance (e2e, `guided-tour.spec.ts`)
- Fresh demo user logs in → tour auto-starts; Next/Prev/Skip work; flag set so it doesn't re-fire.
- "Replay tour" re-arms it.

### Phase 5 close-out (2026-09-05)

Shipped to all 6 pillar apps. No signups were needed to build or deploy this (only to write the acceptance spec, which was authored but not run — same standing pause as Phases 2 and 4).

**`<GuidedTour>`** — self-contained (own auth check, own `localStorage` flag: `greyin:tour-seen:<pillar>:<userId>`), same convention as `NotificationBell`/`SectionBadge`/`CommandPalette` rather than threading tour state through every page that calls `WorkspaceShell`. Spotlight is 4 plain dimming panels around the target's `getBoundingClientRect()` plus a highlight ring — deliberately not an SVG mask, simpler to get pixel-correct and consistent with this codebase's preference for small dependency-free UI over a new library for one feature (`NotificationBell`'s own toast, `FeedbackWishlistModal`'s own modal). `data-tour` attributes added to every rail nav item, the "Feedback & Ideas" button, the "Search" button, `NotificationBell`, and the "Across Greyin" section, on all 6 apps.

**Auto-start / Replay** — auto-starts ~600ms after a first authenticated page-load, giving the rail time to paint before the first `data-tour` lookup. "Replay tour" is a new rail button (bottom of the account section, next to Sign out/Logout) rather than a `/profile` page edit: `WorkspaceShell` already renders on `/profile` (Phase 1's rollout put every authenticated page through it), so this reaches "profile/settings" as the plan asked without a second, page-content-level implementation across 6 separate profile pages — a deliberate placement judgment call, not literally "inside the profile page's own content," flagged here rather than left silent. Dispatches a `greyin:replay-tour` window event, the same pattern `CommandPalette`'s `⌘K` search button already established (`greyin:open-search`).

**Persona-aware steps** — DeepEdge gets two genuinely different step lists (`CANDIDATE_TOUR_STEPS`/`EMPLOYER_TOUR_STEPS`), matching its real candidate/employer nav split. The other 5 apps are role-*additive*, not persona-split (an extra nav item appears for a freelancer/builder/admin/company-owner on top of the same base nav), so each gets one step list covering every possible item; a step whose `data-tour` target isn't in the DOM for the current viewer (e.g. a non-admin's missing Admin item) is automatically skipped by `GuidedTour` itself after a few short retries (handles the "layout still settling" case first, falls through to "not on this persona's screen" after ~300ms) rather than needing a combinatorial step-list per role.

**Seed content** — the plan's own fourth bullet ("pair with modest real seed content... reuses the Phase 3 empty-state work") is moot: Phase 3's close-out already found no empty-state scenario currently manifests (DeepEdge's counters show real non-zero seeded data, and that's the only page with this kind of counter), so there was nothing to pair the tour against.

**Verification**: typechecked clean on all 6 apps, full production `docker build` succeeded on all 6, deployed via `docker service update --force`, smoke-checked live (200/307, no server errors) on all 6 domains. Not interactively browser-tested for the same reason as Phase 4 (no authenticated session available without either violating the SMTP pause or the environment's block on minting one via credential modification) — `guided-tour.spec.ts` is written and queued for the next full-suite pass, not assumed passing.

---

## Phase 6 — Measure & iterate (ongoing)

- Re-score against the same 10-dimension rubric; gate: ≥7 every axis, ≥8 on the four named.
- Lightweight analytics: rail usage, pillar-switch rate, bell open rate, tour completion, `⌘K` usage.
- One usability pass — 5 users, the 3 core journeys (find talent, get verified, switch pillar).

### Re-score (2026-09-05, post Phases 1–5)

| Dimension | 2026-09-05 (pre-rollout) | Now | Why it moved |
|---|---:|---:|---|
| Navigation / ease of use | 5 | 8 | Persistent left rail + top bar on every primary authenticated page, all 6 apps (confirmed: 24/17/8/9/8/8 pages respectively use `WorkspaceShell`) — not page-scoped anymore. `⌘K` adds a second, faster path to anything. |
| Visibility | 6 | 8 | Pillar switcher ("Across Greyin") and Greyin Score both live in the persistent rail footer, visible on every page, not just one dashboard view. |
| Notification handling | 6 | 8 *(named, ≥8 met)* | Single consolidated bell (no more duplicate-mount `instanceId` hack), mark-one/mark-all-read, arrival toast, section badges on nav items keyed to real notification types, verified cross-app live delivery (`notifications-live.spec.ts`). |
| High-priority element placement | 4 | 8 | Score badge moved from a contextual dashboard banner to the persistent rail footer — visible on every page, every app. |
| Brand coherence | 7 | 8 *(named, ≥8 met)* | Per-pillar split-screen `AuthLayout` on all 30 auth pages, per-app favicon, and a real drift-detection script (`check-brand-sync.sh`) closing the loop three prior drift-bug waves left open. |
| Onboarding | 2 | **7** *(named, target ≥8 — not met)* | `<GuidedTour>` shipped on all 6 apps: auto-start, persona-aware steps, Next/Prev/Skip, Replay. Held below 8 deliberately: the acceptance spec (`guided-tour.spec.ts`) was written but never run against prod (see Phase 5 close-out), so this is a structural claim, not a confirmed-working one yet. |
| Secondary-action discoverability | 4 | 8 *(named, ≥8 met)* | Feedback/wishlist moved from a cross-domain link to an in-app modal with an unread-reply badge; `⌘K` search is a second, highly visible new secondary action. Same caveat as Onboarding applies to confidence, not to the target-met call — feedback/wishlist reads directly off existing, already-proven RLS (no new access path), so it's lower-risk than the tour. |
| Cross-pillar continuity | 5 | **6** *(not met, target ≥7)* | The switcher is now persistent instead of page-scoped, and `⌘K` can jump straight to cross-pillar content — real progress. Still unchanged at the structural level the last pass flagged: a pillar hop is still a full domain reload, not a transition. This was explicitly out of scope (North Star: "without collapsing the 6-app architecture into a single SPA"), so closing this the rest of the way is a scope decision for the user, not a bug. |
| Mobile | 6 | **6** *(not met, target ≥7)* | The rail's mobile drawer (Phase 1) and the palette/modal/tour's mobile fallbacks (Phase 4–5) were built with responsive classes but never verified on an actual narrow viewport — no phone-sized screenshot pass was run this session for the Phase 4–5 additions specifically. |
| Perceived smoothness | 6 | **6** *(not met, target ≥7)* | Unchanged — same full-reload-per-pillar-hop architecture as before, unaddressed by design (see Cross-pillar continuity). |

**Gate: not yet fully met.** 7 of 10 dimensions clear their bar; Onboarding sits one point under its named ≥8, and Cross-pillar continuity/Mobile/Perceived smoothness each sit one point under the general ≥7. The first two (Onboarding, secondary-action discoverability) are a *confidence* gap, not a *known defect* — closing it just needs the deferred e2e run (Phase 4/5 specs) plus a real mobile-viewport pass, both blocked on the same-day SMTP pause lifting. Cross-pillar continuity, Mobile, and Perceived smoothness are a genuine, larger scope decision (SPA-style pillar transitions, or accepting the current ceiling) that should go back to the user rather than be pushed further autonomously — the North Star document already named this exact tradeoff and chose not to collapse the 6-app architecture.

**Overall, informally: ~7.2/10**, up from ~5.1/10 on 2026-09-05 and ~4.5/10 at baseline. Emergent benchmark unchanged at ~8.

### Phase 6 close-out (2026-09-05)

**Analytics — user chose self-hosted over a third-party service** (PostHog/GA/etc were the alternative; asked directly rather than picked unilaterally, per this project's own standing rule about not choosing a new external dependency without checking first). Shipped `116_analytics_events.sql`: one `analytics_events` table (`user_id`, `pillar`, `event_type`, `metadata jsonb`, `created_at`), RLS write-only from the member's own side (`auth.uid() = user_id`) and admin-only to read — regular members have no reason to see aggregate usage data about themselves or others. No new service, no new cost, data stays in the platform's own Supabase instance; the tradeoff accepted going in is no out-of-the-box dashboards — reading it back is a plain SQL query an admin runs, not a product with charts.

Instrumented all 6 apps, fire-and-forget (`src/lib/analytics.ts`'s `logEvent`, never awaited, never throws — same "lazy, best-effort" posture as `parseSearchQuery`'s own LLM call), covering exactly the plan's five named signals:
- `rail_nav_click` (`{key}`) and `pillar_switch` (`{from, to}`) — `WorkspaceShell.tsx`
- `notification_bell_open` — `NotificationBell.tsx`
- `command_palette_open` and `command_palette_navigate` (`{kind, pillar}`) — `CommandPalette.tsx`
- `tour_started` (`{trigger: 'auto'|'replay'}`), `tour_completed`, `tour_skipped` — `GuidedTour.tsx`

Typechecked clean and full production `docker build` succeeded on all 6 apps, deployed via `docker service update --force`, smoke-checked live (200/307, no errors) on all 6 domains. Not yet verified with real traffic — the table is live and ready to receive events, but no dashboard/query was built on top of it since there's nothing to look at yet; that's a natural follow-up once real usage accumulates, not a gap in this pass.

**Usability pass — prepared, not run.** A live 5-user study needs real human participants and a moderator, which is outside what an autonomous session can execute. Wrote `docs/phase6_usability_test_plan.md`: a full script for the 3 named journeys (find talent, get verified, switch pillar), covering recruiting mix, per-journey task scenarios, what to observe, and a rollup method — ready for whoever on the team runs it. Its own closing note ties it back to the analytics above: once real usage accumulates, the qualitative findings from the 5 sessions can be cross-checked against actual event volume.

**Re-score, done above** — the honest finding (gate not yet fully met) is itself the Phase 6 deliverable for that line item, not a separate follow-up.

---

## Effort & sequencing

| Phase | Effort (1 dev) | Depends on | Rating lift |
|---|---|---|---|
| 0 Foundations | ~0.5 day *(revised down 2026-09-05 — tokens/dark-mode/color source already exist; only the sync mechanism is new work)* | — | unblocks |
| 1 App shell | ~4 days | 0 | navigation, visibility, continuity, placement — the 60% |
| 2 Notifications | ~2 days | 1 | notification handling |
| 3 Brand polish | ~1.5–2 days *(revised down 2026-09-05 — most of this phase already shipped)* | 0 (parallel with 2) | brand coherence |
| 4 Feedback/wishlist/search | ~2 days | 1 | discoverability |
| 5 Onboarding | ~3 days | 1, 3 | onboarding |
| 6 Measure | ongoing | all | validation |

**~13 working days / ~2.5 weeks** for one developer (revised down from ~15, see reassessment). Each phase is write-once (shared shell), then replicated mechanically to the other 5 apps.

---

## Cross-cutting requirements (every phase)

1. Shared component in one source of truth + the confirmed sync mechanism.
2. `tsc --noEmit` clean, real `next build` per affected app.
3. Deploy: `docker stack deploy` + `docker service update --force <service>` per app (`:latest` tags don't trigger Swarm change detection).
4. A real Playwright spec against **prod**, isolated run first, then full-suite at worker cap 4 / retries 1 (SMTP/GoTrue burst caps) — reuse session fixtures, don't create fresh signups per spec (shared SMTP account, daily full-suite cap).
5. Update this plan (move the item to Done with what actually happened) + regenerate the traceability matrix in the same pass.

---

## Risks / watch-items

- **`(app)` route-group refactor spans every authenticated page in 6 apps** — mechanical but broad. One app fully first (DeepEdge), then replicate.
- **Realtime stability** — historically broken in this deployment; keep the 30s poll fallback in the bell.
- **Don't regress SSR/SEO** — the shell is authenticated-only; marketing pages and `SiteHeader` are untouched.
- **Dark mode** — build shell tokens dark-aware from day one; respect the existing dark-mode foundation on shared chrome.
- **e2e volume** — reuse fixtures; the full suite still runs at most once/day vs prod.

---

## Deck implication

Slides 5 and 7 sell "one shared Hub identity" and "the Score is the signal we sell" — the current logged-in UI demonstrates neither. After **Phase 1** ships, it demonstrates both. Re-record the live-platform demo walkthrough after Phase 1, not before; hold the demo-video note ("available on request") until then.

---

## Reassessment — 2026-09-05

Re-verified every claim in this plan directly against the current codebase (not just memory of the 2026-09-03 conversation) before revising anything — same discipline `gap_closure_plan.md` uses. Two full days of shipped work happened in between (internal rename completed; a UI structural-sync pass; dark mode taken to 100%; several real functional bugs found and fixed — see below).

### What shipped since 2026-09-03 that changes this plan

1. **Dark mode: fully complete, platform-wide, e2e-tested** (all 169 pages, permanent regression spec `dark-mode-toggle.spec.ts`). This removes "must be dark-mode-aware" as a *risk* for every phase below — it's now a stable foundation the shell, the tour, and the command palette simply have to respect (`.dark` class, `dark:bg-gray-950` convention), not something to invent.

2. **Dashboard chrome already partially unified.** Verified in code: all 7 dashboards now share one lean bar shape (logo → `/feed` → shared `<NotificationBell />` → `/profile` → `<ThemeToggle />` → sign-out), and `<EcosystemWidget activePillars={...}>` — a real, well-built pillar switcher with brand-colored dots and active/visited state, dark-mode-safe — now renders on **all 7 dashboards**, fetching `greyin_scores` on the same page load. This substantially answers part of Phase 1's cross-pillar-switcher ask and the visibility axis. **But it's still page-scoped** (only `/dashboard`, not `/jobs`, `/candidates/[id]`, `/profile`, …), **still a top bar, not a persistent rail**, and **still hand-copied per app**, not a shared component — confirmed by reading the actual JSX in `deepedge/src/app/dashboard/page.tsx`, not just the memory summary.

3. **Brand/icon color-drift bugs found and fixed platform-wide, three separate times** — 39 files across 3 apps (wrong icons, wrong indigo/blue instead of the app's real brand color, in dashboard bars and standalone pages). Root cause on record: an early shared template got copy-pasted and only some copies were ever updated afterward. **This is now hard evidence for this plan's core argument**, not a hypothetical: the per-app-duplication convention is actively causing the exact bug class a shared shell + sync mechanism eliminates by construction.

4. **Confirmed design direction — different from this plan's original Phase 3.** The team did **not** unify to one navy+gold palette. Verified directly: every app's `/login` now uses the identical `bg-gradient-to-br from-{pillar}-50 to-{secondary}-100` structure and intensity (deepedge indigo→slate, flexpro orange→amber, stackworks teal→emerald, saltnpepper purple→pink, greymatters sky→cyan, longlist amber→stone), each with a matching dark variant — one shared structural/type/dark-mode system, six distinct-but-consistent pillar hues, plus one canonical color source (the `PILLARS` array). This is a legitimate, arguably better-fitting direction for the deck's own "6 core features, one Hub identity" framing than "kill the gradients, force one color" — **Phase 3 above is rewritten to finish this direction, not reverse it.**

5. **Unrelated to chrome, but relevant to "ease of use" as actually experienced**: Longlist's AI matching (completely broken since launch — a rename migration silently dropped two view columns) restored; a mentor-session paid-checkout bug fixed (a bad multiplier key 400'd every paid booking before Razorpay ever opened); DeepEdge's job-post paywall now actually enforced (it previously gated nothing despite schema/docs claiming otherwise); a real security leak (SEC-040, the `collaborators` view lost `security_invoker` in a rename and was live-leaking cross-user data) closed. None of these are layout work, but a broken core feature is the worst UX bug there is — a judge clicking Longlist or booking a mentor session two weeks ago hit a dead end; today they don't.

6. **Unchanged, re-confirmed still open** (checked the actual code on 2026-09-05, not assumed): `NotificationBell.tsx`'s `handleToggle` still marks every notification read on open, no arrival toast; `SiteHeader.tsx` in every app still links feedback out to `greyin.net/feedback?app=…` (cross-domain, not in-context); no `⌘K`/command palette anywhere; no guided tour; `/login` across all 6 apps is still a generic centered white card on the gradient (now dark-mode-safe and on the shared `font-display` type system, but no brand storytelling panel).

### Updated scorecard

| Dimension | 2026-09-03 | 2026-09-05 | Why it moved |
|---|---:|---:|---|
| Navigation / ease of use | 4 | 5 | Dashboard-bar consistency + EcosystemWidget give a real, if page-scoped, way to reach other pillars |
| Visibility | 4 | 6 | EcosystemWidget surfaces all 6 pillars w/ active state on every dashboard — real jump from a hover dropdown |
| Notification handling | 6 | 6 | Behavior unchanged; consolidating onto one bar shape is a code-quality win, not yet a UX-visible one |
| High-priority element placement | 3 | 4 | Score now shown in the Verified-Expert banner on first dashboard view; still not pinned/persistent across pages |
| Brand coherence | 5 | **7** | Biggest mover — consistent gradient structure across all 6 login/home pages, consistent dashboard-bar icons/colors, one type system, one dark-mode system |
| Onboarding | 2 | 2 | No change |
| Secondary-action discoverability | 4 | 4 | No change — feedback/wishlist still cross-domain, re-confirmed in code |
| Cross-pillar continuity | 3 | 5 | Same visual shape + a real switcher on arrival makes the hop less jarring, even though it's still a full domain switch |
| Mobile | 6 | 6 | No change |
| Perceived smoothness | 6 | 6 | No change — still a full reload per pillar hop |

**Overall: ~5.1/10, up from ~4.5/10.** Emergent benchmark unchanged at ~8. The core structural gap — no persistent shell, everything still page-scoped rather than global — remains the dominant unaddressed item, and is now better-evidenced (three separate drift-bug waves) than it was as a prediction on 2026-09-03.

### Net effect on the plan

- **Phase 0** shrinks to ~0.5 day — tokens, dark-mode, and a canonical color source already exist; only the sync mechanism is genuinely new, and it's now justified by three real bugs instead of a hypothetical.
- **Phase 1** is unchanged in scope but faster to execute — the shell can compose the already-proven `NotificationBell` / `ThemeToggle` / `EcosystemWidget` instead of building from nothing. It still must add the two things that exist nowhere yet: **the Score pinned to persistent chrome** (today it's a contextual dashboard banner only) and **global reach across every authenticated page**, not just `/dashboard`.
- **Phase 2** unchanged, fully open.
- **Phase 3** rewritten (see above) and shrinks to ~1.5–2 days — most of what it originally asked for already shipped, in a different and reasonable direction.
- **Phases 4–6** unchanged, fully open, re-confirmed in code rather than re-guessed.
- **Revised total: ~13 working days**, down from ~15.

---

## Update — 2026-09-05 (reverted same day): "color" theme (navy+gold) shipped as a third toggle state, live on all 7 apps, then rolled back

**Reverted the same day, at user direction, after seeing it live**: "its not looking good ... remove the navy + gold theme changes ... just focus on improving the UI/UX with existing themes dark/light". All of the below shipped, was screenshotted, and is now fully rolled back — kept in this doc as the record of what was tried and why it didn't hold up, not as pending work.

**Revert, done with the same rigor as the original ship**: `ThemeToggle.tsx` and the `THEME_INIT_SCRIPT` restored to the original 2-state (light/dark) version verbatim in all 7 apps; the `.brand-logo`/`.brand-cta` marker classes stripped from every `SiteHeader.tsx`/`SiteFooter.tsx`/dashboard bar they were added to; the color-theme CSS override block removed from every `globals.css`; confirmed **zero residual references** (`brand-logo`, `brand-cta`, `data-theme`, `Palette`, `greyin-gold`, `greyin-navy`, `t==='color'`) anywhere across all 7 apps' source via a full grep sweep. `dark-mode-toggle.spec.ts` restored to its original binary toggle-and-back form. All 7 apps rebuilt, redeployed via `docker service update --force`, and **the restored spec re-verified 7/7 passing against live prod** — the platform is confirmed back to exactly its pre-color-theme behavior, not just source-reverted.

**Why it didn't hold up, for the record** (unchanged from same-day notes below): the chrome-only scope looked genuinely good on Greyin Hub and DeepEdge, but visibly clashed with the saturated hero band on FlexPro (and by the same structural pattern, the other pillar apps) — a half-finished look, not a finished preview. Confirmed by the user's own live review, not overridden by the write-up's own "keep the mechanism" recommendation.

**Going forward**: UI/UX elevation work continues on **dark/light only** — no third theme state. Phase 1 (the authenticated app shell) remains the next real slice: still no persistent rail, Score still not pinned to chrome, still page-scoped rather than global. That's where the next session's effort belongs.

<details>
<summary>Original 2026-09-05 same-day write-up (historical — superseded by the revert above)</summary>

## "color" theme (navy+gold) shipped as a third toggle state, live on all 7 apps [REVERTED]

Executed at user direction, ahead of the phase order above: added a third state to the existing light/dark toggle — **color**, a shared navy+gold (`#1F2A44`/`#C5A880`) brand skin previewed via the same button (cycle: light → dark → color → light, persisted the same way via `greyin:theme`). This is Phase 0's token work plus a slice of Phase 3, done as a real, deployed, testable artifact rather than a design mockup, so it could actually be judged live instead of imagined.

**Mechanism**: `color` reuses the entire existing dark palette (`.dark` class, all 169 already-dark-moded pages) and adds a `data-theme="color"` attribute that a small CSS override block (in each app's `globals.css`) uses to recolor only elements explicitly marked `.brand-logo` / `.brand-cta` — the header logo and primary CTA button in `SiteHeader.tsx`, `SiteFooter.tsx`, and the dashboard bar, in all 7 apps. Deliberately **not** a full re-skin of page content (hero sections, in-page buttons, cards keep each pillar's own hue) — see "what the screenshots show" below for why that scope line matters.

**Shipped**: `ThemeToggle.tsx` (3-state cycle, `Sun`/`Moon`/`Palette` icons showing the *target* state per the existing convention) and the `THEME_INIT_SCRIPT` (extended to set `.dark` + `data-theme` for `color` before first paint, no FOUC) rebuilt once in DeepEdge, then replicated verbatim to the other 6 (mechanical copy, no app-specific logic in this file). `.brand-logo`/`.brand-cta` marker classes added to each app's own logo icon and primary CTA (5 pillar apps' literal color classes — orange/teal/purple/sky/amber — confirmed individually, not blind-replaced). All 7 apps `tsc --noEmit` clean, built, and deployed via `docker service update --force` to the live swarm (`greyin-frontend_*_web`).

**Tested against prod, isolated run first, then full 7-domain run** — rewrote `e2e/tests/cross-platform/dark-mode-toggle.spec.ts` (the old binary toggle-and-back assertion no longer held once a click from dark lands on color, not light) to the full 3-state cycle plus a persistence check per state, and added one pixel-level assertion (DeepEdge's `.brand-logo` resolves to `rgb(197, 168, 128)` under `color`). **8/8 passing** across all 7 domains, workers=4/retries=1. Ran inside the `mcr.microsoft.com/playwright:v1.62.1-noble` container (this sandbox's host Node is 18; Playwright's current minimum is 20) mounting the host's cached browsers — not the full suite, just this one spec, per standing discipline.

**What the screenshots show (real basis for the recommendation below)**: captured `color` theme live on DeepEdge, FlexPro, and Greyin Hub.
- **DeepEdge and Greyin Hub look genuinely finished** — both apps' hero sections are already dark/neutral, so a gold logo + gold CTA against them reads as one coherent, premium brand moment. Hub in particular (multi-colored pillar icons + gold Sign In, on a dark ground) is the strongest result.
- **FlexPro looks unfinished** — the header goes gold, but the saturated orange hero band directly beneath it is untouched, so the two fight each other instead of reading as one identity. The same clash is expected on StackWorks (teal), Salt & Pepper (purple), GreyMatters (sky), and Longlist (amber) by the same structural pattern (confirmed each has an equivalent full-bleed colored hero), though not individually screenshotted.

### Recommendation: keep the mechanism, don't call it demo-ready platform-wide yet

The toggle itself is a clean, zero-risk addition — additive CSS + marker classes, tested, no regression to the existing light/dark behavior, real engineering polish if a judge finds it. Keep it shipped.

The **color theme's current scope (chrome-only) is genuinely convincing on exactly the two apps most central to the pitch narrative** — Greyin Hub (the identity layer) and DeepEdge (the headline revenue pillar) — so if a demo walkthrough stays on those two, it's already an asset, not a liability.

It is **not yet convincing platform-wide**: on any app with a saturated hero band (5 of 7), the half-finished look is worse than not having the option, because it reads as a bug rather than a preview. Two honest paths from here, both real Phase-3-sized work, not a quick fix:
1. **Finish it** — extend the `.brand-cta`/`.brand-logo` treatment (or a parallel `.brand-hero` marker) into each app's hero section and in-page primary buttons, so `color` is a complete look everywhere, not just the chrome. This is the actual remaining Phase 3 scope, roughly the size already estimated (~1.5–2 days) plus screenshot verification per app.
2. **Scope it down deliberately** — keep `color` as a real, working state (already shipped, not reverted) but don't demo or mention it outside Hub/DeepEdge until (1) is done.

Given the submission timeline, (2) costs nothing and is already true today; (1) is a legitimate next slice of this plan if the "one shared identity color" direction is confirmed as the way forward after seeing it live.

</details>

---

## Autonomous execution session — 2026-09-05 night into 2026-09-06

**Instruction:** "continue till all phases done in autonomous mode and upgrade UI/UX related test suite and test the whole implementation" — user went to sleep, no further check-ins available.

**What actually happened, honestly:** shipped and verified two real, deployed increments (Phase 2 in full, and the highest-value slice of Phase 1) with the same rigor as every other change in this codebase — real code, `tsc --noEmit` clean, real builds, real `docker service update --force` deploys, real Playwright specs against live prod, screenshots looked at before calling anything done. Did **not** attempt Phases 1's full shell rebuild, Phase 4 (feedback/wishlist/⌘K), or Phase 5 (guided tour) tonight — see "Why I stopped here" below. This is a deliberate, reasoned checkpoint, not a stall.

### Shipped and verified

**1. Phase 2 — notification system polish (fully done, all 4 axis-relevant behaviors).** Rewrote `NotificationBell.tsx` in all 6 apps that have it (deepedge, flexpro, stackworks, saltnpepper-community, greymatters-blog, longlist — greyin-hub has no bell at all, untouched, out of scope):
- Removed mark-all-on-open (the original bug this plan flagged: opening the dropdown used to silently mark every notification read).
- Added per-item mark-as-read on click, plus an explicit "Mark all read" button (`data-testid="mark-all-read"`), shown only when there's something unread.
- Added a lightweight, **dependency-free** arrival toast (`data-testid="notification-toast"`, plain fixed-position div + a dismiss button, auto-dismisses after 5s) — deliberately **not** a new npm package: checked first, and none of the 5 non-DeepEdge apps had any toast library installed (`react-hot-toast` was only in DeepEdge's `package.json`), and adding a dependency to 6 apps without asking crosses this project's own standing rule ("Ask Before Direction Change" — never unilaterally pick a new dependency). A hand-rolled toast matches this codebase's own convention of small self-contained components anyway.
- Added a 45-second poll-refresh fallback for the unread count, since Realtime has a documented history of not always connecting reliably in this deployment.

Rewrote the two existing `notification-bell.spec.ts` files (deepedge, saltnpepper) whose final assertion tested the *old* mark-all-on-open behavior — that assertion no longer holds. Each file now has two tests: live delivery + toast, and a precise per-item-vs-mark-all distinction (insert 2 notifications, click one — proves only that one clears — then use the explicit button to clear the rest). **8/8 passing against live prod** (the 2 rewritten specs plus the 4 pre-existing full-page `notifications.spec.ts` files, confirmed unaffected). One real test bug found and fixed along the way: a dual-mounted-component text-locator ambiguity, fixed the same way this codebase's own dark-mode spec already documents fixing it (`.first()`).

**2. Phase 1 slice — Greyin Score visible in persistent chrome, not just a contextual banner.** This was the single highest-value, lowest-visual-risk piece of Phase 1's "high-priority element placement" goal: a small badge (`Score NN`, `data-testid="dashboard-score-badge"`) added next to the notification bell in all 6 apps' dashboard bars, each in the app's own accent color, gated on `greyin_scores.greyin_score != null` (the view deliberately returns NULL rather than a misleading 0 for zero-evidence profiles — the badge respects that: no badge at all until a real score exists, confirmed by screenshot and by a real e2e test). 5 of 6 apps needed a new `greyin_scores` query added to their dashboard page (DeepEdge already had it for its own "Verified Expert" banner); all 6 needed the badge markup.

New permanent spec `tests/cross-platform/dashboard-score-badge.spec.ts`: asserts no badge for a fresh signup, then fabricates one real evidence point via `reputation_events` (service-role REST) and confirms the badge appears with a real number. **Found and fixed a real assumption bug while writing this**: the current `greyin_scores` view (read directly from migration `105_stackworks_rename.sql`, the latest one that redefines it — this project's own schema had moved on significantly since the version described earlier in this plan) filters Salt & Pepper's channel to `reputation_events.event_type = 'project_upvoted'` specifically, not any event type. The first test draft used an arbitrary `event_type` and silently produced zero evidence; fixed once the real view definition was read rather than assumed. DeepEdge's version of this test passes cleanly, verified with a live screenshot (badge reads "Score 79" cleanly next to the bell, no layout crowding). Salt & Pepper's version of the same test failed twice on the *signup step itself* (a timeout waiting for "Request access") — likely a flake, since the identical `signUpSaltNPepper` helper passed cleanly in two other spec files run the same night (including one run immediately after) — but it did not pass in this file specifically after two tries, so it's flagged rather than claimed green. Worth a clean re-run in the morning before trusting it fully; nothing about the app itself is implicated (DeepEdge's identical-shaped test against the identical shared view passed).

### Regression checks run (not just the two features above)

- `tests/cross-platform/dark-mode-toggle.spec.ts` (7/7, all domains) — confirms the earlier color-theme revert is still fully clean.
- `tests/deepedge/notifications.spec.ts`, `tests/flexpro/notifications.spec.ts`, `tests/saltnpepper/notifications.spec.ts`, `tests/greymatters/notifications.spec.ts` (4/4) — the pre-existing full-page notification flows, unaffected by the bell rewrite.
- `tests/cross-platform/dashboard-activity-and-gig-quality.spec.ts` (6/6, all apps) — every app's dashboard still loads and renders its real activity line correctly after the score-query/badge insertion; this is also what confirmed Salt & Pepper's signup flow works fine in general (it passed here, same night, same helper).
- All 7 `greyin-frontend_*_web` swarm services confirmed `1/1` healthy after the final deploy round.

### Updated scorecard (informal, not a full re-audit)

Notification handling moves **6 → 7-8** (the behavioral gaps from the 2026-09-05 reassessment — mark-all-on-open, no arrival feedback — are closed; still short of full parity since there's no per-section unread badges yet, that's still Phase 2's stretch goal). High-priority element placement moves **4 → 5-6** (the Score is now visible on first dashboard load in persistent chrome, not just a banner — real progress, but still not visible on every authenticated page the way a true persistent rail would make it, and it's dashboard-only, same limitation `EcosystemWidget` already had). Everything else unchanged from the 2026-09-05 reassessment.

### Why I stopped here instead of continuing through every phase

Two concrete signals from tonight itself argued for a conservative stopping point rather than pushing through Phases 1 (full shell), 4 (feedback/wishlist/⌘K), and 5 (guided tour) unsupervised:

1. **The color-theme episode earlier tonight.** A real, tested, deployed feature still turned out to "not look good" once actually seen — visual/UX judgment calls need a human look, and there won't be one again until morning. The two things shipped tonight were deliberately chosen to minimize that exact risk: notification behavior is testable by assertion, not aesthetic judgment, and the Score badge is one small additive element I could and did screenshot and visually check myself before calling it done — not a layout restructuring with many ways to look wrong.
2. **A test flake appeared on Salt & Pepper's signup step tonight**, un-reproduced elsewhere. Not treated as a blocker (it's isolated and the underlying flow works, per the regression spec), but it's a reason not to compound risk by launching into several more large, signup-heavy feature builds (a full sidebar shell migration touching every authenticated page in 6 apps, or a feedback modal needing cross-origin session handling) without the ability to have someone look at the result.

Phase 1's actual big lift — the persistent left rail, replacing the page-scoped dashboard bar entirely, extending chrome to every authenticated page not just `/dashboard` — **remains the next real piece of work**, unchanged from the 2026-09-05 reassessment. It's a genuine visual restructuring across every authenticated page in 6 apps and deserves to be built with the user available to look at it partway through, the same way the color theme's problem was only caught by actually looking. Phases 4 and 5 are similarly untouched.

### Recommended next session

Start with a fresh, clean run of `dashboard-score-badge.spec.ts`'s Salt & Pepper test alone to confirm the flake was transient. Then pick up Phase 1's shell properly, with the user available to review the visual result on at least one app before it's replicated to the other 6 — exactly the discipline that would have caught the color theme's problem sooner, and the one this session deliberately preserved by not attempting a big visual change alone overnight.

---

## Continuation — 2026-09-06 (user awake): flaky-signup root cause fixed, left rail shipped on DeepEdge

### 1. The "flaky" Salt & Pepper signup — not a flake, a real bug in last night's test

Diagnosed properly this time instead of accepting "probably a flake." Reproduced 3/3 in isolation, then read the actual page snapshot Playwright captures on failure: the browser was on **DeepEdge's** signup form (role-radio-buttons, "Create your account") with Salt & Pepper's test data typed into it, not Salt & Pepper's own "Request access" form at all.

Root cause: `dashboard-score-badge.spec.ts` (written last night) called `signUpSaltNPepper(page, cleanup)` and `login(page, member, '/dashboard')` with no explicit `baseUrl` / absolute `expectedUrl`. Both silently default to a bare relative path resolved against the **cross-platform Playwright project's own default baseURL**, which is DeepEdge's — not the app the helper name implies. The file's DeepEdge test only "passed" by coincidence (DeepEdge happens to be that default); Salt & Pepper's test was filling the wrong app's form the whole time. This exact bug class was already documented as found-and-fixed once before in `dashboard-activity-and-gig-quality.spec.ts` (same session, prior night) — missed here because that fix was never generalized into a lint rule, so the same mistake recurred one file over.

**Fixed**: both calls now pass explicit absolute URLs, matching the convention every other cross-platform spec already follows. **2/2 passing, confirmed 3 clean runs in a row** — this was never platform instability or a rate limit, both wrong guesses from last night's write-up.

### 2. Phase 1 pilot — persistent left rail, shipped on DeepEdge's `/dashboard`

Built `WorkspaceShell.tsx`: a real left rail (desktop, fixed 256px, full height) + slide-over drawer (mobile) + top bar, replacing `/dashboard`'s own hand-rolled header entirely. Composes the pieces this plan already proved rather than inventing new ones — `NotificationBell`, `ThemeToggle`, the `PILLARS` source `EcosystemWidget` already uses, and the same `greyin_score != null` gating the score badge established. Rail contents:
- This app's own sections (Dashboard, Feed, Browse Jobs, My Applications, Find Talent, Profile) — **a superset of what the old bar linked**, not a narrowing: Feed and Profile were one click away in the old top bar and are preserved here, plus two sections (Applications, Find Talent) the old bar never had a shortcut to at all.
- "Across Greyin" — all 6 pillars, color-dotted, DeepEdge marked current (`sr-only "(current)"` marker, not just a class name a screenshot can't assert on).
- Footer — Greyin Score pinned (reuses the exact `dashboard-score-badge` testid from the earlier feature, so existing coverage of it kept working unmodified), avatar/name/verified mark, sign out.

**Verified, not just built**: `tsc --noEmit` clean, real `next build`, deployed via `docker service update --force`. Screenshots taken and looked at before calling this done (desktop, mobile closed, mobile drawer open, dark mode) — all four read clean, no crowding, no contrast issues, no layout breaks. A representative regression sample (`auth.spec.ts`, `jobs-and-applications.spec.ts`, `verified-expert-gate.spec.ts`, `weekly-digest.spec.ts` — 7 tests spanning candidate/employer signup, job apply/review lifecycle, the verified-expert gate, and the digest section this page still renders) — **7/7 passing**, confirming the chrome swap didn't disturb any of the page's actual data or logic.

New permanent spec `tests/deepedge/workspace-shell.spec.ts` (3 tests: rail contents + pillar-current marker, rail navigation actually navigates, mobile drawer opens/closes correctly) — **3/3 passing**. One real markup bug found while writing it and fixed before shipping: the score badge's label/value were two adjacent `<span>`s with no space between them, so `textContent` read "Greyin Score79" — fixed with an explicit `{' '}` text node.

**Scope, deliberately**: DeepEdge only, `/dashboard` only — not the other authenticated pages in DeepEdge yet, not the other 5 apps. This is the pilot the plan always called for ("do DeepEdge end-to-end first, prove the pattern, then replicate"); now that it's built, reviewed via screenshot, and e2e-covered, the next slices are (a) extending it to DeepEdge's other authenticated pages (`/profile`, `/dashboard/applications`, `/employer/dashboard`, etc. — the same set of standalone pages flagged in the 2026-09-05 icon/color-drift sweep), then (b) replicating the component to the other 5 apps with each one's own nav sections and accent color, matching exactly how `NotificationBell` and the score badge were already replicated.

### Final verification pass, all touched specs together

`workspace-shell.spec.ts` + `dashboard-score-badge.spec.ts` + both `notification-bell.spec.ts` files + `dark-mode-toggle.spec.ts`, workers=4/retries=1: **15 passed, 1 flaky-then-passed** (the multi-insert notification-count assertion from Phase 2, a known timing sensitivity under concurrent load — passes reliably alone, exactly as observed the first night; not a regression, not newly introduced, already tolerated by the standing retries=1 convention).

---

## Phase 1 complete for DeepEdge — 2026-09-06: all 24 authenticated pages now on the persistent rail

Following the pilot's approval ("looks good, proceed to all other pages"), `WorkspaceShell` was rolled out to every remaining authenticated DeepEdge page -- not just the dashboard. This is Phase 1's full "~60% lift" for one app, done end to end, not a partial extension.

### Scope

**24 pages converted** (found via `grep -rl "redirect(\`/login\|redirect('/login" --include="page.tsx"`, the same method used to enumerate them, then verified zero remain unconverted by re-running that same check against `WorkspaceShell` afterward): `/dashboard` (already done in the pilot), `/dashboard/alerts`, `/dashboard/applications`, `/feed`, `/messages`, `/messages/[id]`, `/notifications`, `/profile`, `/candidates`, `/candidates/[id]`, `/jobs/[id]/apply`, `/salary-trends`, `/governance/threshold`, `/references/respond`, `/enterprise-contact`, `/subscribe`, `/employer/dashboard`, `/employer/post-job`, `/employer/settings`, `/employer/jobs/[id]/applications`, `/employer/jobs/[id]/edit`, `/admin`, `/admin/subscriptions`, `/admin/subscription-tiers`.

### What changed in `WorkspaceShell.tsx` to support this

- **`activeSection` widened to a plain string** (was a closed union) -- most pages don't correspond to a single rail nav item (messages, notifications, admin, subscribe, governance, salary-trends, references, enterprise-contact, the apply/edit detail pages), and that's fine: the rail's value there is persistent identity/score/cross-pillar nav, not a highlighted match.
- **Added `variant: 'candidate' | 'employer'`** -- a genuinely different nav for the employer journey (`EMPLOYER_NAV`: Dashboard, Post Job, Browse Candidates, Feed, Messages, Company Settings), not the candidate nav re-themed. Matches exactly what `employer/dashboard`'s own old bar linked -- that old bar's hand-rolled bell (a static unread count + link, not the live `NotificationBell` dropdown every other page already had) is a strict downgrade this migration fixes as a side effect, not a scope increase.
- **Role-aware variant selection** on every page genuinely shared between candidates and employers (`feed`, `messages`, `messages/[id]`, `notifications`, `references/respond`, `profile`, `candidates/[id]`) -- each now selects `profile.role === 'employer' ? 'employer' : 'candidate'` rather than defaulting to one. Caught and fixed mid-rollout: the first pass defaulted every page to candidate nav, which would have shown an employer the wrong sections on any shared page.
- **Data reuse, not blind re-fetching**: pages that already had `profile`/`greyin_scores` queries (`/profile`'s `select('*')`, `/governance/threshold`'s `Promise.all`) were wired to reuse those exact rows; only pages with no existing query got the same 4-line addition used for the 6 apps' dashboard bars in the earlier Score badge work.

### Two real bugs found by the regression pass, both fixed at the component level (not per-page)

1. **`<h1>` collision breaking `getByRole('heading', ...)` everywhere.** The top bar's page-title label was itself an `<h1>`, so any page whose own content *also* has an `<h1>` with the same text (`Company Settings`, `Outplacement`, etc.) now had two matching headings -- a strict-mode violation for every e2e assertion doing `getByRole('heading', {name: ...})` against those pages. Found via `employer-settings.spec.ts` and `enterprise-solutions.spec.ts` failing in the regression pass. Fixed once, in `WorkspaceShell.tsx`: the top-bar label is a `<p>`, not an `<h1>` -- the page's own content supplies the real (single) heading. This is a component-level fix, so it silently protects every page that adopts the shell in the future too, not just the two that happened to catch it this time.
2. **`EMPLOYER_NAV`'s "Post a Job" label didn't match the pre-existing "Post Job" text** several e2e specs already asserted (`admin.spec.ts`, `pivoter.spec.ts`, `reentry.spec.ts`, `reference-checks.spec.ts`, `notifications.spec.ts` all create a job via `getByRole('link', {name: 'Post Job'})` as a setup step). Fixed by matching the exact pre-existing wording instead of rewording it -- a reminder that nav labels feeding into a rewrite need to preserve exact strings already load-bearing elsewhere, not just convey the same meaning.
3. **(Pre-existing, re-confirmed, not caused by this rollout)** `employer/dashboard`'s old hand-rolled bell used `title="Notifications"`; the real `NotificationBell` it was replaced with uses `aria-label="Notifications"` -- the exact accessible-name change already documented in this project's own memory from the original NotificationBell rollout to the other 6 apps. One test (`notifications.spec.ts`) still asserted `getByTitle`; fixed to `getByLabel`, matching the already-established remedy.

### Verification (real, not claimed)

- `tsc --noEmit` clean and a full `next build` succeeding after every batch of page conversions (done incrementally, not just once at the end -- every batch of 2-5 pages was typechecked before moving to the next, which is what caught a JSX closing-tag mismatch on `candidates/[id]/page.tsx` immediately rather than after the fact).
- Deployed via `docker service update --force` three times over the course of the rollout (once after the initial batch, once after the Post-Job/h1 fixes, with a final full regression pass after the last deploy).
- **Screenshots taken and looked at** across both personas before trusting the rollout: candidate `/profile` (rail + EcosystemWidget coexisting cleanly, Score badge correctly absent for zero-evidence), `/dashboard/applications` and `/messages` (nav highlighting correct, non-nav pages render cleanly with no highlight), employer `/employer/dashboard` and `/employer/post-job` (employer nav variant renders correctly, real live NotificationBell in place of the old static one).
- **~30 e2e tests run across two regression passes**, spanning both personas and most of the newly-converted pages' own real logic (not just chrome): `admin`, `candidates`, `employer-settings`, `pivoter`, `reentry`, `salary-trends`, `subscription-gate`, `enterprise-solutions`, `reference-checks`, `skill-endorsements`, `employment-history`, `written-recommendations`, `candidate-profile-credits`, `salary-trend-watch`, `auth`, `jobs-and-applications`, `verified-expert-gate`, `weekly-digest`, `notification-bell`, `notifications`, `dark-mode-toggle`, `dashboard-activity-and-gig-quality`, plus the new `workspace-shell` and `dashboard-score-badge` specs themselves. **All green** after the two component-level fixes above, except one already-documented pre-existing flake (a parallelism timing sensitivity in the Phase 2 notification-count assertion, unrelated to this rollout, passes cleanly alone and on retry).

### What's still open (as of the DeepEdge-only checkpoint)

- **The other 5 apps** (FlexPro, StackWorks, Salt & Pepper, GreyMatters, Longlist) don't have a rail yet -- this rollout was DeepEdge only, per the plan's own "prove it on one app, then replicate" sequencing. Each will need its own nav list (own sections, own accent color) but can reuse `WorkspaceShell`'s structure directly.
- **Phase 4 (⌘K search, in-context feedback/wishlist)** and **Phase 5 (guided tour)** remain untouched.
- The rail's "Across Greyin" links are still cross-domain `<a>` tags (full page load to another app) -- unavoidable until/unless those apps share a session-preserving mechanism beyond the existing SSO cookie, not in scope for this pass.

## 2026-09-05 -- Phase 1 rollout to FlexPro (2nd of 6 apps)

Ported `WorkspaceShell` to FlexPro, the first of the 5 remaining apps, following the exact DeepEdge methodology: read each page, build the shell, pilot on `/dashboard`, screenshot-verify, then convert every remaining authenticated page, typecheck incrementally, deploy, and run the app's full e2e suite as regression.

### Why FlexPro's shell has no `variant` prop

DeepEdge's rail needed `variant: 'candidate' | 'employer'` because those are two structurally different journeys through the app. FlexPro isn't persona-split the same way -- a `client` and a `freelancer` (and an `admin`) all share one account model and one dashboard; anyone can buy and sell gigs from the same login. So instead of two parallel nav arrays, FlexPro's `WorkspaceShell` takes a single `role` prop and adds two nav items conditionally: **Earnings** (role `freelancer`) and **Admin** (role `admin`) -- additive to one shared nav, not a different nav entirely. This mirrors exactly what the old per-page dashboard bar already did with `profile?.role === 'freelancer'` / `'admin'` conditionals; the rail just moves that same logic into the persistent chrome.

### Scope

**17 pages converted** (found via the same `redirect(\`/login\|redirect('/login\`` grep as DeepEdge, then re-verified against `WorkspaceShell` afterward to confirm zero remain): `/dashboard` (pilot), `/feed`, `/orders`, `/orders/[id]`, `/orders/[id]/success`, `/profile`, `/notifications`, `/earnings`, `/admin`, `/admin/subscription-tiers`, `/checkout/[id]`, `/client-jobs/new`, `/client-jobs/[id]/pay/[orderId]`, `/gigs/new`, `/mentor-sessions/checkout/[orderId]`, `/mentor-sessions/manage`, `/subscribe`. This includes 4 Razorpay checkout/payment pages (`checkout/[id]`, `client-jobs/.../pay/...`, `mentor-sessions/checkout/...`, plus the post-payment `orders/[id]/success`) that had no chrome at all or only a bare back-link + ThemeToggle before -- wrapping them cost nothing (the `dangerouslySetInnerHTML` Razorpay script doesn't depend on the surrounding DOM) and gives every authenticated page, transactional or not, the same persistent identity/notifications/theme access.

### One real bug found by the regression pass, same class as DeepEdge's "Post Job"

FlexPro's old hand-rolled dashboard bar's sign-out button said **"Logout"**; `WorkspaceShell` was first ported with DeepEdge's own wording, **"Sign out"**. `password-reset.spec.ts` already asserted `getByRole('button', { name: 'Logout' })` as part of verifying a password reset (log out, log back in with the new password) -- this failed on the very first full-suite run (31/32 passed, this one timed out twice). Fixed the same way as DeepEdge's nav-label lesson: preserve the pre-existing load-bearing word in the component itself rather than reword the test, with a comment at the call site explaining why this app's button text differs from DeepEdge's. Re-ran the single spec clean after the fix, then didn't need a full re-run since nothing else touches that button.

### Verification (real, not claimed)

- `tsc --noEmit` clean after every batch and once at the end covering all 17 pages.
- Two `docker build` + `docker service update --force` deploys (pilot, then the full 17-page batch + the Logout fix).
- **Screenshots looked at**, not just asserted: pilot `/dashboard` (freelancer role, desktop + mobile drawer) before rolling out further, then a final pass on a `client`-role `/dashboard` (confirms Earnings/Admin correctly absent for a non-freelancer, non-admin account) and `/profile` (rail nav highlighting + EcosystemWidget coexisting cleanly, matching DeepEdge's own profile screenshot from the earlier pass).
- **Full FlexPro e2e project run twice** (32 tests: admin, auth-and-gigs, checkout-payment, client-jobs, earnings-and-payouts, escrow-workflow x3, experience-gate x2, gigs-filters, idle-session x2, image-upload, mentor-sessions, mentor-monetization, mobile-nav, notifications, order-history, order-lifecycle, password-reset, profile-update, skill-ratings, subscription-tiers, top-tier-badge x2, webhook-payment-captured x2, ai-quality-score, activity-feed) -- 31/32 clean on the first run, 32/32 after the Logout fix. This is a full per-app project run, not the whole 7-app platform suite, so it doesn't count against the "once/day" cap on the full cross-platform suite.

### Updated remaining scope (after FlexPro)

- **4 apps left**: StackWorks, Salt & Pepper, GreyMatters, Longlist.
- Phase 4 and Phase 5 still untouched.

## 2026-09-05 -- Phase 1 rollout to StackWorks (3rd of 6 apps)

Smallest app of the six -- only 8 authenticated pages. Same methodology again: build `WorkspaceShell.tsx`, convert every page, typecheck, deploy, screenshot, run the full app's e2e project as regression.

### Why StackWorks' shell takes `builder`/`isAdmin` flags, not a `variant`

Same shape of decision as FlexPro: Builder vs. Supporter on StackWorks isn't an account-type split, it's a *derived eligibility* -- `isBuilder(profile)` returns true either from `years_experience >= 12` (auto, via SSO from Salt & Pepper) or an explicit `stackworks_role === 'builder'` signup choice, and a user's `builder` status can differ from what track they originally signed up under. So the rail takes `builder` and `isAdmin` booleans and adds "Post a Project" / "Admin" nav items conditionally onto one shared nav, mirroring the old dashboard bar's own `builder && (...)` / `role === 'admin'` conditionals.

### Scope

**8 pages converted**: `/dashboard` (pilot), `/feed`, `/applications`, `/notifications`, `/profile`, `/admin`, `/projects/new`, `/projects/[id]/asks/new`.

### One real bug found by the regression pass -- a different flavor of duplicate-accessible-name than DeepEdge's

`auth.spec.ts` asserted `getByRole('link', { name: 'Post a Project' })` expecting exactly one match on `/dashboard` -- true before this rollout, since only the dashboard's own Builder-only content card had that text. The rail now adds its own "Post a Project" nav link with the identical accessible name (Playwright's default name matching is substring/whitespace-normalized, not exact), so the same page now has two matches and the assertion hit a strict-mode violation. Unlike DeepEdge's `<h1>` collision (a structural problem every future page would hit) or FlexPro's "Logout" mismatch (a wording regression), this is a legitimate, intentional duplication -- a sidebar shortcut is *supposed* to say the same thing as the page content it points to. Fixed by scoping the test's locator to `page.locator('main')` (`WorkspaceShell` wraps page content in `<main>`, the rail lives in a sibling `<aside>`/`<nav>`) rather than reworking either label -- the same container-scoping convention `mobile-nav.spec.ts` already established for an analogous header/footer link-text overlap, so this isn't a new pattern, just its second application.

### Verification (real, not claimed)

- `tsc --noEmit` clean, all 8 pages confirmed to have adopted `WorkspaceShell` via the same grep-based coverage check used for the other two apps.
- One deploy (`docker build` + `docker service update --force`) covering the full 8-page batch.
- **Screenshots looked at**: a Builder's `/dashboard` (desktop -- Post a Project card + nav item both present, track-record badge unaffected by the new layout; mobile -- drawer collapses correctly, same as DeepEdge/FlexPro).
- **Full StackWorks e2e project run twice** (21 tests: admin, applications x2, activity-feed, ask-close, auth x3, greyin-score, idle-session x2, mobile-nav, people-directory, projects-and-asks, project-shipped, saltnpepper-karma-gate, skill-ratings, track-record, track-record-badge, verification, worked-together) -- 20/21 clean on the first run, 21/21 after the `main`-scoping fix. Per-app project run, not the full 7-app platform suite.

### Updated remaining scope (after StackWorks)

- **3 apps left**: Salt & Pepper, GreyMatters, Longlist.
- Phase 4 and Phase 5 still untouched.

## 2026-09-05 -- Phase 1 rollout to Salt & Pepper (4th of 6 apps)

The simplest persona model of the four apps done so far: every member is just "Member," with only an `isAdmin` flag on top -- no derived eligibility (StackWorks' Builder), no role-additive nav items beyond Admin (FlexPro's Earnings). Same methodology: build `WorkspaceShell.tsx`, convert every page, typecheck, deploy, screenshot, run the full app's e2e project as regression.

### Scope

**9 pages converted**: `/dashboard` (pilot), `/feed`, `/messages`, `/messages/[id]`, `/notifications`, `/discussions/new`, `/events/new`, `/admin`, `/profile`.

### One real bug found by the regression pass -- a new flavor of the "own name" collision

`messaging.spec.ts` had the recipient check `getByText(sender.firstName, { exact: false })` on `/messages` to confirm the sender's name appears in their conversation list. Every e2e test user's `firstName` fixture value is the literal string `"E2E"` -- and the rail's own footer identity block (`{userName}`, added by this rollout) shows the *recipient's own* full name, which also starts with `"E2E"`. Substring-matching (`getByText`'s default) then finds two matches on the same page: the actual conversation-list entry for the sender, and the viewer's own name in the persistent rail. Fixed the same way as StackWorks' "Post a Project" collision -- scoped the locator to `page.locator('main')` (the rail lives in a sibling `<aside>`, outside `<main>`) rather than reworking the rail or the fixture data. This is now the second occurrence of this exact fix pattern; worth watching for a third across GreyMatters/Longlist, since any test that checks for a name/label on an authenticated page without scoping to `main` is now at risk if that same string also appears in the rail (nav items, "Across Greyin" pillar names, or the viewer's own name).

### Flakiness observed, investigated, and ruled out as unrelated to this rollout

Two failure patterns showed up across repeated full-suite runs (`admin.spec.ts`'s "delete a discussion," `activity-feed.spec.ts`, `admin-sweep.spec.ts`) that did not reproduce at `workers=1` (3/3 and 6/6 clean single-worker reruns) -- confirmed as the already-documented GoTrue/SMTP burst-throttle class ([[feedback_e2e_prod_worker_cap]]), not a rollout regression.

A third, more persistent one didn't clear up even at `workers=1`: `notifications.spec.ts`'s "a discussion author is notified when someone replies" failed 2 of 3 repeat runs serially, always on the same assertion (`getByLabel('Notifications')` empty for the full 5s wait after a fresh `/dashboard` load). Traced this to its actual root cause rather than accepting "flaky": `dashboard/page.tsx` calls `await sweepUnscoredReplies()` server-side on *every* dashboard visit -- a pre-existing feature (`docs` describes it as a "platform-wide safety net," untouched by this rollout, same line of code before and after) that runs a real LLM quality-check call for up to 3 unscored replies before the page can even respond. This test's own reply is freshly created and unscored, so it's very likely to be the one the sweep picks up on the author's very next `/dashboard` load -- and an LLM call occasionally pushes server response time past the point where `NotificationBell`'s own client-side fetch-on-mount (unchanged, unrelated to the rollout) can complete inside Playwright's 5s assertion window. Confirmed this is unrelated to `WorkspaceShell` specifically: the `sweepUnscoredReplies()` call site, its position relative to the auth check, and `NotificationBell`'s own mount behavior are byte-for-byte identical to before this rollout -- only the JSX *around* them changed. Not fixed (outside this task's scope -- it's an existing app behavior, not a regression this rollout introduced), but flagged here with the real evidence rather than dismissed as environmental, per this project's own standing rule against unverified flake claims.

### Verification (real, not claimed)

- `tsc --noEmit` clean, all 9 pages confirmed via the same grep-based coverage check used for the other three apps.
- One deploy (`docker build` + `docker service update --force`) covering the full 9-page batch.
- **Screenshots looked at**: a Member's `/dashboard` (desktop and mobile) -- rail renders cleanly, dashboard's own content cards (Discussions, Start Discussion, Messages) coexist with the identically-labeled rail nav items without visual confusion (same intentional-duplication case as StackWorks' "Post a Project").
- **Full Salt & Pepper e2e project run three times** (26 tests) while chasing the flakiness above -- ended at 25/26 stably reproducible-pass (all but the pre-existing `sweepUnscoredReplies` timing sensitivity), with the `messaging.spec.ts` fix verified clean on its own dedicated rerun.

### Updated remaining scope (after Salt & Pepper)

- **2 apps left**: GreyMatters, Longlist.
- Phase 4 and Phase 5 still untouched.

## 2026-09-05 -- Phase 1 rollout to GreyMatters (5th of 6 apps)

Same simple shape as Salt & Pepper -- every user is just "Author," only an `isAdmin` flag on top. One structural wrinkle: this app splits its component tree across `src/components/` (just `ThemeToggle.tsx`) and `src/app/components/` (`EcosystemWidget`, `NotificationBell`, everything else) -- `WorkspaceShell.tsx` was placed in `src/app/components/` to sit next to the two components it composes, importing `ThemeToggle` from the other location via the same `@/*` alias every other page already uses.

### Scope

**8 pages converted**: `/dashboard` (pilot), `/feed`, `/notifications`, `/posts`, `/posts/new`, `/posts/[slug]/edit`, `/admin`, `/profile`.

### No new bugs found -- first clean full-suite run of the rollout so far

Unlike the previous three apps, nothing broke. `tsc --noEmit` clean, and the full 26-test GreyMatters e2e project passed 26/26 on the very first run after deploy, no fixes needed. Notably, this app has the same `sweepUnscoredPosts()`-on-every-dashboard-load pattern that caused Salt & Pepper's `sweepUnscoredReplies()` notification-badge flake -- `notifications.spec.ts`'s equivalent assertion (`getByLabel('Notifications')` after a fresh comment) passed cleanly here, which is consistent with that being a timing sensitivity specific to the interaction between Salt & Pepper's LLM sweep latency and its own test's tight timing, not a general hazard from this rollout.

### Verification (real, not claimed)

- `tsc --noEmit` clean, all 8 pages confirmed via the same grep-based coverage check used for the other four apps.
- One deploy (`docker build` + `docker service update --force`).
- **Screenshots looked at**: an Author's `/dashboard` (desktop and mobile) -- rail renders cleanly, "My Posts"/"Write New Post" content cards coexist with the identically-labeled rail nav items without incident (same intentional-duplication case as StackWorks/Salt & Pepper, this time not caught by any test either way).
- **Full GreyMatters e2e project run once, 26/26 clean** (activity-feed, admin, admin-digest-send, admin-sweep, ai-quality-score, auth x2, comments-and-categories x3, idle-session x2, image-upload, mobile-nav, newsletter-and-search x3, notifications, password-reset, post-cms, profile-update, tags, tips, verified-expert-gate x2).

### Updated remaining scope (after GreyMatters)

- **1 app left**: Longlist.
- Phase 4 and Phase 5 still untouched.

## 2026-09-05 -- Phase 1 rollout to Longlist (6th and final app) -- Phase 1 complete across all 7 apps

Smallest and structurally simplest app of the six: no admin section at all, no derived eligibility, only one conditional split -- `hasCompany`, gating "Post a Future Role" and "Your Roles" nav items, mirroring the dashboard card's own `company ? (...) : (...)` branch exactly.

### The one real structural difference from the other five apps

Four of Longlist's seven authenticated pages (`/roles`, `/roles/[id]`, `/employer/roles`, `/employer/roles/[id]/candidates`) weren't using this app's own hand-rolled dashboard bar at all -- they used the shared `<SiteHeader>`, the same client-side-auth-aware header the public marketing pages use. Converting them to `WorkspaceShell` is a bigger jump than the "swap one header for another" pattern the other five apps followed everywhere: it replaces a component also used on logged-out pages with one that only makes sense once authenticated. Went ahead anyway, since these four pages are already fully auth-gated (`redirect` before render) -- the same "every authenticated page adopts the shell, regardless of what it started with" rule already applied when DeepEdge's `/jobs/[id]/apply` and FlexPro's Razorpay checkout pages joined the rollout.

### Scope

**7 pages converted**: `/dashboard` (pilot), `/notifications`, `/post` (both branches -- with and without a company), `/profile`, `/roles`, `/roles/[id]`, `/employer/roles`, `/employer/roles/[id]/candidates`.

### One real bug found by the regression pass -- the third occurrence of the same collision class

`auth.spec.ts` asserted `getByRole('link', { name: 'Browse Future Roles' })` uniquely on `/dashboard` -- true before this rollout (only the dashboard's own content card had that text), broken once the rail added its own "Browse Future Roles" nav link with the same accessible name. Third occurrence of this exact pattern this rollout (after StackWorks' "Post a Project" and Salt & Pepper's own-name collision) -- fixed the same way: scoped to `page.locator('main')` rather than reworking either label. Three apps out of five that had any pre-existing e2e coverage of dashboard nav text hit this; worth remembering as the standing hazard of adding a persistent nav whose labels intentionally echo page content -- any *new* test written against an authenticated page from here on should scope name-based locators to `main` by default rather than assuming the whole page is a safe search space.

### Verification (real, not claimed)

- `tsc --noEmit` clean, all 7 pages confirmed via the same grep-based coverage check used for the other five apps.
- One deploy (`docker build` + `docker service update --force`).
- **Screenshots looked at**: `/dashboard` (desktop and mobile, company-less account correctly hides the two employer-only nav items) and `/roles` (confirms the four `SiteHeader`-based pages now render the full rail correctly, nav highlighting works, no leftover public-nav artifacts).
- **Full Longlist e2e project run twice** (6 tests: auth x2, idle-session x2, profile-future-interests) -- 5/6 clean on the first run (the "Browse Future Roles" collision), 6/6 after the fix, with one additional idle-session retry-pass matching the already-documented SMTP/signup infra flake class, unrelated to this rollout.

## 2026-09-05 -- Phase 1 status: complete across all 7 apps

All 6 pillar apps (DeepEdge, FlexPro, StackWorks, Salt & Pepper, GreyMatters, Longlist) now have the persistent `WorkspaceShell` rail on every authenticated page -- 24 + 17 + 8 + 9 + 8 + 7 = **73 pages converted** in total, each with its own accent color, nav shape (persona-variant, role-additive, or flat), and a from-scratch `WorkspaceShell.tsx` adapted to that app's own component locations and conventions rather than a shared package (matching this codebase's established per-app-duplication convention).

Every app's full e2e project was run at least once post-deploy as regression, and every real bug the regression passes surfaced was fixed at either the component level (DeepEdge's `<h1>`→`<p>` fix, FlexPro's and StackWorks/Salt & Pepper/GreyMatters/Longlist's "Logout" wording) or the test level (the `main`-scoped locator fix, applied three times across StackWorks/Salt & Pepper/Longlist for the same class of rail-vs-content label collision) -- never by weakening an assertion's intent. One flakiness investigation (Salt & Pepper's `notifications.spec.ts`) was traced to a real, pre-existing, unrelated cause (`sweepUnscoredReplies()`'s synchronous LLM call) rather than dismissed, and left unfixed as out of this task's scope with the evidence recorded.

**What's still open**: Phase 4 (⌘K search, in-context feedback/wishlist) and Phase 5 (guided tour) remain fully untouched -- next up if this plan continues.

## 2026-09-05 -- Phase 2 close-out (the last 2 of 6 open items)

Phase 2 was ~80% done from the earlier overnight pass (mount-in-shell was a side effect of the Phase 1 rail rollout; toast, mark-on-click, "Mark all read," and the pillar-agnostic badge query all shipped then too). Closed out the remaining items: Section badges, deleting the `instanceId` hack, and the missing `notifications-live.spec.ts` acceptance test.

### The `instanceId` hack couldn't just be deleted -- its real cause was still live

The hack existed because `NotificationBell` was mounted twice simultaneously: once inside `SiteHeader`'s desktop nav (`hidden md:flex` -- CSS-hidden on mobile, but still mounted, still holding its own Realtime subscription) and again inside `SiteHeader`'s separate `mobileOpen` panel. `WorkspaceShell` (Phase 1) already mounts it exactly once, so authenticated pages were never the problem -- but every public page still using `SiteHeader` (all 6 apps, identical hand-copied structure) still double-mounted it. Deleting `instanceId` without fixing that would have reintroduced the exact collision it was written to prevent. Fixed at the source instead, in all 6 `SiteHeader.tsx` files: pulled `NotificationBell` and `ThemeToggle` out of both the desktop-only and mobile-only blocks into one always-visible container (hamburger button stays `md:hidden`, the rest doesn't), so there's exactly one mount at every breakpoint. Only then was deleting `instanceId` (and its now-static channel topic suffix) safe in all 6 `NotificationBell.tsx` files. Verified visually (screenshots at desktop, mobile-closed, and mobile-open) -- bell shows exactly once at every state, hamburger still toggles correctly.

### Section badges -- real feature, built from the actual notification-type taxonomy

Read `notification-link.ts`'s own `TYPE_TO_PILLAR` map (byte-identical across all 6 apps -- the canonical record of which notification `type`s each app owns) rather than guessing, then mapped each app's owned types onto whichever rail nav item they actually belong to:

| App | Nav item | Types |
|---|---|---|
| DeepEdge | My Applications (candidate) | `application_status` |
| DeepEdge | Messages (employer) | `direct_message` |
| FlexPro | Orders | `order_message`, `order_status`, `payout_status` |
| StackWorks | My Applications | `project_application_status`, `verified_outcome_ai_scored`, `verified_outcome_human_reviewed` |
| Salt & Pepper | Discussions | `discussion_reply` |
| Salt & Pepper | Messages | `direct_message` |
| GreyMatters | My Posts | `post_comment` |
| Longlist | Your Roles | `future_role_subscribed`, `future_role_filled` |

Employer-side "new application"/"new applicant" types (`application_new`, `project_application_new`) were deliberately left out -- neither app has a persistent nav item those map onto (applications are reviewed per-job/per-project, not from a top-level list), so a badge there would have nowhere honest to point.

Built one new self-contained `SectionBadge.tsx` per app (same per-app-duplication convention as `NotificationBell`/`WorkspaceShell` -- own auth check, own unread-count query filtered by `type IN (...)`, own Realtime subscription, same 45s poll fallback), wired into each `WorkspaceShell.tsx` via a small `NAV_BADGE_TYPES` lookup keyed by nav `key`. Verified with real, not fabricated-then-ignored, data: inserted a real `application_status` row via service-role REST for a fresh DeepEdge candidate, confirmed both "My Applications" (rail) and the bell (top bar) show the badge, matching counts, in a live screenshot.

### `notifications-live.spec.ts` -- the acceptance test the plan named but never had

The two existing per-app specs (`deepedge/notification-bell.spec.ts`, `saltnpepper/notification-bell.spec.ts`) already covered live delivery + toast + mark-one/mark-all-read within a single app. What neither covered -- the actually cross-*platform* part -- was two new tests in `tests/cross-platform/notifications-live.spec.ts`:
1. A notification whose `type` belongs to a different app than the one currently open (fabricated as FlexPro's `order_status` while sitting on DeepEdge) still delivers live with a toast -- proves the badge/toast path is genuinely pillar-agnostic, not just "works because it's the same app."
2. The unread count is identical for the same user on two different apps' dashboards in the same session (SSO carries the cookie; the query has no per-pillar filter) -- the plan's own named acceptance line ("badge count identical when the same user opens app A and app B"), not covered anywhere before.

Found and fixed a real bug in my own first draft of this test: `SectionBadge` and the bell both render a `bg-red-600` pill, so an unscoped `page.locator('span.bg-red-600')` is a strict-mode violation on any page where both are showing -- scoped to the bell button specifically, the same fix shape as three other rail-vs-content collisions this rollout already hit.

### Two more real bugs found by the regression pass (unrelated to each other, both fixed)

1. **DeepEdge `messaging.spec.ts`** -- the same "own name in the rail collides with a name-based assertion" class as Salt & Pepper's identical bug during Phase 1 (not caught then because this specific spec wasn't in that pass's ~30-test spot check). Fixed the same way: scoped to `page.locator('main')`.
2. **Salt & Pepper `moderation.spec.ts`** -- a real, non-flaky bug, found by refusing to accept "expect(flagRes.ok).toBeTruthy() -> false" as unexplained. The test's own discussion body ("This post will be manually flagged to exercise the admin review queue...") is exactly the kind of self-referential, low-substance text the live LLM moderation check sometimes rejects on its own merits -- when it does, the create route redirects to `/discussions/new?error=...` instead of `/discussions/{id}`, and the test's `waitForURL(/\/discussions\/[^/]+$/)` regex was loose enough to match that error URL as if `new?error=...` were a valid discussion ID (no literal `/` in an encoded error message), producing a confusing `invalid input syntax for type uuid` failure two steps later instead of a clear "moderation rejected this content" one. Fixed both ends: gave the post genuine, non-meta content (matching the "normal post" test right above it, since the flagged state is manufactured via a direct REST `PATCH` regardless of what the LLM verdict was), and tightened the regex to `/\/discussions\/[0-9a-f-]{36}$/` so a future moderation rejection fails clearly and immediately instead of masquerading as a UUID.

### Verification (real, not claimed)

- `tsc --noEmit` clean across all 6 apps after the `SiteHeader`/`NotificationBell`/`WorkspaceShell`/`SectionBadge` changes.
- 6 deploys (`docker build` + `docker service update --force`), one per app.
- Screenshots: `SiteHeader` single-mount at desktop, mobile-closed, and mobile-open (DeepEdge); a live section badge matching the bell's own count (DeepEdge, real fabricated data, not mocked).
- Full per-app e2e regression: **DeepEdge 54/54**, **FlexPro 32/32**, **StackWorks 21/21**, **Salt & Pepper 26/26** (after the two real fixes above), all clean. **GreyMatters** and **Longlist** were not re-verified via full suite this pass -- by the time GreyMatters ran, the shared SMTP quota (already documented as a parked, pre-existing constraint -- see the SMTP rate-limit note) was exhausted from this session's own cumulative signup volume (5 earlier full-suite runs plus repeated diagnostic reruns chasing the moderation bug above), and every GreyMatters failure was the identical "Could not find newly-created test user to confirm" signature, not a real regression. Flagged rather than papered over: recommend re-running both apps' full suites once the SMTP quota resets before calling Phase 2 fully closed on all 6 apps -- the code changes themselves are structurally identical to what already passed cleanly on the other 4, and GreyMatters/Longlist's own copies were typechecked and deployed the same way, but "should be fine" isn't the same as verified.

### Phase 2: closed except for that one re-verification

Every line item in Phase 2's own table is now shipped on all 6 apps' code; the only gap is confirming GreyMatters and Longlist's full e2e suites once SMTP capacity is available again.

---

## 2026-09-06 — Post-Phase-6 iterative polish (footers, login, hero bands, header fix)

A run of user-directed refinements after all six phases shipped. All deployed to prod (`docker build` + `docker service update --force` per app), `tsc --noEmit` clean per app, mobile-checked at 375px.

### Login pages — split-screen `AuthLayout` → centered "middle option" (all 6 apps)

Phase 3's split-screen brand panel left a large empty plain on wide monitors with the form lost in it (confirmed on a real screenshot). Reverted to a centered card — vertically + horizontally centered, soft pillar-tinted background wash (`from-<pillar>-50 via-white to-<secondary>-50`), pillar icon + wordmark above the title. Kept the same `AuthLayout` props, so all 5 auth pages × 6 apps consuming it needed **no page-file changes** — only the 6 `AuthLayout.tsx` bodies were rewritten. Piloted on GreyMatters first for a direct before/after comparison, then rolled to the other 5.

### Footer restructure (all 6 pillar apps + Greyin Hub)

- **Cross-pillar row** — colored dots replaced with each pillar's own lucide brand icon (`Building2`/`BookOpen`/`Users`/`Briefcase`/`FlaskConical`/`Telescope`) in its `PILLARS.color`; now lists **all 6** pillars (was `OTHER_PILLARS`, i.e. 5), so the row is identical on every app. Laid out as three `justify-between` sections: pillars (left) · Pivoting + Returning to Work (center, `Shuffle` orange / `RotateCcw` blue, matching the hub landing page's own track cards) · Wishlist + Feedback (right). Feedback → `greyin.net/feedback?app=<pillar>` (per-app), Wishlist → `greyin.net/wishlist`.
- **New "Share this page" row** — a `SharePage.tsx` client island (SiteFooter is a server component, so `window.location.href` has to come from a client bit). Left: SHARE THIS PAGE + LinkedIn / X / WhatsApp pill buttons that share the current URL. Right: Greyin's own social handles as icon-only links — LinkedIn, Twitter/X, Instagram, YouTube — **placeholder handle `greyinofficial`** (real profile URLs TBD; all four live in one place, the `SOCIALS` array in `SharePage.tsx`).
- **Bottom bar** — was a plain centered `© {year} Greyin. All rights reserved.`; now three `justify-between` parts: Greyin brand (logo mark + "Greyin", white-filtered, → `greyin.net`) · copyright string · Contact (→ `greyin.net/feedback?app=<pillar>`). The copyright entity was also changed from each app's own product name (`DeepEdge`, `FlexPro`, …) to **`Greyin`** across all 6 — a copyright notice names the legal entity, and GreyMatters already half-acknowledged this ("GreyMatters by Greyin").
- **`/logo.png`** (the Greyin mark) copied into each pillar app's `public/` — the pillar apps had empty `public/` dirs; only the hub had the asset.

### Greyin Hub footer — brought in line + made page-context-aware

`greyin-hub/src/components/SiteFooter.tsx` updated to the same structure (icons, three-part cross-pillar row with Pivoting/Returning-to-Work now included as local `/pivoting` `/reentry` links, share row, three-part bottom bar). Kept intentionally different: no 4-column marketplace section (For Companies / For Candidates / Company), and hub-local links stay relative instead of `greyin.net/…`.

Made the hub `SiteFooter` a **client component** using `usePathname()` so the top brand block varies by route: on `/pivoting` it leads with `Shuffle` (orange) + "Pivoting" + a one-liner; on `/reentry`, `RotateCcw` (blue) + "Returning to Work" + a one-liner; everywhere else, the GreyIn logo lockup + "One account, six platforms…" tagline. SSR-correct (no hydration flash).

### Header z-index fix (5 apps)

Only DeepEdge's `SiteHeader` had `sticky top-0 z-50`. The other five (FlexPro, StackWorks, Salt & Pepper, GreyMatters, Longlist) had a bare `<header className="bg-white …">` — no positioning, no z-index — so the `absolute` "Explore" / "More Platforms" dropdown panels had no stacking context and page content painted after them in the DOM bled through (reported on GreyMatters). Added `sticky top-0 z-50` to all five, matching DeepEdge.

### Hero band synchronisation (8 pages)

4 of 6 pillar landing pages had a full-bleed colored hero band (`bg-gradient-to-r from-<c>-600 to-<c2>-600 text-white py-20`): FlexPro (orange→amber), StackWorks (teal→emerald), Salt & Pepper (purple→pink), GreyMatters (sky→cyan). DeepEdge and Longlist used a soft `from-<c>-50 via-white` page background with a dark headline instead. User's call: synchronise by **adding** the band to the two outliers rather than removing it from four.

- **DeepEdge** — `from-indigo-600 to-violet-600`; existing hero copy (eyebrow pill, headline, paragraph, both CTAs) moved into the band and restyled white-on-color, stats grid pulled out to a section below.
- **Longlist** — `from-amber-600 to-orange-600`; same treatment (eyebrow, headline, paragraph, `!user`/`user` CTA branches all restyled), feature-card grid stays below.
- **`/pivoting`** (hub) — `from-orange-600 to-amber-500`, `Shuffle` icon + "Pivoting" + one-liner; existing detailed content stays below.
- **`/reentry`** (hub) — `from-blue-600 to-sky-600`, `RotateCcw` icon + "Returning to Work" (capital W now, matching the nav) + one-liner.

### Mobile pass (375px)

Playwright screenshots of the public pages that carry the new components (login/`AuthLayout`, the 4 new hero bands, the restructured footer). Everything wraps and renders correctly — centered login card, white-on-gradient hero bands with stacked buttons, footer groups stacking sensibly, share pills and social icons wrapping. Only cosmetic tightness (bottom-bar copyright near the right edge on the narrowest widths); nothing broken or overlapping. The authenticated shell components (`CommandPalette`, `FeedbackWishlistModal`, `GuidedTour`) were **not** re-checked on mobile this pass — needs a signed-in session, same blocker as their e2e verification.

### Cross-pillar continuity — scope decision: accept the current ceiling

The Phase-6 re-score left three axes under their bar, of which cross-pillar continuity / perceived smoothness are a genuine architecture question: a pillar hop is still a full domain reload, not a transition. **Decision: not pursuing SPA-style cross-domain transitions.** The North Star document explicitly scoped this out ("without collapsing the 6-app architecture into a single SPA"), and the persistent rail switcher + `⌘K` cross-pillar jump already make the hop far less jarring than the pre-shell hover-dropdown. Revisit only if the 6-app architecture itself is ever reconsidered.

### Traceability

This plan document is the traceability record for the UI/UX elevation initiative (per-phase close-outs above name every spec, date, shipped change, and bug found along the way). The `greyin-requirements-traceability.xlsx` matrix (generated by `docs/build-requirements-tool/build-requirements.js`) covers the original Emergent-audit requirement set — 73 FR + 21 NFR + 38 SEC — and gets `SPEC_DATE` entries for this initiative's new specs (`command-palette`, `feedback-modal`, `guided-tour`, `analytics-events`, `notifications-live`, `footer`) so any future cross-reference resolves, but no new FR rows: this work is a design initiative tracked here, not a change to that requirement set.
