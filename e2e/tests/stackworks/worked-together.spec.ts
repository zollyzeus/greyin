import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, signUpStackWorksSupporter, login } from '../../utils/auth'

/**
 * "Worked together" discovery (059_collaborators.sql) -- the collaborators
 * view unions accepted project_applications into symmetric pairs, surfaced
 * as a "People you’ve worked with" module on /people. Not just any two
 * StackWorks members; only pairs with a real accepted application between
 * them.
 */
test('accepting an application surfaces both people in each other\'s "worked with" list on /people', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup)
  await login(builderPage, builder, '/dashboard')

  const projectTitle = `E2E Worked Together Project ${Date.now()}`
  await builderPage.goto('/projects/new')
  await builderPage.locator('#title').fill(projectTitle)
  await builderPage.locator('#description').fill('A project used to exercise the worked-together collaborators view.')
  await builderPage.getByRole('button', { name: 'Post Project' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+$/)

  await builderPage.getByRole('link', { name: 'Post an ask' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await builderPage.locator('#role_title').fill('Backend — worked-together flow')
  await builderPage.getByRole('button', { name: 'Post Ask' }).click()
  await builderPage.waitForURL(/\/asks\/[^/]+$/)
  const askUrl = builderPage.url()

  const supporterCtx = await browser.newContext()
  const supporterPage = await supporterCtx.newPage()
  const supporter = await signUpStackWorksSupporter(supporterPage, cleanup)
  await login(supporterPage, supporter, '/dashboard')

  await supporterPage.goto(askUrl)
  await supporterPage.locator('#pitch').fill('Would like to collaborate on this.')
  await supporterPage.getByRole('button', { name: 'Apply' }).click()
  await expect(supporterPage.getByText('Pending')).toBeVisible()

  await builderPage.goto(askUrl)
  await builderPage.getByRole('button', { name: 'Accept' }).click()
  await expect(builderPage.getByText('Accepted')).toBeVisible()

  await builderPage.goto('/people')
  await expect(builderPage.getByText("People you’ve worked with")).toBeVisible()
  const builderWorkedWithList = builderPage.locator('h2', { hasText: "People you’ve worked with" }).locator('xpath=following-sibling::div[1]')
  await expect(builderWorkedWithList.getByText(supporter.lastName)).toBeVisible()

  await supporterPage.goto('/people')
  await expect(supporterPage.getByText("People you’ve worked with")).toBeVisible()
  const supporterWorkedWithList = supporterPage.locator('h2', { hasText: "People you’ve worked with" }).locator('xpath=following-sibling::div[1]')
  await expect(supporterWorkedWithList.getByText(builder.lastName)).toBeVisible()

  await builderCtx.close()
  await supporterCtx.close()
})
