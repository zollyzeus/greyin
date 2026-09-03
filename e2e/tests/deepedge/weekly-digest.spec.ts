import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, createTestGig, createCompletedOrder } from '../../utils/admin'

/**
 * In-app weekly digest (competitive audit, Aug 2026) -- the retention
 * lever without a real email send, given the shared SMTP provider's
 * known rate-limit issue. notifications is one shared table written to
 * by every pillar (017/051), so a single written-recommendation
 * notification (057) is enough to prove the digest surfaces recent
 * activity, not just an DeepEdge-only count.
 */
test('a notification from the last 7 days shows up in the dashboard\'s weekly digest', async ({ browser, cleanup }) => {
  const recommendeeCtx = await browser.newContext()
  const recommendeePage = await recommendeeCtx.newPage()
  const recommendee = await signUpDeepEdge(recommendeePage, 'candidate', cleanup)
  await login(recommendeePage, recommendee, '/dashboard')
  const recommendeeId = await getUserIdByEmail(recommendee.email)
  await expect(recommendeePage.getByText('Nothing new this week yet.')).toBeVisible()
  await recommendeeCtx.close()

  const recommenderCtx = await browser.newContext()
  const recommenderPage = await recommenderCtx.newPage()
  const recommender = await signUpDeepEdge(recommenderPage, 'candidate', cleanup)
  await login(recommenderPage, recommender, '/dashboard')
  const recommenderId = await getUserIdByEmail(recommender.email)

  // Written recommendations are gated to a real collaboration (065) --
  // a real completed FlexPro order is verified-interaction evidence
  // (collaborators view, 059), same seed skill-endorsements.spec.ts and
  // written-recommendations.spec.ts use.
  const gig = await createTestGig(recommendeeId)
  await createCompletedOrder({ gigId: gig.id, buyerId: recommenderId, sellerId: recommendeeId, amount: 1000 })

  await recommenderPage.goto(`/candidates/${recommendeeId}`)
  await recommenderPage.getByLabel('Write a recommendation').fill(`E2E digest test recommendation ${Date.now()}`)
  await recommenderPage.getByRole('button', { name: 'Submit' }).click()
  await recommenderPage.waitForURL(/\/candidates\//)
  await recommenderCtx.close()

  const recommendeeCtx2 = await browser.newContext()
  const recommendeePage2 = await recommendeeCtx2.newPage()
  await login(recommendeePage2, recommendee, '/dashboard')
  await expect(recommendeePage2.getByText('1 update in the last 7 days')).toBeVisible()
  await expect(recommendeePage2.getByText('1× recommendation pending')).toBeVisible()
  await recommendeeCtx2.close()
})
