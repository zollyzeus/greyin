# UI/UX Elevation Plan — closing the gap to the sidebar-shell benchmark

**Created:** 2026-09-03 · **Reassessed:** 2026-09-05 (see dated section at the bottom — read it before acting on anything above, Phase 3 in particular is superseded)
**Baseline:** current Greyin logged-in UX rated ~4.5/10 vs. the Emergent sidebar-SPA benchmark ~8/10, on the axes: navigation/ease of use, visibility, notification handling, high-priority element placement, cross-pillar continuity, brand coherence, onboarding, secondary-action discoverability. **Re-scored 2026-09-05 at ~5.1/10** — see reassessment.
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

---

## Phase 4 — In-context feedback, wishlist, search (≈2 days)

**Axis moved:** secondary-action discoverability (4 → 8).

- **Feedback / wishlist** — move from cross-domain links (`greyin.net/feedback?app=…`) to in-app modals in the shell. The components already exist on greyin-hub; port them as shared shell components hitting the same hub API over the SSO'd session. Feedback modal surfaces the admin reply + shows an unread-reply badge on the rail button.
- **Global search** — a `⌘K` command palette in the shell over the existing `platform_search_index` / `platform_people_index`; results grouped by pillar, keyboard-navigable, Enter navigates. Retires "Ecosystem Search is just a nav item".

### Acceptance (e2e, `command-palette.spec.ts`, `feedback-modal.spec.ts`)
- `⌘K` opens the palette from any page; typing a name returns cross-pillar results; Enter navigates.
- Feedback modal submits; a seeded admin reply shows inside it; the rail badge clears on open.

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

---

## Phase 6 — Measure & iterate (ongoing)

- Re-score against the same 10-dimension rubric; gate: ≥7 every axis, ≥8 on the four named.
- Lightweight analytics: rail usage, pillar-switch rate, bell open rate, tour completion, `⌘K` usage.
- One usability pass — 5 users, the 3 core journeys (find talent, get verified, switch pillar).

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
