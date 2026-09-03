# Greyin Pre-Launch Security Audit — 2026-08-24

## Headline

**The platform cannot launch as-is.** Any user who creates an account can become a platform administrator in two different ways — one of them requiring nothing more than a normal signup with a crafted field. From admin, they can read every LLM provider's API key, approve/deny payouts, and change platform-wide eligibility gates. Independently, the FreeAgent payment flow lets a buyer set their own price and a seller withdraw money for an order that was never actually paid. Both are launch-blocking and need fixing before any real user touches this platform.

Everything below was found by four parallel audits (RLS/database, auth/session/admin, payment/escrow, XSS/secrets/uploads) plus a direct `npm audit` run, each independently verifying findings against actual file:line references — nothing here is theoretical. Two agents independently found the same admin-escalation bug from different angles, which is why it's listed twice below (RLS layer and application layer) — they're two doors to the same room and both need to be locked.

---

## CRITICAL — launch-blocking

### Full admin takeover

1. **Signup lets you become admin directly.** `deployment/migrations/010_confirm_on_verify.sql:29,43,49` reads `role` straight from the signup request's `raw_user_meta_data` with no allowlist, and `007_profile_role_and_experience.sql:35` permits `'admin'` as a valid value. `apps/greyin-b2b/src/app/auth/signup/route.ts:11,28` passes the form's `role` field straight through with no validation. **Exploit:** sign up with `role=admin` in the request, confirm the OTP, you're a platform admin. Same pattern repeats in migrations 010, 022, 030, 038, 047.
2. **Even without that, any logged-in user can PATCH their own role.** `deployment/migrations/001_initial_schema.sql:52-54` — the `profiles` UPDATE policy checks `auth.uid() = id` but restricts no columns. **Exploit:** `PATCH /rest/v1/profiles?id=eq.<self>` with `{"role":"admin"}` using the public anon key. No trigger anywhere blocks this (contrast `057_written_recommendations.sql:52-67`, which does exactly this kind of column-lock correctly for a different table).
3. Both paths hand you: every LLM provider's plaintext API key (`llm_providers`, granted to `role='admin'`), payout approval, escrow dispute resolution, and the platform-wide eligibility gate settings.

**Fix shape:** an allowlist on the signup route + a `BEFORE UPDATE`/`BEFORE INSERT` trigger on `profiles` that pins `role` (and `years_experience`, same exposure) to its prior value unless the acting role is already admin — same pattern already used correctly for `written_recommendations.body` immutability.

### Payment tampering — real money at risk

4. **Order price is entirely client-supplied.** `apps/freeagent-marketplace/src/app/api/orders/create/route.ts:16,36,84` — `amount` comes straight from the request body; the gig's real price is fetched but never consulted. **Exploit:** buy any gig for ₹1.
5. **Payment verification doesn't check which order it's for.** `apps/freeagent-marketplace/src/app/api/orders/verify/route.ts:20,38-39` — the Razorpay signature is checked, but never bound to `order.razorpay_order_id`, and the order's prior status is never checked. **Exploit:** complete one real cheap payment, then replay that same verified `(order_id, payment_id, signature)` triple against a different, expensive order — it gets marked paid with zero payment.
6. **Escrow release never actually checks payment happened.** `apps/freeagent-marketplace/src/app/api/orders/update-status/route.ts:48-56` and `.../api/payouts/request/route.ts:26-30` — an order can be walked `pending → in_progress → delivered → completed` with no payment ever occurring, and the payout balance calculation only checks `status='completed'`, never `payment_status='captured'`. **Exploit:** two colluding accounts create an unpaid order, mark it completed, request a real payout.
7. **`gig_orders` RLS lets either party directly set status/payment fields**, bypassing the intended API workflow entirely (`003_rls_enhancements.sql:200-203`, `004:92-98`) — the fix needs to happen at the database layer, not just in the API routes, since RLS itself currently permits the bypass.
8. **Unauthenticated financial RPCs.** `deployment/migrations/002_razorpay_integration.sql:141,159-180,183-202` — `capture_razorpay_payment()`, `process_razorpay_refund()`, `create_razorpay_order()` are all `SECURITY DEFINER` with zero `auth.uid()` check and no `REVOKE`, meaning any authenticated (or possibly anonymous) caller can invoke them directly via `/rpc/capture_razorpay_payment` with an arbitrary order id.

