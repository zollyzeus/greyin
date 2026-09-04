import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, setCandidateSkills, grantActiveSubscriptionTier } from '../../utils/admin'

/**
 * Natural-language ecosystem search (platform_people_index, 060 +
 * ecosystem_nl_search feature flag, 061) -- parseSearchQuery() sends the
 * free-text query to the real local Ollama provider (same "no mock"
 * convention as stackworks/verification.spec.ts) and branches to
 * platform_people_index when it classifies the query as person-intent.
 * Run from StackWorks's /search (the reference implementation this
 * feature was built against first), searching for a deepedge candidate
 * by a distinctive seeded skill -- proves the cross-app person index
 * actually resolves, not just that the page renders.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const greyinB2BBase = isLocal ? `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}` : 'https://deepedge.greyin.net'
const stackworksBase = isLocal ? `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}` : 'https://stackworks.greyin.net'

test('a person-intent natural-language query finds a candidate by their seeded skill', async ({ page, cleanup }) => {
  const candidate = await signUpDeepEdge(page, 'candidate', cleanup, 15, greyinB2BBase)
  const candidateId = await getUserIdByEmail(candidate.email)
  const distinctiveSkill = `E2ENLSearchSkill${Date.now()}`
  await setCandidateSkills(candidateId, [distinctiveSkill])

  await page.goto(`${stackworksBase}/search?q=${encodeURIComponent(`looking for a freelancer skilled in ${distinctiveSkill}`)}`)

  await expect(page.getByText('People on Greyin')).toBeVisible({ timeout: 20000 })
  const resultLink = page.locator(`a[href="${greyinB2BBase}/candidates/${candidateId}"]`)
  await expect(resultLink).toBeVisible()
  await expect(resultLink.getByText(distinctiveSkill)).toBeVisible()
})

/**
 * A content-intent query (no person-hiring language) keeps using
 * platform_search_index exactly as before -- the people branch must not
 * swallow ordinary ecosystem search.
 */
test('a content-intent query still returns ordinary ecosystem search results', async ({ page, cleanup }) => {
  const author = await signUpDeepEdge(page, 'employer', cleanup, 15, greyinB2BBase)
  await grantActiveSubscriptionTier(await getUserIdByEmail(author.email), 'basic')
  await login(page, author, `${greyinB2BBase}/employer/dashboard`, greyinB2BBase)

  const jobTitle = `E2E NL Content Search Role ${Date.now()}`
  await page.getByRole('link', { name: 'Post Job' }).first().click()
  await page.waitForURL('/employer/post-job')
  await page.locator('#title').fill(jobTitle)
  await page.locator('#description').fill('Exercises the content-intent branch of natural-language search.')
  await page.getByRole('button', { name: 'Publish Job' }).click()
  await page.waitForURL('/employer/dashboard')

  await page.goto(`${stackworksBase}/search?q=${encodeURIComponent(jobTitle)}`)
  await expect(page.getByText(jobTitle)).toBeVisible({ timeout: 20000 })
})
