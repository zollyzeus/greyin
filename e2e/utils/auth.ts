import type { Page } from '@playwright/test'
import { confirmTestUserEmail } from './admin'
import { makeTestUser, type TestUser } from './testUser'
import { waitForURLResilient } from './nav'
import type { Cleanup } from './cleanup'

async function fillCommonSignupFields(page: Page, user: TestUser) {
  await page.locator('#first-name').fill(user.firstName)
  await page.locator('#last-name').fill(user.lastName)
  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(user.password)
  await page.locator('#confirm-password').fill(user.password)
  await page.locator('#terms').check()
}

/**
 * Signups land on /verify (waiting for the emailed 6-digit code) rather
 * than completing immediately — profiles/companies/candidates rows are
 * only finalized by a DB trigger once email_confirmed_at is set. The e2e
 * suite bypasses actually reading a real inbox by confirming through the
 * Supabase Admin API, which sets that same column and fires the same
 * trigger a real OTP entry would. Passing expectedRole makes the confirm
 * helper poll until that trigger's effect is actually visible before
 * returning, rather than racing straight into login.
 */
async function waitForVerifyThenConfirm(page: Page, email: string, expectedRole: string, baseUrl?: string) {
  try {
    await page.waitForURL(/\/verify/, { timeout: 20_000 })
  } catch {
    // The signup POST already succeeded server-side (it's what sent us here
    // in the first place) even when the client-side navigation itself gets
    // stuck on chrome-error://chromewebdata under machine load — the target
    // URL is deterministic, so just go there directly instead of failing.
    const path = `/verify?email=${encodeURIComponent(email)}`
    await page.goto(baseUrl ? new URL(path, baseUrl).toString() : path)
  }
  await confirmTestUserEmail(email, expectedRole)
}

/**
 * DeepEdge (codebase/e2e project renamed from greyin-b2b 2026-09-03,
 * itself rebranded from ExpertEdge earlier): role radio is
 * 'employer' | 'candidate'. Signup itself is never rejected (the "allow
 * the account, limit what it can do" model), but candidacy (applying,
 * appearing in employer search) requires Verified Expert status, so
 * `yearsExperience` defaults to 15 to keep every existing
 * candidate-flow test exercising the eligible path unless a test
 * explicitly wants an ineligible candidate (pass a value under 12).
 * Test-user prefix updated from `b2b-` to `de-`, matching flexpro's
 * `fp-`/stackworks's `sw-` convention.
 */
export async function signUpDeepEdge(page: Page, role: 'employer' | 'candidate', cleanup: Cleanup, yearsExperience = 15, baseUrl?: string): Promise<TestUser> {
  const user = makeTestUser(`de-${role}`)
  // Tracked before the signup flow even runs — the signup POST can succeed
  // server-side (creating the auth.users row) even when the client-side
  // navigation that follows it gets stuck (see waitForVerifyThenConfirm),
  // so this must not depend on the UI flow finishing to guarantee cleanup.
  cleanup.trackUser(user.email)
  await page.goto(baseUrl ? new URL('/signup', baseUrl).toString() : '/signup')
  await fillCommonSignupFields(page, user)
  await page.locator('#years-experience').fill(String(yearsExperience))
  // The role radios are visually hidden (sr-only) in favor of styled labels;
  // force bypasses Playwright's visibility check but still fires the native
  // change event the page's own script listens on to sync the hidden field.
  await page.locator(`input[type="radio"][name="role"][value="${role}"]`).check({ force: true })
  await page.getByRole('button', { name: 'Create account' }).click()
  await waitForVerifyThenConfirm(page, user.email, role, baseUrl)
  return user
}

/**
 * FlexPro (codebase/e2e project renamed from FreeAgent 2026-09-02): role
 * radio is 'client' | 'freelancer'. Both tracks are gated to 12+ years
 * experience (or an equivalent Greyin Score) — `yearsExperience` defaults
 * to 15 so every existing test exercising the app's normal flows keeps
 * working; pass a value under 12 to exercise the rejection path.
 * `baseUrl`, when passed, overrides the calling Playwright project's own
 * baseURL for the goto calls — needed by cross-platform tests whose project
 * baseURL points at a different app than the one this helper drives.
 */
export async function signUpFlexPro(page: Page, role: 'client' | 'freelancer', cleanup: Cleanup, yearsExperience = 15, baseUrl?: string): Promise<TestUser> {
  const user = makeTestUser(`fp-${role}`)
  cleanup.trackUser(user.email)
  await page.goto(baseUrl ? new URL('/signup', baseUrl).toString() : '/signup')
  await fillCommonSignupFields(page, user)
  await page.locator('#years-experience').fill(String(yearsExperience))
  // The role radios are visually hidden (sr-only) in favor of styled labels;
  // force bypasses Playwright's visibility check but still fires the native
  // change event the page's own script listens on to sync the hidden field.
  await page.locator(`input[type="radio"][name="role"][value="${role}"]`).check({ force: true })
  await page.getByRole('button', { name: 'Create account' }).click()
  if (yearsExperience >= 12) {
    await waitForVerifyThenConfirm(page, user.email, role, baseUrl)
  }
  return user
}

