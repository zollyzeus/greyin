import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, signUpStackWorksBuilder, login } from '../../utils/auth'
import { createCompletedOrder, getUserIdByEmail, grantFreeagentSubscription } from '../../utils/admin'

/**
 * cross-platform/trust-signals.spec.ts already proves StackWorks verified
 * outcomes reaching a deepedge employer. This is the other direction:
 * FlexPro's seller_rating/total_reviews (set by 006's
 * update_seller_review_stats trigger on a real order review) are read
 * on the shared profiles row by stackworks/src/app/asks/[id]/page.tsx's
 * "★ ... on FlexPro" line -- a seller with zero StackWorks history of
 * their own should still show up with a real track record there.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const stackworksBase = isLocal
  ? `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}`
  : 'https://stackworks.greyin.net'
const flexproBase = isLocal
  ? `http://localhost:${process.env.E2E_FREEAGENT_PORT || 3102}`
  : 'https://flexpro.greyin.net'

test("a seller's FlexPro rating/review count shows up when a StackWorks ask owner reviews their application", async ({ browser, cleanup }) => {
  const ownerCtx = await browser.newContext()
  const ownerPage = await ownerCtx.newPage()
  const owner = await signUpStackWorksBuilder(ownerPage, cleanup, stackworksBase)
  await login(ownerPage, owner, `${stackworksBase}/dashboard`, stackworksBase)

  await ownerPage.goto(`${stackworksBase}/projects/new`)
  await ownerPage.locator('#title').fill(`E2E FlexPro Trust Signal Project ${Date.now()}`)
  await ownerPage.locator('#description').fill('A project used to exercise the FlexPro -> StackWorks trust signal.')
  await ownerPage.getByRole('button', { name: 'Post Project' }).click()
  await ownerPage.waitForURL(/\/projects\/[^/]+$/)

  await ownerPage.getByRole('link', { name: 'Post an ask' }).click()
  await ownerPage.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await ownerPage.locator('#role_title').fill('FlexPro trust signal ask')
  await ownerPage.getByRole('button', { name: 'Post Ask' }).click()
  await ownerPage.waitForURL(/\/asks\/[^/]+$/)
  const askUrl = ownerPage.url()

  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup, 15, flexproBase)
  // Publishing a gig requires an active subscription (093/094/096's own
  // gate) -- this test never granted one, so the seller was always
  // silently redirected to /subscribe on "Publish Gig", never reaching
  // a real gig at all. A known, previously-flagged-but-unfixed gap.
  await grantFreeagentSubscription(await getUserIdByEmail(seller.email))
  await login(sellerPage, seller, `${flexproBase}/dashboard`, flexproBase)

  const gigTitle = `E2E Trust Signal Gig ${Date.now()}`
  await sellerPage.goto(`${flexproBase}/gigs/new`)
  await sellerPage.locator('#title').fill(gigTitle)
  await sellerPage.locator('#description').fill('Gig used to exercise the FlexPro -> StackWorks trust signal.')
  await sellerPage.locator('#price_min').fill('1500')
  await sellerPage.getByRole('button', { name: 'Publish Gig' }).click()
  await sellerPage.waitForURL(/\/gigs\/[^/]+$/)
  const gigId = sellerPage.url().split('/gigs/')[1]

  const buyerCtx = await browser.newContext()
  const buyerPage = await buyerCtx.newPage()
  const buyer = await signUpFlexPro(buyerPage, 'client', cleanup, 15, flexproBase)
  await login(buyerPage, buyer, `${flexproBase}/dashboard`, flexproBase)

  const [sellerId, buyerId] = await Promise.all([
    getUserIdByEmail(seller.email),
    getUserIdByEmail(buyer.email),
  ])
  // Lands straight on 'completed' (like the earnings spec does) -- the
  // status transitions themselves are already covered end-to-end by
  // order-lifecycle.spec.ts, this test only cares about the review's
  // downstream effect on the shared profiles row.
  const order = await createCompletedOrder({ gigId, buyerId, sellerId, amount: 1530 })

  await buyerPage.goto(`${flexproBase}/orders/${order.id}`)
  await buyerPage.getByRole('button', { name: 'Rate 5 stars' }).click()
  const reviewText = `Excellent work, trust-signal e2e — ${Date.now()}`
  await buyerPage.getByPlaceholder('Share your experience with this service...').fill(reviewText)
  await buyerPage.getByRole('button', { name: 'Submit Review' }).click()
  await expect(buyerPage.getByText(reviewText)).toBeVisible()

  // The seller's own session (SSO cookie on .greyin.net) carries straight
  // into StackWorks -- applying to the owner's ask with zero separate signup
  // there, same mechanism cross-platform/sso.spec.ts already proves.
  await sellerPage.goto(askUrl)
  await sellerPage.locator('#pitch').fill('I can deliver this — see my FlexPro track record.')
  await sellerPage.getByRole('button', { name: 'Apply' }).click()

  await ownerPage.goto(askUrl)
  await expect(ownerPage.getByText('★ 5.0 on FlexPro (1)')).toBeVisible()

  await ownerCtx.close()
  await sellerCtx.close()
  await buyerCtx.close()
})
