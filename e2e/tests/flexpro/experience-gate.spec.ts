import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro } from '../../utils/auth'
import { waitForURLResilient } from '../../utils/nav'

test.describe('FlexPro experience gate', () => {
  test('freelancer signup is rejected for under 12 years of experience', async ({ page, cleanup }) => {
    await signUpFlexPro(page, 'freelancer', cleanup, 5)
    await waitForURLResilient(page, /error=/, () =>
      page.getByRole('button', { name: 'Create account' }).click()
    )
    await expect(page).toHaveURL(/error=/)
    await expect(page.locator('.bg-red-50.text-red-700')).toContainText('12+ years')
  })

  test('client signup is rejected for under 12 years of experience', async ({ page, cleanup }) => {
    await signUpFlexPro(page, 'client', cleanup, 5)
    await waitForURLResilient(page, /error=/, () =>
      page.getByRole('button', { name: 'Create account' }).click()
    )
    await expect(page).toHaveURL(/error=/)
    await expect(page.locator('.bg-red-50.text-red-700')).toContainText('12+ years')
  })
})
