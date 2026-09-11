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
 * AI enhancement (Phase C1, "11 new AI enhancements" plan): the
 * cross-pillar Verified Skill Dossier on /candidates/[id]. buildSkillDossier()
 * reads real evidence tables directly (verified_outcomes, order_reviews,
 * ai_quality_scores, reputation_events), so a subject with zero evidence
 * across all four must show no dossier at all -- same "no badge for
 * zero evidence" convention as dashboard-score-badge.spec.ts. Seeded via
 * the cheapest real channel (reputation_events, Salt & Pepper pillar),
 * matching that same spec's own reasoning for why this is cheaper than a
 * full StackWorks/FlexPro verified-transaction flow.
 *
 * Content assertion is pattern-only (non-deterministic real LLM output),
 * same convention as ai-interview-prep.spec.ts and every other
 * LLM-generated-text feature this session.
 */
test('candidate profile shows an AI skill dossier only once real cross-pillar evidence exists', async ({ browser, cleanup }) => {
  const subjectCtx = await browser.newContext()
  const subjectPage = await subjectCtx.newPage()
  const subject = await signUpDeepEdge(subjectPage, 'candidate', cleanup)
  const subjectId = await getUserIdByEmail(subject.email)
  await subjectCtx.close()

  const viewerCtx = await browser.newContext()
  const viewerPage = await viewerCtx.newPage()
  const viewer = await signUpDeepEdge(viewerPage, 'candidate', cleanup)
  await login(viewerPage, viewer, '/dashboard')

  await viewerPage.goto(`/candidates/${subjectId}`)
  await expect(viewerPage.getByText('AI-Synthesized Verified Profile')).not.toBeVisible()

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/reputation_events`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ user_id: subjectId, event_type: 'project_upvoted', points: 80 }),
  })
  expect(insertRes.ok).toBeTruthy()

  await viewerPage.reload({ waitUntil: 'networkidle' })
  const dossier = viewerPage.getByText('AI-Synthesized Verified Profile')
  await expect(dossier).toBeVisible()
  await dossier.click()
  await expect(viewerPage.locator('p.whitespace-pre-line')).not.toBeEmpty()

  await viewerCtx.close()
})
