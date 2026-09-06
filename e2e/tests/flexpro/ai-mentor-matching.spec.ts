import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { createTestGig, getUserIdByEmail, setFutureInterests } from '../../utils/admin'
import { dismissGuidedTourIfShown } from '../../utils/tour'

/**
 * AI moat roadmap item: AI-powered mentor matching (118,
 * lib/mentor-match.ts). Purely additive, real-time ranking (same posture
 * as parse-search-query.ts's NL search) -- the full /mentor-sessions
 * listing always renders unchanged; a viewer with future_interests (087)
 * set and 2+ gigs to choose among may also see a "Recommended for you"
 * section above it. Which of the two seeded gigs the local model actually
 * picks is non-deterministic, so this only asserts the section renders
 * with a valid pick pointing at one of the two real seeded gigs, not a
 * specific ranking outcome.
 */
test('a viewer with stated future interests sees an AI-recommended mentor session above the full listing', async ({ browser, cleanup }) => {
  const seller1Ctx = await browser.newContext()
  const seller1Page = await seller1Ctx.newPage()
  const seller1 = await signUpFlexPro(seller1Page, 'freelancer', cleanup)
  const seller1Id = await getUserIdByEmail(seller1.email)
  await seller1Ctx.close()

  const seller2Ctx = await browser.newContext()
  const seller2Page = await seller2Ctx.newPage()
  const seller2 = await signUpFlexPro(seller2Page, 'freelancer', cleanup)
  const seller2Id = await getUserIdByEmail(seller2.email)
  await seller2Ctx.close()

  const suffix = Date.now()
  const gig1 = await createTestGig(seller1Id, {
    title: `E2E Career Transition Coaching ${suffix}`,
    description: 'One-on-one coaching for engineers pivoting from individual contributor into engineering leadership roles.',
    is_mentor_session: true,
  })
  const gig2 = await createTestGig(seller2Id, {
    title: `E2E Public Speaking Coaching ${suffix}`,
    description: 'Practice sessions for conference talks, public speaking confidence, and stage presence.',
    is_mentor_session: true,
  })

  const viewerCtx = await browser.newContext()
  const viewerPage = await viewerCtx.newPage()
  const viewer = await signUpFlexPro(viewerPage, 'client', cleanup)
  await login(viewerPage, viewer, '/dashboard')
  await dismissGuidedTourIfShown(viewerPage)
  const viewerId = await getUserIdByEmail(viewer.email)
  await setFutureInterests(viewerId, ['engineering leadership', 'career transition'], 'Looking to move from IC into a management track.')

  await viewerPage.goto('/mentor-sessions')
  const recommended = viewerPage.locator('h2', { hasText: 'Recommended for you' })
  await expect(recommended).toBeVisible({ timeout: 30_000 })

  const recommendedSection = recommended.locator('xpath=ancestor::div[contains(@class,"mb-8")][1]')
  const matchesGig1 = await recommendedSection.getByText(gig1.title).count()
  const matchesGig2 = await recommendedSection.getByText(gig2.title).count()
  expect(matchesGig1 + matchesGig2).toBeGreaterThan(0)

  // The full, unfiltered listing is always still there beneath it -- a
  // recommended gig's title legitimately appears twice on the page (once
  // in "Recommended for you", once in the full list), hence .first().
  await expect(viewerPage.getByText(gig1.title).first()).toBeVisible()
  await expect(viewerPage.getByText(gig2.title).first()).toBeVisible()

  await viewerCtx.close()
})
