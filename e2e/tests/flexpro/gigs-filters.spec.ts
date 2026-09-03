import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { getGigCategories, getUserIdByEmail, grantFreeagentSubscription } from '../../utils/admin'

/**
 * Covers the /gigs page's real filter form (id="gig-filters", wired this
 * session) -- category, price range, and delivery time are each real
 * gigs columns (category_id, price_min, delivery_days), not free text,
 * so two gigs with deliberately different values give a deterministic
 * way to prove each checkbox actually narrows the result set.
 */
test('the /gigs filter form narrows results by category, price range, and delivery time', async ({ page, cleanup }) => {
  const categories = await getGigCategories(2)
  test.skip(categories.length < 2, 'Needs at least two real gig_categories rows to exercise the category filter.')
  const [categoryA, categoryB] = categories

  const seller = await signUpFlexPro(page, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(seller.email))
  await login(page, seller, '/dashboard')

  const gigA = `E2E Filter Gig A ${Date.now()}`
  await page.goto('/gigs/new')
  await page.locator('#title').fill(gigA)
  await page.locator('#description').fill('Cheap, fast-delivery gig used to exercise gig filters.')
  await page.locator('#category_id').selectOption(categoryA.id)
  await page.locator('#price_min').fill('500')
  await page.locator('#delivery_days').fill('1')
  await page.getByRole('button', { name: 'Publish Gig' }).click()
  await page.waitForURL(/\/gigs\/[^/]+$/)

  const gigB = `E2E Filter Gig B ${Date.now()}`
  await page.goto('/gigs/new')
  await page.locator('#title').fill(gigB)
  await page.locator('#description').fill('Pricier, slower-delivery gig used to exercise gig filters.')
  await page.locator('#category_id').selectOption(categoryB.id)
  await page.locator('#price_min').fill('8000')
  await page.locator('#delivery_days').fill('10')
  await page.getByRole('button', { name: 'Publish Gig' }).click()
  await page.waitForURL(/\/gigs\/[^/]+$/)

  // Category
  await page.goto('/gigs')
  await page.locator(`input[name="category"][value="${categoryA.id}"]`).check()
  await page.getByRole('button', { name: 'Apply Filters' }).click()
  await page.waitForURL(/category=/)
  await expect(page.getByText(gigA)).toBeVisible()
  await expect(page.getByText(gigB)).not.toBeVisible()

  // Price range
  await page.goto('/gigs')
  await page.locator('input[name="price"][value="under_1000"]').check()
  await page.getByRole('button', { name: 'Apply Filters' }).click()
  await page.waitForURL(/price=under_1000/)
  await expect(page.getByText(gigA)).toBeVisible()
  await expect(page.getByText(gigB)).not.toBeVisible()

  // Delivery time
  await page.goto('/gigs')
  await page.locator('input[name="delivery"][value="1"]').check()
  await page.getByRole('button', { name: 'Apply Filters' }).click()
  await page.waitForURL(/delivery=1/)
  await expect(page.getByText(gigA)).toBeVisible()
  await expect(page.getByText(gigB)).not.toBeVisible()
})
