import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { getUserIdByEmail, grantFreeagentSubscription, setSellerRating } from '../../utils/admin'

/**
 * Positive-case coverage for the FlexPro "Top Tier" badge (auto-
 * threshold read of greyin_scores: is_verified_expert AND
 * flexpro_score >= 85 AND flexpro_evidence >= 3), completing the
 * negative-only coverage in top-tier-badge.spec.ts. Found and fixed a
 * real bug while scoping this: the badge was checking
 * flexpro_headcount (a platform-wide constant -- how many sellers
 * *anyone* has reviews) instead of flexpro_evidence (this seller's
 * own review count) -- the >=3 check was effectively a no-op on any
 * live platform with more than 3 reviewed sellers, ever.
 *
 * greyin_scores is a Bayesian-shrunk blend against a platform-wide
 * mean that shifts with real traffic, so seller_rating/total_reviews
 * are seeded directly (setSellerRating) rather than through 50 real
 * completed orders -- see that helper's own comment for the math.
 */
test('a seller with a strong, deep rating history shows the Top Tier badge', async ({ page, cleanup }) => {
  const freelancer = await signUpFlexPro(page, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(freelancer.email))
  await login(page, freelancer, '/dashboard')
  const freelancerId = await getUserIdByEmail(freelancer.email)
  await setSellerRating(freelancerId, 5.0, 50)

  const gigTitle = `E2E Elevated Tier Positive Gig ${Date.now()}`
  await page.goto('/gigs/new')
  await page.locator('#title').fill(gigTitle)
  await page.locator('#description').fill('Used to verify the elevated-tier badge shows with a strong rating history.')
  await page.locator('#price_min').fill('500')
  await page.getByRole('button', { name: 'Publish Gig' }).click()

  await page.goto('/gigs')
  await page.getByText(gigTitle).click()
  await page.waitForURL(/\/gigs\//)

  await expect(page.getByText('Top Tier')).toBeVisible()

  await page.goto(`/sellers/${freelancerId}`)
  await expect(page.getByText('Top Tier')).toBeVisible()
})
