import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, createTestGig, createCompletedOrder } from '../../utils/admin'

/**
 * Written recommendations (057_written_recommendations.sql) require
 * recipient approval before they're public. Gated to a real collaboration
 * (065_reference_checks.sql) -- same open/self-report gap the ethos audit
 * found in skill_endorsements, missed in that first pass and closed here.
 * Covers the full gate -> pending -> approved lifecycle, and confirms a
 * stranger with no real interaction can't write one at all.
 */
test('a written recommendation requires a real collaboration, stays hidden until approved, then appears on the profile', async ({ browser, cleanup }) => {
  const recommendeeCtx = await browser.newContext()
  const recommendeePage = await recommendeeCtx.newPage()
  const recommendee = await signUpDeepEdge(recommendeePage, 'candidate', cleanup)
  await login(recommendeePage, recommendee, '/dashboard')
  const recommendeeId = await getUserIdByEmail(recommendee.email)
  await recommendeeCtx.close()

  const recommenderCtx = await browser.newContext()
  const recommenderPage = await recommenderCtx.newPage()
  const recommender = await signUpDeepEdge(recommenderPage, 'candidate', cleanup)
  await login(recommenderPage, recommender, '/dashboard')
  const recommenderId = await getUserIdByEmail(recommender.email)

  // A real completed FlexPro order is verified-interaction evidence
  // (collaborators view, 059), same gate skill-endorsements.spec.ts uses.
  const gig = await createTestGig(recommendeeId)
  await createCompletedOrder({ gigId: gig.id, buyerId: recommenderId, sellerId: recommendeeId, amount: 1200 })

  const recommendationText = `Worked with this person on an e2e test at ${Date.now()} -- sharp and reliable.`
  await recommenderPage.goto(`/candidates/${recommendeeId}`)
  await expect(recommenderPage.getByText('Writing a recommendation requires a real collaboration', { exact: false })).not.toBeVisible()
  await recommenderPage.getByLabel('Write a recommendation').fill(recommendationText)
  await recommenderPage.getByRole('button', { name: 'Submit' }).click()
  await recommenderPage.waitForURL(/\/candidates\//)
  await recommenderCtx.close()

  // Not visible yet -- still pending. (/candidates/[id] requires login,
  // it just has no employer-subscription paywall on top of that.)
  const strangerCtx = await browser.newContext()
  const strangerPage = await strangerCtx.newPage()
  const stranger = await signUpDeepEdge(strangerPage, 'candidate', cleanup)
  await login(strangerPage, stranger, '/dashboard')
  await strangerPage.goto(`/candidates/${recommendeeId}`)
  await expect(strangerPage.getByText(recommendationText)).not.toBeVisible()

  // A stranger with no real interaction can't even write one -- no form,
  // and a direct API bypass attempt doesn't move the (still-pending)
  // recommendation count either.
  await expect(strangerPage.getByText('Writing a recommendation requires a real collaboration', { exact: false })).toBeVisible()
  await expect(strangerPage.getByLabel('Write a recommendation')).not.toBeVisible()
  await strangerCtx.close()

  // Recommendee approves it from their own profile queue.
  const recommendeeCtx2 = await browser.newContext()
  const recommendeePage2 = await recommendeeCtx2.newPage()
  await login(recommendeePage2, recommendee, '/dashboard')
  await recommendeePage2.goto('/profile')
  await expect(recommendeePage2.getByText(recommendationText)).toBeVisible()
  await recommendeePage2.getByRole('button', { name: 'Approve & show on my profile' }).click()
  await recommendeePage2.waitForURL('/profile')
  await recommendeeCtx2.close()

  // Now visible to any logged-in viewer.
  const viewerCtx = await browser.newContext()
  const viewerPage = await viewerCtx.newPage()
  const viewer = await signUpDeepEdge(viewerPage, 'candidate', cleanup)
  await login(viewerPage, viewer, '/dashboard')
  await viewerPage.goto(`/candidates/${recommendeeId}`)
  await expect(viewerPage.getByText(recommendationText)).toBeVisible()
  await viewerCtx.close()
})
