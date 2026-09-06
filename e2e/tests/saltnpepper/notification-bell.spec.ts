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

/**
 * Gap-audit item #2: real-time notification bell (102 + NotificationBell.tsx,
 * piloted here before copying to the other 5 apps). The definitive test of
 * "is Realtime actually delivering events" is a row inserted directly
 * (bypassing any app route, same as every other trigger-fired notification
 * in this codebase) while the page is already open, with no reload -- a
 * badge count that were only fetched once on page load would never move.
 *
 * 2026-09-06 (UI/UX elevation plan, Phase 2): rewritten for the new
 * behavior -- opening the dropdown no longer marks everything read (it
 * used to; that's the change this pass made), a live arrival now also
 * raises a toast, and there's an explicit "Mark all read" action. Split
 * into two tests: live delivery + toast, and the per-item vs. mark-all
 * read distinction.
 */
test('a notification inserted while the page is open updates the bell live, with a toast, and no reload', async ({ page, cleanup }) => {
  const member = await signUpSaltNPepper(page, cleanup)
  const memberId = await getUserIdByEmail(member.email)
  await login(page, member, '/dashboard')

  // NotificationBell lives in SiteHeader -- /dashboard has its own bespoke
  // inline header (a separate, direct NotificationBell mount, exercised in
  // the second test below) and never renders SiteHeader at all, so this
  // needs to be on a page that actually does.
  await page.goto('/discussions')

  // Starts at 0 -- a fresh signup has no notifications yet.
  const bellButton = page.getByRole('button', { name: 'Notifications' })
  await expect(bellButton).toBeVisible()
  await expect(page.locator('span.bg-red-600')).not.toBeVisible()

  const title = `E2E Realtime Notification ${Date.now()}`
  await insertNotification(memberId, title)

  // No page.reload() anywhere above or below this line -- the badge
  // appearing proves the postgres_changes subscription actually fired.
  await expect(page.locator('span.bg-red-600')).toHaveText('1', { timeout: 15_000 })

  const toast = page.getByTestId('notification-toast')
  await expect(toast).toBeVisible()
  await expect(toast).toContainText(title)
  await page.getByTestId('notification-toast-dismiss').click()
  await expect(toast).not.toBeVisible()

  await bellButton.click()
  await expect(page.getByText(title)).toBeVisible()

  // Opening the dropdown used to mark everything read on open; it no
  // longer does -- the badge must still say 1.
  await expect(page.locator('span.bg-red-600')).toHaveText('1')
})

test('clicking one notification marks only that one read; Mark all read clears the rest', async ({ page, cleanup }) => {
  const member = await signUpSaltNPepper(page, cleanup)
  const memberId = await getUserIdByEmail(member.email)
  await login(page, member, '/dashboard')
  await page.goto('/discussions')

  const bellButton = page.getByRole('button', { name: 'Notifications' })
  const firstTitle = `E2E Bell First ${Date.now()}`
  const secondTitle = `E2E Bell Second ${Date.now()}`
  await insertNotification(memberId, firstTitle)
  await expect(page.locator('span.bg-red-600')).toHaveText('1', { timeout: 15_000 })
  await insertNotification(memberId, secondTitle)
  await expect(page.locator('span.bg-red-600')).toHaveText('2', { timeout: 15_000 })

  await bellButton.click()
  await page.getByText(firstTitle).first().click()
  await page.waitForURL(/\/dashboard$/)

  // Salt & Pepper's dashboard mounts NotificationBell directly in its own
  // inline header -- one unread should remain: the second notification.
  const dashboardBell = page.getByRole('button', { name: 'Notifications' })
  await expect(page.locator('span.bg-red-600')).toHaveText('1', { timeout: 10_000 })

  await dashboardBell.click()
  await expect(page.getByText(secondTitle)).toBeVisible()
  const markAll = page.getByTestId('mark-all-read')
  await expect(markAll).toBeVisible()
  await markAll.click()
  await expect(page.locator('span.bg-red-600')).not.toBeVisible()
})
