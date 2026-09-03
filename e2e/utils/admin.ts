import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// This GoTrue version silently ignores the documented `?email=` filter (it
// just returns page 1 unfiltered) and hard-caps `per_page` at 20 regardless
// of what's requested — confirmed by probing the live endpoint directly.
// Listing is newest-first, so a just-created user normally lands on page 1,
// but under parallel test-run load other workers' concurrent signups can
// push it onto a later page before this lookup fires. Page through instead
// of trusting page 1.
async function findUserIdByEmail(email: string): Promise<string | null> {
  // Was 25 sequential per_page=20 page fetches (up to 500 users deep) --
  // confirmed via direct API testing (2026-08-24) that GoTrue's admin
  // users endpoint happily returns everyone in one request (per_page=1000
  // returned all 200 then-current users, matching x-total-count exactly,
  // no truncation). The 10-failure/3-flaky cluster in the Aug 24 full run
  // was traced to this: each confirmTestUserEmail retry re-issued up to
  // 25 sequential admin-API requests, and with workers=4 running dozens
  // of concurrent signups each doing the same, that's self-inflicted
  // congestion on the admin endpoint, not real replication lag -- a
  // single large-page request cuts per-attempt cost ~25x and removes
  // that congestion instead of just raising the depth ceiling again
  // (which is what the previous fix, sized after the Aug 23 run, did).
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=2000`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  })
  if (!res.ok) return null
  const body = await res.json()
  const users: any[] = body.users ?? body
  if (!Array.isArray(users)) return null
  return users.find((u) => u.email === email)?.id ?? null
}

/**
 * Production has ENABLE_EMAIL_AUTOCONFIRM=false, so a freshly signed-up test
 * account can't log in until its email is confirmed. Rather than weaken that
 * setting for real users, confirm just the throwaway test account directly
 * via the Supabase Admin API (service_role key never reaches the browser).
 */
export async function confirmTestUserEmail(email: string, expectedRole?: string): Promise<void> {
  // Under heavy parallel signup load against prod, the admin API's read of
  // auth.users can lag a moment behind the signup POST that just completed
  // (same class of eventual-consistency gap as the profiles-role poll below).
  // Retry the lookup instead of failing on the first miss.
  let userId: string | null = null
  for (let attempt = 0; attempt < 15; attempt++) {
    userId = await findUserIdByEmail(email)
    if (userId) break
    await new Promise((r) => setTimeout(r, 300))
  }
  if (!userId) {
    throw new Error(`Could not find newly-created test user for ${email} to confirm`)
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email_confirm: true }),
  })

  if (!res.ok) {
    throw new Error(`Failed to confirm test user email ${email}: ${res.status} ${await res.text()}`)
  }

  if (!expectedRole) return

  // The confirm PUT returning 200 means auth.users committed, but the DB
  // trigger's profiles upsert (which sets the *real* role — auth.users
  // itself starts with a 'candidate' placeholder row from signup) can
  // occasionally still be settling by the time the very next request
  // (login, fired milliseconds later by an automated test — nothing a
  // real human reading their confirmation email first would ever hit)
  // reads it. Poll for the specific expected role instead of trusting a
  // single read.
  for (let attempt = 0; attempt < 15; attempt++) {
    const check = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`, {
      headers: restHeaders(),
    })
    if (check.ok) {
      const rows = await check.json()
      if (rows[0]?.role === expectedRole) return
    }
    await new Promise((r) => setTimeout(r, 200))
  }
}

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

/**
 * GreyMatters posts are authored via Supabase Studio / the CMS side, not an
 * in-app "new post" page. Comments/categories/search tests need a real
 * published post to work against, so this seeds one directly (bypassing RLS
 * via the service_role key) rather than depending on manually-curated content.
 */
export async function createTestPost(overrides: Record<string, unknown> = {}): Promise<{ id: string; slug: string }> {
  const slug = `e2e-test-post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      title: 'E2E Test Post',
      slug,
      excerpt: 'Seeded by the Playwright e2e suite.',
      content: 'This post exists only to give e2e tests something to comment on and search for.',
      status: 'published',
      published_at: new Date().toISOString(),
      ...overrides,
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to create test post: ${res.status} ${await res.text()}`)
  }
  const [post] = await res.json()
  return { id: post.id, slug: post.slug }
}

