import type { Page } from '@playwright/test'
import { adminCreateAndConfirmUser, confirmTestUserEmail } from './admin'
import { makeTestUser, type TestUser } from './testUser'
import { waitForURLResilient } from './nav'
import type { Cleanup } from './cleanup'

// ---------------------------------------------------------------------------
// By default every signUpX helper provisions its account via the Supabase
// admin API (adminCreateAndConfirmUser) -- no signup form, no GoTrue email.
// This is what keeps a full suite run from firing ~200 confirmation emails
// through the shared, rate-limited SMTP relay. Pass `viaForm: true` to
// exercise the real signup form + emailed-OTP-confirm path instead. Only
// ONE spec does that now -- deepedge/auth.spec.ts's candidate happy path --
// as an end-to-end smoke of the emailed-OTP flow; more than that and even
// ~10 concurrent form posts trip GoTrue's per-IP "too many signup attempts"
// burst limit under a 4-worker run. The gate-rejection specs still drive
// the form directly, but the route rejects before auth.signUp() so they
// send no email and (being only 3) stay under the burst limit.
// ---------------------------------------------------------------------------

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
 * DeepEdge: role radio is 'employer' | 'candidate'. Signup itself is never
 * rejected (the "allow the account, limit what it can do" model), but
 * candidacy (applying, appearing in employer search) requires Verified
 * Expert status, so `yearsExperience` defaults to 15 to keep every
 * candidate-flow test on the eligible path unless a test explicitly wants
 * an ineligible candidate (pass a value under 12).
 */
export async function signUpDeepEdge(
  page: Page,
  role: 'employer' | 'candidate',
  cleanup: Cleanup,
  yearsExperience = 15,
  baseUrl?: string,
  viaForm = false,
): Promise<TestUser> {
  const user = makeTestUser(`de-${role}`)
  cleanup.trackUser(user.email)
  if (!viaForm) {
    await adminCreateAndConfirmUser(
      user,
      { first_name: user.firstName, last_name: user.lastName, role, years_experience: yearsExperience },
      role,
    )
    return user
  }
  await page.goto(baseUrl ? new URL('/signup', baseUrl).toString() : '/signup')
  await fillCommonSignupFields(page, user)
  await page.locator('#years-experience').fill(String(yearsExperience))
  await page.locator(`input[type="radio"][name="role"][value="${role}"]`).check({ force: true })
  await page.getByRole('button', { name: 'Create account' }).click()
  await waitForVerifyThenConfirm(page, user.email, role, baseUrl)
  return user
}

/**
 * FlexPro: role radio is 'client' | 'freelancer'. Both tracks are gated to
 * 12+ years (or an equivalent Greyin Score). `yearsExperience` under 12
 * always drives the real form — that path is a rejection test, and the
 * route rejects before auth.signUp() so no email is sent either way.
 */
export async function signUpFlexPro(
  page: Page,
  role: 'client' | 'freelancer',
  cleanup: Cleanup,
  yearsExperience = 15,
  baseUrl?: string,
  viaForm = false,
): Promise<TestUser> {
  const user = makeTestUser(`fp-${role}`)
  cleanup.trackUser(user.email)
  if (!viaForm && yearsExperience >= 12) {
    await adminCreateAndConfirmUser(
      user,
      { first_name: user.firstName, last_name: user.lastName, role, years_experience: yearsExperience },
      role,
    )
    return user
  }
  await page.goto(baseUrl ? new URL('/signup', baseUrl).toString() : '/signup')
  await fillCommonSignupFields(page, user)
  await page.locator('#years-experience').fill(String(yearsExperience))
  await page.locator(`input[type="radio"][name="role"][value="${role}"]`).check({ force: true })
  await page.getByRole('button', { name: 'Create account' }).click()
  if (yearsExperience >= 12) {
    await waitForVerifyThenConfirm(page, user.email, role, baseUrl)
  }
  return user
}

/**
 * GreyMatters: no role picker — 12+ years lands as 'author', otherwise
 * 'follower'. Both are real accounts (follower is just limited), so both
 * are provisioned the same way; pass a value under 12 for the follower
 * path.
 */
export async function signUpGreyMatters(
  page: Page,
  cleanup: Cleanup,
  yearsExperience = 15,
  baseUrl?: string,
  viaForm = false,
): Promise<TestUser> {
  const user = makeTestUser('gm')
  cleanup.trackUser(user.email)
  const role = yearsExperience >= 12 ? 'author' : 'follower'
  if (!viaForm) {
    await adminCreateAndConfirmUser(
      user,
      { first_name: user.firstName, last_name: user.lastName, role, years_experience: yearsExperience },
      role,
    )
    return user
  }
  await page.goto(baseUrl ? new URL('/signup', baseUrl).toString() : '/signup')
  await fillCommonSignupFields(page, user)
  await page.locator('#years-experience').fill(String(yearsExperience))
  await page.getByRole('button', { name: 'Create account' }).click()
  await waitForVerifyThenConfirm(page, user.email, role, baseUrl)
  return user
}

