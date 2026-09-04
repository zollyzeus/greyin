import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'

test('a discussion author is notified when someone replies', async ({ browser, cleanup }) => {
  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpSaltNPepper(authorPage, cleanup)
  await login(authorPage, author, '/dashboard')

  const title = `E2E Notification Discussion ${Date.now()}`
  await authorPage.goto('/discussions/new')
  await authorPage.locator('#title').fill(title)
  await authorPage.locator('#body').fill('Started to exercise notifications.')
  await authorPage.getByRole('button', { name: 'Post Discussion' }).click()
  await authorPage.waitForURL(/\/discussions\/[^/]+$/)

  const replierCtx = await browser.newContext()
  const replierPage = await replierCtx.newPage()
  const replier = await signUpSaltNPepper(replierPage, cleanup)
  await login(replierPage, replier, '/dashboard')

  await replierPage.goto(authorPage.url())
  await replierPage.locator('textarea[name="body"]').fill(`E2E notification reply ${Date.now()}`)
  await replierPage.getByRole('button', { name: 'Post Reply' }).click()
  await replierCtx.close()

  // The bell badge is rendered on dashboard load, so re-visiting picks up
  // the trigger-inserted notification.
  await authorPage.goto('/dashboard')
  await expect(authorPage.getByLabel('Notifications')).toContainText('1')

  await authorPage.goto('/notifications')
  await expect(authorPage.getByText('New reply to your discussion')).toBeVisible()
  await expect(authorPage.getByText(title, { exact: false })).toBeVisible()

  // Viewing the page marks it read — the badge should be gone now.
  await authorPage.goto('/dashboard')
  await expect(authorPage.getByLabel('Notifications').locator('span')).toHaveCount(0)

  await authorCtx.close()
})
