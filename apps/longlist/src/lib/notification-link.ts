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

const OWN_PILLAR = 'longlist'

// See stackworks/deepedge's own notification-link.ts for the full
// rationale -- notifications is one shared table, and n.link is always a
// path relative to whichever app owns that content, not necessarily this
// one. Keep in sync with every `INSERT INTO notifications` site across
// deployment/migrations/*.sql, including 087's two new Longlist types.
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

  const pillar = TYPE_TO_PILLAR[notification.type] ?? OWN_PILLAR

  if (pillar === OWN_PILLAR) {
    return { href: notification.link, external: false }
  }

  const domain = PILLAR_DOMAINS[pillar]
  return { href: domain ? `${domain}${notification.link}` : notification.link, external: true }
}
