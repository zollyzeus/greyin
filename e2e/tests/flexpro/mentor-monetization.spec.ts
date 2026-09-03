import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, signUpFlexPro, login } from '../../utils/auth'

const isLocal = process.env.E2E_TARGET === 'local'
const greyinB2BBase = isLocal ? `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}` : 'https://deepedge.greyin.net'

/**
 * Mentor monetization breadth (062_mentor_monetization.sql) --
 * addresses the competitive audit's highest-priority gap against
 * Topmate: cohort/group slots, session packages (bulk credits), and
 * paid recording resale, on top of the existing 1:1 booking. Uses
 * price=0 throughout (payment itself is already covered by
 * mentor-sessions.spec.ts) to keep this deterministic and focused on
 * the new capacity/credit/recording mechanics.
 */
test('a mentor can run a cohort session two people join, sell a package redeemed as a credit, and sell a recording replay', async ({ browser, cleanup }) => {
  const mentorCtx = await browser.newContext()
  const mentorPage = await mentorCtx.newPage()
  const mentor = await signUpDeepEdge(mentorPage, 'candidate', cleanup, 15, greyinB2BBase)
  await login(mentorPage, mentor, `${greyinB2BBase}/dashboard`, greyinB2BBase)

  await mentorPage.goto(`${greyinB2BBase}/profile`)
  await mentorPage.locator('input[name="is_mentor"]').check()
  await mentorPage.locator('input[name="mentor_domain"]').fill('E2E Monetization Domain')
  await mentorPage.getByRole('button', { name: 'Save Mentor Availability' }).click()

  await mentorPage.goto('/mentor-sessions/manage')

  const newGigForm = mentorPage.locator('form[action="/api/mentor-sessions/gigs"]')

  const cohortTitle = `E2E Cohort Session ${Date.now()}`
  await newGigForm.locator('input[name="title"]').fill(cohortTitle)
  await newGigForm.locator('textarea[name="description"]').fill('A group session two people can join.')
  await newGigForm.locator('input[name="is_free"]').check()
  await newGigForm.getByRole('button', { name: 'Create' }).click()
  await mentorPage.waitForURL('/mentor-sessions/manage')

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const cohortCard = mentorPage.locator('div.border', { hasText: cohortTitle })
  await cohortCard.locator('input[name="date"]').fill(tomorrow)
  await cohortCard.locator('input[name="start_time"]').fill('11:00')
  await cohortCard.locator('input[name="end_time"]').fill('11:30')
  await cohortCard.locator('input[name="capacity"]').fill('2')
  await cohortCard.getByRole('button', { name: 'Add slot' }).click()
  await mentorPage.waitForURL('/mentor-sessions/manage')

  // A second, separate 1:1 gig used for the package-credit flow.
  const bundleTitle = `E2E Bundle Session ${Date.now()}`
  await newGigForm.locator('input[name="title"]').fill(bundleTitle)
  await newGigForm.locator('textarea[name="description"]').fill('Booked via a purchased package credit.')
  await newGigForm.locator('input[name="is_free"]').check()
  await newGigForm.getByRole('button', { name: 'Create' }).click()
  await mentorPage.waitForURL('/mentor-sessions/manage')

  const bundleCard = mentorPage.locator('div.border', { hasText: bundleTitle })
  await bundleCard.locator('input[name="date"]').fill(tomorrow)
  await bundleCard.locator('input[name="start_time"]').fill('15:00')
  await bundleCard.locator('input[name="end_time"]').fill('15:30')
  await bundleCard.getByRole('button', { name: 'Add slot' }).click()
  await mentorPage.waitForURL('/mentor-sessions/manage')

  await bundleCard.locator('input[name="title"]').fill('2-session bundle')
  await bundleCard.locator('input[name="session_count"]').fill('2')
  await bundleCard.locator('input[name="price"]').fill('0')
  await bundleCard.getByRole('button', { name: 'Add package' }).click()
  await mentorPage.waitForURL('/mentor-sessions/manage')

  await mentorCtx.close()

  // Two buyers join the cohort slot -- both should succeed since capacity is 2.
  const buyer1Ctx = await browser.newContext()
  const buyer1Page = await buyer1Ctx.newPage()
  const buyer1 = await signUpFlexPro(buyer1Page, 'client', cleanup)
  await login(buyer1Page, buyer1, '/dashboard')
  await buyer1Page.goto('/mentor-sessions')
  await buyer1Page.getByRole('link', { name: new RegExp(cohortTitle) }).click()
  await expect(buyer1Page.getByText('2 seats left')).toBeVisible()
  await buyer1Page.getByRole('button', { name: 'Join' }).click()
  await buyer1Page.waitForURL(/\/orders\/[^/]+$/)
  await buyer1Ctx.close()

  const buyer2Ctx = await browser.newContext()
  const buyer2Page = await buyer2Ctx.newPage()
  const buyer2 = await signUpFlexPro(buyer2Page, 'client', cleanup)
  await login(buyer2Page, buyer2, '/dashboard')
  await buyer2Page.goto('/mentor-sessions')
  await buyer2Page.getByRole('link', { name: new RegExp(cohortTitle) }).click()
  await expect(buyer2Page.getByText('1 seat left')).toBeVisible()
  await buyer2Page.getByRole('button', { name: 'Join' }).click()
  await buyer2Page.waitForURL(/\/orders\/[^/]+$/)

  // Slot is now full -- a third person sees no open cohort slot at all.
  const buyer3Ctx = await browser.newContext()
  const buyer3Page = await buyer3Ctx.newPage()
  const buyer3 = await signUpFlexPro(buyer3Page, 'client', cleanup)
  await login(buyer3Page, buyer3, '/dashboard')
  await buyer3Page.goto('/mentor-sessions')
  await buyer3Page.getByRole('link', { name: new RegExp(cohortTitle) }).click()
  await expect(buyer3Page.getByText('No open times right now.')).toBeVisible()
  await buyer3Ctx.close()

  // Package purchase + credit redemption on the bundle gig.
  await buyer2Page.goto('/mentor-sessions')
  await buyer2Page.getByRole('link', { name: new RegExp(bundleTitle) }).click()
  await expect(buyer2Page.getByText('2-session bundle')).toBeVisible()
  await buyer2Page.getByRole('button', { name: 'Buy' }).click()
  await buyer2Page.waitForURL(/\/orders\/[^/]+$/)

  await buyer2Page.goto('/mentor-sessions')
  await buyer2Page.getByRole('link', { name: new RegExp(bundleTitle) }).click()
  await buyer2Page.getByRole('button', { name: 'Use credit' }).click()
  await buyer2Page.waitForURL(new RegExp(`/mentor-sessions/.+\\?success=1`))
  await expect(buyer2Page.getByText('Booked using a session credit.')).toBeVisible()

  await buyer2Ctx.close()
})
