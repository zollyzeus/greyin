import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

/**
 * UI/UX elevation plan, Phase 5 -- guided tour acceptance test.
 * GuidedTour.tsx is self-contained (own auth check, own localStorage
 * flag, same convention as NotificationBell/SectionBadge/CommandPalette)
 * -- a fresh signup is exactly the "never seen it before" case the
 * auto-start flag is meant to catch, so no seeding beyond the signup
 * itself is needed.
 */

test('tour auto-starts for a fresh user, Next/Prev/Skip work, and it does not re-fire after a reload', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, user, '/dashboard', undefined, { suppressTour: false })

  const tooltip = page.getByTestId('guided-tour-tooltip')
  await expect(tooltip).toBeVisible({ timeout: 10_000 })
  await expect(tooltip).toContainText('Step 1 of')

  // Prev is hidden on the first step.
  await expect(page.getByTestId('guided-tour-prev')).not.toBeVisible()

  await page.getByTestId('guided-tour-next').click()
  await expect(tooltip).toContainText('Step 2 of')
  await expect(page.getByTestId('guided-tour-prev')).toBeVisible()

  await page.getByTestId('guided-tour-prev').click()
  await expect(tooltip).toContainText('Step 1 of')

  await page.getByTestId('guided-tour-skip').click()
  await expect(tooltip).not.toBeVisible()

  // Reload -- the localStorage flag set by Skip means it should not
  // auto-start a second time.
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(tooltip).not.toBeVisible({ timeout: 5_000 })
})

test('"Replay tour" re-arms it after it has already been seen', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, user, '/dashboard', undefined, { suppressTour: false })

  const tooltip = page.getByTestId('guided-tour-tooltip')
  await expect(tooltip).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('guided-tour-skip').click()
  await expect(tooltip).not.toBeVisible()

  await page.getByRole('button', { name: 'Replay tour' }).click()
  await expect(tooltip).toBeVisible({ timeout: 5_000 })
  await expect(tooltip).toContainText('Step 1 of')
})
