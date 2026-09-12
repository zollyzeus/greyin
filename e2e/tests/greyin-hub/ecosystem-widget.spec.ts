import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

/**
 * Platform-wide icon-sync audit (2026-09-12): Greyin Hub's own
 * EcosystemWidget.tsx (used on its /dashboard) was a second instance of
 * the same bug already fixed once in GreyMatters-blog -- a plain color
 * dot instead of the real pillar brand icon (Building2/BookOpen/Users/
 * Briefcase/FlaskConical/Telescope every other copy already used).
 * Missed in the first pass since it's a distinct file
 * (components/EcosystemWidget.tsx) from the one already audited.
 *
 * Also covers the active/inactive color-distinction request: "Active"
 * and "Visit to join" used to render in the exact same gray, with no
 * visual distinction at all.
 */
test('the hub dashboard\'s EcosystemWidget shows real pillar icons and colors Active green, distinct from Visit to join', async ({ page, cleanup }) => {
  const member = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  await login(page, member, 'https://greyin.net/dashboard', 'https://greyin.net')

  const widget = page.getByText('Your Greyin Ecosystem').locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
  await expect(widget.locator('a', { hasText: 'DeepEdge' }).locator('svg.lucide-building2')).toBeVisible()
  await expect(widget.locator('a', { hasText: 'GreyMatters' }).locator('svg.lucide-book-open')).toBeVisible()
  // The old dot had no lucide class at all -- confirms it's really gone.
  await expect(widget.locator('span.rounded-full')).toHaveCount(0)

  // Signing up via DeepEdge makes that pillar Active; GreyMatters was
  // never joined, so it's the "Visit to join" case -- a real
  // active/inactive contrast, not two hardcoded strings.
  const activeLabel = widget.locator('a', { hasText: 'DeepEdge' }).getByText('Active')
  const inactiveLabel = widget.locator('a', { hasText: 'GreyMatters' }).getByText('Visit to join')
  await expect(activeLabel).toBeVisible()
  await expect(inactiveLabel).toBeVisible()

  const activeColor = await activeLabel.evaluate((el) => getComputedStyle(el).color)
  const inactiveColor = await inactiveLabel.evaluate((el) => getComputedStyle(el).color)
  expect(activeColor).not.toBe(inactiveColor)
  // Green channel dominant for the active label (text-green-600 = rgb(22,163,74)).
  const [r, g, b] = activeColor.match(/\d+/g)!.map(Number)
  expect(g).toBeGreaterThan(r)
  expect(g).toBeGreaterThan(b)
})
