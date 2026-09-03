import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { getPostIdBySlug } from '../../utils/admin'

/**
 * Mirrors ecosystem-search-coverage.spec.ts's pattern (037_ecosystem_
 * search_full_coverage.sql already unions greymatters posts into
 * platform_search_index) and hub-dashboard.spec.ts's pattern (046_
 * pillar_activity_view.sql's my_pillar_activity already feeds
 * 'greymatters'/'post' rows from posts.author_id) -- for a published
 * GreyMatters post rather than a Salt & Pepper discussion or a StackWorks
 * verified outcome. Both surfacing mechanisms are already live in prod;
 * this is pure test coverage for a gap neither existing cross-platform
 * spec closes.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const greymattersBase = isLocal
  ? `http://localhost:${process.env.E2E_GREYMATTERS_PORT || 3101}`
  : 'https://greymatters.greyin.net'
// deepedge moved to deepedge.greyin.net -- /search lives there now,
// not on greyin.net (the ecosystem hub app has no search page of its own).
const greyinB2BBase = isLocal ? `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}` : 'https://deepedge.greyin.net'
const hubBase = isLocal ? `http://localhost:${process.env.E2E_HUB_PORT || 3105}` : 'https://greyin.net'

test('a published GreyMatters post shows up in deepedge\'s Ecosystem Search and on the hub dashboard\'s activity calendar', async ({ page, cleanup }) => {
  // This test's project baseURL is deepedge (cross-platform project),
  // not greymatters -- signUpGreyMatters/login default to relative
  // goto()s that would otherwise resolve against the wrong app.
  const author = await signUpGreyMatters(page, cleanup, 15, greymattersBase)
  await login(page, author, `${greymattersBase}/dashboard`, greymattersBase)

  const title = `E2E Cross-App Surfacing Post ${Date.now()}`
  await page.goto(`${greymattersBase}/posts/new`)
  await page.locator('#title').fill(title)
  await page.locator('#content').fill('Exercises cross-app Ecosystem Search and hub activity-calendar coverage.')
  await page.locator('#status').selectOption('published')
  await page.getByRole('button', { name: 'Save Post' }).click()
  await page.waitForURL(`${greymattersBase}/posts`)

  // /posts (the author's own management list) only links to the edit
  // page, not the public post -- pull the slug out of that link, same
  // pattern as greymatters/ai-quality-score.spec.ts.
  const editHref = await page.locator('a', { hasText: 'Edit' }).first().getAttribute('href')
  const slug = editHref!.replace('/posts/', '').replace('/edit', '')
  cleanup.trackEntity('posts', await getPostIdBySlug(slug))

  await page.goto(`${greyinB2BBase}/search?q=${encodeURIComponent(title)}`)
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByText(/GreyMatters/)).toBeVisible()

  // Same SSO cookie (shared .greyin.net domain) carries straight into the
  // hub -- no separate hub login needed, matching every other
  // cross-platform SSO test in this suite.
  await page.goto(`${hubBase}/dashboard`)
  await expect(page).toHaveURL(`${hubBase}/dashboard`)
  await expect(page.getByText(/[1-9]\d* activit(y|ies) between/)).toBeVisible()
})
