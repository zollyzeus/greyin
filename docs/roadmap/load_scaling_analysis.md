# Greyin — Load-Scaling Architecture Assessment

_Date: 2026-09-07. Based on: `deployment/frontend-stack.yml`, `deployment/supabase-stack.yml`,
`deployment/traefik/traefik.yml`, live Postgres settings (`pg_stat_activity`, `SHOW`),
`apps/*/src/middleware.ts`, `apps/*/src/lib/supabase/*`, realtime component usage,
`deployment/migrations/024_platform_search.sql` and `122_greyin_score_incremental_cache.sql`._

## Baseline assumption

Today the platform is effectively pre-launch (DB 63 MB, 312 users, ~near-zero RPS).
"1x" here = a modest launch (~1k DAU, ~10 req/s peak). So:

- **10x ≈ 10k DAU / ~100 req/s peak**
- **100x ≈ 100k DAU / ~1k req/s peak**

## Current shape (what is actually deployed)

- **7 Next.js apps** (`output: standalone`, `node server.js`), **each `replicas: 1`, no CPU/memory
  limits**, on a **single Docker Swarm node** shared with unrelated production stacks
  (BigBlueButton, ERPNext, Mongo, edjitsu).
- **Self-hosted Supabase, every service `replicas: 1`:** Postgres (2 GB cap), Kong, PostgREST
  (512 MB), GoTrue (512 MB), Realtime (512 MB), Storage (**local-filesystem backend**), imgproxy,
  Studio, Logflare.
- **Postgres is on stock defaults:** `max_connections=100`, `shared_buffers=128MB`,
  `effective_cache_size=128MB`, `work_mem=4MB`. **No connection pooler** (no Supavisor/pgbouncer).
- **No CDN, no Redis, no app-level rate limiting.** Traefik does TLS + HTTP→HTTPS redirect only.
- **Next.js does no ISR / data-cache** — every page is dynamic SSR (all read cookies/auth).

---

## What is robust enough for 10x–100x (little/no change)

| Area | Why it holds |
|---|---|
| **Next.js app tier (compute)** | Stateless standalone servers behind Traefik. Scaling = bump `replicas` + add nodes. No sticky sessions (auth is a `.greyin.net` cookie validated per-request). Easy axis. |
| **Auth model / SSO** | One shared cookie across all pillars, JWT-based, `security_invoker` RLS. Correct and horizontally scalable; GoTrue is stateless (state lives in Postgres). |
| **RLS as the authorization boundary** | Consistent; service-role bypass confined to webhooks/aggregates. No per-scale redesign — just index the predicates. |
| **Payments (Razorpay webhooks)** | HMAC-verified, service-role, idempotent-ish writes. Volume is a rounding error vs page traffic. |
| **Data size** | Even at 100x the core tables (jobs, gigs, posts, profiles) are ~single-digit GB. Postgres handles that trivially *with* real config + indexes. |
| **Static assets** | `_next/static` is immutable-hashed; trivially CDN-able. |
| **imgproxy** | Stateless, ETag-cached, horizontally scalable; only needs a shared/object store behind it. |
| **Greyin Score compute** | Already moved to a per-user trigger-maintained cache + periodically-refreshed global means (migration 122). This is the pattern the rest of the aggregates need. |

---

## What breaks at ~10x (must fix before a real launch)

1. **Single replica of everything + single node.** Any container OOM/restart = full outage for
   that pillar or the whole API. No redundancy, no rolling capacity.
   → `replicas: 2+` for the app tier and PostgREST/Kong/GoTrue, add a second Swarm node, set
   memory/CPU **reservations** so a noisy neighbour (BBB!) can't starve Postgres.

2. **Postgres stock config.** `shared_buffers=128MB` / `work_mem=4MB` / `max_connections=100`
   will thrash under concurrent SSR.
   → tune to the box (~25% RAM `shared_buffers`, `effective_cache_size` ~50–75% RAM, `work_mem`
   16–32 MB), and **put Supavisor or pgbouncer in front** (transaction pooling) so
   PostgREST/GoTrue/Realtime/app-routes don't collectively exhaust 100 connections.

