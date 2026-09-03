import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

/**
 * The pivot tag and mentor availability are both set once on the shared
 * profiles row via DeepEdge's /profile (the same cross-pillar pattern
 * years_experience/stackworks_role already use) -- these prove they surface
 * on Salt & Pepper's mentor directory via that same SSO session, with no
 * separate signup. Mentor availability is deliberately independent of
 * having personally pivoted (043) -- a lifelong domain expert who never
 * changed careers can still list themselves.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const saltnpepperBase = isLocal
  ? `http://localhost:${process.env.E2E_SALTNPEPPER_PORT || 3103}`
  : 'https://saltnpepper.greyin.net'

test('a completed pivoter who opts into mentoring shows up on Salt & Pepper, messageable from a different account', async ({ browser, cleanup }) => {
  const mentorCtx = await browser.newContext()
  const mentorPage = await mentorCtx.newPage()
  const mentor = await signUpDeepEdge(mentorPage, 'candidate', cleanup)
  await login(mentorPage, mentor, '/dashboard')

  await mentorPage.goto('/profile')
  await mentorPage.locator('input[name="is_pivoter"]').check()
  await mentorPage.locator('input[name="pivot_from_domain"]').fill('Teaching')
  await mentorPage.locator('input[name="pivot_to_domain"]').fill('Product Management')
  await mentorPage.locator('input[name="pivot_status"][value="completed"]').check()
  await mentorPage.getByRole('button', { name: 'Save Pivot Status' }).click()
  await mentorPage.waitForURL(/\?success=1/)

  // Completing a pivot alone doesn't list you as a mentor -- that's a
  // separate, explicit opt-in.
  await mentorPage.goto('/mentors')
  await mentorPage.goto(`${saltnpepperBase}/mentors`)
  await expect(mentorPage.getByText(`${mentor.firstName} ${mentor.lastName}`)).not.toBeVisible()

  await mentorPage.goto('/profile')
  await mentorPage.locator('input[name="is_mentor"]').check()
  await mentorPage.getByRole('button', { name: 'Save Mentor Availability' }).click()
  await mentorPage.waitForURL(/\?success=1/)
  await mentorCtx.close()

  const viewerCtx = await browser.newContext()
  const viewerPage = await viewerCtx.newPage()
  const viewer = await signUpDeepEdge(viewerPage, 'candidate', cleanup)
  await login(viewerPage, viewer, '/dashboard')

  await viewerPage.goto(`${saltnpepperBase}/mentors`)
  await expect(viewerPage.getByText(`${mentor.firstName} ${mentor.lastName}`)).toBeVisible()
  await expect(viewerPage.getByText('Pivoted: Teaching → Product Management')).toBeVisible()

  const mentorCard = viewerPage.locator('div.bg-white.rounded-lg.shadow-md.p-6', { hasText: `${mentor.firstName} ${mentor.lastName}` })
  await mentorCard.getByRole('button', { name: 'Message' }).click()
  await viewerPage.waitForURL(/\/messages\//)

  await viewerCtx.close()
})

test('a Verified Expert who never pivoted can also list themselves as a mentor', async ({ browser, cleanup }) => {
  const expertCtx = await browser.newContext()
  const expertPage = await expertCtx.newPage()
  // signUpDeepEdge defaults to 15 years -- a Verified Expert who never
  // touched the Career Pivot form at all.
  const expert = await signUpDeepEdge(expertPage, 'candidate', cleanup)
  await login(expertPage, expert, '/dashboard')

  await expertPage.goto('/profile')
  await expertPage.locator('input[name="is_mentor"]').check()
  await expertPage.locator('input[name="mentor_domain"]').fill('Embedded Systems')
  await expertPage.locator('textarea[name="mentor_note"]').fill('20 years shipping firmware, happy to talk shop.')
  await expertPage.getByRole('button', { name: 'Save Mentor Availability' }).click()
  await expertPage.waitForURL(/\?success=1/)
  await expertCtx.close()

  const viewerCtx = await browser.newContext()
  const viewerPage = await viewerCtx.newPage()
  const viewer = await signUpDeepEdge(viewerPage, 'candidate', cleanup)
  await login(viewerPage, viewer, '/dashboard')

  await viewerPage.goto(`${saltnpepperBase}/mentors`)
  await expect(viewerPage.getByText(`${expert.firstName} ${expert.lastName}`)).toBeVisible()
  await expect(viewerPage.getByText('Domain expert: Embedded Systems')).toBeVisible()

  await viewerCtx.close()
})
