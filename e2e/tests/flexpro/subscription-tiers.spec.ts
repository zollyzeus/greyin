import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { getUserIdByEmail, grantFreeagentSubscriptionTier } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

// 096: posting is credit-metered per tier, not just gated on "any
// active subscription". 'basic' seeds 5 gig_post credits/mo -- rather
// than posting 5 real gigs to reach the ceiling, pre-consume 4 of
// them directly (same "grant directly, don't drive the real flow
// pixel-by-pixel" precedent as every other subscription helper here),
// leaving exactly 1 credit so the test only needs to post twice: once
// that should succeed, once that should be blocked.
test('posting is capped by the subscriber\'s tier credit allowance, and blocked once exhausted', async ({ page, cleanup }) => {
  const seller = await signUpFlexPro(page, 'freelancer', cleanup)
  const userId = await getUserIdByEmail(seller.email)
  await grantFreeagentSubscriptionTier(userId, 'basic')

  const periodStart = new Date()
  periodStart.setDate(1)
  const periodStartStr = periodStart.toISOString().slice(0, 10)

  const preConsumeRes = await fetch(`${SUPABASE_URL}/rest/v1/credit_usage?on_conflict=user_id,product,credit_type,period_start`, {
    method: 'POST',
    headers: { ...restHeaders(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: userId,
      product: 'flexpro_posting',
      credit_type: 'gig_post',
      period_start: periodStartStr,
      used_count: 4,
    }),
  })
  expect(preConsumeRes.ok).toBeTruthy()

  await login(page, seller, '/dashboard')

  // 5th credit -- should succeed.
  const firstGigTitle = `E2E Tier Credit Gig 1 ${Date.now()}`
  await page.goto('/gigs/new')
  await page.locator('#title').fill(firstGigTitle)
  await page.locator('#description').fill('Uses the last remaining posting credit on the basic tier.')
  await page.locator('#price_min').fill('500')
  await page.getByRole('button', { name: 'Publish Gig' }).click()
  await page.waitForURL(/\/gigs\/[^/]+$/)
  await expect(page.getByText(firstGigTitle)).toBeVisible()

  // 6th credit -- allowance exhausted, should redirect to /subscribe
  // with an explanatory error rather than publish.
  const secondGigTitle = `E2E Tier Credit Gig 2 ${Date.now()}`
  await page.goto('/gigs/new')
  await page.locator('#title').fill(secondGigTitle)
  await page.locator('#description').fill('Should be blocked -- no credits left this month.')
  await page.locator('#price_min').fill('500')
  await page.getByRole('button', { name: 'Publish Gig' }).click()
  await page.waitForURL(/\/subscribe/)
  await expect(page.getByText(/used all your gig\/job posting credits/i)).toBeVisible()
})
