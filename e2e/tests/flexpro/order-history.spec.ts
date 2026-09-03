import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'

test('a buyer can visit their order history page', async ({ page, cleanup }) => {
  const buyer = await signUpFlexPro(page, 'client', cleanup)
  await login(page, buyer, '/dashboard')

  await page.goto('/orders')
  await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible()
})
