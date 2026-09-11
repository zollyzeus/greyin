import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin, createTestBuilderProject } from '../../utils/admin'

/**
 * Salt & Pepper's own /admin has a "Projects (The Lab)" moderation
 * section over the same shared builder_projects table StackWorks owns,
 * posting to its own /api/admin/projects/delete route -- distinct from
 * stackworks/admin.spec.ts, which already covers deleting a project
 * through StackWorks's own admin UI. This is Salt & Pepper's parallel
 * moderation capability over the same table, not a duplicate of that.
 *
 * Seeded directly via the service role rather than through StackWorks's
 * /projects/new UI -- the point here is Salt & Pepper's delete action,
 * not project creation (already covered elsewhere).
 */
test('an admin can delete a builder project from Salt & Pepper\'s own admin panel', async ({ browser, cleanup }) => {
  const ownerCtx = await browser.newContext()
  const ownerPage = await ownerCtx.newPage()
  const owner = await signUpSaltNPepper(ownerPage, cleanup)
  const ownerId = await getUserIdByEmail(owner.email)
  await ownerCtx.close()

  const title = `E2E SnP Admin Project Delete ${Date.now()}`
  const project = await createTestBuilderProject(ownerId, { title })

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
    .locator(`input[name="project_id"][value="${project.id}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Delete' })
    .click()
  await adminPage.waitForURL('/admin')
  await expect(adminPage.getByText(title)).not.toBeVisible()

  await adminCtx.close()
})
