import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { getPostIdBySlug } from '../../utils/admin'
import path from 'path'

test('an author can upload a cover image when writing a post', async ({ page, cleanup }) => {
  const user = await signUpGreyMatters(page, cleanup)
  await login(page, user, '/dashboard')

  const title = `E2E Image Upload Post ${Date.now()}`
  await page.goto('/posts/new')
  await page.locator('#title').fill(title)
  await page.locator('#content').fill('Exercises the cover-image upload flow.')

  await page.locator('input[type="file"]').setInputFiles(
    path.join(__dirname, '../../fixtures/test-image.png')
  )
  // The uploader swaps the label to "Change image" once the upload
  // resolves and a public URL lands in the hidden field.
  await expect(page.getByText('Change image')).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Save Post' }).click()
  await page.waitForURL('/posts')

  await page.getByRole('link', { name: 'Edit' }).first().click()
  await page.waitForURL(/\/posts\/.+\/edit/)
  // posts.author_id is ON DELETE SET NULL, not CASCADE — track explicitly.
  cleanup.trackEntity('posts', await getPostIdBySlug(page.url().split('/posts/')[1].replace('/edit', '')))
  const coverImage = page.locator('img[alt=""]').first()
  await expect(coverImage).toBeVisible()
  await expect(coverImage).toHaveAttribute('src', /public-images\/post-covers\//)
})
