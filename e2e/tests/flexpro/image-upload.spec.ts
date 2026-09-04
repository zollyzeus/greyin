import { test, expect } from '../../utils/fixtures'
import { getUserIdByEmail, grantFreeagentSubscription } from '../../utils/admin'
import { signUpFlexPro, login } from '../../utils/auth'
import path from 'path'

test('a freelancer can upload a cover image when listing a gig', async ({ page, cleanup }) => {
  const user = await signUpFlexPro(page, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(user.email))
  await login(page, user, '/dashboard')

  const gigTitle = `E2E Image Upload Gig ${Date.now()}`
  await page.goto('/gigs/new')
  await page.locator('#title').fill(gigTitle)
  await page.locator('#description').fill('Exercises the gig cover-image upload flow.')
  await page.locator('#price_min').fill('1000')

  await page.locator('input[type="file"]').setInputFiles(
    path.join(__dirname, '../../fixtures/test-image.png')
  )
  await expect(page.getByText('Change image')).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Publish Gig' }).click()
  await page.waitForURL(/\/gigs\/[^/]+$/)

  // ImageUploader.tsx nests uploads under the uploader's own user.id
  // before the folder name (`${user.id}/${folder}/...`), so the real
  // storage path is public-images/<userId>/gig-images/<file> -- not
  // public-images/gig-images/<file> adjacent, which this locator
  // incorrectly assumed and could never match regardless of whether the
  // upload itself worked.
  const coverImage = page.locator('img[src*="/gig-images/"]')
  await expect(coverImage).toBeVisible()
})
