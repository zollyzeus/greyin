import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, signUpLongList, login } from '../../utils/auth'
import {
  getFutureRoleIdByTitle,
  getUserIdByEmail,
  grantActiveSubscriptionTier,
  setLLMFeatureFlag,
} from '../../utils/admin'

/**
 * FR-LL-04 (AI-surfaced second candidate set) and FR-LL-05 (role
 * filled/expired + subscriber notification) were both built and marked
 * "not covered" in the traceability workbook -- this closes both gaps,
 * at direct user request.
 *
 * Two real bugs found while doing this, both fixed in the same pass
 * (110_fix_future_role_expired_notification.sql and this file's own
 * apps/longlist/src/app/employer/roles/page.tsx change), not just
 * worked around in the test:
 *  - notify_future_role_filled() only ever checked
 *    `NEW.status = 'filled'`, never 'expired', despite the feature's own
 *    stated intent covering both ("every subscriber is notified when a
 *    role they were interested in closes") -- a subscriber to a role
 *    that quietly expired was never told at all.
 *  - 'expired' was already a real, API-accepted, notification-wired
 *    status, but the employer roles page only ever rendered a "Mark
 *    filled" button -- there was no way for a real poster to reach it.
 *
 * Cross-platform, not tests/longlist/, because posting a future role
 * needs a real DeepEdge company first (future_roles.company_id FK) --
 * same reasoning as longlist-future-roles.spec.ts.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const deepedgeBase = isLocal ? `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}` : 'https://deepedge.greyin.net'
const longlistBase = isLocal ? `http://localhost:${process.env.E2E_LONGLIST_PORT || 3106}` : 'https://longlist.greyin.net'

async function postFutureRole(employerPage: import('@playwright/test').Page, title: string, skills: string) {
  await employerPage.goto(`${longlistBase}/post`)
  await employerPage.locator('input[name="title"]').fill(title)
  await employerPage.locator('textarea[name="description"]').fill('Role used to exercise the lifecycle/matching e2e spec.')
  await employerPage.locator('input[name="skills"]').fill(skills)
  await employerPage.getByRole('button', { name: 'Post Future Role' }).click()
  await employerPage.waitForURL(`${longlistBase}/employer/roles?posted=1`)
  return getFutureRoleIdByTitle(title)
}

test('a role marked filled, and one marked expired, both notify their subscribers', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup, 15, deepedgeBase)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, `${deepedgeBase}/employer/dashboard`, deepedgeBase)

  // Setup job so a real companies row exists (087's future_roles.company_id FK).
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL(`${deepedgeBase}/employer/post-job`)
  await employerPage.locator('#title').fill(`E2E Lifecycle Setup Job ${Date.now()}`)
  await employerPage.locator('#description').fill('Setup job so a real company exists for this spec.')
  await employerPage.locator('#location').fill('Remote')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL(`${deepedgeBase}/employer/dashboard`)

  const runId = Date.now()
  const filledTitle = `E2E Filled Role ${runId}`
  const expiredTitle = `E2E Expired Role ${runId}`
  const filledRoleId = await postFutureRole(employerPage, filledTitle, 'Kubernetes')
  cleanup.trackEntity('future_roles', filledRoleId)
  const expiredRoleId = await postFutureRole(employerPage, expiredTitle, 'Kubernetes')
  cleanup.trackEntity('future_roles', expiredRoleId)

  // One member subscribes to each role.
  const filledSubCtx = await browser.newContext()
  const filledSubPage = await filledSubCtx.newPage()
  const filledSubscriber = await signUpLongList(filledSubPage, cleanup, longlistBase)
  await login(filledSubPage, filledSubscriber, `${longlistBase}/dashboard`, longlistBase)
  await filledSubPage.goto(`${longlistBase}/roles`)
  await filledSubPage
    .locator('div.bg-white.rounded-xl.border', { hasText: filledTitle })
    .getByRole('button', { name: "I'm future-interested" })
    .click()

  const expiredSubCtx = await browser.newContext()
  const expiredSubPage = await expiredSubCtx.newPage()
  const expiredSubscriber = await signUpLongList(expiredSubPage, cleanup, longlistBase)
  await login(expiredSubPage, expiredSubscriber, `${longlistBase}/dashboard`, longlistBase)
  await expiredSubPage.goto(`${longlistBase}/roles`)
  await expiredSubPage
    .locator('div.bg-white.rounded-xl.border', { hasText: expiredTitle })
    .getByRole('button', { name: "I'm future-interested" })
    .click()

  // Employer closes each role a different way.
  await employerPage.goto(`${longlistBase}/employer/roles`)
  const filledRow = employerPage.locator('div.bg-white.rounded-xl.border', { hasText: filledTitle })
  await filledRow.getByRole('button', { name: 'Mark filled' }).click()
  await employerPage.waitForURL(new RegExp(`${longlistBase}/employer/roles$`))

  const expiredRow = employerPage.locator('div.bg-white.rounded-xl.border', { hasText: expiredTitle })
  await expiredRow.getByRole('button', { name: 'Mark expired' }).click()
  await employerPage.waitForURL(new RegExp(`${longlistBase}/employer/roles$`))

  // Both subscribers were notified -- the real, previously-missing
  // behavior for the 'expired' case.
  await filledSubPage.goto(`${longlistBase}/notifications`)
  await expect(filledSubPage.getByText('A role you were interested in has moved on')).toBeVisible()
  await expect(filledSubPage.getByText(`"${filledTitle}" is no longer open on Longlist`)).toBeVisible()

  await expiredSubPage.goto(`${longlistBase}/notifications`)
  await expect(expiredSubPage.getByText('A role you were interested in has moved on')).toBeVisible()
  await expect(expiredSubPage.getByText(`"${expiredTitle}" is no longer open on Longlist`)).toBeVisible()

  await filledSubCtx.close()
  await expiredSubCtx.close()
})

test('an admin-enabled AI-surfaced candidate list ranks a member by their stated future interest', async ({ browser, cleanup }) => {
  // longlist_candidate_matching is genuinely OFF by default (a real
  // product decision -- see match-candidates.ts's own comment: it
  // surfaces a profile to an employer with no explicit per-role opt-in),
  // so this flips it on for the duration of the test only.
  await setLLMFeatureFlag('longlist_candidate_matching', true)
  try {
    const memberCtx = await browser.newContext()
    const memberPage = await memberCtx.newPage()
    const member = await signUpLongList(memberPage, cleanup, longlistBase)
    await login(memberPage, member, `${longlistBase}/dashboard`, longlistBase)

    // Deliberately never subscribes to anything -- the whole point of
    // FR-LL-04 is surfacing someone who *didn't* explicitly opt in to
    // this specific role, matched purely on stated future interest.
    await memberPage.goto(`${longlistBase}/profile`)
    await memberPage.locator('input[name="future_interests"]').fill('VP Engineering, platform infrastructure leadership')
    await memberPage.locator('textarea[name="future_interests_note"]').fill(
      'Looking to lead a platform/infrastructure org, ideally owning Kubernetes and reliability strategy, from 2027 onward.'
    )
    await memberPage.getByRole('button', { name: 'Save' }).click()
    await memberPage.waitForURL(/\/profile\?saved=1/)

    const employerCtx = await browser.newContext()
    const employerPage = await employerCtx.newPage()
    const employer = await signUpDeepEdge(employerPage, 'employer', cleanup, 15, deepedgeBase)
    await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
    await login(employerPage, employer, `${deepedgeBase}/employer/dashboard`, deepedgeBase)

    await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
    await employerPage.waitForURL(`${deepedgeBase}/employer/post-job`)
    await employerPage.locator('#title').fill(`E2E AI Match Setup Job ${Date.now()}`)
    await employerPage.locator('#description').fill('Setup job so a real company exists for this spec.')
    await employerPage.locator('#location').fill('Remote')
    await employerPage.getByRole('button', { name: 'Publish Job' }).click()
    await employerPage.waitForURL(`${deepedgeBase}/employer/dashboard`)

    const roleTitle = `E2E VP Engineering Platform Role ${Date.now()}`
    await employerPage.goto(`${longlistBase}/post`)
    await employerPage.locator('input[name="title"]').fill(roleTitle)
    await employerPage
      .locator('textarea[name="description"]')
      .fill('Will own platform infrastructure and Kubernetes reliability strategy for the whole engineering org.')
    await employerPage.locator('input[name="skills"]').fill('Kubernetes, platform infrastructure, reliability')
    await employerPage.getByRole('button', { name: 'Post Future Role' }).click()
    await employerPage.waitForURL(`${longlistBase}/employer/roles?posted=1`)

    const futureRoleId = await getFutureRoleIdByTitle(roleTitle)
    cleanup.trackEntity('future_roles', futureRoleId)

    await employerPage.goto(`${longlistBase}/employer/roles/${futureRoleId}/candidates`)
    // A real, non-deterministic LLM call -- generous timeout, matching
    // this suite's own convention for asserting on real AI output
    // (ai-quality-score.spec.ts across GreyMatters/FlexPro/Salt & Pepper).
    await expect(employerPage.getByText('AI-surfaced (', { exact: false })).toBeVisible()
    const aiSection = employerPage.locator('div.bg-white.rounded-xl.border', { hasText: 'AI-surfaced' })
    await expect(aiSection.getByText(`${member.firstName} ${member.lastName}`)).toBeVisible({ timeout: 30_000 })

    await memberCtx.close()
    await employerCtx.close()
  } finally {
    await setLLMFeatureFlag('longlist_candidate_matching', false)
  }
})