export async function deleteTestPost(id: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${id}`, {
    method: 'DELETE',
    headers: restHeaders(),
  })
}

export async function getFirstCategory(): Promise<{ id: string; slug: string; name: string } | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?select=id,slug,name&limit=1`, {
    headers: restHeaders(),
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0] ?? null
}

/**
 * Fast-forwards an order straight to 'paid' without re-running a full
 * Razorpay checkout, so specs that only care about the post-payment
 * lifecycle (status updates, chat, reviews) don't have to repeat the
 * payment flow that checkout-payment.spec.ts already covers end to end.
 */
export async function createPaidOrder(opts: {
  gigId: string
  buyerId: string
  sellerId: string
  amount: number
}): Promise<{ id: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/gig_orders`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      gig_id: opts.gigId,
      buyer_id: opts.buyerId,
      seller_id: opts.sellerId,
      amount: opts.amount,
      status: 'paid',
      // payment_status must actually be 'captured', not just status='paid' --
      // the real app (api/orders/verify/route.ts) always sets both together,
      // and gig_orders_enforce_transition (068_fix_gig_order_payment_
      // transition.sql) now requires payment_status='captured' before any
      // further status progression, closing a real gap where "paid" and
      // "genuinely captured" could previously drift apart (SEC-005/006,
      // 2026-08-24 security audit).
      payment_status: 'captured',
      razorpay_order_id: `order_e2e_seed_${Date.now()}`,
      // Deliberately NOT setting razorpay_payment_id -- apps/flexpro/
      // src/app/api/orders/cancel/route.ts (and resolve-
      // dispute) branch on it: non-null triggers a REAL Razorpay refund
      // API call, which would reject a synthetic id outright. A real
      // Razorpay payment id can only come from an actual transaction
      // (checkout-payment.spec.ts exercises that path with a real test
      // card); leaving this null keeps every OTHER test using this seed
      // helper on the same "nothing to refund, just cancel" path they
      // already relied on before payment_status started being enforced.
      paid_at: new Date().toISOString(),
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to create paid test order: ${res.status} ${await res.text()}`)
  }
  const [order] = await res.json()
  return { id: order.id }
}

/**
 * Same idea as createPaidOrder, but lands straight on 'completed' — used by
 * the earnings/payout spec, which cares about the balance calculation, not
 * the order lifecycle that gets its own coverage in order-lifecycle.spec.ts.
 */
export async function createCompletedOrder(opts: {
  gigId: string
  buyerId: string
  sellerId: string
  amount: number
}): Promise<{ id: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/gig_orders`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      gig_id: opts.gigId,
      buyer_id: opts.buyerId,
      seller_id: opts.sellerId,
      amount: opts.amount,
      status: 'completed',
      paid_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to create completed test order: ${res.status} ${await res.text()}`)
  }
  const [order] = await res.json()
  return { id: order.id }
}

/**
 * Seeds a 'pending' order with a known razorpay_order_id, for tests that
 * drive /api/webhooks/razorpay directly rather than through checkout.js —
 * the webhook handler looks orders up by this column, and doesn't call back
 * out to Razorpay to confirm the order is real, so a synthetic id is fine.
 */
export async function createPendingOrderWithRazorpayId(opts: {
  gigId: string
  buyerId: string
  sellerId: string
  amount: number
  razorpayOrderId: string
}): Promise<{ id: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/gig_orders`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      gig_id: opts.gigId,
      buyer_id: opts.buyerId,
      seller_id: opts.sellerId,
      amount: opts.amount,
      status: 'pending',
      razorpay_order_id: opts.razorpayOrderId,
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to create pending test order: ${res.status} ${await res.text()}`)
  }
  const [order] = await res.json()
  return { id: order.id }
}

export async function getGigOrderStatus(orderId: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/gig_orders?id=eq.${orderId}&select=status`, {
    headers: restHeaders(),
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0]?.status ?? null
}

export async function getGigOrderRow(orderId: string): Promise<Record<string, any> | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/gig_orders?id=eq.${orderId}&select=status,payment_status,gig_id,client_job_application_id,amount,service_fee_buyer,service_fee_seller`,
    { headers: restHeaders() }
  )
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0] ?? null
}

