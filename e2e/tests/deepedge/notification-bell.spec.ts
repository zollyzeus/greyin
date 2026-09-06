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

async function insertNotification(userId: string, title: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      user_id: userId,
      type: 'test_realtime',
      title,
      body: 'Exercises the live notification bell end to end.',
      link: '/dashboard',
    }),
  })
  expect(res.ok).toBeTruthy()
}

// Cross-app spot-check of the NotificationBell rollout (identical component,
// piloted and fully verified against Salt & Pepper's own copy in
// notification-bell.spec.ts there) -- confirms the same live-delivery path
// works on a second app, not just the pilot.
test('a notification inserted while the page is open updates the bell live, with a toast, and no reload', async ({ page, cleanup }) => {
  const candidate = await signUpDeepEdge(page, 'candidate', cleanup)
  const candidateId = await getUserIdByEmail(candidate.email)
  await login(page, candidate, '/dashboard')

  await page.goto('/jobs')

  const bellButton = page.getByRole('button', { name: 'Notifications' })
  await expect(bellButton).toBeVisible()
  await expect(page.locator('span.bg-red-600')).not.toBeVisible()

  const title = `E2E Realtime Notification ${Date.now()}`
  await insertNotification(candidateId, title)

  await expect(page.locator('span.bg-red-600')).toHaveText('1', { timeout: 15_000 })

  // 2026-09-06 (UI/UX elevation plan, Phase 2): arrival now also raises a
  // lightweight toast, independent of the dropdown being open.
  const toast = page.getByTestId('notification-toast')
  await expect(toast).toBeVisible()
  await expect(toast).toContainText(title)
  await page.getByTestId('notification-toast-dismiss').click()
  await expect(toast).not.toBeVisible()

  // 2026-09-06: opening the dropdown no longer marks everything read --
  // the badge must survive just looking at it. (Previously this cleared
  // to 0 on open; that eager mark-all-on-open was the thing this pass
  // removed.)
  await bellButton.click()
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.locator('span.bg-red-600')).toHaveText('1')
})

test('clicking one notification marks only that one read; Mark all read clears the rest', async ({ page, cleanup }) => {
  const candidate = await signUpDeepEdge(page, 'candidate', cleanup)
  const candidateId = await getUserIdByEmail(candidate.email)
  await login(page, candidate, '/dashboard')
  await page.goto('/jobs')

  const bellButton = page.getByRole('button', { name: 'Notifications' })
  const firstTitle = `E2E Bell First ${Date.now()}`
  const secondTitle = `E2E Bell Second ${Date.now()}`
  await insertNotification(candidateId, firstTitle)
  await expect(page.locator('span.bg-red-600')).toHaveText('1', { timeout: 15_000 })
  await insertNotification(candidateId, secondTitle)
  await expect(page.locator('span.bg-red-600')).toHaveText('2', { timeout: 15_000 })

  await bellButton.click()
  // Clicking the older item navigates (its link points at /dashboard,
  // same as every trigger-fired notification in this codebase) -- that
  // navigation itself is the proof the click was registered, and the
  // read-marking write fires before the navigation per NotificationBell's
  // own onClick.
  await page.getByText(firstTitle).first().click()
  await page.waitForURL(/\/dashboard$/)

  // DeepEdge's own dashboard bar mounts NotificationBell directly (not
  // SiteHeader) -- one unread should remain: the second notification.
  const dashboardBell = page.getByRole('button', { name: 'Notifications' })
  await expect(page.locator('span.bg-red-600')).toHaveText('1', { timeout: 10_000 })

  await dashboardBell.click()
  await expect(page.getByText(secondTitle)).toBeVisible()
  const markAll = page.getByTestId('mark-all-read')
  await expect(markAll).toBeVisible()
  await markAll.click()
  await expect(page.locator('span.bg-red-600')).not.toBeVisible()
})
