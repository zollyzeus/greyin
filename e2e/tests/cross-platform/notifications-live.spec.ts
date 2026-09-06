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

async function insertNotification(userId: string, type: string, title: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ user_id: userId, type, title, body: 'Cross-app notification acceptance test.', link: '/dashboard' }),
  })
  expect(res.ok).toBeTruthy()
}

/**
 * UI/UX elevation plan, Phase 2's own missing acceptance test
 * (docs/ui_ux_elevation_plan.md names this file directly). The two
 * per-app specs (deepedge/notification-bell.spec.ts,
 * saltnpepper/notification-bell.spec.ts) already cover live delivery,
 * the arrival toast, and mark-one/mark-all-read within a single app --
 * what neither covers is the thing that's actually cross-*platform*
 * about this system: the `notifications` table is one shared,
 * pillar-agnostic table (017_notifications.sql), so a notification
 * whose `type` belongs to a *different* app than the one currently open
 * still has to show up live, and the same unread count has to match
 * everywhere the user goes -- not just "own app" notifications.
 */

test('a notification "from" a different app than the one currently open still delivers live, with a toast', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  const userId = await getUserIdByEmail(user.email)
  await login(page, user, '/dashboard')

  // Scoped to the bell button itself -- Phase 2's own "Section badges"
  // work (unread counts on rail nav items like My Applications) uses the
  // identical bg-red-600 pill style, so an unscoped locator is a
  // strict-mode violation on any page where both happen to be showing.
  const bellButton = page.getByRole('button', { name: 'Notifications' })
  const bellBadge = bellButton.locator('span.bg-red-600')
  await expect(bellButton).toBeVisible()
  await expect(bellBadge).not.toBeVisible()

  // order_status is FlexPro's own type per every app's notification-link.ts
  // TYPE_TO_PILLAR map -- fabricated here as a stand-in for FlexPro's own
  // order-status-change route inserting it, while the user sits on DeepEdge.
  // The badge and toast don't filter by type or owning pillar, so this
  // should behave identically to a same-app notification.
  const title = `E2E Cross-App Order Update ${Date.now()}`
  await insertNotification(userId, 'order_status', title)

  await expect(bellBadge).toHaveText('1', { timeout: 15_000 })
  const toast = page.getByTestId('notification-toast')
  await expect(toast).toBeVisible()
  await expect(toast).toContainText(title)
})

test('the unread badge count is identical for the same user on two different apps', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  const userId = await getUserIdByEmail(user.email)
  await login(page, user, '/dashboard')

  // application_status also lights up DeepEdge's own "My Applications"
  // section badge (Phase 2 "Section badges"), which uses the identical
  // bg-red-600 pill style -- scope to the bell button itself so this
  // assertion means "unread count," not "any red badge on the page."
  const bellBadge = page.getByRole('button', { name: 'Notifications' }).locator('span.bg-red-600')

  await insertNotification(userId, 'application_status', `E2E Parity A ${Date.now()}`)
  await insertNotification(userId, 'order_status', `E2E Parity B ${Date.now()}`)

  await expect(bellBadge).toHaveText('2', { timeout: 15_000 })

  // Same browser context -> same shared-cookie-domain SSO session
  // (sso.spec.ts is the dedicated regression test for that mechanism) --
  // landing straight on FlexPro's dashboard with no login step is itself
  // proof this is the same session, not a second account.
  await page.goto('https://flexpro.greyin.net/dashboard')
  await expect(page).toHaveURL('https://flexpro.greyin.net/dashboard')
  await expect(page.locator('form[action="/auth/login"]')).toHaveCount(0)

  // Pillar-agnostic unread query (Phase 2's own "Badge correctness" row)
  // means the count carries over exactly, not just "some notifications."
  await expect(page.getByRole('button', { name: 'Notifications' }).locator('span.bg-red-600')).toHaveText('2', { timeout: 15_000 })
})
