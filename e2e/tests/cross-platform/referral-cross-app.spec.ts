import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, signUpSaltNPepper, login } from '../../utils/auth'
import { getJobIdByTitle } from '../../utils/admin'

/**
 * deepedge/referral.spec.ts already proves the referral bridge when the
 * referred person's account happens to live on deepedge itself. The
 * lookup in api/jobs/[id]/refer/route.ts matches on the shared profiles
 * table's email column with no app-of-origin check, and notifications is
 * the same shared table + identical page (just reskinned) in every app
 * that has one -- so this proves the other, more representative case: a
 * Salt & Pepper member who has never touched deepedge still gets
 * referred correctly, and sees the notification on the app they
 * actually use.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const saltnpepperBase = isLocal
  ? `http://localhost:${process.env.E2E_SALTNPEPPER_PORT || 3103}`
  : 'https://saltnpepper.greyin.net'
const greyinB2BBase = isLocal ? `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}` : 'https://deepedge.greyin.net'

test('a Salt & Pepper member, never signed up on deepedge, gets referred to a job and sees the notification on Salt & Pepper', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await login(employerPage, employer, '/employer/dashboard')

  const jobTitle = `E2E Cross-App Referral Role ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise the cross-app referral bridge.')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  const jobId = await getJobIdByTitle(jobTitle)

  const referredCtx = await browser.newContext()
  const referredPage = await referredCtx.newPage()
  const referred = await signUpSaltNPepper(referredPage, cleanup, saltnpepperBase)
  await referredCtx.close()

  const referrerCtx = await browser.newContext()
  const referrerPage = await referrerCtx.newPage()
  const referrer = await signUpDeepEdge(referrerPage, 'candidate', cleanup)
  await login(referrerPage, referrer, '/dashboard')

  await referrerPage.goto(`/jobs/${jobId}`)
  await referrerPage.locator('input[name="referred_email"]').fill(referred.email)
  await referrerPage.locator('textarea[name="note"]').fill('You would crush this role.')
  await referrerPage.getByRole('button', { name: 'Send Referral' }).click()
  await referrerPage.waitForURL(/\?referred=1/)
  await expect(referrerPage.getByText("Thanks — we've let them know.")).toBeVisible()
  await referrerCtx.close()

  // Verified on Salt & Pepper, the app this account actually belongs
  // to -- not deepedge, which this person never signed up on.
  const verifyCtx = await browser.newContext()
  const verifyPage = await verifyCtx.newPage()
  await login(verifyPage, referred, `${saltnpepperBase}/dashboard`, saltnpepperBase)
  await verifyPage.goto(`${saltnpepperBase}/notifications`)
  await expect(verifyPage.getByText(`${referrer.firstName} ${referrer.lastName} referred you to a job`)).toBeVisible()
  await expect(verifyPage.getByText(jobTitle)).toBeVisible()

  // The notification's own link ('/jobs/{id}') only resolves on
  // deepedge, not saltnpepper (053_activity_feed.sql's session added
  // resolveNotificationHref() to fix exactly this: notifications is one
  // shared table, but every app's own /notifications page used to render
  // n.link as a same-origin path regardless of which pillar actually owns
  // it). Assert the rendered href is the real, external b2b URL -- not
  // just that the notification's text is visible, which was already
  // passing before the fix even though clicking through 404'd.
  const notificationRow = verifyPage.locator('a', { hasText: jobTitle })
  await expect(notificationRow).toHaveAttribute('href', `${greyinB2BBase}/jobs/${jobId}`)

  // Follow it end to end and confirm it's a real job page, not a 404.
  await notificationRow.click()
  await expect(verifyPage.getByRole('heading', { name: jobTitle })).toBeVisible()

  await verifyCtx.close()

  await employerCtx.close()
})
