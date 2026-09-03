import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { createTestPost, getFirstCategory } from '../../utils/admin'

test.describe('Post comments and categories', () => {
  test('a signed-in reader can post a comment, which then appears on the page', async ({ page, cleanup }) => {
    const post = await createTestPost()
    cleanup.trackEntity('posts', post.id)
    const user = await signUpGreyMatters(page, cleanup)
    await login(page, user, '/dashboard')

    await page.goto(`/posts/${post.slug}`)
    const commentText = `E2E comment ${Date.now()}`
    await page.locator('textarea[name="content"]').fill(commentText)
    await page.getByRole('button', { name: 'Post Comment' }).click()

    await page.waitForURL(new RegExp(`/posts/${post.slug}`))
    await expect(page.getByText(commentText)).toBeVisible()
  })

  test('an anonymous visitor is prompted to sign in instead of seeing a comment box', async ({ page, cleanup }) => {
    const post = await createTestPost()
    cleanup.trackEntity('posts', post.id)
    await page.goto(`/posts/${post.slug}`)
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
    await expect(page.locator('textarea[name="content"]')).toHaveCount(0)
  })

  test('a post assigned to a category appears on that category\'s page', async ({ page, cleanup }) => {
    const category = await getFirstCategory()
    test.skip(!category, 'No categories seeded in this environment')

    // Unique title, not the default "E2E Test Post" — other specs/manual
    // runs create posts with that same default title, which would make
    // this assertion ambiguous once more than one exists in the category.
    const title = `E2E Category Post ${Date.now()}`
    const post = await createTestPost({ title, category_id: category!.id })
    cleanup.trackEntity('posts', post.id)
    await page.goto(`/categories/${category!.slug}`)
    await expect(page.getByText(title)).toBeVisible()
  })
})
