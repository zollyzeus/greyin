import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  }
}

/**
 * AI enhancement (Phase D2, "11 new AI enhancements" plan): the
 * shareable, opt-in Verified Score badge. The plan's own test spec calls
 * for all 3 states: enabling renders the score at a public no-login URL;
 * a slug that was never enabled 404s; disabling 404s the same URL again
 * (not just "never enabled" -- the actually-toggled-off case too, since
 * get_public_score_badge() (133) deliberately returns nothing for both,
 * so a stranger probing a slug can never tell which one it was).
 */
test('a candidate can publish and unpublish a shareable Verified Score badge', async ({ browser, cleanup }) => {
  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  const candidateId = await getUserIdByEmail(candidate.email)

  // Cheapest real evidence channel for a non-null greyin_score, same
  // convention dashboard-score-badge.spec.ts already established.
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/reputation_events`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ user_id: candidateId, event_type: 'project_upvoted', points: 80 }),
  })
  expect(insertRes.ok).toBeTruthy()

  await login(candidatePage, candidate, '/dashboard')
  await candidatePage.goto('/profile')
  await expect(candidatePage.getByText('Shareable Verified Score Badge')).toBeVisible()
  await candidatePage.getByLabel('Enable public badge').check()
  await candidatePage.getByRole('button', { name: 'Save', exact: true }).click()
  await candidatePage.waitForURL(/\/profile/)

  const badgeLink = candidatePage.getByRole('link', { name: /\/verify\// })
  await expect(badgeLink).toBeVisible()
  const verifyUrl = await badgeLink.getAttribute('href')
  expect(verifyUrl).toBeTruthy()

  // A never-enabled slug 404s.
  const strangerCtx = await browser.newContext()
  const strangerPage = await strangerCtx.newPage()
  const neverEnabledResponse = await strangerPage.goto(`${new URL(verifyUrl!).origin}/verify/never-was-a-real-slug`)
  expect(neverEnabledResponse?.status()).toBe(404)

  // The real, just-enabled slug renders the score, logged out.
  const enabledResponse = await strangerPage.goto(verifyUrl!)
  expect(enabledResponse?.status()).toBe(200)
  await expect(strangerPage.getByText('Greyin Verified Score')).toBeVisible()
  await expect(strangerPage.getByText(/Salt & Pepper: \d+\/100/)).toBeVisible()
  await strangerCtx.close()

  // Disabling it 404s the exact same URL again.
  await candidatePage.getByLabel('Enable public badge').uncheck()
  await candidatePage.getByRole('button', { name: 'Save', exact: true }).click()
  await candidatePage.waitForURL(/\/profile/)
  await expect(candidatePage.getByText('Shareable Verified Score Badge')).toBeVisible()
  await expect(candidatePage.getByRole('link', { name: /\/verify\// })).not.toBeVisible()

  const disabledCtx = await browser.newContext()
  const disabledPage = await disabledCtx.newPage()
  const disabledResponse = await disabledPage.goto(verifyUrl!)
  expect(disabledResponse?.status()).toBe(404)
  await disabledCtx.close()

  await candidateCtx.close()
})
