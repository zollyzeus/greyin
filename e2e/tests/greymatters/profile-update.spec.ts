import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'

/**
 * Covers the integrity-audit fix (114 / 2026-09-04): profile-save used
 * to bundle 'twitter' (a misnamed column) and email_notifications/
 * show_email (columns that never existed) into one .update() -- any one
 * unknown column fails the WHOLE PostgREST statement, so no GreyMatters
 * user could save ANY profile field, not just the broken ones. The dead
 * notification checkboxes were removed entirely rather than given real
 * columns (no email-sending system exists anywhere to act on them).
 */
test('an author can save their profile, including a field that used to be silently dropped', async ({ page, cleanup }) => {
  const user = await signUpGreyMatters(page, cleanup, 15)
  await login(page, user, '/dashboard')
  await page.goto('/profile')

  const bio = `E2E bio ${Date.now()}`
  await page.locator('input[name="full_name"]').fill(`${user.firstName} Updated`)
  await page.locator('textarea[name="bio"]').fill(bio)
  await page.locator('input[name="twitter"]').fill('e2ehandle')
  await page.getByRole('button', { name: 'Save Changes' }).click()

  await page.waitForURL(/\/profile\?success=true/)
  await expect(page.locator('input[name="full_name"]')).toHaveValue(`${user.firstName} Updated`)
  await expect(page.locator('textarea[name="bio"]')).toHaveValue(bio)
  await expect(page.locator('input[name="twitter"]')).toHaveValue('e2ehandle')
})
