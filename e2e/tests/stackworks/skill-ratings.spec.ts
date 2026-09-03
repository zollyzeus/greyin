import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, signUpStackWorksSupporter, login } from '../../utils/auth'
import { createTestConversationWithMessage, getUserIdByEmail } from '../../utils/admin'

/**
 * StackWorks skill ratings are bidirectional and have two triggers
 * (054_skill_endorsements_and_ratings.sql):
 * - an *initial* rating is allowed once the two have interacted (a real
 *   chat, exercised here, OR the traditional ask-closed+accepted path,
 *   already exercised by the Builder->Supporter half below),
 * - a rating can later be *revised* once a verified_outcomes row for
 *   that application reaches status='verified' (mirrors
 *   verification.spec.ts's own AI+human review flow).
 */
test('Builder and Supporter can rate each other\'s skills, via both triggers, and revise once verified', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup)
  await login(builderPage, builder, '/dashboard')

  await builderPage.goto('/projects/new')
  await builderPage.locator('#title').fill(`E2E Skill Rating Project ${Date.now()}`)
  await builderPage.locator('#description').fill('A project used to exercise bidirectional skill ratings.')
  await builderPage.getByRole('button', { name: 'Post Project' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+$/)

  await builderPage.getByRole('link', { name: 'Post an ask' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await builderPage.locator('#role_title').fill('Backend — skill rating flow')
  await builderPage.locator('#skills').fill('Go, Postgres')
  await builderPage.getByRole('button', { name: 'Post Ask' }).click()
  await builderPage.waitForURL(/\/asks\/[^/]+$/)
  const askUrl = builderPage.url()

  const supporterCtx = await browser.newContext()
  const supporterPage = await supporterCtx.newPage()
  const supporter = await signUpStackWorksSupporter(supporterPage, cleanup)
  await login(supporterPage, supporter, '/dashboard')

  await supporterPage.goto(askUrl)
  await supporterPage.locator('#pitch').fill('I can build this.')
  await supporterPage.getByRole('button', { name: 'Apply' }).click()

  // Chat trigger: seed a real conversation between them before the
  // Builder ever accepts -- an initial rating should already be
  // possible from either side.
  const builderId = await getUserIdByEmail(builder.email)
  const supporterId = await getUserIdByEmail(supporter.email)
  await createTestConversationWithMessage(builderId, supporterId)

  // Builder rates Supporter via the chat trigger, ask still open/pending.
  await builderPage.goto(askUrl)
  await builderPage.getByRole('button', { name: 'Rate Go 4 out of 5' }).click()
  await expect(builderPage.getByText('Saved').first()).toBeVisible()

  // Now accept + close, exercising the other (bidirectional) direction
  // via the traditional closed+accepted trigger.
  await builderPage.getByRole('button', { name: 'Accept' }).click()
  await builderPage.getByRole('button', { name: 'Close this ask' }).click()

  await supporterPage.goto(askUrl)
  await supporterPage.getByRole('button', { name: 'Rate Postgres 5 out of 5' }).click()
  await expect(supporterPage.getByText('Saved').first()).toBeVisible()

  // Verification flow (mirrors verification.spec.ts) to unlock revision.
  await supporterPage.locator('#summary').fill('Implemented the backend and deployed it.')
  await supporterPage.locator('#evidence_url').fill('https://example.com/pr/456')
  await supporterPage.getByRole('button', { name: 'Submit for verification' }).click()

  await builderPage.goto(askUrl)
  await builderPage.locator('input[name="human_score"]').fill('90')
  await builderPage.locator('textarea[name="human_notes"]').fill('Great work.')
  await builderPage.getByRole('button', { name: 'Submit review' }).click()
  await expect(builderPage.getByText('Verified', { exact: true })).toBeVisible()

  // Revision: the Builder's earlier initial rating on "Go" can now be
  // revised, reflected as "Verified" in the UI.
  await builderPage.reload()
  await expect(builderPage.getByText('Tap to revise').first()).toBeVisible()
  await builderPage.getByRole('button', { name: 'Rate Go 5 out of 5' }).click()
  await expect(builderPage.getByText('Verified').first()).toBeVisible()

  await builderCtx.close()
  await supporterCtx.close()
})
