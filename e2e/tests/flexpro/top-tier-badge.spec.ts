import { test, expect } from '../../utils/fixtures'
import { getUserIdByEmail, grantFreeagentSubscription } from '../../utils/admin'
import { signUpFlexPro, login } from '../../utils/auth'

/**
 * FlexPro "Top Tier" badge (competitive audit, Aug 2026) -- an
 * auto-threshold read of greyin_scores (is_verified_expert AND
 * flexpro_score >= 85 AND flexpro_headcount >= 3), addressing the
 * gap against Toptal's screened-admission tier.
 *
 * greyin_scores is a Bayesian-shrunk view over platform-wide evidence
 * (036) -- crossing the exact threshold isn't reproducible from a
 * single e2e run without a test-only override that doesn't exist, so
 * this covers the negative case: a freshly signed-up freelancer with
 * no track record must never show the badge. The positive case is
 * exercised manually / left as a documented coverage gap.
 */
test('a freelancer with no track record never shows the Top Tier badge', async ({ page, cleanup }) => {
  const freelancer = await signUpFlexPro(page, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(freelancer.email))
  await login(page, freelancer, '/dashboard')

  const gigTitle = `E2E No Track Record Gig ${Date.now()}`
  await page.goto('/gigs/new')
  await page.locator('#title').fill(gigTitle)
  await page.locator('#description').fill('Used to verify the elevated-tier badge stays hidden with no track record.')
  await page.locator('#price_min').fill('500')
  await page.getByRole('button', { name: 'Publish Gig' }).click()

  await page.goto('/gigs')
  await page.getByText(gigTitle).click()
  await page.waitForURL(/\/gigs\//)

  await expect(page.getByText('Top Tier')).not.toBeVisible()
})