### Data exposure

9. **Candidate resumes are in a fully public, listable storage bucket.** `deployment/migrations/019_public_images_bucket.sql:11,16` — `public: true`, SELECT policy allows anyone unauthenticated. `apps/greyin-b2b/src/components/ResumeSkillsUploader.tsx:52` uploads real resumes here. **Exploit:** anonymously list and download every candidate's resume.
10. **That same bucket has no path scoping, no MIME/size limits.** `019:20` — INSERT policy is just `auth.role() = 'authenticated'`, no check that a user is writing to their own folder. File type/size validation is client-side only (`accept=".pdf"` attributes, trivially bypassed). **Exploit:** upload an `.html` file with `content-type: text/html` — served publicly as HTML from the Supabase origin (phishing), or upload unbounded volume to exhaust storage.
11. **A real, signed `service_role` JWT is committed in the source tree.** `deployment/config/kong.yml:134`, expires 2036, its own comment admits it's "valid everywhere." Anyone with repo or build-artifact access gets full RLS bypass on the entire database. **Fix:** rotate `JWT_SECRET`, reference the key from env only, never commit a signed token.
12. **Stored XSS via unescaped JSON-LD.** `apps/greyin-b2b/src/app/jobs/[id]/page.tsx:91` — `dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }}` where the job description is employer-controlled. `JSON.stringify` doesn't HTML-escape `</script>`. **Exploit:** an employer's job description containing a crafted `</script><script>` payload executes for every visitor to that job page.
13. **The `collaborators` view leaks the entire relationship graph.** `deployment/migrations/059_collaborators.sql` — its own comment claims "security comes from the underlying tables' RLS," but the view has no `security_invoker = true` and runs as its owner, bypassing that RLS entirely. Any authenticated user can read every StackEdge collaboration and every completed FreeAgent order pairing on the platform — this is also the data source for today's "worked together" surfacing and reference-check features.
14. **`verified_outcomes` allows self-verification.** `deployment/migrations/031_verification_engine.sql:102-104` — the INSERT policy only checks `auth.uid() = subject_user_id`, nothing pins `status`. **Exploit:** insert your own `status='verified', score=100` row and become a Verified Expert.

---

## HIGH

15. **Next.js 14.2.4 has a critical CVE** (GHSA-f82v-jwr5-mffw, CVSS 9.1, middleware authorization bypass, CVE-2025-29927) plus a long list of other high/moderate CVEs (DoS, SSRF, cache poisoning, request smuggling), all fixed by 14.2.35 — same minor line, non-breaking per npm's own `fixAvailable`. Practical exploitability of the middleware CVE specifically is lower here since real auth checks live in Server Component `redirect()` calls, not in `middleware.ts` (which only refreshes session tokens) — but the sheer volume of other real, high-severity fixes bundled into the same patch makes this worth doing regardless.
16. **Password-reset codes are brute-forceable.** All 6 apps' `reset-password-confirm/route.ts` accept a 6-digit OTP with no attempt counting, lockout, or per-IP throttling; GoTrue's own rate limit only covers *sending* emails, not *guessing* codes, and the code's default lifetime is 24 hours. **Exploit:** request a reset for a victim's email, then brute-force the 6-digit code over the 24-hour window.
17. **Session cookies aren't `httpOnly`/`secure`, and are scoped to the whole `.greyin.net` apex.** All 6 apps' `middleware.ts`/`server.ts` use `@supabase/ssr` defaults (`sameSite: 'lax'`, no `httpOnly`, no `secure` override). Combined with the apex-wide cookie domain, a single XSS anywhere on any current or future `*.greyin.net` subdomain steals a token that grants SSO access to all six apps at once.
18. **No signup abuse protection anywhere** — no captcha, no rate limiting beyond GoTrue's own defaults. This directly amplifies the admin-escalation risk (automatable) and enables general spam/fake-account abuse.

---

## MEDIUM