/**
 * Elevates a test user to role='admin' directly via the service_role key —
 * signup forms have no way to produce an admin account (by design), so
 * admin-panel specs need this instead of going through the UI.
 */
export async function promoteToAdmin(userId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: restHeaders(),
    body: JSON.stringify({ role: 'admin' }),
  })
  if (!res.ok) {
    throw new Error(`Failed to promote ${userId} to admin: ${res.status} ${await res.text()}`)
  }
}

/**
 * The password-reset spec drives the real OTP-entry UI end to end, same as
 * signup — but unlike signup (where confirmTestUserEmail just marks the
 * email confirmed without needing the real code), verifyOtp for a password
 * reset needs the actual 6-digit token. GoTrue's admin generate_link
 * endpoint returns it without having to read a real inbox.
 */
export async function getRecoveryOtp(email: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ type: 'recovery', email }),
  })
  if (!res.ok) {
    throw new Error(`Failed to generate recovery link for ${email}: ${res.status} ${await res.text()}`)
  }
  const body = await res.json()
  const otp = body.email_otp || body.otp
  if (!otp) {
    throw new Error(`generate_link response had no email_otp field: ${JSON.stringify(body)}`)
  }
  return otp
}

/**
 * Grants an active Starter subscription directly via the service_role key,
 * bypassing the Razorpay checkout UI entirely -- specs that need a
 * subscribed employer to exercise /candidates shouldn't have to drive a
 * real payment widget just to get there (subscription-gate.spec.ts is the
 * one spec that actually walks the enterprise lead-capture -> admin
 * activation journey end to end).
 */
export async function grantActiveSubscription(userId: string): Promise<void> {
  // 096: grant the unlimited 'premium' hiring tier -- /candidates/[id]
  // now meters profile_view credits via consume_credit, and specs that
  // walk into a candidate's full profile more than once per grant
  // shouldn't run into a credit ceiling this helper never intended to
  // impose. Tests that specifically exercise the credit *limit* itself
  // use grantActiveSubscriptionTier with a capped tier instead.
  return grantActiveSubscriptionTier(userId, 'premium')
}

/**
 * Same as grantActiveSubscription, but for a specific tier_key (096,
 * product='deepedge_hiring') -- lets a spec exercise a capped tier's
 * real seeded credit allowance (e.g. 'basic', 50 profile_view
 * credits/mo) without mutating the shared subscription_tiers rows
 * every other spec also reads.
 */
export async function grantActiveSubscriptionTier(userId: string, tierKey: 'basic' | 'pro' | 'premium'): Promise<void> {
  const companyRes = await fetch(`${SUPABASE_URL}/rest/v1/companies?user_id=eq.${userId}&select=id`, {
    headers: restHeaders(),
  })
  const companies = await companyRes.json()
  const companyId = companies[0]?.id
  if (!companyId) {
    throw new Error(`Could not find a company for user ${userId} to grant a subscription to`)
  }

  const planRes = await fetch(`${SUPABASE_URL}/rest/v1/subscription_plans?tier=eq.starter&select=id`, {
    headers: restHeaders(),
  })
  const plans = await planRes.json()
  const planId = plans[0]?.id
  if (!planId) {
    throw new Error('Could not find the starter subscription plan')
  }

  const tierRes = await fetch(
    `${SUPABASE_URL}/rest/v1/subscription_tiers?product=eq.deepedge_hiring&tier_key=eq.${tierKey}&select=id`,
    { headers: restHeaders() }
  )
  const tiers = await tierRes.json()
  const tierId = tiers[0]?.id
  if (!tierId) {
    throw new Error(`Could not find the deepedge_hiring ${tierKey} tier`)
  }

  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/company_subscriptions?on_conflict=company_id`, {
    method: 'POST',
    headers: { ...restHeaders(), Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      company_id: companyId,
      plan_id: planId,
      tier_id: tierId,
      status: 'active',
      current_period_end: periodEnd.toISOString(),
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to grant subscription to company ${companyId}: ${res.status} ${await res.text()}`)
  }
}

