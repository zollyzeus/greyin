import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin, createTestGig, createCompletedOrder } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  }
}

// signUpFlexPro's admin-provisioned metadata has no `full_name` key, so
// 001_initial_schema.sql's handle_new_user() trigger falls back to the
// user's own email for profiles.full_name -- read the real stored value
// back rather than guessing at first_name+last_name composition.
async function getFullName(userId: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=full_name`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  })
  const [row] = await res.json()
  return row.full_name
}

/**
 * AI enhancement (Phase D1, "11 new AI enhancements" plan):
 * cross_pillar_reciprocity_flags (132) -- a pair trading favorable
 * signals in OPPOSITE directions across two DIFFERENT pillars, invisible
 * to 090/091's existing StackWorks-only reciprocity check. Seeded via
 * the cheapest real channel for each side (REST, service role) rather
 * than driving FlexPro's/Salt & Pepper's own review/upvote UI flows --
 * this test exercises the downstream cross-pillar VIEW, not either
 * pillar's own submission UI, same reasoning dashboard-score-badge.spec.ts
 * already established for reputation_events.
 *
 * Person A reviews Person B highly on FlexPro (A -> B); Person B then
 * upvotes Person A's Salt & Pepper project (B -> A) -- a real reciprocal
 * pair spanning two pillars. A 3rd, unrelated pair (a solo FlexPro
 * review with no reverse favor at all) is also seeded to confirm a
 * one-directional signal alone does NOT get flagged.
 */
test('a pair trading favors across two different pillars is flagged; a one-directional favor alone is not', async ({ browser, cleanup }) => {
  const personACtx = await browser.newContext()
  const personBCtx = await browser.newContext()
  const personA = await signUpFlexPro(await personACtx.newPage(), 'client', cleanup)
  const personB = await signUpFlexPro(await personBCtx.newPage(), 'freelancer', cleanup)
  await personACtx.close()
  await personBCtx.close()

  const [personAId, personBId] = await Promise.all([
    getUserIdByEmail(personA.email),
    getUserIdByEmail(personB.email),
  ])

  // FlexPro favor: A (buyer) -> B (seller), a 5-star review.
  const gig = await createTestGig(personBId)
  const order = await createCompletedOrder({ gigId: gig.id, buyerId: personAId, sellerId: personBId, amount: 1500 })
  const reviewRes = await fetch(`${SUPABASE_URL}/rest/v1/order_reviews`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      order_id: order.id,
      gig_id: gig.id,
      reviewer_id: personAId,
      reviewee_id: personBId,
      rating: 5,
      review_text: 'Reciprocity-test review.',
    }),
  })
  expect(reviewRes.ok).toBeTruthy()

  // Salt & Pepper favor, opposite direction: B upvotes A's project.
  const projectRes = await fetch(`${SUPABASE_URL}/rest/v1/builder_projects`, {
    method: 'POST',
    headers: { ...restHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: personAId,
      title: `E2E Reciprocity Project ${Date.now()}`,
      description: 'Seeded for the cross-pillar reciprocity e2e spec.',
    }),
  })
  expect(projectRes.ok).toBeTruthy()
  const [project] = await projectRes.json()

  const upvoteRes = await fetch(`${SUPABASE_URL}/rest/v1/project_upvotes`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ project_id: project.id, user_id: personBId }),
  })
  expect(upvoteRes.ok).toBeTruthy()

  // An unrelated 3rd party: a one-directional FlexPro favor with no
  // reverse signal on any pillar -- must NOT be flagged.
  const strangerCtx = await browser.newContext()
  const strangerPage = await strangerCtx.newPage()
  const stranger = await signUpFlexPro(strangerPage, 'client', cleanup)
  await strangerCtx.close()
  const strangerId = await getUserIdByEmail(stranger.email)
  const soloGig = await createTestGig(personBId)
  const soloOrder = await createCompletedOrder({ gigId: soloGig.id, buyerId: strangerId, sellerId: personBId, amount: 800 })
  const soloReviewRes = await fetch(`${SUPABASE_URL}/rest/v1/order_reviews`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      order_id: soloOrder.id,
      gig_id: soloGig.id,
      reviewer_id: strangerId,
      reviewee_id: personBId,
      rating: 5,
      review_text: 'One-directional-only review, should never be flagged.',
    }),
  })
  expect(soloReviewRes.ok).toBeTruthy()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpSaltNPepper(adminPage, cleanup, 'https://saltnpepper.greyin.net')
  await promoteToAdmin(await getUserIdByEmail(admin.email))
  await login(adminPage, admin, 'https://saltnpepper.greyin.net/dashboard', 'https://saltnpepper.greyin.net')

  await adminPage.goto('https://greyin.net/admin/cross-pillar-flags')
  await expect(adminPage.getByRole('heading', { name: 'Cross-Pillar Reciprocity Flags' })).toBeVisible()

  const [personAName, personBName, strangerName] = await Promise.all([
    getFullName(personAId),
    getFullName(personBId),
    getFullName(strangerId),
  ])

  const flagRow = adminPage.locator('tr', { hasText: personAName }).filter({ hasText: personBName })
  await expect(flagRow).toBeVisible()
  await expect(flagRow).toContainText('flexpro')
  await expect(flagRow).toContainText('saltnpepper')

  // The stranger, who only ever gave a favor and received nothing back
  // on any pillar, must never appear as a flagged row.
  await expect(adminPage.locator('tr', { hasText: strangerName })).toHaveCount(0)

  await adminCtx.close()
})
