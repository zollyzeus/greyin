import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function getTier(tierKey: string): Promise<{ id: string; price_inr: number; razorpay_plan_id: string | null }> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/subscription_tiers?product=eq.flexpro_posting&tier_key=eq.${tierKey}&select=id,price_inr,razorpay_plan_id`,
    { headers: restHeaders() }
  )
  const rows = await res.json()
  return rows[0]
}

async function getGigPostAllowance(tierId: string): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/subscription_tier_credits?tier_id=eq.${tierId}&credit_type=eq.gig_post&select=monthly_allowance`,
    { headers: restHeaders() }
  )
  const rows = await res.json()
  return rows[0].monthly_allowance
}

async function patchTier(tierId: string, patch: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscription_tiers?id=eq.${tierId}`, {
    method: 'PATCH',
    headers: restHeaders(),
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    throw new Error(`Failed to patch subscription_tiers ${tierId}: ${res.status} ${await res.text()}`)
  }
}

async function patchGigPostAllowance(tierId: string, allowance: number): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscription_tier_credits?tier_id=eq.${tierId}&credit_type=eq.gig_post`, {
    method: 'PATCH',
    headers: restHeaders(),
    body: JSON.stringify({ monthly_allowance: allowance }),
  })
  if (!res.ok) {
    throw new Error(`Failed to patch gig_post allowance for tier ${tierId}: ${res.status} ${await res.text()}`)
  }
}

// A tier's razorpay_plan_id is created lazily on first checkout and cached
// forever on the tier row (see subscriptions/checkout/create) -- Razorpay
// plans are immutable, so an admin changing price_inr without clearing that
// cache left every subsequent checkout silently billing the stale price
// (found during the 2026-09-08 pitch-deck cost-model audit; fixed the same
// day in admin/subscription-tiers/update). This drives the real admin form
// to prove both branches of that fix: an unrelated (allowance-only) save
// leaves a cached plan id alone, and an actual price change clears it.
//
// 'basic' is a shared row every spec in this file (and
// subscription-tiers.spec.ts, which asserts its gig_post allowance is
// exactly 5) reads -- price_inr, razorpay_plan_id, AND the gig_post
// allowance this test deliberately changes are all restored in `finally`
// regardless of outcome. (A first version of this test only restored the
// first two and left gig_post_allowance at 7, which silently broke
// subscription-tiers.spec.ts's credit-ceiling assertion in the very next
// suite run -- fixed same day by capturing and restoring all three.)
test('changing a tier price via the admin UI clears its cached Razorpay plan id; an unrelated save does not', async ({ page, cleanup }) => {
  const admin = await signUpFlexPro(page, 'client', cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)

  const tier = await getTier('basic')
  const original = {
    priceInr: tier.price_inr,
    razorpayPlanId: tier.razorpay_plan_id,
    gigPostAllowance: await getGigPostAllowance(tier.id),
  }

  // Simulate a tier that already went through a real checkout once and has
  // a cached plan -- the exact scenario the bug affects.
  const fakePlanId = `plan_e2e_fake_${Date.now()}`
  await patchTier(tier.id, { razorpay_plan_id: fakePlanId })

  try {
    await login(page, admin, '/dashboard')
    await page.goto('/admin/subscription-tiers')

    const tierForm = page.locator(`input[name="tier_id"][value="${tier.id}"]`).locator('xpath=ancestor::form[1]')

    // Save with the SAME price (only the credit allowance changes) --
    // the cached plan id must survive, since nothing billing-relevant changed.
    await tierForm.locator('input[name="gig_post_allowance"]').fill('7')
    await tierForm.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(/\/admin\/subscription-tiers/)
    await expect(page.getByText('Tier updated.')).toBeVisible()

    let current = await getTier('basic')
    expect(current.razorpay_plan_id).toBe(fakePlanId)

    // Now actually change the price -- the cached plan id must be cleared
    // so the next checkout regenerates a Razorpay plan at the new price.
    const newPrice = original.priceInr + 50
    await page.goto('/admin/subscription-tiers')
    const tierFormAgain = page.locator(`input[name="tier_id"][value="${tier.id}"]`).locator('xpath=ancestor::form[1]')
    await tierFormAgain.locator('input[name="price_inr"]').fill(String(newPrice))
    await tierFormAgain.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(/\/admin\/subscription-tiers/)
    await expect(page.getByText('Tier updated.')).toBeVisible()

    current = await getTier('basic')
    expect(current.price_inr).toBe(newPrice)
    expect(current.razorpay_plan_id).toBeNull()
  } finally {
    await patchTier(tier.id, { price_inr: original.priceInr, razorpay_plan_id: original.razorpayPlanId })
    await patchGigPostAllowance(tier.id, original.gigPostAllowance)
  }
})