/**
 * FlexPro's equivalent of grantActiveSubscription above -- same
 * "grant directly, don't drive the real Razorpay Subscriptions
 * checkout UI in e2e" precedent (that flow has no test-mode mock the
 * way one-time Orders does via mockRazorpayCheckout; subscription
 * verification's own HMAC formula is different anyway --
 * `payment_id|subscription_id`, not `order_id|payment_id`). User-scoped
 * rather than company-scoped, since FlexPro has no company concept.
 * The function name and the DB literals it queries (`flexpro_pro`,
 * `flexpro_posting`, `flexpro_subscriptions`) were kept on the
 * pre-rename identifiers through Tier 2, deliberately -- migration 103
 * (Tier 3) has since renamed the live DB values these query, so this
 * is updated in the same pass, not split across two inconsistent
 * states.
 */
export async function grantFreeagentSubscription(userId: string): Promise<void> {
  // 096: grant the unlimited 'premium' tier -- most of this spec suite
  // posts more than once per granted subscription. Tests that
  // specifically exercise the credit *limit* itself use
  // grantFreeagentSubscriptionTier with a capped tier instead.
  return grantFreeagentSubscriptionTier(userId, 'premium')
}

/**
 * Same as grantFreeagentSubscription, but for a specific tier_key
 * (096, product='flexpro_posting') -- lets a spec exercise a capped
 * tier's real seeded credit allowance (e.g. 'basic', 5 gig_post
 * credits/mo) without mutating the shared subscription_tiers rows
 * every other spec also reads.
 */
export async function grantFreeagentSubscriptionTier(userId: string, tierKey: 'basic' | 'pro' | 'premium'): Promise<void> {
  const planRes = await fetch(`${SUPABASE_URL}/rest/v1/subscription_plans?tier=eq.flexpro_pro&select=id`, {
    headers: restHeaders(),
  })
  const plans = await planRes.json()
  const planId = plans[0]?.id
  if (!planId) {
    throw new Error('Could not find the flexpro_pro subscription plan')
  }

  const tierRes = await fetch(
    `${SUPABASE_URL}/rest/v1/subscription_tiers?product=eq.flexpro_posting&tier_key=eq.${tierKey}&select=id`,
    { headers: restHeaders() }
  )
  const tiers = await tierRes.json()
  const tierId = tiers[0]?.id
  if (!tierId) {
    throw new Error(`Could not find the flexpro_posting ${tierKey} tier`)
  }

  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/flexpro_subscriptions?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...restHeaders(), Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: userId,
      plan_id: planId,
      tier_id: tierId,
      status: 'active',
      current_period_end: periodEnd.toISOString(),
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to grant FlexPro subscription to user ${userId}: ${res.status} ${await res.text()}`)
  }
}

export async function getJobIdByTitle(title: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?title=eq.${encodeURIComponent(title)}&select=id`, {
    headers: restHeaders(),
  })
  const rows = await res.json()
  if (!rows[0]) throw new Error(`Could not find job id for title "${title}"`)
  return rows[0].id
}

export async function getClientJobIdByTitle(title: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/client_jobs?title=eq.${encodeURIComponent(title)}&select=id`, {
    headers: restHeaders(),
  })
  const rows = await res.json()
  if (!rows[0]) throw new Error(`Could not find client_jobs id for title "${title}"`)
  return rows[0].id
}

/**
 * future_roles.posted_by references auth.users with NO ACTION, not
 * CASCADE (087) -- only company_id cascades. Deleting a subscribing
 * member's account while the role (and its company) still exist would
 * otherwise leave future_role_subscriptions.user_id dangling. Tests
 * should trackEntity('future_roles', id) with this BEFORE tracking any
 * user accounts (Cleanup.run() clears entities first) so the cascade
 * from future_roles -> future_role_subscriptions always fires before
 * either the employer's or the member's account is deleted, regardless
 * of which user was tracked first.
 */
export async function getFutureRoleIdByTitle(title: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/future_roles?title=eq.${encodeURIComponent(title)}&select=id`, {
    headers: restHeaders(),
  })
  const rows = await res.json()
  if (!rows[0]) throw new Error(`Could not find future_roles id for title "${title}"`)
  return rows[0].id
}

