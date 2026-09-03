import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

/**
 * Gap-audit items #5 (feature wishlist) and #3 (feedback loop), both
 * centralized on the Hub (docs/emergent_deployment_gap.md, 2026-09-02).
 * Users sign up via a pillar app (Salt & Pepper here, arbitrary) and
 * reach the Hub via the platform's shared SSO cookie, same pattern as
 * admin-cleanup-test-data.spec.ts.
 */
const hubBase = 'https://greyin.net'

test('a member can suggest a feature, another member upvotes it, and an admin can change its status', async ({ browser, cleanup }) => {
  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpSaltNPepper(authorPage, cleanup, 'https://saltnpepper.greyin.net')
  await login(authorPage, author, `${hubBase}/dashboard`, hubBase)

  const title = `E2E Wishlist Item ${Date.now()}`
  await authorPage.goto(`${hubBase}/wishlist`)
  await authorPage.getByPlaceholder('What should we build?').fill(title)
  await authorPage.getByPlaceholder("Any more detail? (optional)").fill('Exercises the wishlist end to end.')
  await authorPage.getByRole('button', { name: 'Submit' }).click()
  await authorPage.waitForURL(`${hubBase}/wishlist`)
  await expect(authorPage.getByText(title)).toBeVisible()
  await authorCtx.close()

  const upvoterCtx = await browser.newContext()
  const upvoterPage = await upvoterCtx.newPage()
  const upvoter = await signUpSaltNPepper(upvoterPage, cleanup, 'https://saltnpepper.greyin.net')
  await login(upvoterPage, upvoter, `${hubBase}/dashboard`, hubBase)

  await upvoterPage.goto(`${hubBase}/wishlist`)
  // Scoped to the card's own distinctive class combo (wishlist/page.tsx),
  // not a bare 'div' selector which would also match every ancestor.
  const card = upvoterPage.locator('.bg-white.rounded-lg.shadow.p-5').filter({ hasText: title })
  await card.getByRole('button').click()
  await upvoterPage.waitForURL(`${hubBase}/wishlist`)
  await expect(upvoterPage.locator('.bg-white.rounded-lg.shadow.p-5').filter({ hasText: title }).getByText('1', { exact: true })).toBeVisible()
  await upvoterCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpSaltNPepper(adminPage, cleanup, 'https://saltnpepper.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, `${hubBase}/dashboard`, hubBase)

  await adminPage.goto(`${hubBase}/admin/wishlist`)
  await expect(adminPage.getByText(title)).toBeVisible()
  const adminRow = adminPage.locator('.py-3.flex.items-center.justify-between').filter({ hasText: title })
  await adminRow.locator('select[name="status"]').selectOption('planned')
  await adminRow.getByRole('button', { name: 'Save' }).click()
  await adminPage.waitForURL(`${hubBase}/admin/wishlist`)

  await adminPage.goto(`${hubBase}/wishlist`)
  await expect(adminPage.getByText('planned')).toBeVisible()

  await adminCtx.close()
})

test('a member can send feedback, an admin can reply, and the member is notified and sees the reply', async ({ browser, cleanup }) => {
  const memberCtx = await browser.newContext()
  const memberPage = await memberCtx.newPage()
  const member = await signUpSaltNPepper(memberPage, cleanup, 'https://saltnpepper.greyin.net')
  await login(memberPage, member, `${hubBase}/dashboard`, hubBase)

  const message = `E2E feedback message ${Date.now()}`
  await memberPage.goto(`${hubBase}/feedback?app=saltnpepper`)
  await memberPage.locator('#message').fill(message)
  await memberPage.getByRole('button', { name: 'Send feedback' }).click()
  await memberPage.waitForURL(/\/feedback\?success=1/)
  await expect(memberPage.getByText(message)).toBeVisible()
  await expect(memberPage.getByText('Awaiting reply')).toBeVisible()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpSaltNPepper(adminPage, cleanup, 'https://saltnpepper.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, `${hubBase}/dashboard`, hubBase)

  await adminPage.goto(`${hubBase}/admin/feedback`)
  await expect(adminPage.getByText(message)).toBeVisible()

  const replyText = `Thanks for flagging this -- ${Date.now()}`
  const feedbackCard = adminPage.locator('.py-4').filter({ hasText: message })
  await feedbackCard.locator('textarea[name="admin_reply"]').fill(replyText)
  await feedbackCard.getByRole('button', { name: 'Reply' }).click()
  await adminPage.waitForURL(`${hubBase}/admin/feedback`)
  await expect(adminPage.getByText(replyText)).toBeVisible()
  await adminCtx.close()

  // The member sees the reply on /feedback and is notified via the
  // shared notifications table, readable from any pillar app.
  await memberPage.goto(`${hubBase}/feedback`)
  await expect(memberPage.getByText(replyText)).toBeVisible()
  await expect(memberPage.getByText('Replied')).toBeVisible()

  await memberPage.goto('https://saltnpepper.greyin.net/notifications')
  await expect(memberPage.getByText(/The team replied to your feedback/i)).toBeVisible()

  await memberCtx.close()
})

test('a non-admin cannot reach the wishlist or feedback admin panels', async ({ page, cleanup }) => {
  const member = await signUpSaltNPepper(page, cleanup, 'https://saltnpepper.greyin.net')
  await login(page, member, `${hubBase}/dashboard`, hubBase)

  await page.goto(`${hubBase}/admin/wishlist`)
  await expect(page).toHaveURL(`${hubBase}/dashboard`)

  await page.goto(`${hubBase}/admin/feedback`)
  await expect(page).toHaveURL(`${hubBase}/dashboard`)
})
