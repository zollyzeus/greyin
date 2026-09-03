# Cross-App Integration, Test Coverage, and SRE/Scaling Audit — August 2026

Scope: (1) fix the one stale doc claim found earlier, (2) verify every claimed
cross-app "requirement overlap" is real at the code level, not just
documented, (3) bring e2e coverage up to match, (4) assess the SRE backbone
(monitoring/control/backups), (5) rate current code maturity against 10x and
100x audience growth.

---

## 1. Doc fix

`IMPLEMENTATION_VS_REQUIREMENTS.md` claimed "Salt & Pepper still has no
member-to-member DMs." Read `apps/saltnpepper-community/src/app/api/messages/start/route.ts`
in full — it's a genuine unscoped `get_or_create_conversation` RPC, reachable
from `/members` and `/mentors`, not limited to any order/context. Claim
corrected to reflect this.

## 2. Cross-app integration audit — what's actually real

Verified at the code level (file:line, not doc claims) across four research
passes: identity/SSO, the unified Greyin Score, trust signals, gate config,
notifications/messaging, `EcosystemWidget`, Ecosystem Search, the referral
bridge, pivoter/mentor plumbing, enterprise leads, and the application gate.
All of it checked out as genuinely implemented, not aspirational — confirmed
again just now by the full e2e run (below), which exercises most of this
list end-to-end against production.

**One thing that looked like a bug and wasn't**: Prolab Builders sharing
`profiles.role = 'member'` with genuine Salt & Pepper members, which makes
Builders show up in Salt & Pepper's `/members` directory. `030_prolab_launch.sql`
documents this as intentional shared-cohort design, not accidental
contamination. Verified this explicitly with a dedicated check before
concluding — **left unchanged**, since reversing it would undo a real
product decision, not fix a defect.

**One real gap found and fixed**: only `greyin.net`'s header carried the
"More Platforms" cross-pillar dropdown and a full Ecosystem Search link;
FreeAgent and Salt & Pepper had Ecosystem Search but not the dropdown,
GreyMatters had neither despite already having a working `/search` page
with no link to it, and Prolab had neither *and* no `/search` page at all.
Fixed:

- Added the "More Platforms" dropdown (desktop hover + mobile collapsible,
  sourced from each app's own local `PILLARS` array) to FreeAgent, Prolab,
  Salt & Pepper, and GreyMatters headers.
- Added the "Ecosystem Search" nav link to Prolab and GreyMatters.
- Built Prolab's `/search` page and `EcosystemSearchResults` component from
  scratch, matching the pattern already used in the other four apps.

## 3. E2E coverage — gaps closed

Three genuine coverage gaps were identified where the underlying feature
was real but nothing in the suite exercised it:

1. **Greyin Score reaching employer search.** `candidates.spec.ts`'s
   existing candidate qualifies as Verified Expert on
   `years_experience >= 12` alone and has zero cross-platform evidence, so
   `greyin_scores.greyin_score` stays NULL for them and the page's
   `· Greyin Score {n}` suffix never actually rendered in that test. New
   spec (`cross-platform/greyin-score-in-candidate-search.spec.ts`) gives a
   candidate a real Prolab verified outcome and confirms the score reaches
   `/candidates`, not just Prolab's own profile/People pages.
2. **FreeAgent → Prolab trust signal**, the reverse direction of the
   existing Prolab → greyin-b2b trust-signal test. New spec
   (`cross-platform/freeagent-trust-signal.spec.ts`) drives a real order
   review on FreeAgent (exercising `006`'s `update_seller_review_stats`
   trigger) and confirms the seller's rating/review count shows up on a
   Prolab ask owner's applicant list via the shared `profiles` row.
3. **Cross-app referral.** The existing referral test signs up the referred
   person on greyin-b2b itself — the more representative case is someone
   who has never touched greyin-b2b. New spec
   (`cross-platform/referral-cross-app.spec.ts`) signs the referred person
   up on Salt & Pepper only, has a greyin-b2b employer refer their email,
   and confirms the notification lands on Salt & Pepper's own
   `/notifications` page (same shared table + reskinned component, not a
   siloed per-app one).

Also extended `navigation.spec.ts`, whose docstring had gone stale the
moment the header fix above shipped ("Only greyin.net actually links out"
was no longer true) — added coverage for all 4 other apps' new dropdowns
and their Ecosystem Search links.

**Full suite result, run against production after deploying all four
touched apps:**

```
108 passed (3.6m)
```

(One of the three new specs failed on first pass — `signUpProlabBuilder`
called without the `prolabBase` override needed since the test lives in
the `cross-platform` project, whose default baseURL is greyin-b2b, not
Prolab. Fixed and reconfirmed passing before the full run above.)

## 4. SRE backbone

**What already exists on this host, unused by Greyin:** a full
Prometheus/Grafana/Alertmanager/node-exporter/Uptime-Kuma/Glitchtip stack,
currently scoped entirely to a different product on the same shared
Docker Swarm host. Traefik's own `traefik_service_server_up` /
`traefik_service_requests_total` metrics — the free per-backend up/down and
error-rate signal Prometheus already scrapes — currently only cover that
other product's 3 services (`jobportal`, `lms`, `marketing`). None of
Greyin's 5 frontend services or Supabase's 9 backing services are
monitored, alerted on, or dashboarded anywhere. This is the single biggest
SRE gap: **zero observability**, not weak observability — if any Greyin
service goes down right now, nothing pages anyone.

**Fixed this session (safe, already applied to the live host):**

- `deployment/.env` was world-readable (`664`) despite holding every
  credential this stack depends on — corrected to `600`.
- The Postgres backup script (`deployment/backup.sh`) targeted three
  container names from a pre-Supabase iteration of this stack that no
  longer exist — it had been silently backing up nothing. Rewritten to
  resolve the actual running `supabase_supabase_db` container at run time,
  `pg_dumpall` (roles/grants, not just one database) through `gzip` under
  `set -euo pipefail`, with a minimum-file-size sanity check and 14-day
  local retention pruning. Verified with a real manual run
  (`postgres_20260818_225147.sql.gz`, 1.8M) and a daily 2am cron entry,
  both confirmed present.
- **Explicitly not off-host** — this protects against a bad migration or
  human error, not against the disk or host itself failing. Off-host
  replication is a separate, deliberate step, listed below as something
  requiring your sign-off rather than something to just do.

**Verified live, not fixed (informational, current as of this audit):**

- Postgres: `max_connections = 100`, 31 in use under today's light load,
  no PgBouncer or other pooler in front of it. `shared_buffers = 128MB`
  against a host with 251GB RAM (101GB currently available) — the default,
  never tuned for this box.
- None of Greyin's 5 frontend Docker services have CPU or memory limits
  set (`docker service inspect ... .Spec.TaskTemplate.Resources` returns
  `{}` for all five) — completely unbounded, on a host shared with
  another product's full stack. Supabase's own Postgres service is capped
  (2GB limit / 1GB reservation), Kong is not.
- Every Greyin service runs at `1/1` replicas — no redundancy, no
  zero-downtime rolling updates possible. (The other product on this same
  host runs its comparable services at 2-4 replicas.)
- Disk: 668G/915G used (77%), 201G free. Not urgent today, worth watching
  as the Postgres backup set and any file storage grow.

**Requires your sign-off before I'd touch any of it** (these are live,
shared-host service configs, not local files):

