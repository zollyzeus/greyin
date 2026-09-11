import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, Package, CreditCard, AlertTriangle, Flag, MessageSquareOff, Telescope, Gift, Users, Scale, MessageSquareWarning, TrendingUp, BadgeCheck } from 'lucide-react'
import { VisitTrendChart } from '@/components/admin/VisitTrendChart'

// New (Phase 3, pitch-readiness plan) -- the consolidated admin panel's
// landing tab: real-time moderation-volume counts across every pillar
// (get_admin_overview_counts(), 141) that no existing report function
// covered, plus quick links into the 4 existing admin-facing report
// functions (bias audit, job-recommendation feedback, market
// intelligence, threshold votes) rather than re-rendering their full
// report bodies here -- each already has a dedicated, purpose-built
// page under the Site-wide tab; duplicating that content would be
// redundant, not consolidating.
export default async function AdminOverviewPage() {
  const supabase = await createClient()
  const { data: counts } = await supabase.rpc('get_admin_overview_counts')
  const { data: visitTrend } = await supabase.rpc('get_page_visit_trend', { p_days: 30 })

  const stats: { label: string; value: number; icon: any; href: string }[] = [
    { label: 'Open jobs', value: counts?.open_jobs ?? 0, icon: Briefcase, href: '/admin/deepedge' },
    { label: 'Active gigs', value: counts?.active_gigs ?? 0, icon: Package, href: '/admin/flexpro' },
    { label: 'Pending payouts', value: counts?.pending_payouts ?? 0, icon: CreditCard, href: '/admin/flexpro' },
    { label: 'Disputed orders', value: counts?.disputed_orders ?? 0, icon: AlertTriangle, href: '/admin/flexpro' },
    { label: 'Flagged discussions', value: counts?.flagged_discussions ?? 0, icon: Flag, href: '/admin/saltnpepper' },
    { label: 'Flagged replies', value: counts?.flagged_replies ?? 0, icon: MessageSquareOff, href: '/admin/saltnpepper' },
    { label: 'Open future roles', value: counts?.open_future_roles ?? 0, icon: Telescope, href: '/admin/longlist' },
    { label: 'Referral conversions', value: counts?.total_referral_conversions ?? 0, icon: Gift, href: '/dashboard' },
    { label: 'Total users', value: counts?.total_users ?? 0, icon: Users, href: '/admin/deepedge' },
  ]

  const reportLinks = [
    { label: 'AI Matching Bias Audit', icon: Scale, href: '/admin/bias-audit' },
    { label: 'Job Recommendation Feedback', icon: MessageSquareWarning, href: '/admin/job-recommendation-feedback' },
    { label: 'Market Intelligence', icon: TrendingUp, href: '/admin/market-intelligence' },
    { label: 'Eligibility Governance', icon: BadgeCheck, href: '/admin/threshold-votes' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">Overview</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Link
              key={s.label}
              href={s.href}
              className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition dark:bg-gray-900"
            >
              <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mb-2" />
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-50">{s.value}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{s.label}</div>
            </Link>
          )
        })}
      </div>

      <div className="bg-white rounded-lg shadow-md p-5 mb-8 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-1">Visits (last 30 days)</h2>
        <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
          Anonymous landing-page visits, tracked with no PII — a path and a timestamp, nothing else.
        </p>
        <VisitTrendChart rows={visitTrend ?? []} />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">Reports</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportLinks.map((r) => {
          const Icon = r.icon
          return (
            <Link
              key={r.label}
              href={r.href}
              className="flex items-center gap-2 bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition dark:bg-gray-900"
            >
              <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-50">{r.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
