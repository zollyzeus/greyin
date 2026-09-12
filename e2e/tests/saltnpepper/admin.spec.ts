import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

test('an admin can delete a discussion', async ({ browser, cleanup }) => {
  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpSaltNPepper(authorPage, cleanup)
  await login(authorPage, author, '/dashboard')

  // Content reads as a genuine discussion post, not meta "this is a
  // test/exercise" language -- the pre-publish moderation LLM (098) has
  // been observed blocking phrasing that talks ABOUT testing/moderation/
  // admin flows as low-effort or off-topic (against its own system
  // prompt's instruction not to), a false-positive class discovered
  // while root-causing a waitForURL race that used to mask exactly this
  // (2026-09-12). Matches the substantive-content style that already
  // passes reliably elsewhere in this suite (moderation.spec.ts).
  const title = `E2E Admin Cleanup Discussion ${Date.now()}`
  await authorPage.goto('/discussions/new')
  await authorPage.locator('#title').fill(title)
  await authorPage.locator('#body').fill('Sharing a checklist we use before rolling out a schema migration to production, happy to hear what others would add.')
  await authorPage.getByRole('button', { name: 'Post Discussion' }).click()
  await authorPage.waitForURL(/\/discussions\/(?!new)[^/]+$/)
  const discussionId = authorPage.url().split('/discussions/')[1]
  await authorCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpSaltNPepper(adminPage, cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, '/dashboard')

  await adminPage.goto('/admin')
  await expect(adminPage.getByText(title)).toBeVisible()

  adminPage.once('dialog', (d) => d.accept())
  await adminPage
    .locator(`input[name="discussion_id"][value="${discussionId}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Delete' })
    .click()
  await adminPage.waitForURL('/admin')
  await expect(adminPage.getByText(title)).not.toBeVisible()

  await adminPage.goto('/discussions')
  await expect(adminPage.getByText(title)).not.toBeVisible()

  await adminCtx.close()
})

test('an admin can promote another user to admin and it grants real access', async ({ browser, cleanup }) => {
  const targetCtx = await browser.newContext()
  const targetPage = await targetCtx.newPage()
  const target = await signUpSaltNPepper(targetPage, cleanup)
  const targetId = await getUserIdByEmail(target.email)
  await targetCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpSaltNPepper(adminPage, cleanup)
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
  await adminPage.waitForURL('/admin?role_updated=1')
  await expect(adminPage.getByText('Role updated.')).toBeVisible()
  await adminCtx.close()

  const targetCtx2 = await browser.newContext()
  const targetPage2 = await targetCtx2.newPage()
  await login(targetPage2, target, '/dashboard')
  await targetPage2.goto('/admin')
  await expect(targetPage2).toHaveURL('/admin')
  await targetCtx2.close()
})
