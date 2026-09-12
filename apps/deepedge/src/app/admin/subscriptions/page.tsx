import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

const SERVICE_LABELS: Record<string, { label: string; className: string }> = {
  subscription: { label: 'Candidate Search', className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400' },
  fractional_leadership: { label: 'Fractional Leadership', className: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400' },
  outplacement: { label: 'Outplacement', className: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' },
  general: { label: 'General Inquiry', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { success, error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/subscriptions')
  }

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: leads } = await supabase
    .from('enterprise_leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: subscriptions } = await supabase
    .from('company_subscriptions')
    .select('*, companies ( name ), subscription_plans ( name, tier )')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <WorkspaceShell
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      role={profile?.role}
      pageTitle="Admin · Subscriptions"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <Link href="/admin" className="flex items-center text-gray-600 hover:text-indigo-600 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Link>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Enterprise Subscriptions</h1>
          <Link href="/admin/subscription-tiers" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
            Hiring tiers & credits →
          </Link>
        </div>

        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            {success === 'contacted' ? 'Lead marked as contacted.' : 'Subscription activated.'}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {decodeURIComponent(error)}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 dark:text-gray-50">Enterprise Leads</h2>
          {leads && leads.length > 0 ? (
            <div className="divide-y">
              {leads.map((lead) => {
                const service = SERVICE_LABELS[lead.service_type] || SERVICE_LABELS.subscription
                return (
                  <div key={lead.id} className="py-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-50">{lead.company_name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${service.className}`}>
                          {service.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {lead.contact_name} · {lead.contact_email}{lead.team_size ? ` · ${lead.team_size}` : ''}
                      </p>
                      {lead.message && <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">{lead.message}</p>}
                      <p className="text-xs text-gray-400 mt-1 capitalize dark:text-gray-500">
                        {lead.status} · {new Date(lead.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {lead.status !== 'converted' && lead.status !== 'contacted' && (
                      lead.service_type === 'subscription' && lead.company_id ? (
                        <form action="/api/admin/subscriptions/activate" method="POST" className="flex items-center gap-2 shrink-0">
                          <input type="hidden" name="company_id" value={lead.company_id} />
                          <input type="hidden" name="lead_id" value={lead.id} />
                          <select name="months" defaultValue="12" className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                            <option value="1">1 month</option>
                            <option value="6">6 months</option>
                            <option value="12">12 months</option>
                          </select>
                          <button type="submit" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap dark:text-indigo-400 dark:hover:text-indigo-300">
                            Activate
                          </button>
                        </form>
                      ) : (
                        <form action="/api/admin/enterprise-leads/mark-contacted" method="POST" className="shrink-0">
                          <input type="hidden" name="lead_id" value={lead.id} />
                          <button type="submit" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap dark:text-indigo-400 dark:hover:text-indigo-300">
                            Mark Contacted
                          </button>
                        </form>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No leads yet.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 dark:text-gray-50">Company Subscriptions</h2>
          {subscriptions && subscriptions.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b dark:text-gray-400">
                  <th className="py-2 font-medium">Company</th>
                  <th className="font-medium">Plan</th>
                  <th className="font-medium">Status</th>
                  <th className="font-medium">Period End</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s: any) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2">{s.companies?.name || '—'}</td>
                    <td className="capitalize">{s.subscription_plans?.tier || '—'}</td>
                    <td className="capitalize">{s.status}</td>
                    <td>{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No subscriptions yet.</p>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}
