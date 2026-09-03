import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, signUpFlexPro, login } from '../../utils/auth'
import { mockRazorpayCheckout } from '../../utils/razorpay'

const isLocal = process.env.E2E_TARGET === 'local'
const greyinB2BBase = isLocal ? `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}` : 'https://deepedge.greyin.net'

/**
 * Bookable mentor sessions reuse FlexPro's own gig/order/Razorpay
 * infrastructure (056_mentor_sessions.sql) -- a mentor flips is_mentor
 * on their DeepEdge profile (a Verified Expert gate, hence 15 years
 * experience on signup), then creates session types/slots on FlexPro.
 * Covers both the free path (books instantly, no Razorpay involved)
 * and the paid path (through the mocked Razorpay checkout, same
 * pattern as checkout-payment.spec.ts).
 */
test('a mentor can offer free and paid sessions, and a supporter can book both', async ({ browser, cleanup }) => {
  const mentorCtx = await browser.newContext()
  const mentorPage = await mentorCtx.newPage()
  const mentor = await signUpDeepEdge(mentorPage, 'candidate', cleanup, 15, greyinB2BBase)
  await login(mentorPage, mentor, `${greyinB2BBase}/dashboard`, greyinB2BBase)

  await mentorPage.goto(`${greyinB2BBase}/profile`)
  await mentorPage.locator('input[name="is_mentor"]').check()
  await mentorPage.locator('input[name="mentor_domain"]').fill('E2E Mentor Sessions Domain')
  await mentorPage.getByRole('button', { name: 'Save Mentor Availability' }).click()

  // Same account, same shared session (SSO), now on FlexPro.
  await mentorPage.goto('/mentor-sessions/manage')

  // Scoped to the top-level "New session type" form -- once a gig exists,
  // its own "Add package" mini-form (062_mentor_monetization.sql) also has
  // an input[name="title"], which trips Playwright's strict mode on a bare
  // locator.
  const newGigForm = mentorPage.locator('form[action="/api/mentor-sessions/gigs"]')

  const freeTitle = `E2E Free Session ${Date.now()}`
  await newGigForm.locator('input[name="title"]').fill(freeTitle)
  await newGigForm.locator('textarea[name="description"]').fill('A free intro chat.')
  await newGigForm.locator('input[name="is_free"]').check()
  await newGigForm.getByRole('button', { name: 'Create' }).click()
  await mentorPage.waitForURL('/mentor-sessions/manage')

  const paidTitle = `E2E Paid Session ${Date.now()}`
  await newGigForm.locator('input[name="title"]').fill(paidTitle)
  await newGigForm.locator('textarea[name="description"]').fill('A paid deep-dive session.')
  await newGigForm.locator('input[name="price"]').fill('2000')
  await newGigForm.getByRole('button', { name: 'Create' }).click()
  await mentorPage.waitForURL('/mentor-sessions/manage')

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const freeCard = mentorPage.locator('div.border', { hasText: freeTitle })
  await freeCard.locator('input[name="date"]').fill(tomorrow)
  await freeCard.locator('input[name="start_time"]').fill('10:00')
  await freeCard.locator('input[name="end_time"]').fill('10:15')
  await freeCard.getByRole('button', { name: 'Add slot' }).click()
  await mentorPage.waitForURL('/mentor-sessions/manage')

  const paidCard = mentorPage.locator('div.border', { hasText: paidTitle })
  await paidCard.locator('input[name="date"]').fill(tomorrow)
  await paidCard.locator('input[name="start_time"]').fill('14:00')
  await paidCard.locator('input[name="end_time"]').fill('14:30')
  await paidCard.getByRole('button', { name: 'Add slot' }).click()
  await mentorPage.waitForURL('/mentor-sessions/manage')

  await mentorCtx.close()

  const supporterCtx = await browser.newContext()
  const supporterPage = await supporterCtx.newPage()
  const supporter = await signUpFlexPro(supporterPage, 'client', cleanup)
  await login(supporterPage, supporter, '/dashboard')

  // Free session: books instantly, lands straight on the order page.
  await supporterPage.goto('/mentor-sessions')
  await supporterPage.getByRole('link', { name: new RegExp(freeTitle) }).click()
  await supporterPage.getByRole('button', { name: 'Book' }).click()
  await supporterPage.waitForURL(/\/orders\/[^/]+$/)
  await expect(supporterPage.getByText(freeTitle)).toBeVisible()

  // Paid session: books into 'pending', routes through checkout with a
  // mocked Razorpay, then lands on the order page once verified.
  await mockRazorpayCheckout(supporterPage)
  await supporterPage.goto('/mentor-sessions')
  await supporterPage.getByRole('link', { name: new RegExp(paidTitle) }).click()
  await supporterPage.getByRole('button', { name: 'Book' }).click()
  await supporterPage.waitForURL(/\/mentor-sessions\/checkout\/[^/]+$/)
  await supporterPage.getByRole('button', { name: 'Pay & confirm' }).click()
  await supporterPage.waitForURL(/\/orders\/[^/]+$/)
  await expect(supporterPage.getByText(paidTitle)).toBeVisible()

  await supporterCtx.close()
})
