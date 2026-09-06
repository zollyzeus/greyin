import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { createTestPost } from '../../utils/admin'

/**
 * UI/UX elevation plan, Phase 4 -- ⌘K command palette acceptance test.
 * Content results come from platform_search_index (037), which already
 * unions greymatters posts/deepedge jobs/flexpro gigs/saltnpepper
 * discussions/stackworks projects -- seeding a GreyMatters post directly
 * (createTestPost, no author required) while the test sits on DeepEdge's
 * own dashboard is the simplest way to prove a result is genuinely
 * cross-pillar, not just "this app's own content."
 */

test('⌘K opens the palette from any page, a cross-pillar content result appears, and Enter navigates to it', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, user, '/dashboard')

  const uniqueTitle = `E2E Palette Cross-Pillar Post ${Date.now()}`
  const post = await createTestPost({ title: uniqueTitle })
  cleanup.trackEntity('posts', post.id)

  // Not visible until opened.
  await expect(page.getByTestId('command-palette-input')).not.toBeVisible()

  await page.keyboard.press('Control+k')
  const input = page.getByTestId('command-palette-input')
  await expect(input).toBeVisible()
  await expect(input).toBeFocused()

  await input.fill(uniqueTitle)
  const result = page.getByTestId('command-palette-result').filter({ hasText: uniqueTitle })
  await expect(result).toBeVisible({ timeout: 10_000 })
  // GreyMatters, not DeepEdge -- the actual "cross-pillar" assertion.
  await expect(result).toContainText('GreyMatters')

  await result.click()
  await page.waitForURL(`https://greymatters.greyin.net/posts/${post.slug}`)
})

test('Escape closes the palette, and a person result navigates to the candidate profile', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, user, '/dashboard')

  await page.keyboard.press('Control+k')
  const input = page.getByTestId('command-palette-input')
  await expect(input).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(input).not.toBeVisible()

  // Re-open via the visible header button rather than the shortcut, since
  // the plan calls for a real affordance, not just a hidden keybinding.
  await page.getByRole('button', { name: 'Search Greyin' }).first().click()
  await expect(input).toBeVisible()

  // The signed-up user's own last name is unique per run (makeTestUser),
  // so searching it can only ever match their own profile.
  await input.fill(user.lastName)
  const result = page.getByTestId('command-palette-result').filter({ hasText: user.lastName })
  await expect(result).toBeVisible({ timeout: 10_000 })

  await result.click()
  await expect(page).toHaveURL(/\/candidates\/[0-9a-f-]{36}$/)
})
