import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, signUpStackWorksBuilder, login } from '../../utils/auth'
import { getJobIdByTitle } from '../../utils/admin'

/**
 * The actual payoff of surfacing verified_outcomes across apps: a
 * candidate who has never met this employer before can still show up
 * with real proof of completed work, sourced from a completely
 * different product (stackworks), not just a self-reported resume. Exercises
 * the same SSO-carries-the-session mechanism cross-platform/sso.spec.ts
 * already proves, plus the new cross-app read added to deepedge's
 * employer application review page.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const stackworksBase = isLocal
  ? `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}`
  : 'https://stackworks.greyin.net'

test("a candidate's StackWorks verified outcome shows up when a deepedge employer reviews their application", async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await login(employerPage, employer, '/employer/dashboard')

  const jobTitle = `E2E Trust Signal Role ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise cross-app trust signals.')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  const jobId = await getJobIdByTitle(jobTitle)

  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup, stackworksBase)
  await login(builderPage, builder, `${stackworksBase}/dashboard`, stackworksBase)

  await builderPage.goto(`${stackworksBase}/projects/new`)
  await builderPage.locator('#title').fill(`E2E Trust Signal Project ${Date.now()}`)
  await builderPage.locator('#description').fill('A project used to exercise cross-app trust signals.')
  await builderPage.getByRole('button', { name: 'Post Project' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+$/)

  await builderPage.getByRole('link', { name: 'Post an ask' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await builderPage.locator('#role_title').fill('Cross-app trust signal ask')
  await builderPage.getByRole('button', { name: 'Post Ask' }).click()
  await builderPage.waitForURL(/\/asks\/[^/]+$/)
  const askUrl = builderPage.url()

  // One person, both apps: signs up as a deepedge candidate, then
  // the existing SSO cookie (.greyin.net) carries that same session
  // straight into stackworks with zero separate signup there.
  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')

  await candidatePage.goto(`/jobs/${jobId}/apply`)
  await candidatePage.locator('#cover_letter').fill('Applying with a real, verifiable track record.')
  await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)

  await candidatePage.goto(askUrl)
  await candidatePage.locator('#pitch').fill('I can help with this.')
  await candidatePage.getByRole('button', { name: 'Apply' }).click()

  await builderPage.goto(askUrl)
  await builderPage.getByRole('button', { name: 'Accept' }).click()

  await candidatePage.goto(askUrl)
  await candidatePage.locator('#summary').fill('Delivered the work.')
  await candidatePage.getByRole('button', { name: 'Submit for verification' }).click()

  await builderPage.goto(askUrl)
  await builderPage.locator('input[name="human_score"]').fill('92')
  await builderPage.getByRole('button', { name: 'Submit review' }).click()
  await expect(builderPage.getByText('Verified', { exact: true })).toBeVisible()

  await employerPage.goto(`/employer/jobs/${jobId}/applications`)
  await expect(employerPage.getByText('1 verified outcome on StackWorks · avg 92/100')).toBeVisible()

  await employerCtx.close()
  await builderCtx.close()
  await candidateCtx.close()
})
