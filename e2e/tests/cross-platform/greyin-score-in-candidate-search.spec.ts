import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, signUpStackWorksBuilder, login } from '../../utils/auth'
import { getUserIdByEmail, grantActiveSubscription } from '../../utils/admin'

const isLocal = process.env.E2E_TARGET === 'local'
const stackworksBase = isLocal
  ? `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}`
  : 'https://stackworks.greyin.net'

/**
 * deepedge/candidates.spec.ts already proves the Verified Expert pool
 * is visible to a subscribed employer, but its candidate qualifies on
 * years_experience alone (15 >= 12) and has zero StackWorks/FlexPro/Salt &
 * Pepper evidence, so greyin_scores.greyin_score stays NULL for them and
 * the page's `· Greyin Score {n}` suffix (candidates/page.tsx:170) never
 * actually renders in that test. 036's view only ever produces a number
 * once someone has real cross-platform evidence -- this proves that
 * number reaches the employer's search results once it exists, the same
 * verified-outcome mechanism cross-platform/trust-signals.spec.ts and
 * stackworks/greyin-score.spec.ts already exercise, just read from a third
 * place.
 */
test('a candidate with real StackWorks evidence shows a Greyin Score in the employer candidate search, not just Verified Expert', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup, stackworksBase)
  await login(builderPage, builder, `${stackworksBase}/dashboard`, stackworksBase)

  await builderPage.goto(`${stackworksBase}/projects/new`)
  await builderPage.locator('#title').fill(`E2E Score Search Project ${Date.now()}`)
  await builderPage.locator('#description').fill('A project used to exercise Greyin Score reaching candidate search.')
  await builderPage.getByRole('button', { name: 'Post Project' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+$/)

  await builderPage.getByRole('link', { name: 'Post an ask' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await builderPage.locator('#role_title').fill('Score search ask')
  await builderPage.getByRole('button', { name: 'Post Ask' }).click()
  await builderPage.waitForURL(/\/asks\/[^/]+$/)
  const askUrl = builderPage.url()

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')

  // SSO cookie carries this deepedge session straight into stackworks.
  await candidatePage.goto(askUrl)
  await candidatePage.locator('#pitch').fill('I can help with this.')
  await candidatePage.getByRole('button', { name: 'Apply' }).click()

  await builderPage.goto(askUrl)
  await builderPage.getByRole('button', { name: 'Accept' }).click()

  await candidatePage.goto(askUrl)
  await candidatePage.locator('#summary').fill('Delivered the work.')
  await candidatePage.getByRole('button', { name: 'Submit for verification' }).click()

  await builderPage.goto(askUrl)
  await builderPage.locator('input[name="human_score"]').fill('88')
  await builderPage.getByRole('button', { name: 'Submit review' }).click()
  await expect(builderPage.getByText('Verified', { exact: true })).toBeVisible()

  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await login(employerPage, employer, '/employer/dashboard')
  const employerId = await getUserIdByEmail(employer.email)
  await grantActiveSubscription(employerId)

  await employerPage.goto('/candidates')
  const candidateCard = employerPage.locator('div.bg-white.rounded-lg.shadow-md', { hasText: `${candidate.firstName} ${candidate.lastName}` })
  await expect(candidateCard.getByText(/Verified Expert · Greyin Score \d+/)).toBeVisible()

  await builderCtx.close()
  await candidateCtx.close()
  await employerCtx.close()
})
