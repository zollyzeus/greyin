import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, signUpStackWorksSupporter, login } from '../../utils/auth'

async function postAskAsBuilder(page: any, cleanup: any) {
  const builder = await signUpStackWorksBuilder(page, cleanup)
  await login(page, builder, '/dashboard')

  await page.goto('/projects/new')
  await page.locator('#title').fill(`E2E Applications Project ${Date.now()}`)
  await page.locator('#description').fill('A project used to exercise the application accept/decline flow.')
  await page.getByRole('button', { name: 'Post Project' }).click()
  await page.waitForURL(/\/projects\/[^/]+$/)

  const projectUrl = page.url()

  await page.getByRole('link', { name: 'Post an ask' }).click()
  await page.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await page.locator('#role_title').fill('Design — landing page')
  await page.getByRole('button', { name: 'Post Ask' }).click()
  await page.waitForURL(/\/asks\/[^/]+$/)

  return { builder, askUrl: page.url(), projectUrl }
}

test('a Supporter applies to an ask and the Builder accepts', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const { askUrl, projectUrl } = await postAskAsBuilder(builderPage, cleanup)

  const supporterCtx = await browser.newContext()
  const supporterPage = await supporterCtx.newPage()
  const supporter = await signUpStackWorksSupporter(supporterPage, cleanup)
  await login(supporterPage, supporter, '/dashboard')

  // Upvoting carries over unchanged from The Lab -- worth covering here
  // since a Supporter with no application yet is still a fully valid
  // upvoter, same as the old saltnpepper/projects.spec.ts test this
  // replaces.
  await supporterPage.goto(projectUrl)
  await supporterPage.getByRole('button', { name: /^\d+$/ }).click()
  await expect(supporterPage.getByRole('button', { name: '1' })).toBeVisible()

  await supporterPage.goto(askUrl)
  await supporterPage.locator('#pitch').fill("I've shipped three landing pages this quarter, happy to help.")
  await supporterPage.getByRole('button', { name: 'Apply' }).click()
  await expect(supporterPage.getByText('Pending')).toBeVisible()

  await builderPage.goto(askUrl)
  await expect(builderPage.getByText('1 Application')).toBeVisible()
  await builderPage.getByRole('button', { name: 'Accept' }).click()
  await expect(builderPage.getByText('Accepted')).toBeVisible()

  await supporterPage.goto('/applications')
  await expect(supporterPage.getByText('Accepted')).toBeVisible()

  await builderCtx.close()
  await supporterCtx.close()
})

test('a Builder declines an application', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const { askUrl } = await postAskAsBuilder(builderPage, cleanup)

  const supporterCtx = await browser.newContext()
  const supporterPage = await supporterCtx.newPage()
  const supporter = await signUpStackWorksSupporter(supporterPage, cleanup)
  await login(supporterPage, supporter, '/dashboard')

  await supporterPage.goto(askUrl)
  await supporterPage.locator('#pitch').fill('I would like to help with this.')
  await supporterPage.getByRole('button', { name: 'Apply' }).click()

  await builderPage.goto(askUrl)
  await builderPage.getByRole('button', { name: 'Decline' }).click()
  await expect(builderPage.getByText('Declined')).toBeVisible()

  await supporterPage.goto('/applications')
  await expect(supporterPage.getByText('Declined')).toBeVisible()

  await builderCtx.close()
  await supporterCtx.close()
})
