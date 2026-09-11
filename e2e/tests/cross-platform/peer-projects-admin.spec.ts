import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

/**
 * The moderation surface flagged as missing in the original feature
 * assessment: RLS admin-DELETE policies on peer_projects/peer_project_
 * ratings existed from the start (089/090), but nothing let an admin
 * actually browse for what needs deleting without raw SQL. Covers the
 * new /admin/peer-projects page (greyin-hub) end to end -- a non-admin
 * is blocked, an admin sees a flagged project with the same reciprocal-
 * rating badge an employer would see, and deleting it actually removes
 * it (cascading to its members/ratings, verified by re-visiting rather
 * than a DB check, since this is what a real moderator would observe).
 */
const hubBase = 'https://greyin.net'

test('a non-admin cannot reach peer-projects admin', async ({ page, cleanup }) => {
  const user = await signUpSaltNPepper(page, cleanup, 'https://saltnpepper.greyin.net')
  await login(page, user, `${hubBase}/dashboard`, hubBase)
  await page.goto(`${hubBase}/admin/peer-projects`)
  await expect(page).toHaveURL(`${hubBase}/dashboard`)
})

test('an admin sees a flagged reciprocal-rating project and can delete it', async ({ browser, cleanup }) => {
  const aCtx = await browser.newContext()
  const aPage = await aCtx.newPage()
  const userA = await signUpSaltNPepper(aPage, cleanup, 'https://saltnpepper.greyin.net')

  const bCtx = await browser.newContext()
  const bPage = await bCtx.newPage()
  const userB = await signUpSaltNPepper(bPage, cleanup, 'https://saltnpepper.greyin.net')

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpSaltNPepper(adminPage, cleanup, 'https://saltnpepper.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)

  const projectTitle = `E2E Admin Moderation Project ${Date.now()}`

  // --- A creates a project, tags B ---
  await login(aPage, userA, `${hubBase}/dashboard`, hubBase)
  await aPage.getByText('Add a project').click()
  await aPage.locator('#peer-project-title').fill(projectTitle)
  await aPage.locator('#peer-project-company').fill('E2E Test Co')
  await aPage.locator('#teammate-search').fill(userB.lastName)
  await expect(aPage.getByRole('button', { name: new RegExp(userB.lastName) })).toBeVisible()
  await aPage.getByRole('button', { name: new RegExp(userB.lastName) }).click()
  await aPage.getByRole('button', { name: 'Add project' }).click()
  await aPage.waitForURL(/peer_project_created=1/)

  // --- B confirms ---
  await login(bPage, userB, `${hubBase}/dashboard`, hubBase)
  await bPage.getByRole('button', { name: 'Confirm' }).click()
  await bPage.waitForURL(`${hubBase}/dashboard`)

  const userAId = await getUserIdByEmail(userA.email)
  const userBId = await getUserIdByEmail(userB.email)

  // --- Mutual high ratings -- what actually produces the flag ---
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

  // --- Admin sees it, flagged, and deletes it ---
  await login(adminPage, admin, `${hubBase}/dashboard`, hubBase)
  await adminPage.goto(`${hubBase}/admin/peer-projects`)
  await expect(adminPage.getByText(projectTitle)).toBeVisible()

  // Scope the flag assertion to this test's own project row -- a leftover
  // flagged project from an earlier interrupted run makes an unscoped
  // getByText a strict-mode violation.
  const projectRow = adminPage.locator('div.bg-white.rounded-lg.shadow-sm.border').filter({ hasText: projectTitle })
  await expect(projectRow).toHaveCount(1)
  await expect(projectRow.getByText('⚠ Possible reciprocal rating')).toBeVisible()
  adminPage.once('dialog', (d) => d.accept())
  await projectRow.getByRole('button', { name: 'Delete' }).click()
  await adminPage.waitForURL(`${hubBase}/admin/peer-projects`)
  await expect(adminPage.getByText(projectTitle)).not.toBeVisible()
})
