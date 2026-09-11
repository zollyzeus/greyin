import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, getReputationEvents, getGreyinScoreRow } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function getUserAccessToken(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.json()
  if (!body.access_token) throw new Error(`Failed to sign in ${email}: ${JSON.stringify(body)}`)
  return body.access_token
}

/**
 * Platform-wide referral program (138_referral_system.sql) -- a
 * shareable code any user gets from Hub's /dashboard, redeemable once by
 * anyone else via /referral/redeem, awarding the referrer real
 * reputation (which flows into their greyin_scores composite through
 * the existing evidence channel -- greyin_scores is a view with no
 * direct write path, so this is the only place a referral reward can
 * legitimately enter it).
 */
test('a referral code can be generated, shared, and redeemed once, rewarding the referrer', async ({ browser, cleanup }) => {
  const referrerCtx = await browser.newContext()
  const referrerPage = await referrerCtx.newPage()
  const referrer = await signUpDeepEdge(referrerPage, 'candidate', cleanup)
  await login(referrerPage, referrer, '/dashboard')

  // The widget's link input holds the full redeem URL, not the bare code
  // -- extract the code param rather than assuming a fixed format.
  const linkValue = await referrerPage.locator('input[readonly][value*="/referral/redeem?code="]').inputValue()
  const code = new URL(linkValue, 'https://greyin.net').searchParams.get('code')!
  expect(code).toBeTruthy()

  const referrerId = await getUserIdByEmail(referrer.email)

  // Self-referral must be rejected.
  await referrerPage.goto(`/referral/redeem?code=${code}`)
  await referrerPage.getByRole('button', { name: 'Redeem referral' }).click()
  await expect(referrerPage.getByText(/cannot redeem your own referral code/i)).toBeVisible()
  await referrerCtx.close()

  // A different, real signed-up user redeems it for real.
  const redeemerCtx = await browser.newContext()
  const redeemerPage = await redeemerCtx.newPage()
  const redeemer = await signUpDeepEdge(redeemerPage, 'candidate', cleanup)
  await login(redeemerPage, redeemer, '/dashboard')

  await redeemerPage.goto(`/referral/redeem?code=${code}`)
  await redeemerPage.getByRole('button', { name: 'Redeem referral' }).click()
  await expect(redeemerPage.getByText(/you're in/i)).toBeVisible()

  // A second redemption attempt (by anyone) must be rejected -- verified
  // directly since the UI has no way back to an already-redeemed state.
  // Authenticated as the redeemer's own user (not the service role,
  // which has no auth.uid() at all and would never hit the real check).
  const redeemerAccessToken = await getUserAccessToken(redeemer.email, redeemer.password)
  const secondAttemptRes = await redeemerCtx.request.post(`${SUPABASE_URL}/rest/v1/rpc/redeem_referral_code`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${redeemerAccessToken}`, 'Content-Type': 'application/json' },
    data: { p_code: code },
  })
  const rejection = await secondAttemptRes.json()
  expect(rejection.message).toMatch(/already been referred/i)

  // The reward actually landed, and actually flows into the real score.
  const events = await getReputationEvents(referrerId, 'referral_converted')
  expect(events.length).toBe(1)
  expect(events[0].points).toBe(25)

  const scoreRow = await getGreyinScoreRow(referrerId)
  expect(scoreRow).not.toBeNull()

  await redeemerCtx.close()
})

test('a referrer capped at 4 rewarded referrals is rejected on a 5th', async ({ page, cleanup }) => {
  const referrer = await signUpDeepEdge(page, 'candidate', cleanup)
  const referrerId = await getUserIdByEmail(referrer.email)

  // Seed 4 prior 'referral_converted' events directly -- reaching the cap
  // via 4 full real signups+redemptions would be slow and redundant with
  // the single-redemption path already proven end to end above; only the
  // cap boundary itself is under test here.
  for (let i = 0; i < 4; i++) {
    await fetch(`${SUPABASE_URL}/rest/v1/reputation_events`, {
      method: 'POST',
      headers: restHeaders(),
      body: JSON.stringify({ user_id: referrerId, event_type: 'referral_converted', points: 25 }),
    })
  }

  await login(page, referrer, '/dashboard')
  const linkValue = await page.locator('input[readonly][value*="/referral/redeem?code="]').inputValue()
  const code = new URL(linkValue, 'https://greyin.net').searchParams.get('code')!

  const fifthRedeemer = await signUpDeepEdge(page, 'candidate', cleanup)
  const fifthAccessToken = await getUserAccessToken(fifthRedeemer.email, fifthRedeemer.password)
  const fifthAttemptRes = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/redeem_referral_code`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${fifthAccessToken}`, 'Content-Type': 'application/json' },
    data: { p_code: code },
  })
  const rejection = await fifthAttemptRes.json()
  expect(rejection.message).toMatch(/maximum number of rewarded referrals/i)
})
