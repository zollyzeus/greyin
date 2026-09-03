import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, MapPin, Clock } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { createClient } from '@/lib/supabase/server'

const TIMEFRAME_LABEL: Record<string, string> = {
  '3_months': '~3 months out',
  '6_months': '~6 months out',
  '9_months': '~9 months out',
  '12_months': '~12 months out',
}

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/roles/${id}`)

  const { data: role } = await supabase
    .from('future_roles_public')
    .select('id, title, function_area, seniority_level, target_timeframe, description, skills, location, is_remote, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!role) notFound()

  const { data: sub } = await supabase
    .from('future_role_subscriptions')
    .select('id')
    .eq('future_role_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  const subscribed = !!sub

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/roles" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-amber-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Future Roles
        </Link>

        <div className="bg-white rounded-xl border border-gray-200 p-7">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-700 inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {TIMEFRAME_LABEL[role.target_timeframe] ?? role.target_timeframe}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-3 mb-1">{role.title}</h1>
          <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-5">
            {role.seniority_level && <span>{role.seniority_level}</span>}
            {role.function_area && <span>&middot; {role.function_area}</span>}
            {role.location && (
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{role.location}{role.is_remote ? ' (remote ok)' : ''}</span>
            )}
          </div>

          <p className="text-gray-700 whitespace-pre-wrap mb-5">{role.description}</p>

          {role.skills && role.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6">
              {role.skills.map((s: string) => (
                <span key={s} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{s}</span>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 mb-5">Who posted this stays hidden — that&rsquo;s the whole point of Longlist.</p>

          <form action={`/api/future-roles/${role.id}/${subscribed ? 'unsubscribe' : 'subscribe'}`} method="POST">
            <button
              type="submit"
              className={
                subscribed
                  ? 'w-full py-3 rounded-lg border border-amber-700 text-amber-700 hover:bg-amber-50 font-semibold'
                  : 'w-full py-3 rounded-lg bg-amber-700 text-white hover:bg-amber-800 font-semibold'
              }
            >
              {subscribed ? "You're future-interested — click to withdraw" : "I'm future-interested"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
