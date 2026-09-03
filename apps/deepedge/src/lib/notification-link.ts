const PILLAR_DOMAINS: Record<string, string> = {
  deepedge: 'https://deepedge.greyin.net',
  greymatters: 'https://greymatters.greyin.net',
  saltnpepper: 'https://saltnpepper.greyin.net',
  flexpro: 'https://flexpro.greyin.net',
  stackworks: 'https://stackworks.greyin.net',
  longlist: 'https://longlist.greyin.net',
  // Hub itself was never one of the 6 pillar apps this map covers --
  // added for feedback_replied (101), the first notification type a
  // Hub-owned page (/feedback) ever needs to be linked to.
  greyin_hub: 'https://greyin.net',
}

// This app's own pillar tag (matches the key it uses for itself in every
// PILLAR_DOMAINS lookup duplicated across the platform, e.g.
// EcosystemSearchResults.tsx / FeedCard.tsx).
const OWN_PILLAR = 'deepedge'

// notifications is one shared, ecosystem-wide table (017_notifications.sql)
// -- every app's own /notifications page queries it by user only, not by
// pillar, so a user sees every notification they've ever received
// regardless of which app they're currently on. n.link is always a path
// relative to whichever app actually owns that content, not necessarily
// this one -- rendering it as a same-origin <Link> silently 404s whenever
// the two differ. This maps each known notification `type` to the pillar
// that owns its link, so the page can send cross-pillar notifications to
// the right domain instead. Keep in sync with every
// `INSERT INTO notifications` site across deployment/migrations/*.sql.
const TYPE_TO_PILLAR: Record<string, string> = {
  application_new: 'deepedge',
  application_status: 'deepedge',
  job_alert: 'deepedge',
  job_referral: 'deepedge',
  order_status: 'flexpro',
  order_message: 'flexpro',
  payout_status: 'flexpro',
  post_comment: 'greymatters',
  discussion_reply: 'saltnpepper',
  // direct_message's /messages/{id} route is implemented identically on
  // both deepedge and saltnpepper against the same shared
  // conversations/conversation_participants tables (021_direct_messaging.sql)
  // -- either works for any conversation the viewer is part of, via the
  // platform's shared SSO session. Picking saltnpepper as the canonical
  // destination is an arbitrary but consistent choice, not a correctness
  // requirement.
  direct_message: 'saltnpepper',
  project_application_new: 'stackworks',
  project_application_status: 'stackworks',
  verified_outcome_ai_scored: 'stackworks',
  verified_outcome_human_reviewed: 'stackworks',
  project_ask_closed: 'stackworks',
  future_role_subscribed: 'longlist',
  future_role_filled: 'longlist',
  feedback_replied: 'greyin_hub',
}

export function resolveNotificationHref(notification: { type: string; link: string | null }): {
  href: string
  external: boolean
} {
  if (!notification.link) {
    return { href: '#', external: false }
  }

  // Unrecognized type (shouldn't happen with the mapping above kept in
  // sync) -- fall back to the old same-origin behavior rather than
  // guessing a pillar, so this never makes an already-working link worse.
  const pillar = TYPE_TO_PILLAR[notification.type] ?? OWN_PILLAR

  if (pillar === OWN_PILLAR) {
    return { href: notification.link, external: false }
  }

  const domain = PILLAR_DOMAINS[pillar]
  return { href: domain ? `${domain}${notification.link}` : notification.link, external: true }
}
