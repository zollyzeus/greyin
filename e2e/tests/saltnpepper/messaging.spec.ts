import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'

test('a member can message another member from the directory and get a reply', async ({ browser, cleanup }) => {
  const senderCtx = await browser.newContext()
  const senderPage = await senderCtx.newPage()
  const sender = await signUpSaltNPepper(senderPage, cleanup)
  await login(senderPage, sender, '/dashboard')

  const recipientCtx = await browser.newContext()
  const recipientPage = await recipientCtx.newPage()
  const recipient = await signUpSaltNPepper(recipientPage, cleanup)
  await login(recipientPage, recipient, '/dashboard')

  await senderPage.goto('/members')
  await senderPage
    .getByText(`${recipient.firstName} ${recipient.lastName}`)
    .first()
    .locator('xpath=ancestor::div[contains(@class,"shadow-md")][1]')
    .getByRole('button', { name: 'Message' })
    .click()
  await senderPage.waitForURL(/\/messages\/[^/]+$/)
  // conversations has no FK back to profiles, so deleting both participants
  // would otherwise leave an empty, orphaned conversation row behind.
  cleanup.trackEntity('conversations', senderPage.url().split('/messages/')[1])

  const messageText = `E2E message ${Date.now()}`
  await senderPage.getByPlaceholder('Type a message...').fill(messageText)
  await senderPage.getByRole('button', { name: 'Send' }).click()
  await expect(senderPage.getByText(messageText)).toBeVisible()
  const conversationUrl = senderPage.url()
  await senderCtx.close()

  // The recipient should be notified and able to see + reply to the message.
  await recipientPage.goto('/dashboard')
  await expect(recipientPage.getByLabel('Notifications')).toContainText('1')

  await recipientPage.goto('/messages')
  // Scoped to <main> -- the persistent rail (UI/UX elevation rollout,
  // 2026-09-05) always shows the logged-in user's own name in its footer
  // identity block, and every e2e test user's name starts with the same
  // "E2E" fixture prefix, so an unscoped getByText(sender.firstName)
  // matches the *recipient's own* rail identity too, not just the
  // conversation-list entry for the sender. Same container-scoping fix
  // already used for StackWorks's rail/content label collision.
  await expect(recipientPage.locator('main').getByText(sender.firstName, { exact: false })).toBeVisible()
  await recipientPage.goto(conversationUrl)
  await expect(recipientPage.getByText(messageText)).toBeVisible()

  const replyText = `E2E reply ${Date.now()}`
  await recipientPage.getByPlaceholder('Type a message...').fill(replyText)
  await recipientPage.getByRole('button', { name: 'Send' }).click()
  await expect(recipientPage.getByText(replyText)).toBeVisible()

  await recipientCtx.close()
})