import { test, expect } from '../../utils/fixtures'
import { createTestPost } from '../../utils/admin'
import { waitForURLResilient } from '../../utils/nav'

test.describe('Newsletter and search', () => {
  test('subscribing on the homepage shows a confirmation', async ({ page, cleanup }) => {
    await page.goto('/')
    const email = `test+newsletter-${Date.now()}@greyin.net`
    cleanup.trackByColumn('newsletter_subscribers', 'email', email)
    await page.locator('input[name="email"][placeholder="you@example.com"]').fill(email)
    await page.getByRole('button', { name: 'Subscribe' }).click()
    await page.waitForURL(/newsletter_success=1/)
    await expect(page.getByText('Thanks for subscribing!')).toBeVisible()
  })

  test('an invalid email is rejected with an error message', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[name="email"][placeholder="you@example.com"]').fill('not-an-email')
    // Bypass the browser's native email validation so the server-side check
    // runs — must happen after fill(), since fill()'s input event causes a
    // React re-render that resets `type` back to "email" (the JSX still
    // declares it), silently blocking the click below via native validation
    // if done any earlier.
    await page.evaluate(() => {
      const input = document.querySelector('input[name="email"]') as HTMLInputElement
      input.type = 'text'
    })
    await page.getByRole('button', { name: 'Subscribe' }).click()
    await waitForURLResilient(page, /newsletter_error=/, () =>
      page.getByRole('button', { name: 'Subscribe' }).click()
    )
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
  })

  test('search finds a post by title and shows no results for nonsense queries', async ({ page, cleanup }) => {
    const post = await createTestPost({ title: `Findable E2E Post ${Date.now()}` })
    cleanup.trackEntity('posts', post.id)
    await page.goto(`/search?q=${encodeURIComponent('Findable E2E Post')}`)
    await expect(page.getByText('Findable E2E Post', { exact: false }).first()).toBeVisible()

    await page.goto('/search?q=zzznonexistentqueryzzz')
    await expect(page.getByText('0 results')).toBeVisible()
  })
})
