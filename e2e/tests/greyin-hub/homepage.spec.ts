import { test, expect } from '@playwright/test'

/**
 * The ecosystem hub replaces greyin.net's old marketplace homepage --
 * this proves the pillar grid actually reaches each pillar's real domain
 * (mirrors cross-platform/navigation.spec.ts's pattern, against the new
 * hub instead of the old deepedge homepage), and that the two
 * cross-pillar track pages exist and link out correctly.
 */
test.describe('Ecosystem hub homepage', () => {
  const pillars: Array<{ name: string; host: string }> = [
    { name: 'DeepEdge', host: 'deepedge.greyin.net' },
    { name: 'GreyMatters', host: 'greymatters.greyin.net' },
    { name: 'Salt & Pepper', host: 'saltnpepper.greyin.net' },
    { name: 'FlexPro', host: 'flexpro.greyin.net' },
    { name: 'StackWorks', host: 'stackworks.greyin.net' },
  ]

  test('the pillar grid links to all 5 platforms', async ({ page }) => {
    await page.goto('/')
    for (const pillar of pillars) {
      const link = page.locator(`a[href="https://${pillar.host}"]`).first()
      await expect(link).toBeVisible()
    }
  })

  test('each pillar card shows a live stat, and the footer repeats all 5 links', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/\d+ open jobs/)).toBeVisible()
    await expect(page.getByText(/\d+ articles/)).toBeVisible()
    await expect(page.getByText(/\d+ discussions/)).toBeVisible()
    await expect(page.getByText(/\d+ gigs listed/)).toBeVisible()
    await expect(page.getByText(/\d+ verified outcomes/)).toBeVisible()
    // Header pillar-jump icon + grid card + footer link = 3 per pillar
    // (the header row is new, 2026-09-03 -- "easier jump" from anywhere,
    // not just the homepage grid).
    for (const pillar of pillars) {
      const links = page.locator(`a[href="https://${pillar.host}"]`)
      await expect(links).toHaveCount(3)
    }
  })
})

test('the /pivoting hub page explains the track and links to DeepEdge, StackWorks, and Salt & Pepper', async ({ page }) => {
  await page.goto('/pivoting')
  await expect(page.getByRole('heading', { name: 'Pivoting' })).toBeVisible()
  await expect(page.locator('a[href="https://deepedge.greyin.net/profile"]')).toBeVisible()
  // Scoped to <main>'s own content div, excluding <SiteHeader>'s <header>
  // (a sibling inside the same <main>, not a div) -- both the common
  // footer (2026-09-03) and the header's own pillar-jump icon row
  // (2026-09-03) repeat this same bare pillar-root link elsewhere on the
  // page, so an unscoped locator now matches multiple elements.
  await expect(page.locator('main > div a[href="https://stackworks.greyin.net"]')).toBeVisible()
  await expect(page.locator('a[href="https://saltnpepper.greyin.net/mentors"]')).toBeVisible()
})

test('the /reentry hub page explains the track and links to DeepEdge, StackWorks, and Salt & Pepper', async ({ page }) => {
  await page.goto('/reentry')
  await expect(page.getByRole('heading', { name: 'Returning to work' })).toBeVisible()
  await expect(page.locator('a[href="https://deepedge.greyin.net/profile"]')).toBeVisible()
  // Scoped to <main>'s own content div, excluding <SiteHeader>'s <header>
  // (a sibling inside the same <main>, not a div) -- both the common
  // footer (2026-09-03) and the header's own pillar-jump icon row
  // (2026-09-03) repeat this same bare pillar-root link elsewhere on the
  // page, so an unscoped locator now matches multiple elements.
  await expect(page.locator('main > div a[href="https://stackworks.greyin.net"]')).toBeVisible()
  await expect(page.locator('a[href="https://saltnpepper.greyin.net/mentors"]')).toBeVisible()
})

test('/dashboard redirects an unauthenticated visitor to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login\?next=\/dashboard/)
})
