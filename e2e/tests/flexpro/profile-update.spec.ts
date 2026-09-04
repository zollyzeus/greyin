import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'

/**
 * Covers the integrity-audit fix (114 / 2026-09-04): profile-save used
 * to bundle 'title'/'skills'/'languages'/'razorpay_account_id' into one
 * .update() against a table where none of those columns existed -- any
 * one unknown column fails the WHOLE PostgREST statement, so no FlexPro
 * user could save ANY profile field. 'title'/'languages' now have real
 * columns; 'skills' was redirected to the existing platform-wide
 * profile_skills table (the same one skill_endorsements/skill_ratings
 * already read, and that DeepEdge's candidates.skills already syncs
 * into) instead of a new column; razorpay_account_id was dropped
 * entirely -- superseded by the real bank-detail payout flow on
 * /earnings, confirmed still reachable there.
 */
test('a freelancer can save their profile, including title/languages/skills that used to be silently dropped', async ({ page, cleanup }) => {
  const user = await signUpFlexPro(page, 'freelancer', cleanup)
  await login(page, user, '/dashboard')
  await page.goto('/profile')

  await page.locator('input[name="full_name"]').fill(`${user.firstName} Updated`)
  await page.locator('input[name="title"]').fill('E2E Test Title')
  await page.locator('input[name="languages"]').fill('English, French')
  await page.locator('input[name="skills"]').fill('Logo Design, Branding')
  await page.getByRole('button', { name: 'Save Changes' }).click()

  await page.waitForURL(/\/profile\?success=true/)
  await expect(page.locator('input[name="title"]')).toHaveValue('E2E Test Title')
  await expect(page.locator('input[name="languages"]')).toHaveValue('English, French')
  await expect(page.locator('input[name="skills"]')).toHaveValue('Logo Design, Branding')

  // profile_skills full-replace semantics: removing a skill from the
  // field and saving again should actually remove it, not just leave it
  // stranded (the delete-stale-rows half of the route's own logic).
  await page.locator('input[name="skills"]').fill('Logo Design')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await page.waitForURL(/\/profile\?success=true/)
  await expect(page.locator('input[name="skills"]')).toHaveValue('Logo Design')

  await page.reload()
  await expect(page.locator('input[name="skills"]')).toHaveValue('Logo Design')
})
