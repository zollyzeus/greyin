import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, login } from '../../utils/auth'
import { getUserIdByEmail, getGreyinScoreRow } from '../../utils/admin'

/**
 * The Greyin Score's saltnpepper_evidence input (064_ethos_verification_gates.sql)
 * now only counts project_upvoted reputation events -- a real,
 * per-user-deduped upvote from someone else -- not the three
 * self-generated event types (discussion_created, reply_given,
 * project_created) that award a user reputation just for posting
 * their own content. Verified here via a real project (self-generated,
 * must NOT move the score) followed by a real upvote from a different
 * account (must move it).
 */
test('posting your own project does not move the Greyin Score, but a real upvote from someone else does', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup)
  await login(builderPage, builder, '/dashboard')
  const builderId = await getUserIdByEmail(builder.email)

  const projectTitle = `E2E Karma Gate Project ${Date.now()}`
  await builderPage.goto('/projects/new')
  await builderPage.locator('#title').fill(projectTitle)
  await builderPage.locator('#description').fill('Used to verify self-generated reputation is excluded from the Greyin Score.')
  await builderPage.getByRole('button', { name: 'Post Project' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+$/)
  const projectUrl = builderPage.url()
  const projectId = projectUrl.match(/projects\/([^/?#]+)/)?.[1]!

  // Self-generated (project_created) -- must not count as saltnpepper_evidence.
  const scoreAfterOwnPost = await getGreyinScoreRow(builderId)
  expect(scoreAfterOwnPost?.saltnpepper_evidence ?? null).toBeNull()

  const voterCtx = await browser.newContext()
  const voterPage = await voterCtx.newPage()
  const voter = await signUpStackWorksBuilder(voterPage, cleanup)
  await login(voterPage, voter, '/dashboard')
  await voterPage.goto(projectUrl)
  await voterPage.locator(`form[action="/api/projects/${projectId}/upvote"] button`).click()
  await voterCtx.close()

  // Real, other-verified interaction -- must now show as evidence.
  const scoreAfterRealUpvote = await getGreyinScoreRow(builderId)
  expect(scoreAfterRealUpvote?.saltnpepper_evidence).toBe(1)

  await builderCtx.close()
})
