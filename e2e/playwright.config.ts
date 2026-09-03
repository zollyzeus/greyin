import { defineConfig, devices } from '@playwright/test'

// E2E_TARGET=local points every project at the isolated Docker stack
// (deployment/run-e2e-isolated.sh) instead of live production — same
// tests, same specs, just a throwaway backend/frontend so a run can never
// touch prod data. Defaults to production so `npx playwright test` with no
// env vars behaves exactly as it always has.
const isLocal = process.env.E2E_TARGET === 'local'
// deepedge (formerly greyin-b2b) moved off greyin.net onto its own
// subdomain (rebranded ExpertEdge -> DeepEdge 2026-09-01,
// deepedge.greyin.net); greyin.net now serves the ecosystem hub app
// instead -- the 'deepedge' project's baseURL follows the app, not the
// old domain, so every existing deepedge/*.spec.ts and
// cross-platform/*.spec.ts test (which exercises marketplace routes
// like /jobs, /candidates) keeps working unmodified. `freeagent` was
// fully renamed to `flexpro` 2026-09-02, `stackedge` to `stackworks`
// 2026-09-03, and `greyin-b2b`/`expertedge` to `deepedge` 2026-09-03
// (folder/image/service/e2e project/Traefik IDs all now say deepedge)
// -- this was App 3, the last of the three internal-identifiers
// renames at explicit user request.
const baseURLs = isLocal
  ? {
      deepedge: `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}`,
      'greyin-hub': `http://localhost:${process.env.E2E_HUB_PORT || 3105}`,
      greymatters: `http://localhost:${process.env.E2E_GREYMATTERS_PORT || 3101}`,
      flexpro: `http://localhost:${process.env.E2E_FLEXPRO_PORT || 3102}`,
      saltnpepper: `http://localhost:${process.env.E2E_SALTNPEPPER_PORT || 3103}`,
      stackworks: `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}`,
      longlist: `http://localhost:${process.env.E2E_LONGLIST_PORT || 3106}`,
    }
  : {
      deepedge: 'https://deepedge.greyin.net',
      'greyin-hub': 'https://greyin.net',
      greymatters: 'https://greymatters.greyin.net',
      flexpro: 'https://flexpro.greyin.net',
      saltnpepper: 'https://saltnpepper.greyin.net',
      stackworks: 'https://stackworks.greyin.net',
      longlist: 'https://longlist.greyin.net',
    }

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Capped at 1 (not the Playwright-typical 2+): every retry re-runs
  // signUpXXX helpers, and prod's GoTrue caps signups at 200/hour
  // (GOTRUE_RATE_LIMIT_EMAIL_SENT). At retries:1, a full run's worst case
  // (~57 base signups x 2) stays safely under that ceiling; retries:2 was
  // observed to exhaust it after two consecutive runs.
  retries: 1,
  // Fixed at 4 always (not just CI): this machine has 88 cores, so leaving
  // this unset let Playwright default to ~44 workers, which fired signups
  // at prod's GoTrue/SMTP relay fast enough to trip the relay's own burst
  // throttle ("too many AUTH commands" -> signup itself returns 500, not
  // recoverable by retrying or paginating the admin lookup afterward).
  workers: 4,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 90_000,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: 'deepedge',
      testDir: './tests/deepedge',
      use: { ...devices['Desktop Chrome'], baseURL: baseURLs['deepedge'] },
    },
    {
      name: 'greymatters',
      testDir: './tests/greymatters',
      use: { ...devices['Desktop Chrome'], baseURL: baseURLs['greymatters'] },
    },
    {
      name: 'flexpro',
      testDir: './tests/flexpro',
      use: { ...devices['Desktop Chrome'], baseURL: baseURLs['flexpro'] },
    },
    {
      name: 'saltnpepper',
      testDir: './tests/saltnpepper',
      use: { ...devices['Desktop Chrome'], baseURL: baseURLs['saltnpepper'] },
    },
    {
      name: 'stackworks',
      testDir: './tests/stackworks',
      use: { ...devices['Desktop Chrome'], baseURL: baseURLs['stackworks'] },
    },
    {
      name: 'greyin-hub',
      testDir: './tests/greyin-hub',
      use: { ...devices['Desktop Chrome'], baseURL: baseURLs['greyin-hub'] },
    },
    {
      name: 'longlist',
      testDir: './tests/longlist',
      use: { ...devices['Desktop Chrome'], baseURL: baseURLs['longlist'] },
    },
    {
      name: 'cross-platform',
      testDir: './tests/cross-platform',
      use: { ...devices['Desktop Chrome'], baseURL: baseURLs['deepedge'] },
    },
  ],
})
