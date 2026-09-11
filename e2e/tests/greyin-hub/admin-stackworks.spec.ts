import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin, createTestBuilderProject } from '../../utils/admin'

/**
 * Ported StackWorks admin tab on Hub (Phase 3, pitch-readiness plan) --
 * project deletion and user-role-update ported fully (verifications are
 * covered indirectly via the shared human-review route, not re-tested
 * here to keep this proportional to the other pillar specs).
 */
test('an admin can delete a project from the Hub-hosted StackWorks tab', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup, 'https://stackworks.greyin.net')
  const builderId = await getUserIdByEmail(builder.email)
  const project = await createTestBuilderProject(builderId)
  await builderCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpStackWorksBuilder(adminPage, cleanup, 'https://stackworks.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, 'https://greyin.net/dashboard', 'https://greyin.net')

  await adminPage.goto('/admin/stackworks')
  await expect(adminPage.getByText(project.title)).toBeVisible()

  await adminPage
    .locator(`input[name="project_id"][value="${project.id}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Delete' })
    .click()
  await adminPage.waitForURL(/\/admin\/stackworks/)
  await expect(adminPage.getByText(project.title)).not.toBeVisible()

  await adminCtx.close()
})

test('an admin can update a user role from the Hub-hosted StackWorks tab', async ({ browser, cleanup }) => {
  const targetCtx = await browser.newContext()
  const targetPage = await targetCtx.newPage()
  const target = await signUpStackWorksBuilder(targetPage, cleanup, 'https://stackworks.greyin.net')
  const targetId = await getUserIdByEmail(target.email)
  await targetCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpStackWorksBuilder(adminPage, cleanup, 'https://stackworks.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, 'https://greyin.net/dashboard', 'https://greyin.net')

  await adminPage.goto('/admin/stackworks')
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
  await adminPage.waitForURL(/\/admin\/stackworks/)
  await adminCtx.close()

  const verifyCtx = await browser.newContext()
  const verifyPage = await verifyCtx.newPage()
  await login(verifyPage, target, 'https://greyin.net/dashboard', 'https://greyin.net')
  await verifyPage.goto('/admin/stackworks')
  await expect(verifyPage).toHaveURL(/\/admin\/stackworks/)
  await verifyCtx.close()
})
