import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'

test('a newly joined member appears in the members directory with their experience', async ({ page, cleanup }) => {
  const user = await signUpSaltNPepper(page, cleanup)
  await login(page, user, '/dashboard')

  // Every "sp" test run produces an identically-named member with the same
  // years_experience (fixed firstName/lastName/experience, not per-run
  // unique), so after many runs there are several matches — the members
  // list is newest-first, so .first() is ours.
  await page.goto('/members')
  await expect(page.getByText(`${user.firstName} ${user.lastName}`).first()).toBeVisible()
  await expect(page.getByText('15 years of experience').first()).toBeVisible()
})
