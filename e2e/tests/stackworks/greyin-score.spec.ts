import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, signUpStackWorksSupporter, login } from '../../utils/auth'

/**
 * The unified Greyin Score (036, Algorithm B: Bayesian-shrunk,
 * headcount-weighted composite of StackWorks/FlexPro/Salt & Pepper plus
 * career experience) only produces a number once someone has evidence on
 * at least one platform -- a fresh signup with zero activity should show
 * nothing. Once a Supporter has a verified outcome, both their own
 * profile page and the public People directory should show a real
 * score instead.
 */
test('a Supporter with a verified outcome gets a Greyin Score on their profile and in the People directory', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup)
  await login(builderPage, builder, '/dashboard')

  await builderPage.goto('/projects/new')
  await builderPage.locator('#title').fill(`E2E Greyin Score Project ${Date.now()}`)
  await builderPage.locator('#description').fill('A project used to exercise the unified Greyin Score.')
  await builderPage.getByRole('button', { name: 'Post Project' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+$/)

  await builderPage.getByRole('link', { name: 'Post an ask' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await builderPage.locator('#role_title').fill('Greyin Score ask')
  await builderPage.getByRole('button', { name: 'Post Ask' }).click()
  await builderPage.waitForURL(/\/asks\/[^/]+$/)
  const askUrl = builderPage.url()

  const supporterCtx = await browser.newContext()
  const supporterPage = await supporterCtx.newPage()
  const supporter = await signUpStackWorksSupporter(supporterPage, cleanup)
  await login(supporterPage, supporter, '/dashboard')

  // Before any activity, no score should be shown anywhere.
  await supporterPage.goto('/profile')
  await expect(supporterPage.getByText(/Greyin Score:/)).not.toBeVisible()

  await supporterPage.goto(askUrl)
  await supporterPage.locator('#pitch').fill('I can help with this.')
  await supporterPage.getByRole('button', { name: 'Apply' }).click()

  await builderPage.goto(askUrl)
  await builderPage.getByRole('button', { name: 'Accept' }).click()

  await supporterPage.goto(askUrl)
  await supporterPage.locator('#summary').fill('Delivered the work.')
  await supporterPage.getByRole('button', { name: 'Submit for verification' }).click()

  await builderPage.goto(askUrl)
  await builderPage.locator('input[name="human_score"]').fill('90')
  await builderPage.getByRole('button', { name: 'Submit review' }).click()
  await expect(builderPage.getByText('Verified', { exact: true })).toBeVisible()

  await supporterPage.goto('/profile')
  await expect(supporterPage.getByText(/Greyin Score: \d+/)).toBeVisible()

  // The breakdown behind "How is this calculated?" -- Bayesian-shrunk
  // per-platform contributions plus the career-experience term -- reads
  // straight off the same greyin_scores columns this whole score is
  // computed from, so this is a direct check on the transparency
  // disclosure added to every app's profile page, not just StackWorks's.
  await supporterPage.getByText('How is this calculated?').click()
  await expect(supporterPage.getByText(/StackWorks: \d+\/100 \(from 1 verified outcome\)/)).toBeVisible()
  await expect(supporterPage.getByText(/Greyin Score = 85% platform composite \+ 15% experience = \d+/)).toBeVisible()

  await supporterPage.goto('/people')
  const supporterCard = supporterPage.locator('div.bg-white.rounded-lg.shadow-md', { hasText: supporter.lastName })
  await expect(supporterCard.getByText(/^\d+$/)).toBeVisible()

  await builderCtx.close()
  await supporterCtx.close()
})
