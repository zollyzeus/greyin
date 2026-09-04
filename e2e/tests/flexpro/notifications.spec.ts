import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { createPaidOrder, getGigIdByTitle, getUserIdByEmail, grantFreeagentSubscription } from '../../utils/admin'

test('a seller is notified when a buyer sends an order message', async ({ browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(seller.email))
  await login(sellerPage, seller, '/dashboard')

  const gigTitle = `E2E Notification Gig ${Date.now()}`
  await sellerPage.goto('/gigs/new')
  await sellerPage.locator('#title').fill(gigTitle)
  await sellerPage.locator('#description').fill('Gig used to exercise order-message notifications.')
  await sellerPage.locator('#price_min').fill('1000')
  await sellerPage.getByRole('button', { name: 'Publish Gig' }).click()
  await sellerPage.waitForURL(/\/gigs\/[^/]+$/)

  const buyerCtx = await browser.newContext()
  const buyerPage = await buyerCtx.newPage()
  const buyer = await signUpFlexPro(buyerPage, 'client', cleanup)
  await login(buyerPage, buyer, '/dashboard')

  const gigId = await getGigIdByTitle(gigTitle)
  const sellerId = await getUserIdByEmail(seller.email)
  const buyerId = await getUserIdByEmail(buyer.email)
  const order = await createPaidOrder({ gigId, buyerId, sellerId, amount: 1000 })

  await buyerPage.goto(`/orders/${order.id}`)
  await buyerPage.getByPlaceholder('Type your message...').fill(`E2E notification message ${Date.now()}`)
  await buyerPage.getByRole('button', { name: 'Send' }).click()
  await buyerCtx.close()

  // Structural sync pass (2026-09-05): the dashboard's own hand-rolled
  // bell+badge link (title="Notifications") was replaced with the shared
  // <NotificationBell /> component, whose button carries aria-label
  // instead of a title attribute -- same visible badge, different locator.
  await sellerPage.goto('/dashboard')
  await expect(sellerPage.getByLabel('Notifications')).toContainText('1')

  await sellerPage.goto('/notifications')
  await expect(sellerPage.getByText('New message')).toBeVisible()

  await sellerCtx.close()
})