3. **`auth.getUser()` in middleware on every request.** Each navigation makes a GoTrue call →
   DB round-trip. At 100 req/s that's 100 GoTrue hits/s through one 512 MB container.
   → verify the JWT locally with the shared secret (`getClaims()` / jose), only call GoTrue on
   refresh. Removes GoTrue from the hot path; one-file change per app.

4. **No rate limiting anywhere.** One scraper or credential-stuffer hits Postgres directly
   through PostgREST.
   → Traefik rate-limit middleware per-IP + per-route limits on auth/search/LLM endpoints
   (ideally a WAF/CDN in front).

5. **`platform_search_index` is a plain VIEW** (posts ∪ jobs ∪ gigs) with `ILIKE '%term%'` and no
   full-text index. Every ⌘K keystroke-search = 3 seq-scans + union.
   → `tsvector` + GIN index, or a materialized view refreshed on write, or `pg_trgm` at minimum.

6. **`audit_log_entries` grows unbounded** (already 21 MB / 53k rows at zero traffic).
   → pg_cron nightly prune / partition by month.

7. **Storage on a local filesystem volume.** Can't add a second node without shared storage, and
   it competes with Postgres for disk IO.
   → move to S3/MinIO backend.

---

## What breaks at ~100x (architectural — plan now even if deferred)

1. **Realtime `postgres_changes` fan-out.** Every logged-in tab opens **2 channels**
   (`SectionBadge` + `NotificationBell`) per app, each an RLS-checked `postgres_changes`
   subscription. Supabase Realtime evaluates every WAL change against every subscription's RLS —
   the documented hard ceiling. At 100k concurrent sessions this collapses.
   → move badge/bell counts to short-poll (30–60 s), or a single per-user "notifications"
   channel, or a fan-out layer (Redis pub/sub / centralized WS service). Realtime must be
   clustered, not `replicas: 1`.

2. **Single-writer Postgres, no read replicas.** All SSR reads + writes hit one primary.
   → streaming replicas for read traffic (feeds, search, dashboards, `platform_*_index`),
   primary for writes; route reads through a replica-aware pooler.

3. **Synchronous LLM calls in request routes** (resume parse, mentor/candidate matching). At
   100x these tie up Node workers for seconds and depend on external provider limits.
   → queue + worker (pg-boss / BullMQ / Supabase Edge Functions), return "processing", notify on
   completion.

4. **Cross-pillar aggregates computed on read.** Migration 122 already cached `greyin_score`
   because live computation got expensive. Every other "activity count / score / feed" that
   computes on read needs the same treatment.
   → precompute on write or via scheduled rollups; treat any `COUNT(*)`/aggregate in a hot path
   as a bug.

5. **Kong / PostgREST as the only data path.** PostgREST's pool (~10) and one Kong instance
   become the funnel.
   → scale PostgREST horizontally behind the pooler; multiple Kong replicas; consider moving the
   heaviest read endpoints to purpose-built Next.js route handlers with tuned queries.

6. **No CDN / all-dynamic rendering.** 1k req/s of full SSR against one node is wasted compute
   for pages that are ~90% identical.
   → CDN in front (Cloudflare); ISR / `unstable_cache` for public/semi-static pages (job
   listings, posts, pillar landing pages); keep dynamic only for authenticated shells.

7. **Single node = no failure-domain isolation.** 100x traffic on shared hardware with
   BBB/ERPNext is untenable.
   → dedicated cluster for Greyin; Postgres on its own machine with fast NVMe.

---

## Priority order if acting

1. **Config + redundancy** — Postgres tuning, connection pooler, `replicas: 2`, resource limits,
   second node. Cheap; unblocks everything.
2. **Local JWT verification in middleware** — removes GoTrue from the hot path.
3. **Rate limiting + CDN** — abuse protection and ~80% compute reduction on public pages.
4. **Search index (FTS/GIN)** and **audit-log pruning** — bounded, well understood.
5. **Realtime strategy** (poll or fan-out) and **LLM queueing** — needed before 100x, designable
   now.
6. **Read replicas + storage on object store** — the 100x-only items.
