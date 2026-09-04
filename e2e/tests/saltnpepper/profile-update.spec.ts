import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'

/**
 * Covers the integrity-audit fix (114 / 2026-09-04): profile-save used
 * to bundle 'linkedin'/'twitter' (misnamed columns) and
 * email_notifications/comment_notifications (columns that never
 * existed) into one .update() -- any one unknown column fails the WHOLE
 * PostgREST statement, so no Salt & Pepper user could save ANY profile
 * field. 'interests' now has a real column (previously silently
 * dropped); the dead notification checkboxes were removed entirely
 * rather than given real columns (no email-sending system exists
 * anywhere to act on them).
 */
test('a member can save their profile, including interests which used to be silently dropped', async ({ page, cleanup }) => {
  const user = await signUpSaltNPepper(page, cleanup)
  await login(page, user, '/dashboard')
  await page.goto('/profile')

  await page.locator('input[name="full_name"]').fill(`${user.firstName} Updated`)
  await page.locator('input[name="interests"]').fill('Hiking, Chess, Woodworking')
  await page.locator('input[name="linkedin"]').fill('https://linkedin.com/in/e2etesthandle')
  await page.getByRole('button', { name: 'Save Changes' }).click()

  await page.waitForURL(/\/profile\?success=true/)
  await expect(page.locator('input[name="full_name"]')).toHaveValue(`${user.firstName} Updated`)
  await expect(page.locator('input[name="interests"]')).toHaveValue('Hiking, Chess, Woodworking')
  await expect(page.locator('input[name="linkedin"]')).toHaveValue('https://linkedin.com/in/e2etesthandle')
})
