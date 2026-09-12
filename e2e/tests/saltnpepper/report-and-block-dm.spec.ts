import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
}

/**
 * Direct messages (shared conversations/direct_messages schema, 152) --
 * same report + block feature as DeepEdge's own report-content.spec.ts,
 * exercised here on Salt & Pepper since it shares the identical schema
 * and RLS. A real bug was caught building this: the block-check
 * subquery originally ran under the SENDER's own RLS view of
 * blocked_users (which only lets a blocker see rows THEY created), so it
 * silently never blocked anything -- fixed via a SECURITY DEFINER
 * helper (sender_is_blocked_in_conversation).
 */
test('a message recipient can report and block the sender, and the sender can no longer message them', async ({ browser, cleanup }) => {
  const senderCtx = await browser.newContext()
  const senderPage = await senderCtx.newPage()
  const sender = await signUpSaltNPepper(senderPage, cleanup)
  const senderId = await getUserIdByEmail(sender.email)
  await login(senderPage, sender, '/dashboard')

  const recipientCtx = await browser.newContext()
  const recipientPage = await recipientCtx.newPage()
  const recipient = await signUpSaltNPepper(recipientPage, cleanup)
  const recipientId = await getUserIdByEmail(recipient.email)
  await login(recipientPage, recipient, '/dashboard')

  const convRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
    method: 'POST',
    headers: { ...restHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({}),
  })
  const [conversation] = await convRes.json()
  await fetch(`${SUPABASE_URL}/rest/v1/conversation_participants`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify([
      { conversation_id: conversation.id, user_id: senderId },
      { conversation_id: conversation.id, user_id: recipientId },
    ]),
  })
  await fetch(`${SUPABASE_URL}/rest/v1/direct_messages`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ conversation_id: conversation.id, sender_id: senderId, body: 'Unwanted message.' }),
  })

  await recipientPage.goto(`/messages/${conversation.id}`)
  await expect(recipientPage.getByText('Unwanted message.')).toBeVisible()

  await recipientPage.getByText('Report', { exact: true }).click()
  await recipientPage.locator('textarea[name="reason"]').fill('Harassment.')
  await recipientPage.getByRole('button', { name: 'Submit report' }).click()
  await recipientPage.waitForURL(/\?reported=1/)

  await recipientPage.goto(`/messages/${conversation.id}`)
  recipientPage.once('dialog', (d) => d.accept())
  await recipientPage.getByRole('button', { name: 'Block' }).click()
  await recipientPage.waitForURL(/\/messages\?blocked=1/)

  const blockRes = await fetch(`${SUPABASE_URL}/rest/v1/blocked_users?blocker_id=eq.${recipientId}&blocked_id=eq.${senderId}`, {
    headers: restHeaders(),
  })
  expect((await blockRes.json()).length).toBe(1)

  await senderPage.goto(`/messages/${conversation.id}`)
  await senderPage.locator('input[placeholder="Type a message..."]').fill('Trying again after being blocked.')
  await senderPage.getByRole('button', { name: 'Send' }).click()
  await senderPage.waitForTimeout(1000)
  await expect(senderPage.getByText('Trying again after being blocked.')).not.toBeVisible()

  await senderCtx.close()
  await recipientCtx.close()
})
