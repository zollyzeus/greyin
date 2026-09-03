import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

/**
 * The re-entry tag is set once on the shared profiles row via DeepEdge's
 * /profile, same cross-pillar pattern as is_pivoter/is_mentor -- this
 * proves it surfaces on Salt & Pepper's mentor directory via the existing
 * SSO session, and on StackWorks's People directory, with no separate signup
 * on either app.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const saltnpepperBase = isLocal
  ? `http://localhost:${process.env.E2E_SALTNPEPPER_PORT || 3103}`
  : 'https://saltnpepper.greyin.net'
const stackworksBase = isLocal
  ? `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}`
  : 'https://stackworks.greyin.net'

test('a re-entry Verified Expert who opts into mentoring shows the "returned after a gap" note on Salt & Pepper, and the badge on StackWorks People', async ({ browser, cleanup }) => {
  const memberCtx = await browser.newContext()
  const memberPage = await memberCtx.newPage()
  const member = await signUpDeepEdge(memberPage, 'candidate', cleanup)
  await login(memberPage, member, '/dashboard')

  await memberPage.goto('/profile')
  await memberPage.locator('input[name="is_reentry"]').check()
  await memberPage.locator('select[name="reentry_reason"]').selectOption('layoff')
  await memberPage.getByRole('button', { name: 'Save Re-entry Status' }).click()
  await memberPage.waitForURL(/\?success=1/)

  // Tagging re-entry alone doesn't list you as a mentor -- separate opt-in,
  // same as Pivoter/Mentor decoupling.
  await memberPage.goto(`${saltnpepperBase}/mentors`)
  await expect(memberPage.getByText(`${member.firstName} ${member.lastName}`)).not.toBeVisible()

  await memberPage.goto('/profile')
  await memberPage.locator('input[name="is_mentor"]').check()
  await memberPage.locator('input[name="mentor_domain"]').fill('Product Design')
  await memberPage.getByRole('button', { name: 'Save Mentor Availability' }).click()
  await memberPage.waitForURL(/\?success=1/)

  await memberPage.goto(`${saltnpepperBase}/mentors`)
  const mentorCard = memberPage.locator('div.bg-white.rounded-lg.shadow-md.p-6', { hasText: `${member.firstName} ${member.lastName}` })
  await expect(mentorCard).toBeVisible()
  await expect(mentorCard.getByText('Returned to work after a gap')).toBeVisible()

  // The People directory reads pillar_memberships, which is only populated
  // by stackworks's own /auth/login route (ensure_pillar_membership) -- a bare
  // SSO-cookie goto() to /dashboard, like sso.spec.ts deliberately uses to
  // prove cookie recognition alone, would skip that bookkeeping. But this
  // member is already authenticated via the deepedge SSO cookie, so
  // stackworks's /login *page* immediately redirects away before its form can
  // be filled -- POST straight to /auth/login instead (same fields the
  // real form sends), which re-authenticates and runs
  // ensure_pillar_membership regardless of the existing session.
  await memberPage.request.post(`${stackworksBase}/auth/login`, {
    form: { email: member.email, password: member.password },
  })
  await memberPage.goto(`${stackworksBase}/people`)
  const peopleCard = memberPage.locator('div', { hasText: `${member.firstName} ${member.lastName}` }).first()
  await expect(peopleCard.getByText('Returning to work')).toBeVisible()

  await memberCtx.close()
})
