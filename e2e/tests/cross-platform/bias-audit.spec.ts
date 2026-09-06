import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, signUpLongList, login } from '../../utils/auth'
import {
  getFutureRoleIdByTitle,
  getLLMFeatureFlagEnabled,
  getUserIdByEmail,
  grantActiveSubscriptionTier,
  promoteToAdmin,
  setDemographics,
  setFutureInterests,
  setLLMFeatureFlag,
} from '../../utils/admin'
import { dismissGuidedTourIfShown } from '../../utils/tour'

/**
 * AI moat roadmap item: bias/fairness auditing on AI matching output
 * (119, get_bias_audit_report()). The report's eligible_count/bucket
 * breakdown is a deterministic join (platform_people_index x
 * profile_demographics), independent of whatever the LLM actually
 * surfaces this run -- so unlike ai-mentor-matching.spec.ts this doesn't
 * need to assert on a specific AI pick, only that a real self-disclosed
 * member with future_interests set shows up in their bucket's eligible
 * count. Runs a real Longlist AI-match call too (same setup as
 * longlist-role-lifecycle-and-matching.spec.ts) so ai_match_audit_log
 * has something in it, but doesn't assert on surfaced_count specifically
 * since that part is genuinely non-deterministic.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const deepedgeBase = isLocal ? `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}` : 'https://deepedge.greyin.net'
const longlistBase = isLocal ? `http://localhost:${process.env.E2E_LONGLIST_PORT || 3106}` : 'https://longlist.greyin.net'
const greyinHubBase = isLocal ? `http://localhost:${process.env.E2E_GREYIN_HUB_PORT || 3107}` : 'https://greyin.net'

test('a self-disclosed member appears in the bias audit report, and the AI-match pipeline logs to the audit trail', async ({ browser, cleanup }) => {
  // Same save/restore pattern as longlist-role-lifecycle-and-matching.spec.ts
  // -- see getLLMFeatureFlagEnabled()'s comment on why this must not
  // hardcode either state.
  const priorEnabled = await getLLMFeatureFlagEnabled('longlist_candidate_matching')
  await setLLMFeatureFlag('longlist_candidate_matching', true)
  try {
    const memberCtx = await browser.newContext()
    const memberPage = await memberCtx.newPage()
    const member = await signUpLongList(memberPage, cleanup, longlistBase)
    await login(memberPage, member, `${longlistBase}/dashboard`, longlistBase)
    await dismissGuidedTourIfShown(memberPage)
    const memberId = await getUserIdByEmail(member.email)
    await setFutureInterests(memberId, ['VP Engineering', 'platform infrastructure leadership'])
    await setDemographics(memberId, { gender: 'woman' })
    await memberCtx.close()

    const employerCtx = await browser.newContext()
    const employerPage = await employerCtx.newPage()
    const employer = await signUpDeepEdge(employerPage, 'employer', cleanup, 15, deepedgeBase)
    await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
    await login(employerPage, employer, `${deepedgeBase}/employer/dashboard`, deepedgeBase)

    await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
    await employerPage.waitForURL(`${deepedgeBase}/employer/post-job`)
    await employerPage.locator('#title').fill(`E2E Bias Audit Setup Job ${Date.now()}`)
    await employerPage.locator('#description').fill('Setup job so a real company exists for this spec.')
    await employerPage.locator('#location').fill('Remote')
    await employerPage.getByRole('button', { name: 'Publish Job' }).click()
    await employerPage.waitForURL(`${deepedgeBase}/employer/dashboard`)

    const roleTitle = `E2E Bias Audit Role ${Date.now()}`
    await employerPage.goto(`${longlistBase}/post`)
    await employerPage.locator('input[name="title"]').fill(roleTitle)
    await employerPage.locator('textarea[name="description"]').fill('Will own platform infrastructure for the whole engineering org.')
    await employerPage.locator('input[name="skills"]').fill('Kubernetes, platform infrastructure')
    await employerPage.getByRole('button', { name: 'Post Future Role' }).click()
    await employerPage.waitForURL(`${longlistBase}/employer/roles?posted=1`)

    const futureRoleId = await getFutureRoleIdByTitle(roleTitle)
    cleanup.trackEntity('future_roles', futureRoleId)

    // Triggers a real matchCandidatesForRole() call, which now also
    // writes to ai_match_audit_log (119) for whoever it surfaces.
    await employerPage.goto(`${longlistBase}/employer/roles/${futureRoleId}/candidates`)
    await expect(employerPage.getByText('AI-surfaced (', { exact: false })).toBeVisible({ timeout: 30_000 })
    await employerCtx.close()

    await promoteToAdmin(await getUserIdByEmail(employer.email))
    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()
    // Login redirects by role (auth/login/route.ts) -- now that this
    // account is 'admin' rather than 'employer', that lands on /dashboard,
    // not /employer/dashboard.
    await login(adminPage, employer, `${deepedgeBase}/dashboard`, deepedgeBase)
    await dismissGuidedTourIfShown(adminPage)

    await adminPage.goto(`${greyinHubBase}/admin/bias-audit`)
    await expect(adminPage.getByRole('heading', { name: 'AI Matching Bias Audit' })).toBeVisible()
    const womanRow = adminPage.locator('tr', { hasText: 'Woman' })
    await expect(womanRow).toBeVisible()
    const eligibleCount = await womanRow.locator('td').nth(1).textContent()
    expect(Number(eligibleCount)).toBeGreaterThanOrEqual(1)

    await adminCtx.close()
  } finally {
    await setLLMFeatureFlag('longlist_candidate_matching', priorEnabled)
  }
})
