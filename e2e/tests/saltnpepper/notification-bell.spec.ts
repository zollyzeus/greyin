import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail } from '../../utils/admin'

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
 * Gap-audit item #2: real-time notification bell (102 + NotificationBell.tsx,
 * piloted here before copying to the other 5 apps). The definitive test of
 * "is Realtime actually delivering events" is a row inserted directly
 * (bypassing any app route, same as every other trigger-fired notification
 * in this codebase) while the page is already open, with no reload -- a
 * badge count that were only fetched once on page load would never move.
 */
test('a notification inserted while the page is open updates the bell live, with no reload', async ({ page, cleanup }) => {
  const member = await signUpSaltNPepper(page, cleanup)
  const memberId = await getUserIdByEmail(member.email)
  await login(page, member, '/dashboard')

  // NotificationBell lives in SiteHeader -- /dashboard has its own bespoke
  // inline header (a pre-existing, separate static bell+badge, out of
  // scope here) and never renders SiteHeader at all, so this needs to be
  // on a page that actually does.
  await page.goto('/discussions')

  // Starts at 0 -- a fresh signup has no notifications yet.
  const bellButton = page.getByRole('button', { name: 'Notifications' })
  await expect(bellButton).toBeVisible()
  await expect(page.locator('span.bg-red-600')).not.toBeVisible()

  const title = `E2E Realtime Notification ${Date.now()}`
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      user_id: memberId,
      type: 'test_realtime',
      title,
      body: 'Exercises the live notification bell end to end.',
      link: '/dashboard',
    }),
  })
  expect(insertRes.ok).toBeTruthy()

  // No page.reload() anywhere above or below this line -- the badge
  // appearing proves the postgres_changes subscription actually fired.
  await expect(page.locator('span.bg-red-600')).toHaveText('1', { timeout: 15_000 })

  await bellButton.click()
  await expect(page.getByText(title)).toBeVisible()

  // Opening the dropdown marks everything read -- badge clears.
  await expect(page.locator('span.bg-red-600')).not.toBeVisible()
})
