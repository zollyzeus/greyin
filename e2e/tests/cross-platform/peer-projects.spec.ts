import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, getGreyinScoreRow, grantActiveSubscriptionTier } from '../../utils/admin'

/**
 * Covers 089_peer_projects.sql / 090_peer_rating_anonymity_and_rater_
 * reliability.sql / 091_peer_project_reciprocity_flags.sql end to end
 * through the real UI: a project created and tagged via the hub
 * dashboard, confirmed by the tagged teammate, mutually rated by both
 * sides (deliberately, to produce a reciprocal-rating pattern), then
 * checked from three different viewpoints -- the rated member's own
 * dashboard, an employer's view of the candidate profile (sees the
 * rating pattern and the per-project reciprocity flag), and a
 * regular non-employer member's view of the same profile (sees the
 * peer-confirmed project itself, since that's public, but never the
 * rating pattern or the flag -- both employer/admin-only).
 */
const hubBase = 'https://greyin.net'
const b2bBase = 'https://deepedge.greyin.net'

test('a peer-confirmed project is tagged, confirmed, mutually rated, and the resulting reciprocal pattern is visible only to employers', async ({ browser, cleanup }) => {
  const aCtx = await browser.newContext()
  const aPage = await aCtx.newPage()
  const userA = await signUpSaltNPepper(aPage, cleanup, 'https://saltnpepper.greyin.net')

  const bCtx = await browser.newContext()
  const bPage = await bCtx.newPage()
  const userB = await signUpSaltNPepper(bPage, cleanup, 'https://saltnpepper.greyin.net')

  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup, 15, b2bBase)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')

  // --- A logs in via the hub, creates a project, tags B ---
  await login(aPage, userA, `${hubBase}/dashboard`, hubBase)
  await aPage.getByText('Add a project').click()
  await aPage.locator('#peer-project-title').fill('E2E Payments Migration')
  await aPage.locator('#peer-project-company').fill('E2E Test Co')
  await aPage.locator('#teammate-search').fill(userB.lastName)
  await expect(aPage.getByRole('button', { name: new RegExp(userB.lastName) })).toBeVisible()
  await aPage.getByRole('button', { name: new RegExp(userB.lastName) }).click()
  await aPage.getByRole('button', { name: 'Add project' }).click()
  await aPage.waitForURL(/peer_project_created=1/)

  // --- B logs in via the hub, confirms the tag ---
  await login(bPage, userB, `${hubBase}/dashboard`, hubBase)
  await expect(bPage.getByText('E2E Payments Migration')).toBeVisible()
  await bPage.getByRole('button', { name: 'Confirm' }).click()
  await bPage.waitForURL(`${hubBase}/dashboard`)

  const userAId = await getUserIdByEmail(userA.email)
  const userBId = await getUserIdByEmail(userB.email)

  // --- Mutual high ratings: B rates A, then A rates B ---
  // Scoped by the rating form's own ratee_id hidden input rather than
  // matching on displayed name text -- the dashboard's own "People
  // you've worked with" module (further down the same page) shows the
  // same collaborator names again, so a name-text locator can match
  // the wrong section entirely.
  await bPage.reload()
  const bRatingForm = bPage.locator('form[action="/api/peer-projects/ratings/create"]')
    .filter({ has: bPage.locator(`input[name="ratee_id"][value="${userAId}"]`) })
  await expect(bRatingForm).toBeVisible()
  await bRatingForm.locator('select[name="contribution_rating"]').selectOption('5')
  await bRatingForm.getByRole('button', { name: 'Rate' }).click()
  await bPage.waitForURL(/peer_rating_submitted=1/)

  await aPage.reload()
  const aRatingForm = aPage.locator('form[action="/api/peer-projects/ratings/create"]')
    .filter({ has: aPage.locator(`input[name="ratee_id"][value="${userBId}"]`) })
  await expect(aRatingForm).toBeVisible()
  await aRatingForm.locator('select[name="contribution_rating"]').selectOption('5')
  await aRatingForm.getByRole('button', { name: 'Rate' }).click()
  await aPage.waitForURL(/peer_rating_submitted=1/)

  // --- peer_score landed, separate from (and platform-verified score
  // still null for) this user -- direct DB-level confirmation the
  // separation actually holds end to end, not just at the SQL layer. ---
  const scoreRow = await getGreyinScoreRow(userAId)
  expect(scoreRow?.peer_score).not.toBeNull()
  expect(scoreRow?.greyin_score).toBeNull()

  // --- Employer view: sees the rating pattern AND the per-project
  // reciprocal flag ---
  await login(employerPage, employer, `${b2bBase}/employer/dashboard`, b2bBase)
  await employerPage.goto(`${b2bBase}/candidates/${userAId}`)
  await expect(employerPage.getByText('Employer view: rating pattern as a peer rater')).toBeVisible()
  await expect(employerPage.getByText(/mutual pair where both sides rated each other/)).toBeVisible()
  await expect(employerPage.getByText('E2E Payments Migration')).toBeVisible()
  await expect(employerPage.getByText('⚠ Possible reciprocal rating')).toBeVisible()

  // --- Non-employer view: the peer-confirmed project itself is public
  // (same page, same profile, B's own saltnpepper session carries over
  // via the shared .greyin.net cookie) -- but never the rating pattern
  // or the flag, both employer/admin-only. ---
  await bPage.goto(`${b2bBase}/candidates/${userAId}`)
  await expect(bPage.getByText('E2E Payments Migration')).toBeVisible()
  await expect(bPage.getByText('Employer view: rating pattern as a peer rater')).toHaveCount(0)
  await expect(bPage.getByText('⚠ Possible reciprocal rating')).toHaveCount(0)
})
