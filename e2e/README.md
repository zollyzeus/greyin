# Greyin Platform — E2E Suite

Playwright tests against the **live production** sites (greyin.net,
greymatters.greyin.net, flexpro.greyin.net, saltnpepper.greyin.net, and more).

## Setup

```bash
cd e2e
npm install
npx playwright install --with-deps chromium
```

`.env` already contains the Supabase service_role key used only to
auto-confirm throwaway test accounts (production has email confirmation
required, so a real signup can't log in until confirmed). Never expose this
key to a browser context — it's only read from Node in test setup code.

## Running

```bash
npm test                    # full suite, all projects
npm run test:deepedge
npm run test:greymatters
npm run test:flexpro
npm run test:stackworks
npm run test:saltnpepper
npm run test:cross-platform
npm run report               # open the last HTML report
```

## Design

- One Playwright **project** per app (own `baseURL`), plus a `cross-platform`
  project for the one nav path that links all 5 sites together.
- Every spec creates its own throwaway account(s) via `utils/testUser.ts` +
  `utils/auth.ts` (`test+<prefix>-<timestamp>-<random>@greyin.net`, plus-
  addressed off the real `test@greyin.net` mailbox; never registered
  greyin-e2e-test.com, which is why it was bouncing every confirmation
  email straight back to SMTP_ADMIN_EMAIL).
  No spec depends on another spec's data or on manually-seeded content, so
  the suite is safe to run repeatedly and in parallel against production.
- `utils/admin.ts` uses the Supabase service_role key for two things only:
  confirming test-account emails, and seeding a throwaway blog post /
  fast-forwarding an order to `paid` where a full UI flow already covers
  that path elsewhere (`checkout-payment.spec.ts` drives a real Razorpay
  test-mode payment end to end).
- `checkout-payment.spec.ts` is the most environment-fragile spec, since it
  drives Razorpay's own checkout iframe rather than app UI.
- `idle-session.spec.ts` (one per app) tests the 20-minute idle-warning /
  22-minute auto-sign-out guard without ever waiting real minutes: the
  guard reads a single `localStorage` timestamp (`greyin:lastActivityAt`)
  once a second, so directly rewriting that timestamp into the past is a
  faithful fast-forward of real elapsed idle time, not a shortcut around
  the logic under test. See `fastForwardIdle()` in each spec.
- `cross-platform/session-monkey.spec.ts` is a seeded (mulberry32),
  reproducible randomized fuzzer for the shared-SSO session -- built to
  chase an unreproduced user report of a tab showing stale logged-in
  state after signing out elsewhere. Drives a random sequence of login/
  logout/navigate/reload/tab-switch actions across 2 tabs and all 7 apps,
  checking after every single step (both tabs) that `/dashboard` actually
  agrees with the fuzzer's own tracked ground truth. Override
  `SESSION_MONKEY_SEED` / `SESSION_MONKEY_STEPS` for a longer or
  differently-randomized run; a failure prints the exact seed and full
  step log needed to reproduce it deterministically.

## Known gaps

- Comment moderation status (`approved`/`pending`/`spam`) isn't filtered on
  the GreyMatters post page, so this suite doesn't exercise moderation.
- GreyMatters posts have no in-app authoring UI — `utils/admin.ts` seeds
  test posts directly via the Supabase REST API.
