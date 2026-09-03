import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, signUpFlexPro, login, signUpDeepEdge } from '../../utils/auth'
import { getUserIdByEmail } from '../../utils/admin'

const isLocal = process.env.E2E_TARGET === 'local'
const greyinB2BBase = isLocal ? `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}` : 'https://deepedge.greyin.net'
const flexproBase = isLocal ? `http://localhost:${process.env.E2E_FREEAGENT_PORT || 3102}` : 'https://flexpro.greyin.net'

/**
 * Salt & Pepper's own /mentors directory has no booking/payment
 * infrastructure of its own -- it links out to FlexPro, where mentor
 * sessions actually live (056_mentor_sessions.sql), same
 * hardcoded-absolute-URL cross-pillar convention as EcosystemWidget.tsx.
 * The link only appears once the mentor has a real active session gig
 * (a cross-app read of gigs, confirmed via mentors/page.tsx).
 */
test('a mentor with a real bookable session shows a "Book a session" link on Salt & Pepper\'s mentor directory', async ({ browser, cleanup }) => {
  const mentorCtx = await browser.newContext()
  const mentorPage = await mentorCtx.newPage()
  const mentor = await signUpSaltNPepper(mentorPage, cleanup)
  await login(mentorPage, mentor, '/dashboard')
  const mentorId = await getUserIdByEmail(mentor.email)

  await mentorCtx.close()

  // Flip is_mentor via DeepEdge's own profile page (that's the only
  // place it's settable, gated on Verified Expert status) -- same
  // underlying person via SSO on the same shared credentials, even
  // though the initial signup happened on Salt & Pepper. profiles is
  // one shared table read/written by every app.
  const b2bCtx = await browser.newContext()
  const b2bPage = await b2bCtx.newPage()
  await login(b2bPage, mentor, `${greyinB2BBase}/dashboard`, greyinB2BBase)
  await b2bPage.goto(`${greyinB2BBase}/profile`)
  const hasMentorSection = await b2bPage.locator('input[name="is_mentor"]').isVisible().catch(() => false)
  if (hasMentorSection) {
    await b2bPage.locator('input[name="is_mentor"]').check()
    await b2bPage.getByRole('button', { name: 'Save Mentor Availability' }).click()
  }
  await b2bCtx.close()

  // Create a real active session gig on FlexPro for this same mentor.
  const faCtx = await browser.newContext()
  const faPage = await faCtx.newPage()
  await login(faPage, mentor, `${flexproBase}/dashboard`, flexproBase)
  const sessionTitle = `E2E Cross-App Session ${Date.now()}`
  await faPage.goto(`${flexproBase}/mentor-sessions/manage`)
  await faPage.locator('input[name="title"]').fill(sessionTitle)
  await faPage.locator('textarea[name="description"]').fill('Exercises the cross-app mentor booking link.')
  await faPage.locator('input[name="is_free"]').check()
  await faPage.getByRole('button', { name: 'Create' }).click()
  await faPage.waitForURL(`${flexproBase}/mentor-sessions/manage`)
  await faCtx.close()

  const viewerCtx = await browser.newContext()
  const viewerPage = await viewerCtx.newPage()
  const viewer = await signUpSaltNPepper(viewerPage, cleanup)
  await login(viewerPage, viewer, '/dashboard')

  await viewerPage.goto('/mentors')
  const bookLink = viewerPage.getByRole('link', { name: 'Book a session' })
  await expect(bookLink.first()).toBeVisible()
  await expect(bookLink.first()).toHaveAttribute('href', new RegExp(`^${flexproBase}/mentor-sessions\\?mentor=${mentorId}$`))

  await viewerCtx.close()
})
