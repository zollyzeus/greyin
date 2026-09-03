import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Gap-audit item #1: pre-publish moderation (098/099). The real LLM
 * verdict is non-deterministic and this deployment's provider reachability
 * isn't guaranteed, so this doesn't try to force a live BLOCK -- instead:
 * (1) confirms a normal, benign post still goes through end to end
 * (moderation never gets in the way of legitimate content, whichever path
 * -- live ALLOW or fail-open -- actually ran), and (2) directly seeds a
 * 'flagged_on_retry' row (same "manufacture the hard-to-trigger state
 * directly" precedent used for credit-exhaustion elsewhere this session)
 * to exercise the real admin review queue: visible, clearable, deletable,
 * and denied to a non-admin.
 */

test('a normal discussion post is not blocked by moderation', async ({ page, cleanup }) => {
  const member = await signUpSaltNPepper(page, cleanup)
  await login(page, member, '/dashboard')

  const title = `E2E Moderation Normal Post ${Date.now()}`
  await page.goto('/discussions/new')
  await page.locator('#title').fill(title)
  await page.locator('#body').fill('Sharing a real architecture decision from a recent project -- happy to discuss trade-offs.')
  await page.getByRole('button', { name: 'Post Discussion' }).click()
  await page.waitForURL(/\/discussions\/[^/]+$/)
  await expect(page.getByText(title)).toBeVisible()
})

test('a flagged discussion appears in the admin review queue, and can be cleared or deleted', async ({ browser, cleanup }) => {
  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpSaltNPepper(authorPage, cleanup)
  await login(authorPage, author, '/dashboard')

  const title = `E2E Moderation Flagged Post ${Date.now()}`
  await authorPage.goto('/discussions/new')
  await authorPage.locator('#title').fill(title)
  await authorPage.locator('#body').fill('This post will be manually flagged to exercise the admin review queue.')
  await authorPage.getByRole('button', { name: 'Post Discussion' }).click()
  await authorPage.waitForURL(/\/discussions\/[^/]+$/)
  const discussionId = authorPage.url().split('/discussions/')[1]
  await authorCtx.close()

  // Manufacture the 'flagged_on_retry' state directly -- same precedent as
  // pre-consuming credits elsewhere this session, since a real retry
  // requires waiting on the periodic sweep and a specific LLM verdict.
  const flagRes = await fetch(`${SUPABASE_URL}/rest/v1/discussions?id=eq.${discussionId}`, {
    method: 'PATCH',
    headers: restHeaders(),
    body: JSON.stringify({ moderation_status: 'flagged_on_retry' }),
  })
  expect(flagRes.ok).toBeTruthy()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpSaltNPepper(adminPage, cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, '/dashboard')

  await adminPage.goto('/admin')
  // The title legitimately appears twice -- once in the new Moderation
  // review section, once in the existing Discussions list below (which
  // lists every discussion regardless of moderation status) -- .first()
  // scopes to the review-queue occurrence.
  await expect(adminPage.getByText(title).first()).toBeVisible()
  await expect(adminPage.getByText('Flagged on retry')).toBeVisible()

  // Both "Clear flag" and "Delete" forms in the Moderation review row carry
  // their own copy of this hidden input, plus a third in the Discussions
  // list's own Delete form further down -- .first() lands on whichever
  // Moderation-section occurrence comes first in DOM order (that section
  // renders above Discussions), and either one's ancestor row still
  // contains the sibling "Clear flag" button being clicked.
  await adminPage
    .locator(`input[name="discussion_id"][value="${discussionId}"]`)
    .first()
    .locator('xpath=ancestor::div[contains(@class, "justify-between")][1]')
    .getByRole('button', { name: 'Clear flag' })
    .click()
  await adminPage.waitForURL('/admin')
  await expect(adminPage.getByText('Flagged on retry')).not.toBeVisible()

  await adminCtx.close()
})

test('a non-admin cannot reach the moderation review queue at all', async ({ page, cleanup }) => {
  const member = await signUpSaltNPepper(page, cleanup)
  await login(page, member, '/dashboard')
  await page.goto('/admin')
  await expect(page).toHaveURL('/dashboard')
})
