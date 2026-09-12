import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

const SERVICE_COPY: Record<string, { heading: string; blurb: string; backHref: string; backLabel: string }> = {
  subscription: {
    heading: 'Talk to sales',
    blurb: "Enterprise access is invoiced, not charged to a card — tell us about your team and we'll follow up with terms.",
    backHref: '/pricing',
    backLabel: 'Back to Pricing',
  },
  fractional_leadership: {
    heading: 'Fractional Leadership Placement',
    blurb: "Need a CTO, VP Engineering, or Head of Product a few days a week? Tell us what you need and we'll match you with a Verified Expert.",
    backHref: '/solutions',
    backLabel: 'Back to Solutions',
  },
  outplacement: {
    heading: 'Outplacement',
    blurb: "Tell us about your team and timeline, and we'll put together an outplacement package that connects departing employees into the Verified Expert ecosystem.",
    backHref: '/solutions',
    backLabel: 'Back to Solutions',
  },
  general: {
    heading: 'Talk to sales',
    blurb: "Tell us what you're looking for and we'll follow up.",
    backHref: '/solutions',
    backLabel: 'Back to Solutions',
  },
}

export default async function EnterpriseContactPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; service?: string }>
}) {
  const { success, error, service: serviceParam } = await searchParams
  const service = SERVICE_COPY[serviceParam || ''] ? serviceParam! : 'subscription'
  const copy = SERVICE_COPY[service]

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/enterprise-contact${serviceParam ? `?service=${serviceParam}` : ''}`)}`)
  }

  const { data: profile } = await supabase.from('profiles').select('role, full_name, email').eq('id', user.id).single()
  if (profile?.role !== 'employer') {
    redirect('/dashboard')
  }

  const { data: company } = await supabase.from('companies').select('id, name').eq('user_id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  return (
    <WorkspaceShell
      variant="employer"
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      role={profile?.role}
      pageTitle={copy.heading}
    >
      <div className="max-w-lg mx-auto px-4 py-12">
        <Link href={copy.backHref} className="flex items-center gap-2 mb-6 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
          <ArrowLeft className="w-4 h-4" />
          <span>{copy.backLabel}</span>
        </Link>
        {success ? (
          <div className="bg-white rounded-lg shadow p-8 text-center dark:bg-gray-900">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4 dark:text-green-400" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2 dark:text-gray-50">Request received</h1>
            <p className="text-gray-600 dark:text-gray-400">Our team will reach out to {profile?.email || user.email} shortly to discuss terms and get you set up.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 dark:bg-gray-900">
            <h1 className="text-2xl font-bold text-gray-900 mb-2 dark:text-gray-50">{copy.heading}</h1>
            <p className="text-gray-600 mb-6 dark:text-gray-400">{copy.blurb}</p>

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
                {decodeURIComponent(error)}
              </div>
            )}

            <form action="/api/enterprise-leads/create" method="POST" className="space-y-4">
              <div>
                <label htmlFor="service_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">What are you interested in?</label>
                <select
                  id="service_type" name="service_type" defaultValue={service}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="subscription">Candidate search subscription</option>
                  <option value="fractional_leadership">Fractional leadership placement</option>
                  <option value="outplacement">Outplacement</option>
                  <option value="general">Not sure / general inquiry</option>
                </select>
              </div>
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company name</label>
                <input
                  id="company_name" name="company_name" type="text" required defaultValue={company?.name || ''}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="contact_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Your name</label>
                <input
                  id="contact_name" name="contact_name" type="text" required defaultValue={profile?.full_name || ''}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Work email</label>
                <input
                  id="contact_email" name="contact_email" type="email" required defaultValue={profile?.email || user.email || ''}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="team_size" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Team / headcount size</label>
                <select
                  id="team_size" name="team_size" defaultValue=""
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="">Prefer not to say</option>
                  <option value="1-5">1-5</option>
                  <option value="6-20">6-20</option>
                  <option value="21-50">21-50</option>
                  <option value="50+">50+</option>
                </select>
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tell us more</label>
                <textarea
                  id="message" name="message" rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700">
                Request a callback
              </button>
            </form>
          </div>
        )}
      </div>
    </WorkspaceShell>
  )
}
