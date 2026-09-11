import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, Star, DollarSign, Clock, Filter, Search, User, BadgeCheck } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'

const PRICE_RANGES: Record<string, { min?: number; max?: number }> = {
  under_1000: { max: 1000 },
  '1000_5000': { min: 1000, max: 5000 },
  '5000_10000': { min: 5000, max: 10000 },
  over_10000: { min: 10000 },
}

const DELIVERY_MAX_DAYS: Record<string, number> = {
  '1': 1,
  '3': 3,
  '7': 7,
}

export default async function GigsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    category?: string | string[]
    price?: string | string[]
    delivery?: string | string[]
    sort?: string
  }>
}) {
  const { q, category, price, delivery, sort } = await searchParams
  // Checkboxes sharing a name post as either a single string (one checked)
  // or a string array (multiple), matching the same normalization used on
  // deepedge's jobs/page.tsx.
  const selectedCategories = Array.isArray(category) ? category : category ? [category] : []
  const selectedPriceRanges = Array.isArray(price) ? price : price ? [price] : []
  const selectedDelivery = Array.isArray(delivery) ? delivery : delivery ? [delivery] : []

  const supabase = await createClient()

  let gigsQuery = supabase
    .from('gigs')
    .select(`
      *,
      profiles:freelancer_id (
        id,
        full_name,
        avatar_url,
        seller_rating,
        total_reviews
      ),
      gig_categories (
        name
      )
    `)
    .eq('status', 'active')
    .eq('is_mentor_session', false)
    .limit(20)

  if (q) {
    // SEC-022 (2026-08-26 security audit): q feeds directly into this
    // PostgREST .or() filter string as raw, unescaped text -- a comma
    // starts a new OR-condition and parens group conditions. RLS still
    // caps what a successful injection could ever expose, but stripping
    // PostgREST's own DSL-reserved characters here closes the injection
    // itself rather than relying on RLS as the only defense.
    const sanitizedQ = q.replace(/[,()".{}\\]/g, ' ').trim()
    gigsQuery = gigsQuery.or(`title.ilike.%${sanitizedQ}%,description.ilike.%${sanitizedQ}%`)
  }
  if (selectedCategories.length > 0) {
    gigsQuery = gigsQuery.in('category_id', selectedCategories)
  }
  if (selectedPriceRanges.length > 0) {
    // Ranges are ORs of each other (checking "Under ₹1,000" AND
    // "₹10,000+" should show gigs in either band) -- Supabase's query
    // builder doesn't give a clean way to OR several .gte/.lte pairs, so
    // build the combined .or() filter string directly, matching this
    // app's own existing q/description .or() pattern above.
    const clauses = selectedPriceRanges
      .map((key) => PRICE_RANGES[key])
      .filter(Boolean)
      .map(({ min, max }) => {
        if (min != null && max != null) return `and(price_min.gte.${min},price_min.lte.${max})`
        if (min != null) return `price_min.gte.${min}`
        if (max != null) return `price_min.lte.${max}`
        return null
      })
      .filter(Boolean)
    if (clauses.length > 0) {
      gigsQuery = gigsQuery.or(clauses.join(','))
    }
  }
  // "Anytime" is a superset of every other option, so checking it
  // alongside anything else just means "no delivery filter" -- rather
  // than express that as an OR, treat its presence as skipping this
  // filter entirely.
  if (selectedDelivery.length > 0 && !selectedDelivery.includes('any')) {
    const days = selectedDelivery.map((d) => DELIVERY_MAX_DAYS[d]).filter((n): n is number => n != null)
    if (days.length > 0) {
      gigsQuery = gigsQuery.lte('delivery_days', Math.max(...days))
    }
  }
  if (sort === 'price_asc') {
    gigsQuery = gigsQuery.order('price_min', { ascending: true, nullsFirst: false })
  } else if (sort === 'price_desc') {
    gigsQuery = gigsQuery.order('price_min', { ascending: false, nullsFirst: false })
  } else if (sort === 'newest') {
    gigsQuery = gigsQuery.order('created_at', { ascending: false })
  } else if (sort === 'best_selling') {
    gigsQuery = gigsQuery.order('orders_count', { ascending: false, nullsFirst: false })
  } else {
    gigsQuery = gigsQuery.order('created_at', { ascending: false })
  }

  const { data: gigs } = await gigsQuery

  // StackWorks verified track record, cross-referenced by freelancer id --
  // flexpro doesn't own this table (it's stackworks's), same cross-app
  // read pattern stackworks already uses against saltnpepper's
  // builder_projects. Best-effort: a freelancer with zero stackworks
  // activity just shows nothing extra.
  const freelancerIds = [...new Set((gigs || []).map((g: any) => g.profiles?.id).filter(Boolean))]
  const { data: verifiedOutcomes } = freelancerIds.length
    ? await supabase.from('verified_outcomes').select('subject_user_id, score').in('subject_user_id', freelancerIds).eq('status', 'verified')
    : { data: [] }
  const trackRecordByUser = new Map<string, { count: number; avgScore: number }>()
  for (const id of freelancerIds) {
    const rows = (verifiedOutcomes || []).filter((o) => o.subject_user_id === id)
    if (rows.length > 0) {
      trackRecordByUser.set(id, { count: rows.length, avgScore: Math.round(rows.reduce((s, r) => s + (r.score || 0), 0) / rows.length) })
    }
  }

  const { data: categories } = await supabase
    .from('gig_categories')
    .select('*')
    .order('name')

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      {/* Hero */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">Find Freelance Services</h1>
          <p className="text-xl opacity-90 mb-6">Browse thousands of services from talented freelancers</p>
          
          {/* id referenced by the Filters sidebar's inputs below via the
              form="" attribute -- keeps the sidebar visually separate
              while still submitting as part of this one GET request. */}
          <form id="gig-filters" action="/gigs" method="GET" className="bg-white rounded-lg p-4 flex gap-4 max-w-3xl dark:bg-gray-900 focus-within:ring-2 focus-within:ring-orange-500">
            <div className="flex-1 flex items-center gap-3">
              <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                name="q"
                defaultValue={q || ''}
                placeholder="Search for services..."
                className="flex-1 outline-none text-gray-900 placeholder-gray-500 dark:text-gray-50 dark:bg-gray-950"
              />
            </div>
            <button type="submit" className="bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-700">
              Search
            </button>
          </form>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-8 max-w-2xl">
            <div>
              <div className="text-3xl font-bold">1,000+</div>
              <div className="text-sm opacity-90">Active Gigs</div>
            </div>
            <div>
              <div className="text-3xl font-bold">0%</div>
              <div className="text-sm opacity-90">Platform Fee</div>
            </div>
            <div>
              <div className="text-3xl font-bold">500+</div>
              <div className="text-sm opacity-90">Freelancers</div>
            </div>
          </div>
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

              {/* Categories */}
              {categories && categories.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-sm text-gray-900 mb-3 dark:text-gray-50">Category</h3>
                  <div className="space-y-2">
                    {categories.map((cat: any) => (
                      <label key={cat.id} className="flex items-center">
                        <input
                          type="checkbox"
                          form="gig-filters"
                          name="category"
                          value={cat.id}
                          defaultChecked={selectedCategories.includes(cat.id)}
                          className="rounded text-orange-600 mr-2 dark:text-orange-400 dark:bg-gray-950 dark:text-gray-100"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Price Range -- real gigs.price_min/price_max columns */}
              <div className="mb-6">
                <h3 className="font-semibold text-sm text-gray-900 mb-3 dark:text-gray-50">Price Range</h3>
                <div className="space-y-2">
                  {[
                    { value: 'under_1000', label: 'Under ₹1,000' },
                    { value: '1000_5000', label: '₹1,000 - ₹5,000' },
                    { value: '5000_10000', label: '₹5,000 - ₹10,000' },
                    { value: 'over_10000', label: '₹10,000+' },
                  ].map((range) => (
                    <label key={range.value} className="flex items-center">
                      <input
                        type="checkbox"
                        form="gig-filters"
                        name="price"
                        value={range.value}
                        defaultChecked={selectedPriceRanges.includes(range.value)}
                        className="rounded text-orange-600 mr-2 dark:text-orange-400 dark:bg-gray-950 dark:text-gray-100"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{range.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Delivery Time -- real gigs.delivery_days column */}
              <div className="mb-6">
                <h3 className="font-semibold text-sm text-gray-900 mb-3 dark:text-gray-50">Delivery Time</h3>
                <div className="space-y-2">
                  {[
                    { value: '1', label: '24 hours' },
                    { value: '3', label: '3 days' },
                    { value: '7', label: '1 week' },
                    { value: 'any', label: 'Anytime' },
                  ].map((time) => (
                    <label key={time.value} className="flex items-center">
                      <input
                        type="checkbox"
                        form="gig-filters"
                        name="delivery"
                        value={time.value}
                        defaultChecked={selectedDelivery.includes(time.value)}
                        className="rounded text-orange-600 mr-2 dark:text-orange-400 dark:bg-gray-950 dark:text-gray-100"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{time.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button form="gig-filters" type="submit" className="w-full bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-orange-700 mb-2">
                Apply Filters
              </button>
              <Link href="/gigs" className="block w-full text-center text-sm text-orange-600 hover:text-orange-700 font-semibold dark:text-orange-400 dark:hover:text-orange-300">
                Reset Filters
              </Link>
            </div>
          </aside>

          {/* Gig Listings */}
          <div className="flex-1">
            <div className="mb-6 flex justify-between items-center">
              <p className="text-gray-600 dark:text-gray-400">
                {gigs?.length || 0} services available
              </p>
              {/* Server Component -- no client JS here, so this submits via
                  the shared Search/Apply Filters buttons, not on change. */}
              <select
                form="gig-filters"
                name="sort"
                defaultValue={sort || 'recommended'}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                <option value="recommended">Recommended</option>
                <option value="best_selling">Best Selling</option>
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>

            {/* 0% Commission Banner */}
            <div className="bg-gradient-to-r from-green-50 to-orange-50 border border-green-200 rounded-lg p-6 mb-6 dark:border-green-900 dark:from-gray-950 dark:to-gray-900">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center dark:bg-green-950/40">
                  <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1 dark:text-gray-50">
                    0% Platform Fee - Keep 100% of Your Earnings!
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    Only ~2% Razorpay processing fee. No hidden charges. Built for verified experts across the Greyin ecosystem.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gigs && gigs.length > 0 ? (
                gigs.map((gig: any) => (
                  <Link
                    key={gig.id}
                    href={`/gigs/${gig.id}`}
                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition dark:bg-gray-900"
                  >
                    {/* Gig Image */}
                    <div className="h-48 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center dark:from-gray-950 dark:to-gray-900">
                      {gig.images && gig.images.length > 0 ? (
                        <img src={gig.images[0]} alt={gig.title} className="w-full h-full object-cover" />
                      ) : (
                        <Briefcase className="h-16 w-16 text-gray-300" />
                      )}
                    </div>

                    <div className="p-4">
                      {/* Seller Info */}
                      <div className="flex items-center gap-2 mb-3">
                        {gig.profiles?.avatar_url ? (
                          <img src={gig.profiles.avatar_url} alt={gig.profiles.full_name} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{gig.profiles?.full_name || 'Anonymous'}</span>
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 h-12 dark:text-gray-50">
                        {gig.title}
                      </h3>

                      {/* Category */}
                      {gig.gig_categories && (
                        <span className="inline-block px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs font-medium mb-3 dark:bg-orange-950/40 dark:text-orange-400">
                          {gig.gig_categories.name}
                        </span>
                      )}

                      {/* Rating -- real seller_rating/total_reviews, not a placeholder */}
                      <div className="flex items-center gap-1 mb-2">
                        {gig.profiles?.total_reviews > 0 ? (
                          <>
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="text-sm font-semibold">{gig.profiles.seller_rating?.toFixed(1)}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">({gig.profiles.total_reviews})</span>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">New seller</span>
                        )}
                      </div>

                      {/* StackWorks verified track record, if any */}
                      <div className="mb-3">
                        {trackRecordByUser.get(gig.profiles?.id) && (
                          <div className="flex items-center gap-1 text-xs text-green-700 font-medium dark:text-green-400">
                            <BadgeCheck className="h-3.5 w-3.5" />
                            {trackRecordByUser.get(gig.profiles.id)!.count} verified on StackWorks · avg {trackRecordByUser.get(gig.profiles.id)!.avgScore}/100
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="flex items-center gap-1 text-gray-600 text-sm dark:text-gray-400">
                          <Clock className="h-4 w-4" />
                          {gig.delivery_days} days delivery
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600 dark:text-gray-400">Starting at</div>
                          <div className="text-lg font-bold text-gray-900 dark:text-gray-50">
                            {/* gigs has price_min/price_max, not price_basic
                                (that column doesn't exist) -- this was
                                silently rendering blank for every gig. */}
                            ₹{gig.price_min?.toLocaleString('en-IN') ?? '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="col-span-3 bg-white rounded-lg shadow-md p-12 text-center dark:bg-gray-900">
                  <Briefcase className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 dark:text-gray-50">No gigs found</h3>
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
