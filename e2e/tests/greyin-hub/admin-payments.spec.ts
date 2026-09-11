import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

async function createTestTip(authorId: string): Promise<{ id: string; description: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/author_tips`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      post_id: (await (await fetch(`${SUPABASE_URL}/rest/v1/posts?select=id&limit=1`, { headers: restHeaders() })).json())[0].id,
      author_id: authorId,
      amount: 123456, // distinctive amount so this test's row is unambiguous in a shared, non-empty ledger
      status: 'paid',
    }),
  })
  if (!res.ok) throw new Error(`Failed to create test tip: ${res.status} ${await res.text()}`)
  const [row] = await res.json()
  // Indian digit grouping (₹1,23,456), matching the page's toLocaleString('en-IN').
  return { id: row.id, description: '1,23,456' }
}

/**
 * New admin transaction ledger (Emergent-parity gap #1, 2026-09-08) --
 * get_recent_transactions() (143) UNIONs 5 real payment sources into
 * one admin-only view. Seeds a distinctively-amounted tip (rather than
 * asserting on the whole list, which is real prod data and non-empty)
 * to prove this specific row surfaces correctly.
 */
test('the Payments tab shows a real transaction with the right amount', async ({ page, cleanup }) => {
  const admin = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  const tip = await createTestTip(adminId)

  await login(page, admin, 'https://greyin.net/dashboard', 'https://greyin.net')
  await page.goto('/admin/payments')

  // The distinctive amount is the real proof this specific seeded row
  // surfaced -- other real "Tip" badges already exist in this shared,
  // non-empty ledger, so asserting on the badge text alone would be a
  // strict-mode-violating, redundant check.
  await expect(page.getByText(tip.description)).toBeVisible()

  await fetch(`${SUPABASE_URL}/rest/v1/author_tips?id=eq.${tip.id}`, { method: 'DELETE', headers: restHeaders() })
})

test('a non-admin is redirected away from the Payments tab', async ({ page, cleanup }) => {
  const member = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  await login(page, member, 'https://greyin.net/dashboard', 'https://greyin.net')

  await page.goto('/admin/payments')
  await expect(page).toHaveURL(/\/dashboard$/)
})
