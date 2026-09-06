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

async function getEventCount(userId: string, eventType: string): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/analytics_events?user_id=eq.${userId}&event_type=eq.${eventType}&select=id`,
    { headers: restHeaders() }
  )
  const rows = await res.json()
  return Array.isArray(rows) ? rows.length : 0
}

/**
 * UI/UX elevation plan, Phase 6 -- lightweight self-hosted analytics
 * acceptance test (116_analytics_events.sql). logEvent() is fire-and-forget
 * from the browser's own anon-key session (never awaited by the caller),
 * so this polls the table briefly via the service role rather than
 * asserting immediately after the UI action.
 */
test('rail nav clicks, ⌘K open, and the guided tour each log a real analytics_events row', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  const userId = await getUserIdByEmail(user.email)
  await login(page, user, '/dashboard')

  // The guided tour auto-starts for a fresh signup and fires tour_started
  // on its own -- skip it immediately so it doesn't sit over the rail for
  // the rest of this test.
  const tourTooltip = page.getByTestId('guided-tour-tooltip')
  if (await tourTooltip.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByTestId('guided-tour-skip').click()
  }

  await expect
    .poll(() => getEventCount(userId, 'tour_started'), { timeout: 10_000 })
    .toBeGreaterThan(0)
  await expect
    .poll(() => getEventCount(userId, 'tour_skipped'), { timeout: 10_000 })
    .toBeGreaterThan(0)

  // ⌘K check first, while still on /dashboard -- CommandPalette only
  // mounts inside WorkspaceShell, and "Browse Jobs" below navigates to
  // /jobs, which uses the public SiteHeader instead (no WorkspaceShell,
  // no palette) once a candidate follows it off the dashboard.
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('command-palette-input')).toBeVisible()
  await expect
    .poll(() => getEventCount(userId, 'command_palette_open'), { timeout: 10_000 })
    .toBeGreaterThan(0)
  await page.keyboard.press('Escape')

  await page.getByRole('link', { name: 'Browse Jobs' }).click()
  await expect
    .poll(() => getEventCount(userId, 'rail_nav_click'), { timeout: 10_000 })
    .toBeGreaterThan(0)
})