/**
 * GreyMatters: no role picker — 12+ years lands as 'author', otherwise
 * 'follower'. Defaults to 15 so every existing test exercising authorship
 * (posting, editing) keeps working; pass a value under 12 to exercise the
 * follower path. `baseUrl`, when passed, overrides the calling Playwright
 * project's own baseURL for the goto calls — needed by cross-platform
 * tests whose project baseURL points at a different app than the one
 * this helper drives.
 */
export async function signUpGreyMatters(page: Page, cleanup: Cleanup, yearsExperience = 15, baseUrl?: string): Promise<TestUser> {
  const user = makeTestUser('gm')
  cleanup.trackUser(user.email)
  await page.goto(baseUrl ? new URL('/signup', baseUrl).toString() : '/signup')
  await fillCommonSignupFields(page, user)
  await page.locator('#years-experience').fill(String(yearsExperience))
  await page.getByRole('button', { name: 'Create account' }).click()
  await waitForVerifyThenConfirm(page, user.email, yearsExperience >= 12 ? 'author' : 'follower', baseUrl)
  return user
}

/**
 * Salt & Pepper: requires years_experience >= 12 to pass the signup gate.
 * `baseUrl`, when passed, overrides the calling Playwright project's own
 * baseURL for the goto calls — needed by cross-platform tests whose project
 * baseURL points at a different app than the one this helper drives.
 */
export async function signUpSaltNPepper(page: Page, cleanup: Cleanup, baseUrl?: string): Promise<TestUser> {
  const user = makeTestUser('sp')
  cleanup.trackUser(user.email)
  await page.goto(baseUrl ? new URL('/signup', baseUrl).toString() : '/signup')
  await fillCommonSignupFields(page, user)
  await page.locator('#years-experience').fill('15')
  await page.getByRole('button', { name: 'Request access' }).click()
  await waitForVerifyThenConfirm(page, user.email, 'member', baseUrl)
  return user
}

/**
 * StackWorks (codebase/e2e project renamed from StackEdge 2026-09-03,
 * itself renamed from Prolab earlier): track radio is
 * 'builder' | 'supporter'. Builder reuses the same 12+-years gate as
 * Salt & Pepper (and lands on role='member', same as that signup) --
 * Supporter has no gate at all. Test-user prefixes updated from the
 * still-older 'pl-' (Prolab) to 'sw-', matching flexpro's own 'fp-'
 * convention.
 */
export async function signUpStackWorksBuilder(page: Page, cleanup: Cleanup, baseUrl?: string): Promise<TestUser> {
  const user = makeTestUser('sw-builder')
  cleanup.trackUser(user.email)
  await page.goto(baseUrl ? new URL('/signup', baseUrl).toString() : '/signup')
  await fillCommonSignupFields(page, user)
  await page.locator('input[type="radio"][name="track"][value="builder"]').check({ force: true })
  await page.locator('#years-experience').fill('15')
  await page.getByRole('button', { name: 'Create account' }).click()
  await waitForVerifyThenConfirm(page, user.email, 'member', baseUrl)
  return user
}

export async function signUpStackWorksSupporter(page: Page, cleanup: Cleanup): Promise<TestUser> {
  const user = makeTestUser('sw-supporter')
  cleanup.trackUser(user.email)
  await page.goto('/signup')
  await fillCommonSignupFields(page, user)
  await page.locator('input[type="radio"][name="track"][value="supporter"]').check({ force: true })
  await page.getByRole('button', { name: 'Create account' }).click()
  await waitForVerifyThenConfirm(page, user.email, 'supporter')
  return user
}

/**
 * Longlist: no track/experience gate at all -- role is always the same
 * base 'candidate' value DeepEdge candidates get, since posting a
 * future role is gated on having a company (created via DeepEdge),
 * not on anything set at Longlist signup itself. `baseUrl`, when
 * passed, overrides the calling Playwright project's own baseURL --
 * needed by cross-platform tests whose project baseURL points at a
 * different app than this one.
 */
export async function signUpLongList(page: Page, cleanup: Cleanup, baseUrl?: string): Promise<TestUser> {
  const user = makeTestUser('ll')
  cleanup.trackUser(user.email)
  await page.goto(baseUrl ? new URL('/signup', baseUrl).toString() : '/signup')
  await fillCommonSignupFields(page, user)
  await page.getByRole('button', { name: 'Create account' }).click()
  await waitForVerifyThenConfirm(page, user.email, 'candidate', baseUrl)
  return user
}

/**
 * `expectedUrl` is required rather than left to the caller's own
 * `waitForURL` because the post-login redirect is exactly the kind of
 * navigation that occasionally lands on chrome-error://chromewebdata under
 * this shared server's load — folding the wait in here lets it retry just
 * the "Sign in" click instead of the whole test.
 */
export async function login(page: Page, user: TestUser, expectedUrl: string | RegExp, baseUrl?: string) {
  await page.goto(baseUrl ? new URL('/login', baseUrl).toString() : '/login')
  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await waitForURLResilient(page, expectedUrl, () =>
    page.getByRole('button', { name: 'Sign in' }).click()
  )
}
