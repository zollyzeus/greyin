import { test, expect } from '../../utils/fixtures'
import { getUserIdByEmail, grantFreeagentSubscription, setYearsExperience } from '../../utils/admin'
import { signUpFlexPro, login } from '../../utils/auth'

// Emergent-parity gap #4: gigs priced above a high-value threshold require
// a verified-expert profile (greyin_scores.is_verified_expert), mirroring
// Emergent's own price-vs-experience anti-fraud gate
// (backend/routers/freeagent.py:62-68) which FlexPro previously had no
// equivalent of at all -- any freelancer could list at any price.
test.describe('FlexPro high-price gig gate', () => {
  test('a non-expert freelancer is blocked from listing a gig above ₹25,000', async ({ page, cleanup }) => {
    const freelancer = await signUpFlexPro(page, 'freelancer', cleanup)
    const userId = await getUserIdByEmail(freelancer.email)
    // Drop below platform_gate_settings.min_years_experience -- a fresh
    // account has no evidence yet, so greyin_score is null and
    // is_verified_expert becomes false once years drop too.
    await setYearsExperience(userId, 2)
    await grantFreeagentSubscription(userId)
    await login(page, freelancer, '/dashboard')

    await page.goto('/gigs/new')
    const gigTitle = `E2E High Price Gig ${Date.now()}`
    await page.locator('#title').fill(gigTitle)
    await page.locator('#description').fill('Should be blocked by the price gate.')
    await page.locator('#price_min').fill('20000')
    await page.locator('#price_max').fill('30000')
    await page.getByRole('button', { name: 'Publish Gig' }).click()

    await page.waitForURL(/\/gigs\/new/)
    await expect(page.getByText(/verified-expert profile/)).toBeVisible()
    await expect(page.getByText(gigTitle)).not.toBeVisible()
  })

  test('a verified-expert freelancer can list a gig above ₹25,000', async ({ page, cleanup }) => {
    // Default signUpFlexPro years_experience (15) already clears
    // platform_gate_settings.min_years_experience (12).
    const freelancer = await signUpFlexPro(page, 'freelancer', cleanup)
    await grantFreeagentSubscription(await getUserIdByEmail(freelancer.email))
    await login(page, freelancer, '/dashboard')

    await page.goto('/gigs/new')
    const gigTitle = `E2E Verified High Price Gig ${Date.now()}`
    await page.locator('#title').fill(gigTitle)
    await page.locator('#description').fill('A verified expert listing a premium gig.')
    await page.locator('#price_min').fill('20000')
    await page.locator('#price_max').fill('30000')
    await page.getByRole('button', { name: 'Publish Gig' }).click()

    await page.waitForURL(/\/gigs\/[^/]+$/)
    await expect(page.getByText(gigTitle)).toBeVisible()
  })

  test('a non-expert freelancer can still list a normal-priced gig (regression)', async ({ page, cleanup }) => {
    const freelancer = await signUpFlexPro(page, 'freelancer', cleanup)
    const userId = await getUserIdByEmail(freelancer.email)
    await setYearsExperience(userId, 2)
    await grantFreeagentSubscription(userId)
    await login(page, freelancer, '/dashboard')

    await page.goto('/gigs/new')
    const gigTitle = `E2E Normal Price Gig ${Date.now()}`
    await page.locator('#title').fill(gigTitle)
    await page.locator('#description').fill('A normal, unrestricted price gig.')
    await page.locator('#price_min').fill('1000')
    await page.locator('#price_max').fill('5000')
    await page.getByRole('button', { name: 'Publish Gig' }).click()

    await page.waitForURL(/\/gigs\/[^/]+$/)
    await expect(page.getByText(gigTitle)).toBeVisible()
  })
})
