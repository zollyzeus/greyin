import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, MapPin, DollarSign, Clock, Building2, Search, Filter, BellPlus } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    location?: string
    employment_type?: string | string[]
    remote_type?: string | string[]
    category?: string | string[]
    min_experience?: string
    open_to_career_changers?: string
    open_to_reentry?: string
    sort?: string
  }>
}) {
  const {
    q, location, min_experience, open_to_career_changers, open_to_reentry,
    sort, employment_type, remote_type, category,
  } = await searchParams
  // Checkboxes sharing a name post as either a single string (one checked)
  // or a string array (multiple) depending on how many were checked --
  // normalize to an array either way so .in() below always gets one shape.
  const employmentTypes = Array.isArray(employment_type) ? employment_type : employment_type ? [employment_type] : []
  const remoteTypes = Array.isArray(remote_type) ? remote_type : remote_type ? [remote_type] : []
  const selectedCategories = Array.isArray(category) ? category : category ? [category] : []

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let jobsQuery = supabase
    .from('jobs')
    .select(`
      *,
      companies (
        id,
        name,
        logo_url,
        industry
      )
    `)
    .eq('status', 'open')
    .limit(20)

  if (q) {
    // SEC-022 (2026-08-26 security audit): q feeds directly into this
    // PostgREST .or() filter string as raw, unescaped text -- a comma
    // starts a new OR-condition and parens group conditions. RLS still
    // caps what a successful injection could ever expose, but stripping
    // PostgREST's own DSL-reserved characters here closes the injection
    // itself rather than relying on RLS as the only defense.
    const sanitizedQ = q.replace(/[,()".{}\\]/g, ' ').trim()
    jobsQuery = jobsQuery.or(`title.ilike.%${sanitizedQ}%,description.ilike.%${sanitizedQ}%`)
  }
  if (location) {
    jobsQuery = jobsQuery.ilike('location', `%${location}%`)
  }
  if (employmentTypes.length > 0) {
    jobsQuery = jobsQuery.in('employment_type', employmentTypes)
  }
  if (remoteTypes.length > 0) {
    jobsQuery = jobsQuery.in('remote_type', remoteTypes)
  }
  if (selectedCategories.length > 0) {
    jobsQuery = jobsQuery.in('category', selectedCategories)
  }
  if (min_experience) {
    jobsQuery = jobsQuery.gte('experience_min', parseInt(min_experience, 10))
  }
  if (open_to_career_changers === 'true') {
    jobsQuery = jobsQuery.eq('open_to_career_changers', true)
  }
  if (open_to_reentry === 'true') {
    jobsQuery = jobsQuery.eq('open_to_reentry', true)
  }
  if (sort === 'salary_desc') {
    jobsQuery = jobsQuery.order('salary_max', { ascending: false, nullsFirst: false })
  } else if (sort === 'salary_asc') {
    jobsQuery = jobsQuery.order('salary_min', { ascending: true, nullsFirst: false })
  } else {
    jobsQuery = jobsQuery.order('created_at', { ascending: false })
  }

  const { data: jobs } = await jobsQuery

  const { data: categories } = await supabase
    .from('jobs')
    .select('category')
    .eq('status', 'open')
  
  const uniqueCategories = Array.from(new Set(categories?.map(j => j.category).filter(Boolean)))

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      {/* Search Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-6">Find Your Next Opportunity</h1>
          {/* id referenced by the Filters sidebar's inputs below via the
              form="" attribute -- keeps the sidebar visually separate
              while still submitting as part of this one GET request, so
              a filter change doesn't drop whatever's typed in search. */}
          <form id="job-filters" action="/jobs" method="GET" className="bg-white rounded-lg p-4 flex gap-4 dark:bg-gray-900">
            <div className="flex-1 flex items-center gap-3">
              <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                name="q"
                defaultValue={q || ''}
                placeholder="Job title, skills, or keywords..."
                className="flex-1 outline-none text-gray-900 placeholder-gray-500 dark:text-gray-50 dark:bg-gray-950"
              />
            </div>
            <div className="flex items-center gap-3 border-l pl-4">
              <MapPin className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                name="location"
                defaultValue={location || ''}
                placeholder="Location"
                className="outline-none text-gray-900 placeholder-gray-500 w-48 dark:text-gray-50 dark:bg-gray-950"
              />
            </div>
            <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700">
              Search Jobs
            </button>
          </form>
          {user && (q || location) && (
            <form action="/api/job-alerts/create" method="POST" className="mt-3">
              <input type="hidden" name="keywords" value={q || ''} />
              <input type="hidden" name="location" value={location || ''} />
              <button type="submit" className="flex items-center gap-2 text-sm text-white/90 hover:text-white underline">
                <BellPlus className="h-4 w-4" />
                Get notified about new jobs matching this search
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Filters Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-24 dark:bg-gray-900">
              <div className="flex items-center gap-2 mb-6">
                <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <h2 className="font-semibold text-lg">Filters</h2>
              </div>

              {/* Employment Type -- real jobs.employment_type enum values */}
              <div className="mb-6">
                <h3 className="font-semibold text-sm text-gray-900 mb-3 dark:text-gray-50">Employment Type</h3>
                <div className="space-y-2">
                  {[
                    { value: 'full-time', label: 'Full-time' },
                    { value: 'part-time', label: 'Part-time' },
                    { value: 'contract', label: 'Contract' },
                    { value: 'internship', label: 'Internship' },
                  ].map((type) => (
                    <label key={type.value} className="flex items-center">
                      <input
                        type="checkbox"
                        form="job-filters"
                        name="employment_type"
                        value={type.value}
                        defaultChecked={employmentTypes.includes(type.value)}
                        className="rounded text-indigo-600 mr-2 dark:text-indigo-400 dark:bg-gray-950 dark:text-gray-100"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Experience -- jobs has an experience_min/max range, not a
                  labeled level enum, so this is a "requires at least N
                  years" floor rather than a fixed set of level checkboxes. */}
              <div className="mb-6">
                <h3 className="font-semibold text-sm text-gray-900 mb-3 dark:text-gray-50">Minimum Experience</h3>
                <select
                  form="job-filters"
                  name="min_experience"
                  defaultValue={min_experience || ''}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="">Any</option>
                  <option value="5">5+ years</option>
                  <option value="10">10+ years</option>
                  <option value="15">15+ years</option>
                  <option value="20">20+ years</option>
                </select>
              </div>

              {/* Work Location -- real jobs.remote_type enum values */}
              <div className="mb-6">
                <h3 className="font-semibold text-sm text-gray-900 mb-3 dark:text-gray-50">Work Location</h3>
                <div className="space-y-2">
                  {[
                    { value: 'remote', label: 'Remote' },
                    { value: 'hybrid', label: 'Hybrid' },
                    { value: 'onsite', label: 'On-site' },
                  ].map((loc) => (
                    <label key={loc.value} className="flex items-center">
                      <input
                        type="checkbox"
                        form="job-filters"
                        name="remote_type"
                        value={loc.value}
                        defaultChecked={remoteTypes.includes(loc.value)}
                        className="rounded text-indigo-600 mr-2 dark:text-indigo-400 dark:bg-gray-950 dark:text-gray-100"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{loc.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Category */}
              {uniqueCategories.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-sm text-gray-900 mb-3 dark:text-gray-50">Category</h3>
                  <div className="space-y-2">
                    {uniqueCategories.slice(0, 5).map((cat) => (
                      <label key={cat} className="flex items-center">
                        <input
                          type="checkbox"
                          form="job-filters"
                          name="category"
                          value={cat}
                          defaultChecked={selectedCategories.includes(cat)}
                          className="rounded text-indigo-600 mr-2 dark:text-indigo-400 dark:bg-gray-950 dark:text-gray-100"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Cross-pillar tracks -- makes the hub's /pivoting page's
                  "browse jobs open to career changers" link actually mean
                  something instead of pointing at an unfiltered list. */}
              <div className="mb-6">
                <h3 className="font-semibold text-sm text-gray-900 mb-3 dark:text-gray-50">Cross-pillar tracks</h3>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      form="job-filters"
                      name="open_to_career_changers"
                      value="true"
                      defaultChecked={open_to_career_changers === 'true'}
                      className="rounded text-indigo-600 mr-2 dark:text-indigo-400 dark:bg-gray-950 dark:text-gray-100"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Open to career changers</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      form="job-filters"
                      name="open_to_reentry"
                      value="true"
                      defaultChecked={open_to_reentry === 'true'}
                      className="rounded text-indigo-600 mr-2 dark:text-indigo-400 dark:bg-gray-950 dark:text-gray-100"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Open to candidates with career gaps</span>
                  </label>
                </div>
              </div>

              <button form="job-filters" type="submit" className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-indigo-700 mb-2">
                Apply Filters
              </button>
              <Link href="/jobs" className="block w-full text-center text-sm text-indigo-600 hover:text-indigo-700 font-semibold dark:text-indigo-400 dark:hover:text-indigo-300">
                Reset Filters
              </Link>
            </div>
          </aside>

          {/* Job Listings */}
          <div className="flex-1">
            <div className="mb-6 flex justify-between items-center">
              <p className="text-gray-600 dark:text-gray-400">
                {jobs?.length || 0} jobs found
              </p>
              {/* Server Component -- no client JS here, so this submits via
                  the shared "Apply Filters"/"Search Jobs" buttons like
                  every other filter, not on change. */}
              <select
                form="job-filters"
                name="sort"
                defaultValue={sort || 'recent'}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                <option value="recent">Most Recent</option>
                <option value="salary_desc">Salary: High to Low</option>
                <option value="salary_asc">Salary: Low to High</option>
              </select>
            </div>

            <div className="space-y-4">
              {jobs && jobs.length > 0 ? (
                jobs.map((job: any) => (
                  <div
                    key={job.id}
                    className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6 dark:bg-gray-900"
                  >
                    <div className="flex justify-between items-start">
                      <Link href={`/jobs/${job.id}`} className="flex gap-4 flex-1">
                        {/* Company Logo */}
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 dark:bg-gray-800">
                          {job.companies?.logo_url ? (
                            <img src={job.companies.logo_url} alt={job.companies.name} className="w-12 h-12 object-contain" />
                          ) : (
                            <Building2 className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                          )}
                        </div>

                        {/* Job Info */}
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-1 hover:text-indigo-600 dark:text-gray-50">
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
                          </h3>
                          <p className="text-gray-600 mb-3 dark:text-gray-400">{job.companies?.name}</p>

                          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3 dark:text-gray-400">
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
                                ${(job.salary_min / 1000).toFixed(0)}k - ${(job.salary_max / 1000).toFixed(0)}k
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {new Date(job.created_at).toLocaleDateString()}
                            </div>
                          </div>

                          <p className="text-gray-700 line-clamp-2 dark:text-gray-300">{job.description}</p>

                          {/* Tags */}
                          {job.skills_required && job.skills_required.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {job.skills_required.slice(0, 5).map((skill: string) => (
                                <span key={skill} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium dark:bg-indigo-950/40 dark:text-indigo-400">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </Link>

                      {/* Separate control, not nested inside the card's own
                          Link -- it used to sit inside it, so clicking
                          "Apply Now" and clicking anywhere else on the card
                          did the same thing (and a <button> nested in an
                          <a> is invalid HTML besides). */}
                      <Link
                        href={`/jobs/${job.id}/apply`}
                        className="ml-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-semibold whitespace-nowrap"
                      >
                        Apply Now
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-lg shadow-md p-12 text-center dark:bg-gray-900">
                  <Briefcase className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 dark:text-gray-50">No jobs found</h3>
                  <p className="text-gray-600 dark:text-gray-400">Try adjusting your filters or search criteria</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
