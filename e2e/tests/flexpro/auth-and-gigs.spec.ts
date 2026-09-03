import { test, expect } from '../../utils/fixtures'
import { getUserIdByEmail, grantFreeagentSubscription } from '../../utils/admin'
import { signUpFlexPro, login } from '../../utils/auth'

test.describe('FlexPro auth and gig listing', () => {
  test('a freelancer can sign up, log in, and list a gig that shows up in the marketplace', async ({ page, cleanup }) => {
    const freelancer = await signUpFlexPro(page, 'freelancer', cleanup)
    await grantFreeagentSubscription(await getUserIdByEmail(freelancer.email))
    await login(page, freelancer, '/dashboard')

    await page.goto('/gigs/new')
    const gigTitle = `E2E CAN bus dashboard ${Date.now()}`
    await page.locator('#title').fill(gigTitle)
    await page.locator('#description').fill('A gig created end-to-end by the Playwright suite.')
    await page.locator('#price_min').fill('1000')
    await page.getByRole('button', { name: 'Publish Gig' }).click()

    await page.waitForURL(/\/gigs\//)
    await expect(page.getByText(gigTitle)).toBeVisible()

    await page.goto('/gigs')
    await expect(page.getByText(gigTitle)).toBeVisible()
    // The listing card used to hardcode "4.9 (123)" for every gig
    // regardless of real review data -- a freshly created freelancer
    // with zero reviews should now show "New seller" instead.
    const card = page.locator('a', { hasText: gigTitle })
    await expect(card.getByText('New seller')).toBeVisible()
    await expect(card.getByText('4.9')).not.toBeVisible()
  })

  test('a client can sign up and log in', async ({ page, cleanup }) => {
    const client = await signUpFlexPro(page, 'client', cleanup)
    await login(page, client, '/dashboard')
  })
})
