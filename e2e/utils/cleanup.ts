import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function headers() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Every e2e test runs against the live production database (there is no
 * throwaway/staging copy), so each test's data must be gone by the time it
 * exits — pass or fail — or repeated runs leave the shared DB permanently
 * accumulating test accounts, jobs, discussions, orders, etc. This is the
 * single place that guarantees that.
 *
 * Deleting a tracked user's auth.users row cascades through almost
 * everything owned by them (profiles.id -> auth.users is ON DELETE CASCADE,
 * and every dependent table — companies, candidates, jobs, gigs,
 * discussions, orders, messages, reputation_events, ...— cascades from
 * profiles in turn), so tracking every test account a test creates is
 * usually sufficient on its own. The one confirmed exception is
 * posts.author_id, which is ON DELETE SET NULL, not CASCADE — GreyMatters
 * posts (mostly seeded directly via the service role rather than through
 * the UI) need explicit trackEntity('posts', id) instead.
 */
export class Cleanup {
  private userEmails: string[] = []
  private entities: { table: string; column: string; value: string }[] = []

  /** Register a test account (by the email makeTestUser generated) for deletion at teardown. */
  trackUser(email: string) {
    this.userEmails.push(email)
  }

  /** Register a row that isn't reachable via a tracked user's cascade (e.g. service-role-seeded posts). */
  trackEntity(table: string, id: string) {
    this.entities.push({ table, column: 'id', value: id })
  }

  /** Same as trackEntity, but for rows with no user account to cascade from and no id known up front (e.g. a newsletter signup, looked up by the email that was entered). */
  trackByColumn(table: string, column: string, value: string) {
    this.entities.push({ table, column, value })
  }

  /** Runs automatically via the `cleanup` fixture — not meant to be called directly from a test. */
  async run(): Promise<void> {
    // Explicit entities first, in reverse registration order (roughly
    // child-before-parent for tests that track more than one), then user
    // accounts, whose cascades sweep up everything else.
    for (const { table, column, value } of [...this.entities].reverse()) {
      await fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${encodeURIComponent(value)}`, {
        method: 'DELETE',
        headers: headers(),
      }).catch(() => {})
    }

    for (const email of this.userEmails) {
      const id = await findUserIdByEmail(email)
      if (!id) continue
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: headers(),
      }).catch(() => {})
    }
  }
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: headers(),
  }).catch(() => null)
  if (!res || !res.ok) return null
  const body = await res.json()
  const users = body.users ?? body
  const match = Array.isArray(users) ? users.find((u: any) => u.email === email) : null
  return match?.id ?? null
}
