import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin, getGreyinScoreRow, getGateSettings, seedReputationPoints } from '../../utils/admin'

/**
 * platform_gate_settings (041_gate_threshold_governance.sql) is the one
 * live value greyin_scores.is_verified_expert actually reads -- this
 * proves the admin form (moved to Greyin Hub's /admin/threshold-votes
 * 2026-08-24, alongside the LLM admin panel -- both genuinely
 * platform-wide, not scoped to one pillar) really changes it, and that a
 * real candidate's verified-expert status flips the moment it does, not
 * just that the form redirects with a success banner.
 *
 * years_experience is kept below the *existing* min_years_experience
 * (which this test never changes) so the years-based OR branch can't
 * itself grant is_verified_expert -- only the score branch is exercised.
 * The candidate's actual greyin_score depends on the live platform-wide
 * Salt & Pepper mean (not something this suite controls), so the two
 * thresholds tried are derived from the candidate's own observed score
 * after seeding real (if synthetic) evidence, not hardcoded.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const hubBase = isLocal ? `http://localhost:${process.env.E2E_HUB_PORT || 3105}` : 'https://greyin.net'

test('an admin can update the eligibility gate settings and a candidate\'s verified-expert status flips accordingly', async ({ browser, cleanup }) => {
  const original = await getGateSettings()

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup, Math.max(0, original.min_years_experience - 5))
  const candidateId = await getUserIdByEmail(candidate.email)
  await candidateCtx.close()

  // Give the candidate real (if modest) Salt & Pepper evidence so their
  // greyin_score is a real, non-null number instead of staying null
  // forever -- a null score can never cross a threshold either way.
  await seedReputationPoints(candidateId, 50)

  let scoreRow: Record<string, any> | null = null
  for (let attempt = 0; attempt < 10; attempt++) {
    scoreRow = await getGreyinScoreRow(candidateId)
    if (typeof scoreRow?.greyin_score === 'number') break
    await new Promise((r) => setTimeout(r, 300))
  }
  const observedScore = scoreRow!.greyin_score as number

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpDeepEdge(adminPage, 'candidate', cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, '/dashboard')

  async function setThreshold(minGreyinScore: number) {
    await adminPage.goto(`${hubBase}/admin/threshold-votes`)
    await adminPage.locator('#min_years_experience').fill(String(original.min_years_experience))
    await adminPage.locator('#min_greyin_score').fill(String(minGreyinScore))
    await adminPage.getByRole('button', { name: 'Save' }).click()
    await adminPage.waitForURL(`${hubBase}/admin/threshold-votes?success=1`)
    await expect(adminPage.getByText('Gate settings updated.')).toBeVisible()
  }

  try {
    // Push the threshold above the candidate's observed score -- confirm not verified.
    await setThreshold(Math.min(100, Math.ceil(observedScore) + 10))
    const belowRow = await getGreyinScoreRow(candidateId)
    expect(belowRow?.is_verified_expert).toBe(false)

    // Now push it below -- confirm the flip.
    await setThreshold(Math.max(0, Math.floor(observedScore) - 10))
    const aboveRow = await getGreyinScoreRow(candidateId)
    expect(aboveRow?.is_verified_expert).toBe(true)
  } finally {
    // Restore prod's original gate settings so this test never leaves
    // them changed.
    await setThreshold(original.min_greyin_score)
  }

  await adminCtx.close()
})
