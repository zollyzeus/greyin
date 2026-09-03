import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, MapPin, Users, Globe, ArrowLeft, Briefcase, Star } from 'lucide-react'

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { id } = await params
  const { success, error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  if (!company) {
    notFound()
  }

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, location, employment_type, created_at')
    .eq('company_id', id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  // Anonymous by design (058_company_reviews.sql) -- reviewer_id is
  // deliberately never selected here.
  const { data: reviews } = await supabase
    .from('company_reviews')
    .select('id, rating, review_text, created_at')
    .eq('company_id', id)
    .order('created_at', { ascending: false })
  const reviewCount = reviews?.length || 0
  const avgRating = reviewCount > 0 ? (reviews!.reduce((sum, r) => sum + r.rating, 0) / reviewCount) : null

  // Eligibility mirrors the RLS policy exactly -- only shown as a form
  // when it would actually succeed.
  let canReview = false
  let alreadyReviewed = false
  if (user) {
    const { data: candidate } = await supabase.from('candidates').select('id').eq('user_id', user.id).maybeSingle()
    if (candidate) {
      const { data: eligibleApp } = await supabase
        .from('applications')
        .select('id, jobs!inner(company_id)')
        .eq('candidate_id', candidate.id)
        .eq('jobs.company_id', id)
        .limit(1)
        .maybeSingle()
      canReview = !!eligibleApp
    }
    if (canReview) {
      // reviewer_id has no general SELECT grant (065's anonymity fix) --
      // this narrow RPC lets a user check only their own membership
      // without that column ever being broadly readable.
      const { data: reviewed } = await supabase.rpc('has_reviewed_company', { p_company_id: id })
      alreadyReviewed = !!reviewed
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-2xl font-bold">DeepEdge</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/companies" className="flex items-center text-gray-600 hover:text-blue-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to companies
        </Link>

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Review submitted. Thanks for sharing.
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-16 h-16 object-contain" />
              ) : (
                <Building2 className="h-10 w-10 text-gray-400" />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
              {company.industry && <p className="text-gray-600 mt-1">{company.industry}</p>}
              {avgRating != null && (
                <p className="flex items-center gap-1 text-sm text-amber-600 font-medium mt-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {avgRating.toFixed(1)} &middot; {reviewCount} review{reviewCount === 1 ? '' : 's'}
                </p>
              )}
            </div>
          </div>

          {company.description && (
            <p className="text-gray-700 mt-6">{company.description}</p>
          )}

          <div className="flex flex-wrap gap-6 mt-6 text-sm text-gray-600">
            {company.location && (
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{company.location}</span>
            )}
            {company.size && (
              <span className="flex items-center gap-1"><Users className="h-4 w-4" />{company.size} employees</span>
            )}
            {company.website && (
              <a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
                <Globe className="h-4 w-4" />{company.website}
              </a>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Open Positions</h2>
          {jobs && jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">{job.title}</h3>
                    <p className="text-sm text-gray-600">{job.location || 'Remote'} • {job.employment_type}</p>
                  </div>
                  <Briefcase className="h-5 w-5 text-gray-400" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No open positions right now.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-8 mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Reviews</h2>
          <p className="text-sm text-gray-500 mb-4">
            Only from candidates who actually applied here &mdash; shown anonymously.
          </p>

          {canReview && !alreadyReviewed && (
            <form action={`/api/companies/${id}/reviews/create`} method="POST" className="border border-gray-200 rounded-lg p-4 mb-6 space-y-3">
              <div>
                <label htmlFor="rating" className="block text-sm font-medium text-gray-700 mb-1">Your rating</label>
                <select id="rating" name="rating" required defaultValue="" className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="" disabled>Select a rating</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>{n} star{n === 1 ? '' : 's'}</option>
                  ))}
                </select>
              </div>
              <textarea
                name="review_text"
                rows={3}
                placeholder="What was your experience applying here? (optional)"
                className="w-full border border-gray-300 rounded-lg p-3 text-sm"
              />
              <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold">
                Submit review
              </button>
            </form>
          )}
          {alreadyReviewed && (
            <p className="text-sm text-gray-500 mb-6">You&rsquo;ve already reviewed this company.</p>
          )}

          {reviews && reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-4 w-4 ${n <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                    ))}
                    <span className="text-xs text-gray-400 ml-2">{new Date(review.created_at).toLocaleDateString()}</span>
                  </div>
                  {review.review_text && <p className="text-sm text-gray-700">{review.review_text}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No reviews yet.</p>
          )}
        </div>
      </div>
    </main>
  )
}
