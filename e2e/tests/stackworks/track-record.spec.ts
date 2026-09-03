import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, signUpStackWorksSupporter, login } from '../../utils/auth'

/**
 * The point of the verification engine is that a verified outcome
 * actually helps a Supporter get picked for future work -- this proves
 * that end to end: once a Supporter has one verified outcome, a Builder
 * reviewing a *different, later* application from that same Supporter
 * sees their track record summary, not just the pitch text.
 */
test("a Supporter's verified outcome shows up on their next application elsewhere", async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup)
  await login(builderPage, builder, '/dashboard')

  await builderPage.goto('/projects/new')
  await builderPage.locator('#title').fill(`E2E Track Record Project ${Date.now()}`)
  await builderPage.locator('#description').fill('A project used to exercise track record visibility.')
  await builderPage.getByRole('button', { name: 'Post Project' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+$/)
  const projectUrl = builderPage.url()

  await builderPage.getByRole('link', { name: 'Post an ask' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await builderPage.locator('#role_title').fill('First ask')
  await builderPage.getByRole('button', { name: 'Post Ask' }).click()
  await builderPage.waitForURL(/\/asks\/[^/]+$/)
  const firstAskUrl = builderPage.url()

  const supporterCtx = await browser.newContext()
  const supporterPage = await supporterCtx.newPage()
  const supporter = await signUpStackWorksSupporter(supporterPage, cleanup)
  await login(supporterPage, supporter, '/dashboard')

  await supporterPage.goto(firstAskUrl)
  await supporterPage.locator('#pitch').fill('I can help with this.')
  await supporterPage.getByRole('button', { name: 'Apply' }).click()

  await builderPage.goto(firstAskUrl)
  await builderPage.getByRole('button', { name: 'Accept' }).click()

  await supporterPage.goto(firstAskUrl)
  await supporterPage.locator('#summary').fill('Delivered the first ask.')
  await supporterPage.getByRole('button', { name: 'Submit for verification' }).click()

  await builderPage.goto(firstAskUrl)
  await builderPage.locator('input[name="human_score"]').fill('85')
  await builderPage.getByRole('button', { name: 'Submit review' }).click()
  await expect(builderPage.getByText('Verified', { exact: true })).toBeVisible()

  // A second, independent ask on the same project -- the same Supporter
  // applying here should now show their track record from the first.
  await builderPage.goto(projectUrl)
  await builderPage.getByRole('link', { name: 'Post an ask' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await builderPage.locator('#role_title').fill('Second ask')
  await builderPage.getByRole('button', { name: 'Post Ask' }).click()
  await builderPage.waitForURL(/\/asks\/[^/]+$/)
  const secondAskUrl = builderPage.url()

  await supporterPage.goto(secondAskUrl)
  await supporterPage.locator('#pitch').fill('I can help with this one too.')
  await supporterPage.getByRole('button', { name: 'Apply' }).click()

  await builderPage.goto(secondAskUrl)
  await expect(builderPage.getByText('✓ 1 verified outcome · avg 85/100')).toBeVisible()

  await builderCtx.close()
  await supporterCtx.close()
})
