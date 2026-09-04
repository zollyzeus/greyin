import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, signUpStackWorksSupporter, login } from '../../utils/auth'

/**
 * Covers migration 051_stackworks_notifications.sql's two application-
 * lifecycle triggers end to end, plus the ask-closing flow itself
 * (untested before this session, since applications.spec.ts only
 * exercises accept/decline, never closing the ask):
 *
 * - notify_new_project_application: the Builder gets a notification (and
 *   dashboard bell increment) the moment a Supporter applies -- the same
 *   shape as freeagent/notifications.spec.ts.
 * - notify_ask_closed: a still-*pending* applicant gets notified when the
 *   Builder closes the ask, and a fresh Supporter viewing the now-closed
 *   ask sees "Closed" with no Apply control.
 */
test('a Builder is notified of a new application, closes the ask, and the still-pending applicant is notified', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup)
  await login(builderPage, builder, '/dashboard')

  const projectTitle = `E2E Ask Close Project ${Date.now()}`
  await builderPage.goto('/projects/new')
  await builderPage.locator('#title').fill(projectTitle)
  await builderPage.locator('#description').fill('A project used to exercise closing an ask and its notifications.')
  await builderPage.getByRole('button', { name: 'Post Project' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+$/)

  await builderPage.getByRole('link', { name: 'Post an ask' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await builderPage.locator('#role_title').fill('Backend — ask close flow')
  await builderPage.getByRole('button', { name: 'Post Ask' }).click()
  await builderPage.waitForURL(/\/asks\/[^/]+$/)
  const askUrl = builderPage.url()

  const supporterCtx = await browser.newContext()
  const supporterPage = await supporterCtx.newPage()
  const supporter = await signUpStackWorksSupporter(supporterPage, cleanup)
  await login(supporterPage, supporter, '/dashboard')

  await supporterPage.goto(askUrl)
  await supporterPage.locator('#pitch').fill('I can take this on and would love to help.')
  await supporterPage.getByRole('button', { name: 'Apply' }).click()
  await expect(supporterPage.getByText('Pending')).toBeVisible()

  // notify_new_project_application (051) -- the Builder gets notified the
  // moment the application lands.
  await builderPage.goto('/dashboard')
  await expect(builderPage.getByLabel('Notifications')).toContainText('1')
  await builderPage.goto('/notifications')
  await expect(builderPage.getByText('New application received')).toBeVisible()

  // Builder closes the ask without accepting/declining the application --
  // it stays 'pending', which is exactly what notify_ask_closed targets.
  await builderPage.goto(askUrl)
  await builderPage.getByRole('button', { name: 'Close this ask' }).click()
  await expect(builderPage.getByText('Closed', { exact: true })).toBeVisible()

  // notify_ask_closed (051) -- the still-pending applicant is notified.
  await supporterPage.goto('/dashboard')
  await expect(supporterPage.getByLabel('Notifications')).toContainText('1')
  await supporterPage.goto('/notifications')
  await expect(supporterPage.getByText('Ask closed')).toBeVisible()

  // A fresh Supporter viewing the now-closed ask sees no Apply control.
  const freshCtx = await browser.newContext()
  const freshPage = await freshCtx.newPage()
  const freshSupporter = await signUpStackWorksSupporter(freshPage, cleanup)
  await login(freshPage, freshSupporter, '/dashboard')
  await freshPage.goto(askUrl)
  await expect(freshPage.getByText('This ask is closed.')).toBeVisible()
  await expect(freshPage.getByRole('button', { name: 'Apply' })).not.toBeVisible()

  await builderCtx.close()
  await supporterCtx.close()
  await freshCtx.close()
})
