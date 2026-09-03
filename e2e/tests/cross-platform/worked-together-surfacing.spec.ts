import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { getUserIdByEmail, createTestGig, createCompletedOrder } from '../../utils/admin'

/**
 * The `collaborators` view (059) was already real data -- a real
 * completed FlexPro order, or an accepted StackWorks collaboration --
 * but the only place it ever surfaced was as small, unlinked pill
 * widgets on stackworks/people and saltnpepper/members, and it was never
 * shown at all on deepedge/candidates or freeagent/sellers profile
 * pages, or anywhere cross-pillar. Considered (and rejected, see
 * conversation) building a LinkedIn-style mutual "connection request"
 * instead -- that would have been the one self-report/no-verification
 * social-graph feature on a platform that spent this whole session
 * closing exactly that class of gap (skill endorsements, Salt & Pepper
 * karma). This is the on-ethos version: surface the already-earned data
 * properly instead of adding an unverified new one.
 *
 * Covers: (a) Greyin Hub's dashboard shows a real collaborator across
 * pillars, linking out to their profile; (b) the FlexPro seller
 * profile shows an inline "worked together" note to the actual
 * collaborator; (c) a stranger with no real interaction sees neither.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const hubBase = isLocal ? `http://localhost:${process.env.E2E_HUB_PORT || 3105}` : 'https://greyin.net'
const flexproBase = isLocal ? `http://localhost:${process.env.E2E_FREEAGENT_PORT || 3102}` : 'https://flexpro.greyin.net'

test('a real FlexPro order makes both parties show up as "worked together" on Hub and on the seller profile, but a stranger sees neither', async ({ browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup, 15, flexproBase)
  const sellerId = await getUserIdByEmail(seller.email)
  const gig = await createTestGig(sellerId)
  await sellerCtx.close()

  const buyerCtx = await browser.newContext()
  const buyerPage = await buyerCtx.newPage()
  const buyer = await signUpFlexPro(buyerPage, 'client', cleanup, 15, flexproBase)
  const buyerId = await getUserIdByEmail(buyer.email)

  // A real completed order -- this is what makes collaborators (059)
  // recognize seller<->buyer as having actually worked together.
  await createCompletedOrder({ gigId: gig.id, buyerId, sellerId, amount: 1500 })

  await login(buyerPage, buyer, `${flexproBase}/dashboard`, flexproBase)

  // (a) Greyin Hub's dashboard, cross-pillar -- proves this isn't
  // duplicated per-app data, it's one real cross-pillar signal.
  await buyerPage.goto(`${hubBase}/dashboard`)
  const hubCollaboratorLink = buyerPage.getByRole('link', { name: new RegExp(seller.firstName) })
  await expect(hubCollaboratorLink).toBeVisible()
  await expect(hubCollaboratorLink).toHaveAttribute('href', new RegExp(`candidates/${sellerId}`))
  await expect(buyerPage.getByText('via FlexPro')).toBeVisible()

  // (b) The seller's own FlexPro profile shows the note to the buyer,
  // who genuinely worked with them.
  await buyerPage.goto(`${flexproBase}/sellers/${sellerId}`)
  await expect(buyerPage.getByText('You’ve worked together via FlexPro', { exact: false })).toBeVisible()
  await buyerCtx.close()

  // (c) A stranger with no real order sees no such note.
  const strangerCtx = await browser.newContext()
  const strangerPage = await strangerCtx.newPage()
  const stranger = await signUpFlexPro(strangerPage, 'client', cleanup, 15, flexproBase)
  await login(strangerPage, stranger, `${flexproBase}/dashboard`, flexproBase)

  await strangerPage.goto(`${flexproBase}/sellers/${sellerId}`)
  await expect(strangerPage.getByText('You’ve worked together', { exact: false })).not.toBeVisible()
  await strangerCtx.close()
})