19. **No Razorpay webhook idempotency** — a replayed `payment.captured` event can flip an already-cancelled/refunded order back to `paid`, re-enabling a second real refund of the same payment.
20. **Non-timing-safe signature comparisons** (3 sites: both webhook routes + order verify) — plain `===` instead of `crypto.timingSafeEqual`. Signature checks do exist, so this is a hardening gap, not an open door.
21. **`company_reviews` leaks `reviewer_id`** — anonymity is UI-only (the app just doesn't `SELECT` it), not RLS-enforced. `?select=reviewer_id,rating` de-anonymizes every "anonymous" employer review.
22. **Open-redirect filter bypass via backslash** in every app's `?next=` handling — `next.startsWith('/') && !next.startsWith('//')` doesn't catch `\evil.com`, which browsers normalize to `//evil.com`. Usable for phishing after a real login.
23. **Unescaped user input in PostgREST `.or()` filter strings** on several search pages — a `,` or `)` in a search query injects extra filter clauses. RLS caps the actual blast radius, but it's unsanitized input in a query DSL.
24. **`mentor_session_slots`** — a mentor can flip their own booked slot back to `open` and null out `gig_order_id`, effectively reselling an already-paid seat; `recording_url` is also exposed on any `open`-status slot regardless of purchase.
25. **`create_job_referral_notification()`** only checks the caller is logged in — attacker-controlled title/body can be pushed into any user's notification inbox.
26. **`subscription_plans` has no RLS enabled at all** — the only `CREATE TABLE public.*` across 66 migrations missing it; worth confirming Supabase's default grants don't let `anon`/`authenticated` write to pricing.
27. **`platform_search_index`** (granted to `anon`) includes `discussions.body` and `builder_projects`, bypassing their own `auth.role() = 'authenticated'` RLS — the view's own migration comment explicitly warned against exactly this.
28. **`activity_feed`** selects published posts unfiltered, bypassing the `view_audience = 'verified_expert'` restriction those posts are supposed to have.
29. **nodemailer** has a high-severity "email to unintended domain" CVE — used in `apps/greyin-b2b/src/lib/email.ts`; worth confirming exactly what it sends before deciding urgency.

---

## LOW

30. Newsletter signup's `WITH CHECK (true)` for anonymous inserts — spam/enumeration surface.
31. `get_unread_message_count()` is `SECURITY DEFINER` with public execute and no auth check — a count-only information leak.
32. A candidate can list anyone as a professional reference without that person's consent (by design from today's build, per your own direction — noting it here only as a privacy consideration, not a bug).
33. StackEdge's skill-rating interaction gate is satisfiable by a single DM, enabling drive-by 1-star ratings with minimal real interaction.
34. `payout_requests` accepts any client-supplied `amount` at insert time — the real balance check happens in application code, not the database, so this is a defense-in-depth gap rather than an active hole.
35. ~36 of 69 `SECURITY DEFINER` functions lack an explicit `SET search_path` — a hardening best-practice gap, low real exploitability on a Supabase-managed instance.
36. No idempotency key on outbound Razorpay refund calls, and no row lock between two concurrent cancel requests on the same order — a narrow double-refund race window.
37. `postcss`/`cookie`/`@supabase/ssr` — low-severity npm advisories, fixed incidentally by the Next.js bump.

---

## What I'd fix, and in what order

The four CRITICAL admin-escalation and payment-tampering items (1–8) are the ones that make this platform unsafe to launch — they're each independently sufficient for a total compromise or real financial loss, and I'd want all of them closed before any real user signs up. The storage/secrets items (9–14) are close behind — resumes are real people's PII, and the committed service_role key is a standing risk regardless of whether it's ever actively exploited. The HIGH group (15–18) I'd want done before launch but they're posture/defense-in-depth rather than "this specific request breaks everything." MEDIUM and LOW are real and worth doing, but none of them are launch-blocking on their own.

**I have not fixed anything yet.** Given the size and financial/security sensitivity of these changes, I want your explicit go-ahead before touching any of it — especially the RLS/trigger changes on `profiles` and `gig_orders`, which are exactly the kind of schema change this session has been careful to verify with direct SQL before shipping.

**What do you want me to do next?** Options, not mutually exclusive:
- Fix the CRITICAL items now, in the order above, verifying each with direct SQL and a real e2e test before moving to the next (this will take a while given the count).
- Fix just the two admin-escalation bugs first (1–2) since they're the single most catastrophic category, then re-assess.
- Something else — tell me how you want to sequence this.
