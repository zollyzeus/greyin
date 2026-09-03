import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

/**
 * A Builder self-submitting their own project as "shipped" can't be
 * allowed to review their own submission (031/033's RLS explicitly
 * excludes the subject from reviewing their own outcome) -- an admin is
 * the reviewer here instead, same override path as the collaboration
 * flow's admin section. The local Ollama provider (admin-panel-managed,
 * no API key) reviews it first, same as verification.spec.ts, but the
 * admin's human score is still what actually resolves the outcome --
 * this exercises that resolution path for project_shipped specifically,
 * a genuinely different code path from collaboration_completed.
 */
test('a Builder submits their project as shipped and an admin verifies it', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup)
  await login(builderPage, builder, '/dashboard')

  const projectTitle = `E2E Shipped Project ${Date.now()}`
  await builderPage.goto('/projects/new')
  await builderPage.locator('#title').fill(projectTitle)
  await builderPage.locator('#description').fill('A project used to exercise self-verification.')
  await builderPage.getByRole('button', { name: 'Post Project' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+$/)
  const projectUrl = builderPage.url()

  await builderPage.locator('#ship-summary').fill('Shipped and deployed to production.')
  await builderPage.locator('#ship-evidence').fill('https://example.com/demo')
  await builderPage.getByRole('button', { name: 'Submit for verification' }).click()
  await expect(builderPage.getByText('Submitted — awaiting review.')).toBeVisible()
  await expect(builderPage.getByText(/AI review: \d+\/100/)).toBeVisible()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpStackWorksBuilder(adminPage, cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, '/dashboard')

  await adminPage.goto('/admin')
  // Scoped to this test's own row -- the admin review queue is shared,
  // global state (not scoped per test), so a concurrently-running spec
  // that also leaves a pending human review (e.g. verification.spec.ts)
  // can land its own "human_score" input on the same page at the same
  // time under parallel workers. An unscoped locator then resolves to
  // more than one element (Playwright strict-mode violation) even though
  // nothing is actually broken -- both rows are legitimately pending.
  const reviewRow = adminPage.locator('div.py-4', { hasText: `${projectTitle} (self-submitted, review required)` })
  await expect(reviewRow).toBeVisible()
  await reviewRow.locator('input[name="human_score"]').fill('90')
  await reviewRow.locator('input[name="human_notes"]').fill('Confirmed working live.')
  await reviewRow.getByRole('button', { name: 'Resolve' }).click()
  await adminPage.waitForURL('/admin')
  await expect(adminPage.getByText(`${projectTitle} (self-submitted, review required)`)).not.toBeVisible()

  await builderPage.goto(projectUrl)
  await expect(builderPage.getByText('Verified shipped · 90/100')).toBeVisible()

  await builderCtx.close()
  await adminCtx.close()
})
