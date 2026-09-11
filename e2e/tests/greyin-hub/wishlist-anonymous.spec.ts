import 'dotenv/config'
import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Anonymous wishlist submission (Emergent-parity gap #2, 144) --
 * reverses 101's deliberate "no anonymous submission" decision. No
 * signup/account created by this spec, so no `cleanup` fixture needed
 * (just @playwright/test, matching homepage.spec.ts in this directory)
 * -- teardown deletes the one row this test creates directly.
 */
test('an anonymous visitor can submit a feature request with just an email', async ({ page }) => {
  const title = `E2E Anonymous Wishlist ${Date.now()}`
  const email = `e2e-wishlist-${Date.now()}@example.com`

  await page.goto('/wishlist')
  await expect(page.getByPlaceholder('Your email')).toBeVisible()

  await page.getByPlaceholder('What should we build?').fill(title)
  await page.getByPlaceholder('Your email').fill(email)
  await page.getByRole('button', { name: 'Submit' }).click()
  await page.waitForURL(/\/wishlist/)

  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByText('Anonymous visitor').first()).toBeVisible()

  const res = await fetch(`${SUPABASE_URL}/rest/v1/feature_requests?title=eq.${encodeURIComponent(title)}&select=id,user_id,email`, {
    headers: restHeaders(),
  })
  const [row] = await res.json()
  expect(row.user_id).toBeNull()
  expect(row.email).toBe(email)

  await fetch(`${SUPABASE_URL}/rest/v1/feature_requests?id=eq.${row.id}`, { method: 'DELETE', headers: restHeaders() })
})

test('an anonymous submission without an email is rejected', async ({ page }) => {
  const title = `E2E Anonymous Wishlist No Email ${Date.now()}`

  await page.goto('/wishlist')
  await page.getByPlaceholder('What should we build?').fill(title)
  // Leave email blank -- the input is `required`, so bypass the browser's
  // own validation via a direct form submit to exercise the server-side check.
  await page.evaluate(() => {
    const form = document.querySelector('form[action="/api/wishlist/create"]') as HTMLFormElement
    form.querySelectorAll('[required]').forEach((el) => el.removeAttribute('required'))
  })
  await page.getByRole('button', { name: 'Submit' }).click()
  await page.waitForURL(/\/wishlist\?error=/)
  await expect(page.getByText(/valid email is required/i)).toBeVisible()

  const res = await fetch(`${SUPABASE_URL}/rest/v1/feature_requests?title=eq.${encodeURIComponent(title)}&select=id`, {
    headers: restHeaders(),
  })
  expect(await res.json()).toEqual([])
})
