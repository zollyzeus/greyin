import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { createCompletedOrder, getGigIdByTitle, getUserIdByEmail, grantFreeagentSubscription } from '../../utils/admin'

test('a freelancer sees their earnings balance and can request a withdrawal', async ({ browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(seller.email))
  await login(sellerPage, seller, '/dashboard')

  const gigTitle = `E2E Earnings Gig ${Date.now()}`
  await sellerPage.goto('/gigs/new')
  await sellerPage.locator('#title').fill(gigTitle)
  await sellerPage.locator('#description').fill('Gig used to exercise the earnings/payout flow.')
  await sellerPage.locator('#price_min').fill('1000')
  await sellerPage.getByRole('button', { name: 'Publish Gig' }).click()
  await sellerPage.waitForURL(/\/gigs\/[^/]+$/)

  const buyerCtx = await browser.newContext()
  const buyerPage = await buyerCtx.newPage()
  const buyer = await signUpFlexPro(buyerPage, 'client', cleanup)
  await login(buyerPage, buyer, '/dashboard')
  await buyerCtx.close()

  const gigId = await getGigIdByTitle(gigTitle)
  const sellerId = await getUserIdByEmail(seller.email)
  const buyerId = await getUserIdByEmail(buyer.email)

  // 1000 at 2% platform fee -> 980 available.
  await createCompletedOrder({ gigId, buyerId, sellerId, amount: 1000 })

  await sellerPage.goto('/earnings')
  await expect(sellerPage.locator('#available-balance')).toHaveText('₹980')

  await sellerPage.locator('#amount').fill('500')
  await sellerPage.locator('#bank_account_name').fill(`E2E Test Seller ${Date.now()}`)
  await sellerPage.locator('#bank_account_number').fill('1234567890')
  await sellerPage.locator('#bank_ifsc').fill('HDFC0001234')
  await sellerPage.getByRole('button', { name: 'Request withdrawal' }).click()
  await sellerPage.waitForURL(/\/earnings/)

  // '₹500' also matches the "already requested" summary stat above the
  // history list — scope to the history row specifically.
  await expect(sellerPage.getByText('₹500').last()).toBeVisible()
  await expect(sellerPage.getByText('pending', { exact: false })).toBeVisible()
  await expect(sellerPage.locator('#available-balance')).toHaveText('₹480')

  await sellerCtx.close()
})
