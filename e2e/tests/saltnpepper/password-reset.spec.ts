import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper } from '../../utils/auth'
import { confirmTestUserEmail, getRecoveryOtp } from '../../utils/admin'
import { waitForURLResilient } from '../../utils/nav'

test('a member can reset their password and log in with the new one', async ({ page, cleanup }) => {
  const user = await signUpSaltNPepper(page, cleanup)
  await confirmTestUserEmail(user.email, 'member')

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
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Logout' }).click()
  await waitForURLResilient(page, '/login', () =>
    page.getByRole('button', { name: 'Logout' }).click()
  )

  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(newPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/dashboard')
})
