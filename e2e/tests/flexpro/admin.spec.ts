import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import {
  getGigIdByTitle,
  getUserIdByEmail,
  promoteToAdmin,
  createCompletedOrder,
  grantFreeagentSubscription,
} from '../../utils/admin'

test('an admin can close a gig listing and process a withdrawal request', async ({ browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(seller.email))
  await login(sellerPage, seller, '/dashboard')

  const gigTitle = `E2E Admin Moderation Gig ${Date.now()}`
  await sellerPage.goto('/gigs/new')
  await sellerPage.locator('#title').fill(gigTitle)
  await sellerPage.locator('#description').fill('Gig used to exercise admin moderation.')
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
  await createCompletedOrder({ gigId, buyerId, sellerId, amount: 1000 })

  const bankAccountName = `E2E Admin Test Seller ${Date.now()}`
  await sellerPage.goto('/earnings')
  await sellerPage.locator('#amount').fill('300')
  await sellerPage.locator('#bank_account_name').fill(bankAccountName)
  await sellerPage.locator('#bank_account_number').fill('1234567890')
  await sellerPage.locator('#bank_ifsc').fill('HDFC0001234')
  await sellerPage.getByRole('button', { name: 'Request withdrawal' }).click()
  await sellerPage.waitForURL(/\/earnings/)
  await sellerCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpFlexPro(adminPage, 'client', cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, '/dashboard')

  await adminPage.goto('/admin')
  await expect(adminPage.getByText(gigTitle)).toBeVisible()
  await expect(adminPage.getByText(bankAccountName)).toBeVisible()

  await adminPage
    .locator(`input[name="gig_id"][value="${gigId}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Close listing' })
    .click()
  await adminPage.waitForURL('/admin')
  await expect(adminPage.getByText(gigTitle)).not.toBeVisible()

  // Requests are listed oldest-first, so with accumulated pending requests
  // from earlier runs, this test's own (newest) request is the last one —
  // scope to its row by the unique bank account name rather than picking a
  // position that could hit a stale, unrelated request.
  await adminPage
    .getByText(bankAccountName)
    .locator('xpath=ancestor::div[contains(@class, "justify-between")][1]')
    .getByRole('button', { name: 'Mark paid' })
    .click()
  await adminPage.waitForURL('/admin')
  await expect(adminPage.getByText(bankAccountName)).not.toBeVisible()

  await adminCtx.close()
})

test('an admin can promote another user to admin and it grants real access', async ({ browser, cleanup }) => {
  const targetCtx = await browser.newContext()
  const targetPage = await targetCtx.newPage()
  const target = await signUpFlexPro(targetPage, 'client', cleanup)
  const targetId = await getUserIdByEmail(target.email)
  await targetCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpFlexPro(adminPage, 'client', cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, '/dashboard')

  await adminPage.goto('/admin')
  await adminPage
    .locator(`input[name="user_id"][value="${targetId}"]`)
    .locator('xpath=..')
    .locator('select[name="role"]')
    .selectOption('admin')
  await adminPage
    .locator(`input[name="user_id"][value="${targetId}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Update' })
    .click()
  await adminPage.waitForURL('/admin')
  await adminCtx.close()

  // Prove the change is real by having the promoted user access /admin
  // themselves — a cosmetic-only bug would leave them redirected away.
  const targetCtx2 = await browser.newContext()
  const targetPage2 = await targetCtx2.newPage()
  await login(targetPage2, target, '/dashboard')
  await targetPage2.goto('/admin')
  await expect(targetPage2).toHaveURL('/admin')
  await targetCtx2.close()
})