export async function getPostIdBySlug(slug: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?slug=eq.${encodeURIComponent(slug)}&select=id`, {
    headers: restHeaders(),
  })
  const rows = await res.json()
  if (!rows[0]) throw new Error(`Could not find post id for slug "${slug}"`)
  return rows[0].id
}

export async function getGigIdByTitle(title: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/gigs?title=eq.${encodeURIComponent(title)}&select=id`, {
    headers: restHeaders(),
  })
  const rows = await res.json()
  if (!rows[0]) throw new Error(`Could not find gig id for title "${title}"`)
  return rows[0].id
}

export async function getUserIdByEmail(email: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: restHeaders(),
  })
  const body = await res.json()
  const users = body.users ?? body
  const match = Array.isArray(users) ? users.find((u: any) => u.email === email) : null
  if (!match) throw new Error(`Could not find user id for ${email}`)
  return match.id
}

/**
 * candidates.id, not profiles/auth.users.id -- /candidates/[id] (096)
 * routes on the candidates table's own primary key.
 */
export async function getCandidateIdByUserId(userId: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/candidates?user_id=eq.${userId}&select=id`, {
    headers: restHeaders(),
  })
  const rows = await res.json()
  if (!rows[0]) throw new Error(`Could not find candidate id for user ${userId}`)
  return rows[0].id
}

/**
 * Direct read of a user's greyin_scores row -- used by specs that need
 * to confirm a new platform input (e.g. GreyMatters' AI quality score,
 * 048_ai_quality_scores.sql) actually landed in the live composite, not
 * just that the UI shows a number somewhere.
 */
export async function getGreyinScoreRow(userId: string): Promise<Record<string, any> | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/greyin_scores?user_id=eq.${userId}&select=*`, {
    headers: restHeaders(),
  })
  const rows = await res.json()
  return rows[0] ?? null
}

/**
 * Reads the live platform_gate_settings row (041_gate_threshold_governance.sql)
 * -- used by the gate-settings-update spec both to compute thresholds
 * relative to a real candidate's observed greyin_score, and to restore
 * prod's original values at teardown so the test never leaves the live
 * gate changed.
 */
export async function getGateSettings(): Promise<{ min_years_experience: number; min_greyin_score: number }> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/platform_gate_settings?id=eq.1&select=min_years_experience,min_greyin_score`,
    { headers: restHeaders() }
  )
  const rows = await res.json()
  if (!rows[0]) throw new Error('Could not read platform_gate_settings')
  return rows[0]
}

/**
 * Seeds a Salt & Pepper reputation event directly for a given user --
 * profiles is shared across every pillar, so this is a legitimate way to
 * give any test account (regardless of which app they signed up through)
 * real, if synthetic, evidence toward their greyin_scores composite,
 * without having to drive a full discussion/reply/upvote flow just to
 * produce a non-null saltnpepper_raw for a test that isn't about Salt &
 * Pepper itself (e.g. the gate-settings-update spec).
 */
export async function seedReputationPoints(userId: string, points: number): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/reputation_events`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      user_id: userId,
      event_type: 'e2e_test_seed',
      points,
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to seed reputation points for ${userId}: ${res.status} ${await res.text()}`)
  }
}

/**
 * Seeds a StackWorks/"The Lab" project row directly via the service role,
 * for specs (e.g. Salt & Pepper's own parallel builder_projects admin
 * moderation panel) that need one to exist but aren't themselves
 * exercising the project-creation flow (already covered by
 * stackworks/projects-and-asks.spec.ts).
 */
export async function createTestBuilderProject(
  userId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; title: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/builder_projects`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      user_id: userId,
      title: `E2E Test Project ${Date.now()}`,
      description: 'Seeded by the Playwright e2e suite.',
      ...overrides,
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to create test builder project: ${res.status} ${await res.text()}`)
  }
  const [project] = await res.json()
  return { id: project.id, title: project.title }
}

/**
 * Seeds a Salt & Pepper discussion reply directly via the service role,
 * bypassing /api/discussions/[id]/reply -- that route's own redirect
 * back to the thread page immediately triggers a lazy, per-thread AI
 * quality sweep (reply-quality.ts), which would score a reply posted
 * through the real UI before a test ever gets to exercise the admin
 * panel's own "Sweep now" action. Inserting directly is the only way to
 * produce a reply that's still genuinely unswept.
 */
export async function createTestDiscussionReply(
  discussionId: string,
  authorId: string,
  body: string
): Promise<{ id: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/discussion_replies`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      discussion_id: discussionId,
      author_id: authorId,
      body,
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to create test discussion reply: ${res.status} ${await res.text()}`)
  }
  const [reply] = await res.json()
  return { id: reply.id }
}

/**
 * Reads the real gig_categories rows -- gigs-filters.spec.ts needs at
 * least two distinct real category ids to exercise the /gigs category
 * checkbox filter (the select on /gigs/new is a required field with no
 * "uncategorized" option, so gigs always need a real category id).
 */
export async function getGigCategories(limit = 5): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/gig_categories?select=id,name&order=name&limit=${limit}`, {
    headers: restHeaders(),
  })
  const rows = await res.json()
  return rows
}

