import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, setCandidateSkills, createTestGig, createCompletedOrder } from '../../utils/admin'

/**
 * Skill endorsements are gated to a real, verified interaction
 * (064_ethos_verification_gates.sql) -- the competitive/ethos audit
 * found this was the one open, unverified social-proof signal on the
 * platform (any authenticated user, zero interaction, unlike
 * interaction-gated skill ratings or approval-gated recommendations).
 * Now requires the endorser+endorsee pair to appear in the
 * collaborators view (059) -- here established via a real completed
 * FlexPro order between them. Covers both the positive path and the
 * negative one (a stranger with no real interaction sees no Endorse
 * button and no way to force it through the API).
 */
test('endorsing a real skill requires a real collaboration; a stranger cannot endorse at all', async ({ browser, cleanup }) => {
  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')
  const candidateId = await getUserIdByEmail(candidate.email)
  await setCandidateSkills(candidateId, ['E2E Endorsement Skill'])
  await candidateCtx.close()

  const endorserCtx = await browser.newContext()
  const endorserPage = await endorserCtx.newPage()
  const endorser = await signUpDeepEdge(endorserPage, 'candidate', cleanup)
  await login(endorserPage, endorser, '/dashboard')
  const endorserId = await getUserIdByEmail(endorser.email)

  // A real completed FlexPro order is verified-interaction evidence
  // (collaborators view, 059) -- the candidate is the "seller", the
  // endorser is the "buyer" they actually transacted with.
  const gig = await createTestGig(candidateId)
  await createCompletedOrder({ gigId: gig.id, buyerId: endorserId, sellerId: candidateId, amount: 1500 })

  await endorserPage.goto(`/candidates/${candidateId}`)
  await expect(endorserPage.getByText('E2E Endorsement Skill')).toBeVisible()
  await expect(endorserPage.getByText('Endorsing requires a real collaboration', { exact: false })).not.toBeVisible()
  await endorserPage.getByRole('button', { name: 'Endorse' }).click()
  await expect(endorserPage.getByRole('button', { name: '1' })).toBeVisible()
  await endorserCtx.close()

  // A stranger with no real interaction sees the explanatory note
  // instead of an Endorse button.
  const strangerCtx = await browser.newContext()
  const strangerPage = await strangerCtx.newPage()
  const stranger = await signUpDeepEdge(strangerPage, 'candidate', cleanup)
  await login(strangerPage, stranger, '/dashboard')

  await strangerPage.goto(`/candidates/${candidateId}`)
  await expect(strangerPage.getByText('Endorsing requires a real collaboration', { exact: false })).toBeVisible()
  await expect(strangerPage.getByRole('button', { name: 'Endorse' })).not.toBeVisible()

  // Even bypassing the UI, RLS itself blocks it -- not just the button
  // being hidden. The route redirects either way, so the real check is
  // that the endorsement count stays at 1, not 2, afterward.
  await strangerPage.evaluate(
    async ({ endorseeId, skill }) => {
      await fetch(`/api/skills/${endorseeId}/endorse`, {
        method: 'POST',
        body: new URLSearchParams({ skill }),
      })
    },
    { endorseeId: candidateId, skill: 'E2E Endorsement Skill' }
  )
  // Ineligible viewers see the endorsement count as plain text (not the
  // interactive button, which is gated) -- still 1, not 2.
  await strangerPage.goto(`/candidates/${candidateId}`)
  await expect(strangerPage.getByText('1 endorsement', { exact: false })).toBeVisible()
  await expect(strangerPage.getByText('2 endorsement', { exact: false })).not.toBeVisible()

  await strangerCtx.close()
})
