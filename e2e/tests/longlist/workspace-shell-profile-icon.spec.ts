import { test, expect } from '../../utils/fixtures'
import { signUpLongList, login } from '../../utils/auth'

/**
 * Platform-wide icon-sync audit (2026-09-12): every other pillar's rail
 * uses the Settings (gear) icon for its Profile link; Longlist alone used
 * Send (a paper-plane), a leftover mismatch from whenever its rail was
 * first built. Asserted via lucide-react's own auto-added
 * `lucide-<kebab-name>` class rather than guessing at SVG path data.
 */
test('the rail\'s Profile link uses the same Settings icon every other pillar uses', async ({ page, cleanup }) => {
  const candidate = await signUpLongList(page, cleanup)
  await login(page, candidate, '/dashboard')

  const rail = page.locator('aside').first()
  const profileLink = rail.getByRole('link', { name: 'Profile' })
  await expect(profileLink.locator('svg.lucide-settings')).toBeVisible()
  await expect(profileLink.locator('svg.lucide-send')).toHaveCount(0)
})
