import Link from 'next/link'
import { Briefcase, Star, DollarSign, User, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { PILLARS } from '@/components/EcosystemWidget'

const OTHER_PILLARS = PILLARS.filter((p) => p.key !== 'flexpro')

export default async function Home() {
  const supabase = await createClient()

  // The homepage used to be a hero and three stat cards, then nothing --
  // no preview of what's actually for sale. A few real active gigs give
  // a first-time visitor something concrete before asking them to click
  // through to /gigs.
  const { data: featuredGigs } = await supabase
    .from('gigs')
    .select('id, title, price_basic, profiles:freelancer_id ( full_name, seller_rating, total_reviews )')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="bg-gradient-to-r from-orange-600 to-amber-500 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-display text-5xl font-semibold mb-6">Find Freelance Services</h1>
          <p className="text-xl">Connect with talented freelancers for your projects</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <Briefcase className="h-12 w-12 text-orange-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">1000+ Services</h3>
            <p className="text-gray-600">Browse thousands of freelance services</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <Star className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Top Rated</h3>
            <p className="text-gray-600">Work with verified top-rated freelancers</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <DollarSign className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Fair Pricing</h3>
            <p className="text-gray-600">Transparent pricing for all services</p>
          </div>
        </div>
      </div>

      {featuredGigs && featuredGigs.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recently listed</h2>
            <Link href="/gigs" className="text-orange-600 font-semibold text-sm flex items-center gap-1 hover:text-orange-700">
              Browse all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredGigs.map((gig: any) => (
              <Link key={gig.id} href={`/gigs/${gig.id}`} className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6 block">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{gig.profiles?.full_name || 'Freelancer'}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-3 line-clamp-2">{gig.title}</h3>
                <div className="flex items-center justify-between">
                  {gig.profiles?.total_reviews > 0 ? (
                    <span className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      {gig.profiles.seller_rating?.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">New seller</span>
                  )}
                  <span className="font-bold text-gray-900">₹{gig.price_basic?.toLocaleString('en-IN')}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Ecosystem cross-link -- previously only deepedge's homepage
          promoted the other pillars. */}
      <div className="bg-white border-t border-gray-200 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-2">Part of the Greyin ecosystem</p>
            <h2 className="text-3xl font-bold text-gray-900">One login, five more platforms</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {OTHER_PILLARS.map((p) => (
              <a key={p.key} href={p.url} className="block rounded-xl border-2 bg-white hover:shadow-lg transition-shadow p-5" style={{ borderColor: p.color }}>
                <span className="w-2.5 h-2.5 rounded-full inline-block mb-3" style={{ backgroundColor: p.color }} aria-hidden="true" />
                <h3 className="font-bold text-gray-900 mb-1">{p.label}</h3>
                <p className="text-sm text-gray-600">{p.description}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
