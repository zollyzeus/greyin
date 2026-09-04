import { test, expect } from '../../utils/fixtures'
import { signUpLongList, login } from '../../utils/auth'

/**
 * my_pillar_activity (the Hub dashboard's "Activity across all six
 * platforms" heatmap) had zero Longlist coverage at all -- found via a
 * direct user report ("dashboard not showing any activity on longlist").
 * Not a rendering bug: 046_pillar_activity_view.sql (and every later
 * touch) only ever unioned deepedge/flexpro/stackworks/saltnpepper/
 * greymatters; Longlist launched later and was never added as a source,
 * so a real future-role subscription genuinely never appeared, for
 * anyone, ever. Fixed in 108_pillar_activity_longlist.sql. Also fixed in
 * the same pass: ActivityHeatmap.tsx's own pillar-color map still keyed
 * DeepEdge as 'expertedge' (the pre-2026-09-03-rename name), so even
 * DeepEdge's own activity squares were silently colorless.
 *
 * Lives here, not tests/greyin-hub/ -- it exercises both
 * longlist.greyin.net and greyin.net, and every expectedUrl below is a
 * full absolute URL rather than a path, since a relative one resolves
 * against whichever single project's own baseURL the run happens to use
 * (a real bug this test hit on its first draft: run under the
 * `greyin-hub` project, '/dashboard' resolved against greyin.net instead
 * of the longlist.greyin.net login it was actually waiting on).
 */
test('subscribing to a future role shows up on the Hub activity dashboard', async ({ page, cleanup }) => {
  const user = await signUpLongList(page, cleanup, 'https://longlist.greyin.net')
  await login(page, user, 'https://longlist.greyin.net/dashboard', 'https://longlist.greyin.net')

  // The /roles list page renders its own "I'm future-interested" button
  // per role card (same text as the detail page's) -- subscribe straight
  // from the list rather than navigating into a detail page first, and
  // scope with .first() since a seeded env can have several roles listed.
  await page.goto('https://longlist.greyin.net/roles')
  await page.getByRole('button', { name: "I'm future-interested" }).first().click()
  await page.waitForLoadState('networkidle')

  // Already authenticated via the shared .greyin.net SSO cookie from the
  // longlist login above -- a second login() call would hit /login's own
  // already-logged-in redirect and never find a form to submit.
  await page.goto('https://greyin.net/dashboard')
  await page.waitForLoadState('networkidle')
  const heatmapCard = page.locator('div.bg-white.rounded-lg.shadow', { hasText: 'Activity across all six platforms' })
  await expect(heatmapCard.getByText('Longlist')).toBeVisible()
  await expect(heatmapCard.getByText(/^(?!0 activities)\d+ activit/)).toBeVisible()
})
