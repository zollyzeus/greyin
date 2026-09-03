import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

test('an employer can visit their company settings page', async ({ page, cleanup }) => {
  const employer = await signUpDeepEdge(page, 'employer', cleanup)
  await login(page, employer, '/employer/dashboard')

  await page.goto('/employer/settings')
  await expect(page.getByRole('heading', { name: 'Company Settings' })).toBeVisible()
})
