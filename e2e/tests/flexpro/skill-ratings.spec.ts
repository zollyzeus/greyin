import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { getUserIdByEmail, createTestGig, createCompletedOrder } from '../../utils/admin'

/**
 * Skill ratings on FlexPro: buyer rates seller, only once the order
 * is completed, only for skills tagged on the gig
 * (054_skill_endorsements_and_ratings.sql). Mirrors order_reviews' own
 * direction, broken out per-skill.
 */
test('a buyer can rate a completed order\'s seller on the gig\'s own tagged skills', async ({ browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup)
  await login(sellerPage, seller, '/dashboard')
  const sellerId = await getUserIdByEmail(seller.email)
  const gig = await createTestGig(sellerId, { tags: ['E2E Rating Skill'] })
  await sellerCtx.close()

  const buyerCtx = await browser.newContext()
  const buyerPage = await buyerCtx.newPage()
  const buyer = await signUpFlexPro(buyerPage, 'client', cleanup)
  await login(buyerPage, buyer, '/dashboard')
  const buyerId = await getUserIdByEmail(buyer.email)

  const order = await createCompletedOrder({ gigId: gig.id, buyerId, sellerId, amount: 1500 })

  await buyerPage.goto(`/orders/${order.id}`)
  await expect(buyerPage.getByText('E2E Rating Skill')).toBeVisible()
  await buyerPage.getByRole('button', { name: 'Rate E2E Rating Skill 5 out of 5' }).click()
  await expect(buyerPage.getByText('Saved')).toBeVisible()

  await buyerCtx.close()
})
