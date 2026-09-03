import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, signUpStackWorksSupporter, login } from '../../utils/auth'

/**
 * A local Ollama provider is configured as the fallback AI reviewer
 * (admin-panel-managed, covered separately in admin-llm.spec.ts) -- no
 * API key required, so this exercises a real AI review end to end rather
 * than the "no provider configured" degradation path. The AI score is
 * non-deterministic (a real local model), so this only asserts the
 * pattern, not an exact number. Either way, the AI score never
 * auto-resolves the outcome -- the ask owner's human score is still what
 * actually finalizes it (see submit-outcome/route.ts).
 */
test('a Supporter submits work, the local Ollama provider reviews it, and the Builder finalizes it with a human score', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup)
  await login(builderPage, builder, '/dashboard')

  await builderPage.goto('/projects/new')
  await builderPage.locator('#title').fill(`E2E Verification Project ${Date.now()}`)
  await builderPage.locator('#description').fill('A project used to exercise the verification engine.')
  await builderPage.getByRole('button', { name: 'Post Project' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+$/)

  await builderPage.getByRole('link', { name: 'Post an ask' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await builderPage.locator('#role_title').fill('Backend — verification API')
  await builderPage.locator('#verification_criteria').fill('The endpoint should return a 200 with a JSON score field.')
  await builderPage.getByRole('button', { name: 'Post Ask' }).click()
  await builderPage.waitForURL(/\/asks\/[^/]+$/)
  const askUrl = builderPage.url()

  const supporterCtx = await browser.newContext()
  const supporterPage = await supporterCtx.newPage()
  const supporter = await signUpStackWorksSupporter(supporterPage, cleanup)
  await login(supporterPage, supporter, '/dashboard')

  await supporterPage.goto(askUrl)
  await supporterPage.locator('#pitch').fill('I can build this endpoint.')
  await supporterPage.getByRole('button', { name: 'Apply' }).click()

  await builderPage.goto(askUrl)
  await builderPage.getByRole('button', { name: 'Accept' }).click()

  await supporterPage.goto(askUrl)
  await supporterPage.locator('#summary').fill('Implemented the endpoint and deployed it.')
  await supporterPage.locator('#evidence_url').fill('https://example.com/pr/123')
  await supporterPage.getByRole('button', { name: 'Submit for verification' }).click()
  await expect(supporterPage.getByText(/AI review: \d+\/100/)).toBeVisible()
  await expect(supporterPage.getByText('Pending', { exact: true })).toBeVisible()

  await builderPage.goto(askUrl)
  await expect(builderPage.getByText(/AI review: \d+\/100/)).toBeVisible()
  await builderPage.locator('input[name="human_score"]').fill('85')
  await builderPage.locator('textarea[name="human_notes"]').fill('Solid work, tested it myself.')
  await builderPage.getByRole('button', { name: 'Submit review' }).click()
  await expect(builderPage.getByText('Verified', { exact: true })).toBeVisible()

  await supporterPage.goto('/profile')
  await expect(supporterPage.getByText('Backend — verification API')).toBeVisible()
  await expect(supporterPage.getByText(/Verified · 85\/100/)).toBeVisible()

  await builderCtx.close()
  await supporterCtx.close()
})
