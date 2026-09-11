import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
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
    `${SUPABASE_URL}/rest/v1/subscription_tiers?product=eq.deepedge_hiring&tier_key=eq.${tierKey}&select=id,price_inr,razorpay_plan_id`,
    { headers: restHeaders() }
  )
  const rows = await res.json()
  return rows[0]
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

async function getProfileViewAllowance(tierId: string): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/subscription_tier_credits?tier_id=eq.${tierId}&credit_type=eq.profile_view&select=monthly_allowance`,
    { headers: restHeaders() }
  )
  const rows = await res.json()
  return rows[0].monthly_allowance
}

async function patchProfileViewAllowance(tierId: string, allowance: number): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscription_tier_credits?tier_id=eq.${tierId}&credit_type=eq.profile_view`, {
    method: 'PATCH',
    headers: restHeaders(),
    body: JSON.stringify({ monthly_allowance: allowance }),
  })
  if (!res.ok) {
    throw new Error(`Failed to patch profile_view allowance for tier ${tierId}: ${res.status} ${await res.text()}`)
  }
}

// Same fix, same test shape as flexpro/subscription-tier-price-update.spec.ts
// -- see that file's comment for the full rationale, including why the
// credit allowance this test deliberately changes (here, profile_view;
// the other 5 credit fields round-trip unchanged since the form always
// submits every field's current DOM value) must be captured and restored
// in `finally` alongside price_inr/razorpay_plan_id, not just the latter
// two -- a first version of this fix left profile_view mutated and broke
// a subscription-gate assertion elsewhere that depends on 'basic''s seeded
// 50-credit allowance.
test('changing a tier price via the admin UI clears its cached Razorpay plan id; an unrelated save does not', async ({ page, cleanup }) => {
  const admin = await signUpDeepEdge(page, 'candidate', cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)

  const tier = await getTier('basic')
  const original = {
    priceInr: tier.price_inr,
    razorpayPlanId: tier.razorpay_plan_id,
    profileViewAllowance: await getProfileViewAllowance(tier.id),
  }

  const fakePlanId = `plan_e2e_fake_${Date.now()}`
  await patchTier(tier.id, { razorpay_plan_id: fakePlanId })

  try {
    await login(page, admin, '/dashboard')
    await page.goto('/admin/subscription-tiers')

    const tierForm = page.locator(`input[name="tier_id"][value="${tier.id}"]`).locator('xpath=ancestor::form[1]')

    // Save with the SAME price (only a credit allowance changes) -- the
    // cached plan id must survive, since nothing billing-relevant changed.
    await tierForm.locator('input[name="credit_profile_view"]').fill('55')
    await tierForm.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(/\/admin\/subscription-tiers/)
    await expect(page.getByText('Tier updated.')).toBeVisible()

    let current = await getTier('basic')
    expect(current.razorpay_plan_id).toBe(fakePlanId)

    // Now actually change the price -- the cached plan id must be cleared
    // so the next checkout regenerates a Razorpay plan at the new price.
    const newPrice = original.priceInr + 500
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
    await patchProfileViewAllowance(tier.id, original.profileViewAllowance)
  }
})
