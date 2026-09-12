import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
}

// ActivityHeatmap.tsx's "no activity" day cells used to hardcode a
// light-gray fill (#e5e7eb) via inline `style`, with no dark-mode
// branch -- inline style always wins over className, so no dark: CSS
// anywhere could ever apply to it. Every empty day (guaranteed for any
// user who has been active fewer days than the calendar's own range)
// rendered as a pale square against the dark dashboard. Fixed by only
// setting backgroundColor via style for days with real activity, and
// using a themed className (bg-gray-200 dark:bg-gray-800) otherwise.
test('empty activity-heatmap cells use theme-aware classes, not a hardcoded light-gray inline style', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, user, '/dashboard')

  // Backdate the join date so the heatmap's range spans several real
  // days -- a same-day signup's range is just "today", which wouldn't
  // reliably produce an empty (count=0) in-range cell to check.
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(user.email)}&select=id`, {
    headers: restHeaders(),
  })
  const [profile] = await profileRes.json()
  const backdated = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
    method: 'PATCH',
    headers: restHeaders(),
    body: JSON.stringify({ created_at: backdated }),
  })

  await page.goto('/dashboard')
  await expect(page.getByText('Activity across all six platforms')).toBeVisible()

  // At least one empty cell should carry the theme-aware classes...
  const emptyCell = page.locator('div.bg-gray-200.dark\\:bg-gray-800.border.border-gray-300.dark\\:border-gray-700').first()
  await expect(emptyCell).toBeVisible()

  // ...and the old hardcoded hex must not appear anywhere on the page.
  const pageHtml = await page.content()
  expect(pageHtml).not.toContain('#e5e7eb')
})
