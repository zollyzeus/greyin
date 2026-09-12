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

      // The same FK-cascade-ordering bug documented in the 2026-09-07
      // pitch-demo scrutiny pass (project_pitch_demo_scrutiny_fixes):
      // verified_outcomes/reputation_events/ai_quality_scores/
      // peer_project_ratings each carry an AFTER DELETE trigger (122)
      // that re-upserts greyin_score_inputs keyed on that row's own
      // subject -- cascading through auth.users can reach profiles
      // before reaching these tables in the same statement, and the
      // trigger's upsert then fails with a FK violation against the
      // now-gone profile, aborting GoTrue's whole delete (a 500, not a
      // 404 or a partial success). The catch below silently swallowed
      // exactly this failure for every test that awards reputation
      // (seedReputationPoints, and now redeem_referral_code, 138) --
      // confirmed live: 6 real orphaned test accounts (with real
      // referral_converted reputation_events) accumulated in prod this
      // way, invisible until directly queried. Deleting these 4 tables'
      // rows explicitly first, while the profile still exists for the
      // trigger's own upsert to find, avoids the ordering problem
      // entirely -- same fix as the seed file's own cleanup phase.
      // Column name holding the "subject" differs per table -- confirmed
      // directly against the live schema, not assumed (verified_outcomes/
      // ai_quality_scores use subject_user_id, not user_id; peer_project_ratings
      // has no single user_id at all, only rater_id/ratee_id).
      for (const [table, filter] of [
        // subject_user_id cascades on delete (verified_outcomes_subject_user_id_fkey,
        // ON DELETE CASCADE) so was never actually the blocker on its own --
        // verified_by has NO cascade action at all. A reviewer/verifier
        // account (e.g. a StackWorks builder who reviews a candidate's
        // submitted work) is deleted here even though they're never the
        // subject of the row, hitting verified_outcomes_verified_by_fkey
        // and aborting the whole GoTrue delete with the same class of
        // silent 500 this file's own comment above already root-caused
        // for the subject-side columns -- confirmed live via hub-dashboard.spec.ts's
        // own builder account failing to delete with exactly this FK name.
        ['verified_outcomes', `or=(subject_user_id.eq.${id},verified_by.eq.${id})`],
        ['reputation_events', `user_id=eq.${id}`],
        ['ai_quality_scores', `subject_user_id=eq.${id}`],
        ['peer_project_ratings', `or=(rater_id.eq.${id},ratee_id.eq.${id})`],
      ]) {
        await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
          method: 'DELETE',
          headers: headers(),
        }).catch(() => {})
      }

      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: headers(),
      }).catch((e) => {
        console.warn(`[Cleanup] failed to delete user ${email} (${id}):`, e)
        return null
      })
      if (res && !res.ok) {
        console.warn(`[Cleanup] failed to delete user ${email} (${id}): ${res.status} ${await res.text()}`)
      }
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
