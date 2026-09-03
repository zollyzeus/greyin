import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'

/**
 * Gap-audit item #7 (2026-08-31 code-level pass): Community Events &
 * Resources / RSVP, net-new (100). Covers the full real path: a host
 * publishes an event, a different member sees it and RSVPs, the host is
 * notified, and the going-count updates -- then the member cancels.
 */
test('a member can host an event, another member RSVPs and is counted, then cancels', async ({ browser, cleanup }) => {
  const hostCtx = await browser.newContext()
  const hostPage = await hostCtx.newPage()
  const host = await signUpSaltNPepper(hostPage, cleanup)
  await login(hostPage, host, '/dashboard')

  const title = `E2E Architecture Review ${Date.now()}`
  const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const startsAtLocal = startsAt.toISOString().slice(0, 16)

  await hostPage.goto('/events/new')
  await hostPage.locator('#title').fill(title)
  await hostPage.locator('#description').fill('A monthly review of real architecture decisions from the community.')
  await hostPage.locator('#starts_at').fill(startsAtLocal)
  await hostPage.getByRole('button', { name: 'Publish Event' }).click()
  await hostPage.waitForURL(/\/events\/[^/]+$/)
  const eventId = hostPage.url().split('/events/')[1]
  await expect(hostPage.getByText(title)).toBeVisible()
  await expect(hostPage.getByText('0 going')).toBeVisible()

  // Appears on the public browse listing too.
  await hostPage.goto('/events')
  await expect(hostPage.getByText(title)).toBeVisible()

  const attendeeCtx = await browser.newContext()
  const attendeePage = await attendeeCtx.newPage()
  const attendee = await signUpSaltNPepper(attendeePage, cleanup)
  await login(attendeePage, attendee, '/dashboard')

  await attendeePage.goto(`/events/${eventId}`)
  await attendeePage.getByRole('button', { name: "I'm going" }).click()
  await attendeePage.waitForURL(`/events/${eventId}`)
  await expect(attendeePage.getByText('1 going')).toBeVisible()
  await expect(attendeePage.getByRole('button', { name: /I'm going ✓/ })).toBeVisible()
  await expect(attendeePage.getByText(`${attendee.firstName} ${attendee.lastName}`)).toBeVisible()

  // Host is notified of the RSVP.
  await hostPage.goto('/notifications')
  await expect(hostPage.getByText(/New RSVP for your event/i)).toBeVisible()

  // Cancel -- count drops back to 0.
  await attendeePage.getByRole('button', { name: /I'm going ✓/ }).click()
  await attendeePage.waitForURL(`/events/${eventId}`)
  await expect(attendeePage.getByText('0 going')).toBeVisible()
  await expect(attendeePage.getByRole('button', { name: "I'm going" })).toBeVisible()

  await attendeeCtx.close()
  await hostCtx.close()
})
