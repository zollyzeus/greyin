import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
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

// Cross-app spot-check of the NotificationBell rollout (identical component,
// piloted and fully verified against Salt & Pepper's own copy in
// notification-bell.spec.ts there) -- confirms the same live-delivery path
// works on a second app, not just the pilot.
test('a notification inserted while the page is open updates the bell live, with no reload', async ({ page, cleanup }) => {
  const candidate = await signUpDeepEdge(page, 'candidate', cleanup)
  const candidateId = await getUserIdByEmail(candidate.email)
  await login(page, candidate, '/dashboard')

  await page.goto('/jobs')

  const bellButton = page.getByRole('button', { name: 'Notifications' })
  await expect(bellButton).toBeVisible()
  await expect(page.locator('span.bg-red-600')).not.toBeVisible()

  const title = `E2E Realtime Notification ${Date.now()}`
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      user_id: candidateId,
      type: 'test_realtime',
      title,
      body: 'Exercises the live notification bell end to end.',
      link: '/dashboard',
    }),
  })
  expect(insertRes.ok).toBeTruthy()

  await expect(page.locator('span.bg-red-600')).toHaveText('1', { timeout: 15_000 })

  await bellButton.click()
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.locator('span.bg-red-600')).not.toBeVisible()
})
