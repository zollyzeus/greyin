import { test, expect } from '@playwright/test'

/**
 * The audit's other DeepEdge finding: hardcoded "10,000+ Active Jobs"
 * etc. sat right next to a jobs page that could (and did) show zero --
 * the fastest way to lose a skeptical visitor's trust. Homepage stats
 * are real counts now; this just confirms the old fixed strings are gone.
 *
 * The old "capillary ecosystem section" test that used to live here was
 * removed along with that section itself -- this app (now living at
 * deepedge.greyin.net) is the B2B marketplace specifically; ecosystem
 * discovery moved to the dedicated hub app (greyin.net), covered by
 * greyin-hub/homepage.spec.ts instead.
 */
test('homepage shows real stats, not the old hardcoded placeholder numbers', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('10,000+')).not.toBeVisible()
  await expect(page.getByText('50,000+')).not.toBeVisible()
  await expect(page.getByText('Open Jobs')).toBeVisible()
})