/**
 * Platform-wide follow graph (053_activity_feed.sql). Seeded directly
 * for apps that don't yet have an in-app Follow button (e.g. deepedge,
 * where the plan explicitly deferred a v1 attachment surface) or for
 * tests that only care about the resulting /feed content, not the click
 * path itself.
 */
export async function createTestFollow(followerId: string, followedId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_follows`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ follower_id: followerId, followed_id: followedId }),
  })
  if (!res.ok) {
    throw new Error(`Failed to create test follow: ${res.status} ${await res.text()}`)
  }
}

export async function deleteTestFollow(followerId: string, followedId: string): Promise<void> {
  await fetch(
    `${SUPABASE_URL}/rest/v1/user_follows?follower_id=eq.${followerId}&followed_id=eq.${followedId}`,
    { method: 'DELETE', headers: restHeaders() }
  )
}

/**
 * Sets a candidate's skills array directly -- the real UI path is a
 * resume upload + heuristic PDF parse (parse-resume/route.ts), not
 * practical to drive from e2e. Writing candidates.skills here exercises
 * the real on_candidate_skills_synced trigger
 * (054_skill_endorsements_and_ratings.sql) that populates profile_skills,
 * same as a real resume-derived skill list would.
 */
export async function setCandidateSkills(userId: string, skills: string[]): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/candidates?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: restHeaders(),
    body: JSON.stringify({ skills }),
  })
  if (!res.ok) {
    throw new Error(`Failed to set candidate skills: ${res.status} ${await res.text()}`)
  }
}

/**
 * Seeds a gig directly with a real category + tags -- skill-ratings.spec.ts
 * needs a gig whose tags are the exact skills a completed order can be
 * rated on (054_skill_endorsements_and_ratings.sql).
 */
export async function createTestGig(
  freelancerId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; title: string }> {
  const categories = await getGigCategories(1)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/gigs`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      freelancer_id: freelancerId,
      title: `E2E Test Gig ${Date.now()}`,
      slug: `e2e-test-gig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: 'Seeded by the Playwright e2e suite.',
      category_id: categories[0]?.id,
      pricing_type: 'fixed',
      price_min: 1000,
      price_max: 2000,
      delivery_days: 3,
      status: 'active',
      ...overrides,
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to create test gig: ${res.status} ${await res.text()}`)
  }
  const [gig] = await res.json()
  return { id: gig.id, title: gig.title }
}

/**
 * Seeds a real conversation + message between two users directly --
 * StackWorks has no messaging UI of its own (direct_messages is a
 * cross-pillar feature, only exposed on deepedge/saltnpepper), but
 * the "initial skill rating" chat-trigger
 * (054_skill_endorsements_and_ratings.sql) checks this same shared
 * conversations/direct_messages schema regardless of which app the
 * chat happened on.
 */
