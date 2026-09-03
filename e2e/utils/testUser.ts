export interface TestUser {
  email: string
  password: string
  firstName: string
  lastName: string
}

/**
 * Every test that needs an account calls this to get a unique, disposable
 * identity — no test shares a user with another, so specs stay isolated and
 * safe to run in parallel against the live production database.
 */
export function makeTestUser(prefix: string): TestUser {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    // greyin-e2e-test.com was never actually registered (confirmed via
    // dig: NXDOMAIN), so every signup's real confirmation-email send
    // attempt was bouncing straight back to SMTP_ADMIN_EMAIL. Using
    // test@greyin.net (plus-addressed for uniqueness, same pattern as
    // before) instead -- a real mailbox under a domain already owned and
    // already routed through the existing SMTP setup, per user direction.
    email: `test+${prefix}-${unique}@greyin.net`,
    password: 'TestPass!2026',
    firstName: 'E2E',
    // lastName used to be just the capitalized prefix (e.g. "B2b-candidate"),
    // identical across every run — after enough accumulated runs, any spec
    // that lists multiple test accounts on one page (candidates, companies,
    // members directories) hit Playwright strict-mode violations from dozens
    // of matching elements. The unique suffix keeps each run's name unique.
    lastName: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)}-${unique.slice(-6)}`,
  }
}
