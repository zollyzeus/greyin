import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, ArrowLeft, GraduationCap } from 'lucide-react'

export default async function MentorSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ mentor?: string }>
}) {
  const { mentor } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('gigs')
    .select('id, title, description, price_min, seller:profiles!freelancer_id(full_name)')
    .eq('is_mentor_session', true)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (mentor) {
    query = query.eq('freelancer_id', mentor)
  }
  const { data: gigs } = await query

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Briefcase className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-2xl font-bold">FlexPro</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <GraduationCap className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Mentor Sessions</h1>
        </div>

        {gigs && gigs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {gigs.map((gig: any) => (
              <Link
                key={gig.id}
                href={`/mentor-sessions/${gig.id}`}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
              >
                <h3 className="font-semibold text-gray-900 mb-1">{gig.title}</h3>
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{gig.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">with {gig.seller?.full_name || 'a mentor'}</span>
                  <span className="font-semibold text-indigo-600">
                    {gig.price_min > 0 ? `₹${gig.price_min.toLocaleString()}` : 'Free'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <GraduationCap className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No mentor sessions available yet</h3>
          </div>
        )}
      </div>
    </main>
  )
}
