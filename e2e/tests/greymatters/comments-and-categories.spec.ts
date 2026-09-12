import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { createTestPost, getFirstCategory } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function createTestCategory(fields: { name: string; slug: string; color: string }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/categories`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(fields),
  })
  const [row] = await res.json()
  return row as { id: string; slug: string }
}

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

  // safeCategoryColor() (apps/greymatters-blog/src/app/lib/safe-color.ts)
  // -- categories.color is a plain unconstrained TEXT column with no
  // admin UI to edit it today, so this is a defensive guard rather than
  // a fix for a live incident: nothing stops a future admin-set color
  // extreme enough to vanish against one of this app's two themed card
  // backgrounds (bg-white / dark:bg-gray-900), since the page renders
  // server-side with no way to know the viewer's actual (client-side,
  // localStorage-driven) theme choice.
  test('a category color too dark or too light for either theme falls back to the safe default', async ({ page, cleanup }) => {
    const suffix = Date.now()
    const tooDarkName = `E2E Too-Dark Category ${suffix}`
    const safeName = `E2E Safe Color Category ${suffix}`

    const tooDark = await createTestCategory({ name: tooDarkName, slug: `e2e-too-dark-${suffix}`, color: '#0a0a0a' })
    cleanup.trackEntity('categories', tooDark.id)

    const safe = await createTestCategory({ name: safeName, slug: `e2e-safe-color-${suffix}`, color: '#3B82F6' })
    cleanup.trackEntity('categories', safe.id)

    await page.goto('/categories')

    const tooDarkCard = page.locator('a').filter({ hasText: tooDarkName })
    await expect(tooDarkCard.locator('svg').first()).toHaveCSS('color', 'rgb(37, 99, 235)') // #2563eb fallback

    const safeCard = page.locator('a').filter({ hasText: safeName })
    await expect(safeCard.locator('svg').first()).toHaveCSS('color', 'rgb(59, 130, 246)') // #3B82F6, unchanged
  })
})
