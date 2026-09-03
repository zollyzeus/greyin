/**
 * Next.js's standalone server mode uses the Dockerfile's HOSTNAME=0.0.0.0
 * (correct for binding) as the base when building `request.url` inside
 * Route Handlers, ignoring the real Host header Traefik forwards — so
 * `new URL(path, request.url)` silently redirects to
 * https://0.0.0.0:3000/... in production, which no real browser can reach.
 * Build redirect targets from the known public site URL instead.
 */
export function absoluteUrl(path: string): URL {
  return new URL(path, process.env.NEXT_PUBLIC_SITE_URL)
}
