/**
 * Next.js calls register() once when a new server instance boots (not
 * per-request) -- the one place in this app that can host a genuine
 * long-lived background timer, since this runs as a persistent Node
 * process (output: 'standalone'), not a serverless function. Guarded to
 * the nodejs runtime because this file also gets loaded when compiling
 * for the edge runtime, where setInterval/the service-role client don't
 * apply.
 *
 * Single replica today (deployment/frontend-stack.yml) -- this timer
 * would double up if that ever changes without adding real
 * coordination (e.g. an advisory lock). Acceptable for now: a duplicate
 * sweep tick is wasteful, not harmful, since scoring upserts are
 * idempotent per post_id.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const TICK_MS = 60_000

  setInterval(() => {
    import('./app/lib/post-quality')
      .then((mod) => mod.runPeriodicSweepIfDue())
      .catch((error) => console.error('Periodic post-quality sweep tick failed:', error))
  }, TICK_MS)
}
