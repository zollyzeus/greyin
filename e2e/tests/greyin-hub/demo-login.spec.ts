import { test, expect } from '@playwright/test'

/**
 * One-click "Launch Demo" access (2026-09-08) -- lets a pitch reviewer or
 * first-time visitor explore a real, populated account with no signup and
 * no password ever touching the browser (see
 * apps/greyin-hub/src/app/api/demo-login/route.ts and
 * apps/greyin-hub/src/lib/demo-personas.ts). Every persona here is a
 * real, permanent seeded account, not test-created data -- no cleanup
 * needed, same as homepage.spec.ts in this directory.
 */
test.describe('Demo login', () => {
  const personas: Array<{ key: string; host: string; marker: RegExp }> = [
    { key: 'hannah-kim', host: 'deepedge.greyin.net', marker: /Hannah/i },
    { key: 'miguel-santos', host: 'flexpro.greyin.net', marker: /Miguel/i },
    { key: 'marcus-webb', host: 'deepedge.greyin.net', marker: /Marcus/i },
    { key: 'adrian-costa', host: 'greymatters.greyin.net', marker: /Adrian/i },
    { key: 'demo-admin', host: 'greyin.net', marker: /admin/i },
  ]

  for (const persona of personas) {
    test(`${persona.key} logs in and lands on ${persona.host}`, async ({ page }) => {
      await page.goto(`https://greyin.net/api/demo-login?persona=${persona.key}`)
      await expect(page).toHaveURL(new RegExp(persona.host.replace('.', '\\.')))
      await expect(page.getByText(persona.marker).first()).toBeVisible()
      // Session must actually be real, not a bare redirect -- if sign-in
      // had failed silently, the landing page would bounce to a login
      // form instead of rendering the persona's own authenticated content.
      await expect(page.getByRole('link', { name: /log ?in|sign ?in/i })).toHaveCount(0)
    })
  }

  test('an unknown persona key redirects home with an error, not a crash', async ({ page }) => {
    await page.goto('https://greyin.net/api/demo-login?persona=not-a-real-persona')
    await expect(page).toHaveURL(/greyin\.net\/\?error=/)
  })
})