- Wire Greyin's 5 frontend services + Supabase's services into the
  existing Prometheus/Grafana/Alertmanager stack (add scrape targets,
  build dashboards, define alert rules) — the infrastructure to do this
  already exists on the host, this is purely additive config, but it does
  touch a shared monitoring stack another product depends on.
- Add CPU/memory limits to Greyin's services so a traffic spike or bug in
  one app can't starve the other 4 (or the other product's services) on
  this shared host.
- Introduce PgBouncer (or similar) in front of Postgres before connection
  count becomes a real ceiling — see the 10x/100x section below for why
  this matters more at scale than it does today.
- Bump Greyin's frontend services to 2+ replicas each for basic
  redundancy and zero-downtime deploys, matching the pattern already used
  by the other product on this host.
- Off-host backup replication (rsync/S3/etc.) — today's backup only
  protects against bad migrations and human error, not host/disk failure.

## 5. Scaling: 10x and 100x, and current code maturity

**10x current traffic**: Likely fine on application code — the app layer
is stateless Next.js behind Traefik, straightforward to scale horizontally
by adding replicas once resource limits and multi-replica deploys are in
place (see above). The real ceiling at 10x is **Postgres connections**:
100 max, already shared across 5 frontend apps' server-side Supabase
clients plus PostgREST, GoTrue, Realtime, Storage, and Meta, with no
pooler. Each additional concurrent user session multiplies request-time
connections across all of that. A PgBouncer transaction-pooling layer is
the single highest-leverage change for 10x headroom — everything else
(host RAM, disk) has comfortable margin today.

**100x current traffic**: This is where single-node Docker Swarm plus a
single unpooled Postgres instance stops being sufficient regardless of
tuning. At that scale the architecture question becomes real: managed
Postgres with read replicas (or Supabase's own hosted tier, given this is
already self-hosted Supabase), a multi-node Swarm/Kubernetes setup instead
of one shared host, and the monitoring/alerting backbone above becoming
load-bearing rather than optional — at 100x scale, "nothing pages anyone"
stops being a tolerable gap. This is a genuine architectural decision, not
a config change, and shouldn't be scoped or started without your explicit
direction on it.

**Code maturity verdict**: the application layer itself — the 5 apps, the
shared `profiles`/SSO/Greyin-Score fabric, RLS policies, the e2e suite now
at 108 passing tests spanning standalone and cross-app coverage — is in
good shape to support 10x growth with the operational fixes above, not
code rewrites. The gap between here and 100x is infrastructure and SRE
backbone (pooling, redundancy, real observability, and eventually a
managed/multi-node data layer), not application code quality.
