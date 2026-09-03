import type { Page } from '@playwright/test'
import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

/**
 * Idle-timeout session guard (2026-09-03) -- see
 * tests/deepedge/idle-session.spec.ts for the full rationale. Same
 * component, same numbers, duplicated per app; this is the Greyin Hub
 * copy. The Hub has no signup of its own (shared SSO credentials created
 * on any pillar work here too, same pattern as
 * cross-platform/logout-flow.spec.ts) -- DeepEdge's signup form creates
 * the account, then login happens directly against the Hub.
 */
async function fastForwardIdle(page: Page, msAgo: number) {
  await page.waitForFunction(() => localStorage.getItem('greyin:lastActivityAt') !== null)
  await page.evaluate((ms) => {
    localStorage.setItem('greyin:lastActivityAt', String(Date.now() - ms))
  }, msAgo)
}

test.describe('Idle session guard', () => {
  test('shows a warning after the idle threshold, and "Stay signed in" dismisses it', async ({ page, cleanup }) => {
    const user = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
    await login(page, user, '/dashboard')

    await expect(page.getByRole('alertdialog')).not.toBeVisible()
    await fastForwardIdle(page, 20 * 60 * 1000 + 5000)
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3000 })

    await page.mouse.move(200, 200)
    await page.waitForTimeout(1500)
    await expect(page.getByRole('alertdialog')).toBeVisible()

    await page.getByRole('button', { name: 'Stay signed in' }).click()
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
  })

  test('letting the countdown run out signs the user out with an explanatory message', async ({ page, cleanup }) => {
    const user = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
    await login(page, user, '/dashboard')

    await fastForwardIdle(page, 22 * 60 * 1000 + 5000)

    await page.waitForURL(/\/login/, { timeout: 5000 })
    await expect(page.getByText('You were signed out after a period of inactivity.')).toBeVisible()
  })
})
