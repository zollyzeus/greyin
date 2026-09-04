import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, MapPin, DollarSign, Clock, Briefcase, Users, Calendar, CheckCircle, ArrowLeft, UserPlus } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'

interface JobDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ referred?: string; referError?: string }>
}

async function getJob(id: string) {
  const supabase = await createClient()
  const { data: job } = await supabase
    .from('jobs')
    .select(`
      *,
      companies (
        id,
        name,
        logo_url,
        industry,
        description,
        website,
        size,
        location
      )
    `)
    .eq('id', id)
    .single()
  return job
}

// Competitive audit (Aug 2026): DeepEdge's biggest structural gap vs
// Indeed is reach, not features -- job postings weren't indexable as
// jobs at all. schema.org JobPosting markup is what Google for Jobs
// and other job-search crawlers actually key off; plain meta tags
// alone don't get a listing surfaced there.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = await getJob(id)
  if (!job) return {}
  return {
    title: `${job.title} at ${job.companies?.name || 'a DeepEdge employer'} | DeepEdge`,
    description: job.description?.slice(0, 155) || `${job.title} — apply on DeepEdge.`,
  }
}

export default async function JobDetailPage({ params, searchParams }: JobDetailPageProps) {
  const resolvedParams = await params
  const { referred, referError } = await searchParams
  const supabase = await createClient()

  const job = await getJob(resolvedParams.id)

  if (!job) {
    notFound()
  }

  const jobPostingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    datePosted: job.created_at,
    validThrough: job.expires_at || undefined,
    employmentType: (job.employment_type || 'full-time').toUpperCase().replace('-', '_'),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.companies?.name || 'DeepEdge employer',
      logo: job.companies?.logo_url || undefined,
      sameAs: job.companies?.website || undefined,
    },
    jobLocation: job.location
      ? { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location } }
      : undefined,
    ...(job.salary_disclosed && job.salary_min && job.salary_max
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: job.currency || 'USD',
            value: { '@type': 'QuantitativeValue', minValue: job.salary_min, maxValue: job.salary_max, unitText: 'YEAR' },
          },
        }
      : {}),
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* eslint-disable-next-line react/no-danger */}
      {/* JSON.stringify alone doesn't escape "<" -- an employer-controlled
          field (description, company name/website) containing
          "</script><script>..." would otherwise break out of this tag
          and execute (SEC-012, 2026-08-24 security audit). < is the
          standard mitigation: valid inside a JSON string, never
          interpreted as a tag boundary by the HTML parser. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd).replace(/</g, '\\u003c') }}
      />
      <SiteHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <Link href="/jobs" className="flex items-center text-gray-600 hover:text-blue-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to jobs
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Header */}
            <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-900">
              <div className="flex gap-6">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 dark:bg-gray-800">
                  {job.companies?.logo_url ? (
                    <img src={job.companies.logo_url} alt={job.companies.name} className="w-16 h-16 object-contain" />
                  ) : (
                    <Building2 className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2 dark:text-gray-50">
                    {job.title}
                    {job.open_to_career_changers && (
                      <span className="ml-2 align-middle px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs font-medium dark:bg-orange-950/40 dark:text-orange-400">
                        Open to career changers
                      </span>
                    )}
                    {job.open_to_reentry && (
                      <span className="ml-2 align-middle px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium dark:bg-blue-950/40 dark:text-blue-400">
                        Open to candidates with career gaps
                      </span>
                    )}
                  </h1>
                  {job.companies?.id ? (
                    <Link href={`/companies/${job.companies.id}`} className="text-xl text-gray-600 hover:text-blue-600 mb-4 inline-block dark:text-gray-400">
                      {job.companies.name}
                    </Link>
                  ) : (
                    <p className="text-xl text-gray-600 mb-4 dark:text-gray-400">{job.companies?.name}</p>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-4 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {job.location || 'Remote'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      {job.employment_type || 'Full-time'}
                    </div>
                    {job.salary_min && job.salary_max && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        ${(job.salary_min / 1000).toFixed(0)}k - ${(job.salary_max / 1000).toFixed(0)}k per year
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Posted {new Date(job.created_at).toLocaleDateString()}
                    </div>
                    {job.experience_min && (
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {job.experience_min}+ years experience
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-4">
                <Link
                  href={`/jobs/${job.id}/apply`}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold text-center"
                >
                  Apply Now
                </Link>
                <a href="#refer" className="border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 font-semibold flex items-center gap-2 dark:border-gray-700 dark:hover:bg-gray-800">
                  <UserPlus className="h-4 w-4" />
                  Refer a Friend
                </a>
              </div>
            </div>

            {/* Job Description */}
            <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-900">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 dark:text-gray-50">Job Description</h2>
              <div className="prose max-w-none text-gray-700 whitespace-pre-line dark:text-gray-300">
                {job.description}
              </div>

              {job.requirements && (
                <>
                  <h3 className="text-xl font-bold text-gray-900 mt-8 mb-4 dark:text-gray-50">Requirements</h3>
                  <div className="prose max-w-none text-gray-700 whitespace-pre-line dark:text-gray-300">
                    {job.requirements}
                  </div>
                </>
              )}

              {job.responsibilities && (
                <>
                  <h3 className="text-xl font-bold text-gray-900 mt-8 mb-4 dark:text-gray-50">Responsibilities</h3>
                  <div className="prose max-w-none text-gray-700 whitespace-pre-line dark:text-gray-300">
                    {job.responsibilities}
                  </div>
                </>
              )}

              {job.benefits && (
                <>
                  <h3 className="text-xl font-bold text-gray-900 mt-8 mb-4 dark:text-gray-50">Benefits</h3>
                  <div className="prose max-w-none text-gray-700 whitespace-pre-line dark:text-gray-300">
                    {job.benefits}
                  </div>
                </>
              )}
            </div>

            {/* Skills Required */}
            {job.skills_required && job.skills_required.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-900">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 dark:text-gray-50">Required Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {job.skills_required.map((skill: string) => (
                    <span key={skill} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium dark:bg-blue-950/40 dark:text-blue-400">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Apply Card */}
            <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
              <h3 className="font-bold text-lg mb-4">Apply for this job</h3>
              <Link
                href={`/jobs/${job.id}/apply`}
                className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold text-center mb-3"
              >
                Apply Now
              </Link>
              <p className="text-sm text-gray-600 text-center dark:text-gray-400">
                You'll need to sign in or create an account
              </p>
            </div>

            {/* Refer a Friend */}
            <div id="refer" className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
              <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Know someone great for this?
              </h3>
              <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">Refer a fellow professional — we'll let them know.</p>

              {referred && (
                <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 dark:text-green-400 dark:bg-green-950/40 dark:border-green-900">
                  Thanks — we've let them know.
                </p>
              )}
              {referError && (
                <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:text-red-400 dark:bg-red-950/40 dark:border-red-900">
                  {decodeURIComponent(referError)}
                </p>
              )}

              <form action={`/api/jobs/${job.id}/refer`} method="POST" className="space-y-3">
                <input
                  type="email"
                  name="referred_email"
                  required
                  placeholder="Their email address"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                <textarea
                  name="note"
                  rows={2}
                  placeholder="Optional note (why they'd be a great fit)"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                <button type="submit" className="w-full border border-blue-600 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 font-semibold text-sm dark:text-blue-400 dark:hover:bg-blue-950/40">
                  Send Referral
                </button>
              </form>
            </div>

            {/* Company Info */}
            <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
              <h3 className="font-bold text-lg mb-4">About {job.companies?.name}</h3>
              
              {job.companies?.description && (
                <p className="text-gray-700 mb-4 dark:text-gray-300">{job.companies.description}</p>
              )}

              <div className="space-y-3 text-sm">
                {job.companies?.industry && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Building2 className="h-4 w-4" />
                    <span>{job.companies.industry}</span>
                  </div>
                )}
                {job.companies?.size && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Users className="h-4 w-4" />
                    <span>{job.companies.size} employees</span>
                  </div>
                )}
                {job.companies?.location && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <MapPin className="h-4 w-4" />
                    <span>{job.companies.location}</span>
                  </div>
                )}
              </div>

              {job.companies?.id && (
                <Link
                  href={`/companies/${job.companies.id}`}
                  className="block w-full mt-6 border border-blue-600 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 font-semibold text-center dark:text-blue-400 dark:hover:bg-blue-950/40"
                >
                  View Company Profile
                </Link>
              )}
            </div>

            {/* Job Stats */}
            <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
              <h3 className="font-bold text-lg mb-4">Job Information</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1 dark:text-gray-400">Job Type</p>
                  <p className="font-semibold">{job.employment_type || 'Full-time'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1 dark:text-gray-400">Work Location</p>
                  <p className="font-semibold">{job.location || 'Remote'}</p>
                </div>
                {job.category && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1 dark:text-gray-400">Category</p>
                    <p className="font-semibold">{job.category}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600 mb-1 dark:text-gray-400">Posted</p>
                  <p className="font-semibold">{new Date(job.created_at).toLocaleDateString()}</p>
                </div>
                {job.application_deadline && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1 dark:text-gray-400">Application Deadline</p>
                    <p className="font-semibold">{new Date(job.application_deadline).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