/**
 * Salt & Pepper: requires years_experience >= 12 to pass the signup gate;
 * every helper caller uses an eligible value (the rejection path is tested
 * by saltnpepper/auth.spec.ts driving the form directly).
 */
export async function signUpSaltNPepper(
  page: Page,
  cleanup: Cleanup,
  baseUrl?: string,
  viaForm = false,
): Promise<TestUser> {
  const user = makeTestUser('sp')
  cleanup.trackUser(user.email)
  if (!viaForm) {
    await adminCreateAndConfirmUser(
      user,
      { first_name: user.firstName, last_name: user.lastName, role: 'member', years_experience: 15 },
      'member',
    )
    return user
  }
  await page.goto(baseUrl ? new URL('/signup', baseUrl).toString() : '/signup')
  await fillCommonSignupFields(page, user)
  await page.locator('#years-experience').fill('15')
  await page.getByRole('button', { name: 'Request access' }).click()
  await waitForVerifyThenConfirm(page, user.email, 'member', baseUrl)
  return user
}

/**
 * StackWorks: track radio is 'builder' | 'supporter'. Builder reuses the
 * 12+-years gate and lands on role='member'; Supporter has no gate and
 * lands on role='supporter'. Both carry stackworks_role in metadata.
 */
export async function signUpStackWorksBuilder(
  page: Page,
  cleanup: Cleanup,
  baseUrl?: string,
  viaForm = false,
): Promise<TestUser> {
  const user = makeTestUser('sw-builder')
  cleanup.trackUser(user.email)
  if (!viaForm) {
    await adminCreateAndConfirmUser(
      user,
      { first_name: user.firstName, last_name: user.lastName, role: 'member', stackworks_role: 'builder', years_experience: 15 },
      'member',
    )
    return user
  }
  await page.goto(baseUrl ? new URL('/signup', baseUrl).toString() : '/signup')
  await fillCommonSignupFields(page, user)
  await page.locator('input[type="radio"][name="track"][value="builder"]').check({ force: true })
  await page.locator('#years-experience').fill('15')
  await page.getByRole('button', { name: 'Create account' }).click()
  await waitForVerifyThenConfirm(page, user.email, 'member', baseUrl)
  return user
}

export async function signUpStackWorksSupporter(page: Page, cleanup: Cleanup, viaForm = false): Promise<TestUser> {
  const user = makeTestUser('sw-supporter')
  cleanup.trackUser(user.email)
  if (!viaForm) {
    await adminCreateAndConfirmUser(
      user,
      { first_name: user.firstName, last_name: user.lastName, role: 'supporter', stackworks_role: 'supporter', years_experience: 0 },
      'supporter',
    )
    return user
  }
  await page.goto('/signup')
  await fillCommonSignupFields(page, user)
  await page.locator('input[type="radio"][name="track"][value="supporter"]').check({ force: true })
  await page.getByRole('button', { name: 'Create account' }).click()
  await waitForVerifyThenConfirm(page, user.email, 'supporter')
  return user
}

/**
 * Longlist: no track/experience gate — role is always the base 'candidate'
 * value DeepEdge candidates get (posting a future role is gated on having
 * a company, created via DeepEdge, not on anything set at Longlist signup).
 */
export async function signUpLongList(
  page: Page,
  cleanup: Cleanup,
  baseUrl?: string,
  viaForm = false,
): Promise<TestUser> {
  const user = makeTestUser('ll')
  cleanup.trackUser(user.email)
  if (!viaForm) {
    await adminCreateAndConfirmUser(
      user,
      { first_name: user.firstName, last_name: user.lastName, role: 'candidate' },
      'candidate',
    )
    return user
  }
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
export async function login(
  page: Page,
  user: TestUser,
  expectedUrl: string | RegExp,
  baseUrl?: string,
  { suppressTour = true }: { suppressTour?: boolean } = {},
) {
  if (suppressTour) {
    // GuidedTour auto-starts ~600ms after a fresh user's first authenticated
    // page load and its full-viewport overlay blocks clicks until dismissed.
    // Nearly every authenticated spec clicks something immediately after
    // landing, so opt the whole suite out at the source rather than sprinkling
    // dismiss-if-shown into dozens of call sites. guided-tour.spec.ts and
    // analytics-events.spec.ts, which assert on the tour itself, pass
    // { suppressTour: false }. addInitScript is context-wide and re-runs on
    // every navigation, so this one call covers the post-login redirect and
    // any later same-context pages too.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('greyin:e2e-no-tour', '1')
      } catch {
        /* storage blocked -- the tour will just auto-start, same as a real user */
      }
    })
  }
  await page.goto(baseUrl ? new URL('/login', baseUrl).toString() : '/login')
  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await waitForURLResilient(page, expectedUrl, () =>
    page.getByRole('button', { name: 'Sign in' }).click()
  )
}