export async function createTestConversationWithMessage(userA: string, userB: string): Promise<void> {
  const convRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({}),
  })
  if (!convRes.ok) {
    throw new Error(`Failed to create test conversation: ${convRes.status} ${await convRes.text()}`)
  }
  const [conversation] = await convRes.json()

  await fetch(`${SUPABASE_URL}/rest/v1/conversation_participants`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify([
      { conversation_id: conversation.id, user_id: userA },
      { conversation_id: conversation.id, user_id: userB },
    ]),
  })

  // SEC-032 (2026-08-26 security audit): the skill-rating "informal
  // chat" gate (054, tightened by 083) now requires a real two-way
  // exchange -- messages from BOTH participants in the shared
  // conversation, not just one -- closing a drive-by-DM-then-1-star
  // exploit. Seed both sides here to match.
  await fetch(`${SUPABASE_URL}/rest/v1/direct_messages`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ conversation_id: conversation.id, sender_id: userA, body: 'Quick technical chat before deciding.' }),
  })
  await fetch(`${SUPABASE_URL}/rest/v1/direct_messages`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ conversation_id: conversation.id, sender_id: userB, body: 'Sure, happy to chat.' }),
  })
}

/**
 * Sets fields on a candidate's expected-salary/title/experience --
 * salary_trends.spec.ts uses this to seed the view's "expected" source
 * branch (055_employment_history_salary_trends.sql) directly, since
 * driving a resume-derived salary figure through the real UI isn't
 * practical from e2e.
 */
export async function setCandidateProfile(userId: string, fields: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/candidates?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: restHeaders(),
    body: JSON.stringify(fields),
  })
  if (!res.ok) {
    throw new Error(`Failed to set candidate profile fields: ${res.status} ${await res.text()}`)
  }
}

/**
 * Seeds profiles.seller_rating/total_reviews directly -- the FlexPro
 * "Top Tier" badge (FR-RM-03, 062... no, 036 auto-threshold read) is
 * gated on greyin_scores.flexpro_score (renamed by migration 103's
 * Tier 3 pass), a Bayesian-shrunk blend of
 * this rating against the platform-wide mean. That mean shifts with
 * real prod traffic, so there's no fixed number of real orders+reviews
 * that deterministically crosses the >=85 threshold from a single e2e
 * run -- total_reviews=50 at a perfect 5.0 rating overwhelms the shrink
 * term regardless of the live mean (worst case, a platform mean of 0,
 * still yields (50/55)*100 ≈ 90.9). Seeded directly rather than through
 * 50 real orders, which is what this is standing in for.
 */
export async function setSellerRating(userId: string, rating: number, totalReviews: number): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: restHeaders(),
    body: JSON.stringify({ seller_rating: rating, total_reviews: totalReviews }),
  })
  if (!res.ok) {
    throw new Error(`Failed to set seller rating: ${res.status} ${await res.text()}`)
  }
}

/**
 * Auth signup auto-creates a companies row per employer (auth/signup/
 * route.ts) -- this looks it up rather than assuming a fixed id, since
 * seeding backdated jobs (below) needs a real company_id to satisfy
 * the FK.
 */
export async function getCompanyIdByUserId(userId: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/companies?user_id=eq.${userId}&select=id`, {
    headers: restHeaders(),
  })
  const [company] = await res.json()
  if (!company) {
    throw new Error(`No company found for user ${userId}`)
  }
  return company.id
}

/**
 * Seeds a real, backdated, salary-disclosed job directly -- used to
 * establish a distinct earlier salary_trends period (grouped by
 * DATE_TRUNC('quarter', created_at), 055) that a same-quarter,
 * UI-posted job can't produce on its own, since every job created
 * during a single e2e run falls in the same quarter.
 */
export async function createBackdatedJob(opts: {
  companyId: string
  title: string
  location: string
  salaryMin: number
  salaryMax: number
  monthsAgo: number
}): Promise<string> {
  const createdAt = new Date()
  createdAt.setMonth(createdAt.getMonth() - opts.monthsAgo)
  const slug = `e2e-backdated-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      company_id: opts.companyId,
      title: opts.title,
      slug,
      description: 'Seeded by the Playwright e2e suite to establish a backdated salary_trends period.',
      location: opts.location,
      salary_min: opts.salaryMin,
      salary_max: opts.salaryMax,
      currency: 'INR',
      salary_disclosed: true,
      status: 'open',
      created_at: createdAt.toISOString(),
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to create backdated job: ${res.status} ${await res.text()}`)
  }
  const [job] = await res.json()
  return job.id
}
