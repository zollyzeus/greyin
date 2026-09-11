import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'

test('an author can write, edit, publish and delete their own post', async ({ page, cleanup }) => {
  const user = await signUpGreyMatters(page, cleanup)
  await login(page, user, '/dashboard')

  const title = `E2E CMS Post ${Date.now()}`
  await page.goto('/posts/new')
  await page.locator('#title').fill(title)
  await page.locator('#excerpt').fill('Written end to end by the Playwright suite.')
  await page.locator('#content').fill('This post exercises the in-app author CMS.')
  await page.locator('#status').selectOption('draft')
  await page.getByRole('button', { name: 'Save Post' }).click()
  await page.waitForURL('/posts')

  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByText('draft', { exact: false }).first()).toBeVisible()

  await page.getByRole('link', { name: 'Edit' }).first().click()
  await page.waitForURL(/\/posts\/.+\/edit/)
  const updatedTitle = `${title} (updated)`
  await page.locator('#title').fill(updatedTitle)
  await page.locator('#status').selectOption('published')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await page.waitForURL('/posts')

  await expect(page.getByText(updatedTitle)).toBeVisible()
  await expect(page.getByText('published', { exact: false }).first()).toBeVisible()

  // Published posts are publicly viewable — confirm it actually shows up
  // on the site, not just in the author's own list.
  await page.goto('/')
  await expect(page.getByText(updatedTitle)).toBeVisible()

  await page.goto('/posts')
  await page.getByRole('link', { name: 'Edit' }).first().click()
  await page.waitForURL(/\/posts\/.+\/edit/)
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Delete Post' }).click()
  await page.waitForURL('/posts')
  await expect(page.getByText(updatedTitle)).not.toBeVisible()
})
