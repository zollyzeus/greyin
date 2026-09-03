import type { Page } from '@playwright/test'
import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

/**
 * Idle-timeout session guard (2026-09-03): 20 min of inactivity shows a
 * "Still there?" warning with a 2-minute countdown; letting it run out
 * signs the user out. Real time isn't waited on here -- the guard reads
 * a single localStorage timestamp (greyin:lastActivityAt) once a second,
 * so directly rewriting that timestamp into the past is a faithful,
 * fast-forwarded simulation of true elapsed idle time, not a shortcut
 * around the actual logic under test.
 */

// The guard seeds greyin:lastActivityAt itself on mount, asynchronously
// (it waits on its own getUser() auth check first) -- writing a
// past timestamp before that seed lands just gets clobbered a moment
// later. Wait for the key to actually exist first, then it's safe to
// rewrite it into the past.
async function fastForwardIdle(page: Page, msAgo: number) {
  await page.waitForFunction(() => localStorage.getItem('greyin:lastActivityAt') !== null)
  await page.evaluate((ms) => {
    localStorage.setItem('greyin:lastActivityAt', String(Date.now() - ms))
  }, msAgo)
}

test.describe('Idle session guard', () => {
  test('shows a warning after the idle threshold, and "Stay signed in" dismisses it', async ({ page, cleanup }) => {
    const user = await signUpDeepEdge(page, 'candidate', cleanup)
    await login(page, user, '/dashboard')

    // No warning yet -- freshly active.
    await expect(page.getByRole('alertdialog')).not.toBeVisible()

    await fastForwardIdle(page, 20 * 60 * 1000 + 5000)

    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('Still there?')).toBeVisible()
    await expect(page.getByText(/you'll be signed out in/)).toBeVisible()

    // Passive activity (a plain mousemove) must NOT dismiss it once shown.
    await page.mouse.move(200, 200)
    await page.waitForTimeout(1500)
    await expect(page.getByRole('alertdialog')).toBeVisible()

    // Only the explicit button does.
    await page.getByRole('button', { name: 'Stay signed in' }).click()
    await expect(page.getByRole('alertdialog')).not.toBeVisible()

    // And the activity timestamp actually moved forward, not just the UI.
    const ts = await page.evaluate(() => Number(localStorage.getItem('greyin:lastActivityAt')))
    expect(Date.now() - ts).toBeLessThan(5000)
  })

  test('letting the countdown run out signs the user out with an explanatory message', async ({ page, cleanup }) => {
    const user = await signUpDeepEdge(page, 'candidate', cleanup)
    await login(page, user, '/dashboard')

    // Fast-forward past the full 22-minute logout threshold in one step.
    await fastForwardIdle(page, 22 * 60 * 1000 + 5000)

    await page.waitForURL(/\/login/, { timeout: 5000 })
    await expect(page.getByText('You were signed out after a period of inactivity.')).toBeVisible()

    // Actually signed out, not just redirected -- protected pages bounce
    // to login again rather than rendering.
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('"Sign out now" signs out immediately without waiting for the countdown', async ({ page, cleanup }) => {
    const user = await signUpDeepEdge(page, 'candidate', cleanup)
    await login(page, user, '/dashboard')

    await fastForwardIdle(page, 20 * 60 * 1000 + 5000)
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: 'Sign out now' }).click()
    await page.waitForURL(/\/login/, { timeout: 5000 })
    await expect(page.getByText('You were signed out after a period of inactivity.')).toBeVisible()
  })

  test('activity in another tab dismisses the warning in the first', async ({ context, cleanup }) => {
    const pageA = await context.newPage()
    const user = await signUpDeepEdge(pageA, 'candidate', cleanup)
    await login(pageA, user, '/dashboard')

    await fastForwardIdle(pageA, 20 * 60 * 1000 + 5000)
    await expect(pageA.getByRole('alertdialog')).toBeVisible({ timeout: 3000 })

    // A second tab, same browser context -- shares localStorage with tab
    // A. Real activity there writes the shared timestamp forward; tab A's
    // own 1s poll picks that up regardless of which tab wrote it.
    const pageB = await context.newPage()
    await pageB.goto('/dashboard')
    await pageB.mouse.move(150, 150)
    await pageB.mouse.move(151, 151)

    await expect(pageA.getByRole('alertdialog')).not.toBeVisible({ timeout: 3000 })
    await pageB.close()
  })
})
