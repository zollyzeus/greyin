import { test, expect } from '@playwright/test'

const isLocal = process.env.E2E_TARGET === 'local'
const baseURLs: Record<string, string> = isLocal
  ? {
      deepedge: `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}`,
      greymatters: `http://localhost:${process.env.E2E_GREYMATTERS_PORT || 3101}`,
      flexpro: `http://localhost:${process.env.E2E_FLEXPRO_PORT || 3102}`,
      saltnpepper: `http://localhost:${process.env.E2E_SALTNPEPPER_PORT || 3103}`,
      stackworks: `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}`,
    }
  : {
      deepedge: 'https://deepedge.greyin.net',
      greymatters: 'https://greymatters.greyin.net',
      flexpro: 'https://flexpro.greyin.net',
      saltnpepper: 'https://saltnpepper.greyin.net',
      stackworks: 'https://stackworks.greyin.net',
    }

/**
 * greyin.net used to be the app that linked back out to the other 4
 * platforms (a "More Platforms" dropdown + an "Explore Our Ecosystem"
 * section) -- that app (deepedge) has since moved to
 * deepedge.greyin.net (rebranded from ExpertEdge 2026-09-01), and
 * greyin.net now serves a dedicated ecosystem hub app instead (see
 * greyin-hub/homepage.spec.ts for its own carousel coverage, which
 * supersedes what the old "ecosystem section" test here used to check).
 * All 5 pillar apps still carry the same "More Platforms" dropdown,
 * sourced from each app's own local PILLARS array (identical data,
 * reskinned styling) -- its `greyin` entry's url now points at
 * deepedge.greyin.net, not greyin.net, since that's genuinely where the
 * pillar lives now. `freeagent`/`stackedge`/`greyin-b2b`+`expertedge`
 * were fully renamed to `flexpro`/`stackworks`/`deepedge`
 * (folder/image/service/e2e project all now say their new name) on
 * 2026-09-02, -03, and -03 respectively -- this file's own local
 * `baseURLs` object key is `deepedge` to match, purely a local lookup
 * convenience for this spec, distinct from the shared PILLARS array's
 * own `key` field (still literally `greyin`, the platform-wide hiring
 * pillar identifier -- see the Tier 3 migration for why that one is
 * handled separately and carefully, not swept in with this rename).
 */
test.describe('Cross-platform navigation from DeepEdge', () => {
  // Labels match the shared PILLARS array (components/EcosystemWidget.tsx),
  // consistently used across every app's nav dropdown and EcosystemWidget.
  const targets: Array<{ name: string; host: string }> = [
    { name: 'GreyMatters', host: 'greymatters.greyin.net' },
    { name: 'FlexPro', host: 'flexpro.greyin.net' },
    { name: 'Salt & Pepper', host: 'saltnpepper.greyin.net' },
    { name: 'StackWorks', host: 'stackworks.greyin.net' },
  ]

  for (const target of targets) {
    test(`"More Platforms" dropdown links to ${target.name}`, async ({ page }) => {
      await page.goto('/')
      const nav = page.locator('nav')
      await nav.getByRole('button', { name: 'More Platforms' }).hover()
      const link = nav.getByRole('link', { name: new RegExp(target.name) })
      await expect(link).toHaveAttribute('href', `https://${target.host}`)
    })
  }
})

test.describe('Cross-platform navigation from the other 4 apps', () => {
  const apps: Array<{ key: string; name: string }> = [
    { key: 'greymatters', name: 'GreyMatters' },
    { key: 'flexpro', name: 'FlexPro' },
    { key: 'saltnpepper', name: 'Salt & Pepper' },
    { key: 'stackworks', name: 'StackWorks' },
  ]

  for (const app of apps) {
    test(`${app.name}'s own "More Platforms" dropdown links to the other 4 platforms`, async ({ page }) => {
      await page.goto(baseURLs[app.key])
      const nav = page.locator('nav')
      await nav.getByRole('button', { name: 'More Platforms' }).hover()
      for (const [otherKey, otherUrl] of Object.entries(baseURLs)) {
        if (otherKey === app.key) continue
        const link = nav.locator(`a[href="${otherUrl}"]`)
        await expect(link).toBeVisible()
      }
    })

    test(`${app.name} links to Ecosystem Search`, async ({ page }) => {
      await page.goto(baseURLs[app.key])
      // Ecosystem Search lives inside the header's own "Explore" dropdown
      // (2026-09-03 redesign) -- hover to reveal it first, same pattern
      // "More Platforms" dropdown links to X already uses above.
      const nav = page.locator('nav')
      await nav.getByRole('button', { name: 'Explore' }).hover()
      await expect(nav.getByRole('link', { name: 'Ecosystem Search' })).toHaveAttribute('href', '/search')
    })
  }
})
