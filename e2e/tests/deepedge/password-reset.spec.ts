import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge } from '../../utils/auth'
import { confirmTestUserEmail, getRecoveryOtp } from '../../utils/admin'
import { waitForURLResilient } from '../../utils/nav'

/**
 * SEC-015 (2026-08-24 security audit): the reset code had no guess limit
 * at all before 075_auth_rate_limiting.sql -- 5 wrong codes now locks
 * further attempts for 20 minutes, even the genuinely correct one, closing
 * the brute-force window a bare 6-digit code would otherwise leave open.
 */
test('too many wrong reset codes locks out further attempts, even the correct one', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  await confirmTestUserEmail(user.email, 'candidate')

  await page.goto('/reset-password')
  await page.locator('#email').fill(user.email)
  await page.getByRole('button', { name: 'Send reset code' }).click()
  await waitForURLResilient(page, /\/reset-password\/confirm/, () =>
    page.getByRole('button', { name: 'Send reset code' }).click()
  )

  const otp = await getRecoveryOtp(user.email)
  const newPassword = 'NewTestPass!2026'

  for (let attempt = 0; attempt < 5; attempt++) {
    await page.locator('#code').fill('000000')
    await page.locator('#password').fill(newPassword)
    await page.locator('#confirm-password').fill(newPassword)
    await page.getByRole('button', { name: 'Update password' }).click()
    // The button disables to "Updating..." while the fetch is in flight and
    // re-enables to "Update password" once it resolves -- waiting for that
    // is a reliable settle point without a fixed sleep.
    await expect(page.getByRole('button', { name: 'Update password' })).toBeEnabled()
  }

  // The 6th attempt, even with the real code, is rejected by the lockout
  // -- not by GoTrue's own "invalid code" error.
  await page.locator('#code').fill(otp)
  await page.locator('#password').fill(newPassword)
  await page.locator('#confirm-password').fill(newPassword)
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('Too many attempts', { exact: false })).toBeVisible()
})

test('a candidate can reset their password and log in with the new one', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  await confirmTestUserEmail(user.email, 'candidate')

  await page.goto('/reset-password')
  await page.locator('#email').fill(user.email)
  await page.getByRole('button', { name: 'Send reset code' }).click()
  await waitForURLResilient(page, /\/reset-password\/confirm/, () =>
    page.getByRole('button', { name: 'Send reset code' }).click()
  )

  const otp = await getRecoveryOtp(user.email)
  const newPassword = 'NewTestPass!2026'

  await page.locator('#code').fill(otp)
  await page.locator('#password').fill(newPassword)
  await page.locator('#confirm-password').fill(newPassword)
  await page.getByRole('button', { name: 'Update password' }).click()
  await page.waitForURL(/\/login/)

  // verifyOtp (recovery) establishes a real session, so the reset flow
  // leaves the user already logged in — log out explicitly so signing back
  // in actually exercises the new password rather than riding the existing
  // session past a login page that would just redirect straight through.
  // Unlike the other 3 apps, deepedge's candidate dashboard logout button
  // is icon-only with no accessible text label, so it can't be targeted by
  // role name — go straight at the logout form instead.
  await page.goto('/dashboard')
  await page.locator('form[action="/auth/logout"] button').click()
  await waitForURLResilient(page, '/login', () =>
    page.locator('form[action="/auth/logout"] button').click()
  )

  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(newPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/dashboard')
})
