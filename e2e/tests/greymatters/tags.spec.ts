import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { getPostIdBySlug } from '../../utils/admin'

/**
 * The links-audit found every post tag chip linking to /tags/{tag}, a
 * route that never existed -- and separately, that `posts.tags` had no
 * write path anywhere (create/update routes both hardcoded []), so no
 * post could ever actually carry a tag through the real UI. This proves
 * the full loop closed: set a tag at creation, the chip renders on the
 * post page, and clicking it lands on a real /tags/{tag} listing that
 * actually contains the post.
 */
test('a tag set at post creation renders as a working link to a real /tags page', async ({ page, cleanup }) => {
  const author = await signUpGreyMatters(page, cleanup)
  await login(page, author, '/dashboard')

  const title = `E2E Tags Post ${Date.now()}`
  const tag = `e2e-tag-${Date.now()}`
  await page.goto('/posts/new')
  await page.locator('#title').fill(title)
  await page.locator('#excerpt').fill('Exercises the tags write path and /tags/{tag} route.')
  await page.locator('#content').fill('Post body used to test tagging end to end.')
  await page.locator('#tags').fill(`  ${tag}  , ${tag} `) // deliberately includes whitespace + an exact duplicate
  await page.locator('#status').selectOption('published')
  await page.getByRole('button', { name: 'Save Post' }).click()
  await page.waitForURL('/posts')

  const slug = (await page.locator('div.p-6', { hasText: title }).getByRole('link', { name: 'Edit' }).getAttribute('href'))!.split('/posts/')[1].replace('/edit', '')
  cleanup.trackEntity('posts', await getPostIdBySlug(slug))

  await page.goto(`/posts/${slug}`)
  const tagChip = page.getByRole('link', { name: `#${tag}` })
  await expect(tagChip).toBeVisible()
  // Whitespace-trimmed and de-duplicated -- only one chip for the tag,
  // not two.
  await expect(page.getByRole('link', { name: `#${tag}` })).toHaveCount(1)

  await tagChip.click()
  await page.waitForURL(`/tags/${tag}`)
  await expect(page.getByRole('heading', { name: `#${tag}` })).toBeVisible()
  await expect(page.getByText(title)).toBeVisible()
})
