import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
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
 * AI enhancement (Phase C2, "11 new AI enhancements" plan): cross-pillar
 * career-path projection on greyin-hub's /dashboard. projectCareerPath()
 * reads the shared greyin_scores view, so it's gated the same way as the
 * score badge (dashboard-score-badge.spec.ts) -- no pillar score yet
 * means no projection section at all. Seeded via the same cheapest real
 * channel (Salt & Pepper reputation_events) that spec already uses for
 * exercising this shared view cross-app.
 *
 * Content assertion is pattern-only (non-deterministic real LLM output),
 * same convention as every other LLM-generated-text feature this session.
 */
test('Hub dashboard shows an AI career-path projection only once a real greyin_scores row exists', async ({ page, cleanup }) => {
  const member = await signUpSaltNPepper(page, cleanup, 'https://saltnpepper.greyin.net')
  const memberId = await getUserIdByEmail(member.email)
  await login(page, member, 'https://greyin.net/dashboard', 'https://greyin.net')

  const projection = page.getByText('Your career path (AI-synthesized)')
  await expect(projection).not.toBeVisible()

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/reputation_events`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ user_id: memberId, event_type: 'project_upvoted', points: 80 }),
  })
  expect(insertRes.ok).toBeTruthy()

  await page.reload({ waitUntil: 'networkidle' })
  await expect(projection).toBeVisible()
  await expect(page.locator('p.whitespace-pre-line')).not.toBeEmpty()
})
