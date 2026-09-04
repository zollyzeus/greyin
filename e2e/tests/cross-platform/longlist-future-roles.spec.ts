import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, signUpLongList, login } from '../../utils/auth'
import { getFutureRoleIdByTitle, grantActiveSubscriptionTier, getUserIdByEmail } from '../../utils/admin'

/**
 * Longlist's whole mechanic in one real flow: a company posts a future
 * role without its identity ever appearing to a browsing member, a
 * member subscribes as future-interested (not an application), and only
 * then does that member's identity become visible -- to the role's
 * poster specifically, not published anywhere else. Necessarily
 * cross-platform: the company/employer identity lives on DeepEdge
 * (companies table), the future role itself on Longlist.
 *
 * Covers the RLS-critical path this was already verified for directly
 * via SQL before shipping (087/088) -- this is the same mechanic
 * exercised end to end through the real UI instead.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const expertedgeBase = isLocal ? `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}` : 'https://deepedge.greyin.net'
const longlistBase = isLocal ? `http://localhost:${process.env.E2E_LONGLIST_PORT || 3106}` : 'https://longlist.greyin.net'

test('a company posts a future role anonymously, a member subscribes, and only the poster ever sees who', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup, 15, expertedgeBase)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, `${expertedgeBase}/employer/dashboard`, expertedgeBase)

  // A real job post is what actually creates the companies row (087's
  // future_roles.company_id FK needs one to exist) -- same setup every
  // other DeepEdge employer-flow test uses.
  const companyRevealingJobTitle = `E2E Longlist Setup Job ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL(`${expertedgeBase}/employer/post-job`)
  await employerPage.locator('#title').fill(companyRevealingJobTitle)
  await employerPage.locator('#description').fill('Setup job so a real company exists for the Longlist e2e spec.')
  await employerPage.locator('#location').fill('Remote')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL(`${expertedgeBase}/employer/dashboard`)

  // Now post the future role -- same session, shared .greyin.net cookie,
  // no separate Longlist login needed. The description deliberately
  // never names the company (matching /post's own instructions to a
  // real poster).
  const roleTitle = `E2E Future Staff Engineer ${Date.now()}`
  await employerPage.goto(`${longlistBase}/post`)
  await employerPage.locator('input[name="title"]').fill(roleTitle)
  await employerPage.locator('textarea[name="description"]').fill('Will own the platform team once the round closes. No company name here on purpose.')
  await employerPage.locator('input[name="skills"]').fill('Kubernetes, team leadership')
  await employerPage.getByRole('button', { name: 'Post Future Role' }).click()
  await employerPage.waitForURL(`${longlistBase}/employer/roles?posted=1`)
  await expect(employerPage.getByText(roleTitle)).toBeVisible()

  const futureRoleId = await getFutureRoleIdByTitle(roleTitle)
  // Tracked as an entity, cleared before any user account -- see
  // getFutureRoleIdByTitle's own comment: this guarantees the
  // future_role_subscriptions row this test is about to create doesn't
  // outlive the future_roles row it references, regardless of which
  // user (employer or member) gets deleted first.
  cleanup.trackEntity('future_roles', futureRoleId)

  const memberCtx = await browser.newContext()
  const memberPage = await memberCtx.newPage()
  const member = await signUpLongList(memberPage, cleanup, longlistBase)
  await login(memberPage, member, `${longlistBase}/dashboard`, longlistBase)

  await memberPage.goto(`${longlistBase}/roles`)
  await expect(memberPage.getByText(roleTitle)).toBeVisible()
  // The actual anonymity assertion: the company's real name is nowhere
  // on the page a browsing member sees, even though the role is theirs.
  await expect(memberPage.locator('body')).not.toContainText(employer.lastName)

  // /roles orders by created_at desc, so the role this test just posted
  // is always first -- .first() is the real target, not a workaround.
  // Same fix as cross-platform/longlist-activity.spec.ts's own -- a
  // growing seeded env means more than one role can be listed by the
  // time this runs, and the bare locator was ambiguous (strict-mode
  // violation) without it.
  await memberPage.getByRole('button', { name: "I'm future-interested" }).first().click()
  await expect(memberPage.getByRole('button', { name: "You're future-interested" })).toBeVisible()

  // Back to the employer: this is the one place the member's identity
  // is allowed to appear.
  await employerPage.goto(`${longlistBase}/employer/roles/${futureRoleId}/candidates`)
  await expect(employerPage.getByText(`${member.firstName} ${member.lastName}`)).toBeVisible()
})

test('a stranger sees no subscribers on a role they did not post', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup, 15, expertedgeBase)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, `${expertedgeBase}/employer/dashboard`, expertedgeBase)

  const jobTitle = `E2E Longlist Stranger Setup ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL(`${expertedgeBase}/employer/post-job`)
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Setup job for the Longlist stranger-access e2e spec.')
  await employerPage.locator('#location').fill('Remote')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL(`${expertedgeBase}/employer/dashboard`)

  const roleTitle = `E2E Future Role Not Yours ${Date.now()}`
  await employerPage.goto(`${longlistBase}/post`)
  await employerPage.locator('input[name="title"]').fill(roleTitle)
  await employerPage.locator('textarea[name="description"]').fill('A role a stranger should never see the candidates for.')
  await employerPage.getByRole('button', { name: 'Post Future Role' }).click()
  await employerPage.waitForURL(`${longlistBase}/employer/roles?posted=1`)

  const futureRoleId = await getFutureRoleIdByTitle(roleTitle)
  cleanup.trackEntity('future_roles', futureRoleId)

  // A second, unrelated employer -- also has a real company, just not
  // the one that owns this role.
  const strangerCtx = await browser.newContext()
  const strangerPage = await strangerCtx.newPage()
  const stranger = await signUpDeepEdge(strangerPage, 'employer', cleanup, 15, expertedgeBase)
  await grantActiveSubscriptionTier(await getUserIdByEmail(stranger.email), 'basic')
  await login(strangerPage, stranger, `${expertedgeBase}/employer/dashboard`, expertedgeBase)

  await strangerPage.goto(`${longlistBase}/employer/roles/${futureRoleId}/candidates`)
  // RLS (087) makes a non-owner's read of future_roles come back empty
  // -- the page's own notFound() renders Next.js's 404, not the role's
  // real title or candidate list.
  await expect(strangerPage.getByText(roleTitle)).toHaveCount(0)
})
