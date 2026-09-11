// Curated "Launch Demo" personas for pitch reviewers and first-time
// visitors -- one-click, credential-free exploration of a populated
// account. Every persona here is a REAL, pre-existing seeded account
// from deployment/seed-demo-data.sql (all @demo.greyin.internal), whose
// login password was reset 2026-09-08 specifically to enable this
// feature, EXCEPT `demo-admin`, which was created fresh that same day
// (an admin persona never existed in the original 32-account seed cast,
// and `role='admin'` can never be set via signup metadata by design --
// see handle_email_confirmed(), SEC-001 -- so it always has to be a
// create-then-promote account, not a reset of something pre-existing).
//
// The actual password is NEVER in this file or any client-shipped code
// -- it lives only in the server-only DEMO_ACCOUNT_PASSWORD env var,
// read by /api/demo-login/route.ts. This file only maps a public,
// URL-safe `key` to which account to sign in as and where to land them,
// so nothing password-shaped ever reaches the browser.
//
// landingUrl is a full external URL, not a relative path, because most
// personas land on a DIFFERENT pillar app than Hub (auth cookies are
// shared at .greyin.net, so a visitor signed in here is already
// authenticated there too -- see lib/supabase/server.ts's COOKIE_DOMAIN).

export type DemoPersona = {
  key: string
  email: string
  label: string
  tagline: string
  landingUrl: string
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    key: 'hannah-kim',
    email: 'hannah-kim@demo.greyin.internal',
    label: 'Hannah Kim',
    tagline: 'Verified-expert candidate — endorsements, a peer project, an active subscription',
    landingUrl: 'https://deepedge.greyin.net/dashboard',
  },
  {
    key: 'miguel-santos',
    email: 'miguel-santos@demo.greyin.internal',
    label: 'Miguel Santos',
    tagline: 'Freelancer with a pending payout — see the earnings & withdrawal flow',
    landingUrl: 'https://flexpro.greyin.net/earnings',
  },
  {
    key: 'marcus-webb',
    email: 'marcus-webb@demo.greyin.internal',
    label: 'Marcus Webb',
    tagline: 'Employer at Northbridge Capital Partners — 3 live job postings',
    landingUrl: 'https://deepedge.greyin.net/employer/dashboard',
  },
  {
    key: 'adrian-costa',
    email: 'adrian-costa@demo.greyin.internal',
    label: 'Adrian Costa',
    tagline: 'GreyMatters author — published posts, AI quality scoring',
    landingUrl: 'https://greymatters.greyin.net/dashboard',
  },
  {
    key: 'demo-admin',
    email: 'demo-admin@demo.greyin.internal',
    label: 'Demo Admin',
    tagline: 'Platform admin — moderation, subscription tiers, cross-pillar reports',
    landingUrl: 'https://greyin.net/admin',
  },
]

export function findDemoPersona(key: string): DemoPersona | undefined {
  return DEMO_PERSONAS.find((p) => p.key === key)
}
