import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, signUpStackWorksBuilder, login } from '../../utils/auth'

/**
 * The hub's /dashboard reads from two things this whole session's prior
 * work already proves independently: the greyin_scores view (same
 * verified-outcome flow as stackworks/greyin-score.spec.ts) and the new
 * my_pillar_activity view (046) feeding the activity calendar. This is
 * the first real end-to-end check that a piece of real cross-pillar
 * activity actually reaches the calendar, not just the raw table.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const stackworksBase = isLocal
  ? `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}`
  : 'https://stackworks.greyin.net'
const hubBase = isLocal
  ? `http://localhost:${process.env.E2E_HUB_PORT || 3105}`
  : 'https://greyin.net'

test('a candidate with a real StackWorks verified outcome sees it reflected on the hub dashboard\'s activity calendar and Greyin Score', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup, stackworksBase)
  await login(builderPage, builder, `${stackworksBase}/dashboard`, stackworksBase)

  await builderPage.goto(`${stackworksBase}/projects/new`)
  await builderPage.locator('#title').fill(`E2E Hub Dashboard Project ${Date.now()}`)
  await builderPage.locator('#description').fill('A project used to exercise the hub activity calendar.')
  await builderPage.getByRole('button', { name: 'Post Project' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+$/)

  await builderPage.getByRole('link', { name: 'Post an ask' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await builderPage.locator('#role_title').fill('Hub dashboard ask')
  await builderPage.getByRole('button', { name: 'Post Ask' }).click()
  await builderPage.waitForURL(/\/asks\/[^/]+$/)
  const askUrl = builderPage.url()

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')

  // SSO cookie carries this deepedge (expertedge) session straight into
  // StackWorks -- same mechanism cross-platform/sso.spec.ts already proves.
  await candidatePage.goto(askUrl)
  await candidatePage.locator('#pitch').fill('I can help with this.')
  await candidatePage.getByRole('button', { name: 'Apply' }).click()

  await builderPage.goto(askUrl)
  await builderPage.getByRole('button', { name: 'Accept' }).click()

  await candidatePage.goto(askUrl)
  await candidatePage.locator('#summary').fill('Delivered the work.')
  await candidatePage.getByRole('button', { name: 'Submit for verification' }).click()

  await builderPage.goto(askUrl)
  await builderPage.locator('input[name="human_score"]').fill('91')
  await builderPage.getByRole('button', { name: 'Submit review' }).click()
  await expect(builderPage.getByText('Verified', { exact: true })).toBeVisible()

  // Same SSO cookie also carries straight into the hub -- no separate hub
  // login needed, matching every other cross-platform SSO test this
  // session.
  await candidatePage.goto(`${hubBase}/dashboard`)
  await expect(candidatePage).toHaveURL(`${hubBase}/dashboard`)
  await expect(candidatePage.getByText(/Greyin Score: \d+/)).toBeVisible()
  await expect(candidatePage.getByText(/[1-9]\d* activit(y|ies) between/)).toBeVisible()

  await builderCtx.close()
  await candidateCtx.close()
})
