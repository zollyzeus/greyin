import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin, createTestGig } from '../../utils/admin'

/**
 * Ported FlexPro admin tab on Hub (Phase 3, pitch-readiness plan) --
 * gig-close and user-role-update, the two actions fully ported (payouts/
 * disputes are visibility-only on this tab by design, see
 * admin/flexpro/page.tsx's own header comment, so not covered here).
 */
test('an admin can close a gig listing from the Hub-hosted FlexPro tab', async ({ browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup, undefined, 'https://flexpro.greyin.net')
  const sellerId = await getUserIdByEmail(seller.email)
  const gig = await createTestGig(sellerId)
  await sellerCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpFlexPro(adminPage, 'client', cleanup, undefined, 'https://flexpro.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, 'https://greyin.net/dashboard', 'https://greyin.net')

  await adminPage.goto('/admin/flexpro')
  await expect(adminPage.getByText(gig.title)).toBeVisible()

  await adminPage
    .locator(`input[name="gig_id"][value="${gig.id}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Close listing' })
    .click()
  await adminPage.waitForURL(/\/admin\/flexpro/)
  await expect(adminPage.getByText(gig.title)).not.toBeVisible()

  await adminCtx.close()
})

test('an admin can update a user role from the Hub-hosted FlexPro tab', async ({ browser, cleanup }) => {
  const targetCtx = await browser.newContext()
  const targetPage = await targetCtx.newPage()
  const target = await signUpFlexPro(targetPage, 'freelancer', cleanup, undefined, 'https://flexpro.greyin.net')
  const targetId = await getUserIdByEmail(target.email)
  await targetCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpFlexPro(adminPage, 'client', cleanup, undefined, 'https://flexpro.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, 'https://greyin.net/dashboard', 'https://greyin.net')

  await adminPage.goto('/admin/flexpro')
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
  await adminPage.waitForURL(/\/admin\/flexpro/)
  await adminCtx.close()

  // Confirm the change is real: the promoted target should now pass
  // themselves as an admin visiting the Hub-hosted tab.
  const verifyCtx = await browser.newContext()
  const verifyPage = await verifyCtx.newPage()
  await login(verifyPage, target, 'https://greyin.net/dashboard', 'https://greyin.net')
  await verifyPage.goto('/admin/flexpro')
  await expect(verifyPage).toHaveURL(/\/admin\/flexpro/)
  await verifyCtx.close()
})
