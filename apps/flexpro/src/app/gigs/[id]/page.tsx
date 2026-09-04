import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Star, Clock, Check, Package, User, ArrowLeft, BadgeCheck, Tag, Award } from 'lucide-react'
import GigReviews from '@/components/GigReviews'
import { FollowButton } from '@/components/FollowButton'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function GigDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  // Get gig details
  const { data: gig } = await supabase
    .from('gigs')
    .select(`
      *,
      seller:profiles!freelancer_id(id, full_name, avatar_url, bio, seller_rating, total_reviews),
      category:gig_categories(name)
    `)
    .eq('id', params.id)
    .single()

  if (!gig || gig.status !== 'active') {
    notFound()
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // StackWorks verified track record -- cross-app read, same pattern as the
  // gigs listing page.
  const { data: verifiedOutcomes } = gig.seller?.id
    ? await supabase.from('verified_outcomes').select('score').eq('subject_user_id', gig.seller.id).eq('status', 'verified')
    : { data: [] }
  const trackRecord = verifiedOutcomes && verifiedOutcomes.length > 0
    ? { count: verifiedOutcomes.length, avgScore: Math.round(verifiedOutcomes.reduce((s, o) => s + (o.score || 0), 0) / verifiedOutcomes.length) }
    : null

  const { data: myFollow } = user && gig.seller?.id
    ? await supabase.from('user_follows').select('followed_id').eq('follower_id', user.id).eq('followed_id', gig.seller.id).maybeSingle()
    : { data: null }

  // FlexPro "Top Tier" badge -- same auto-threshold read as
  // sellers/[id], surfaced here too since this is where a client
  // actually decides whether to hire.
  const { data: scoreRow } = gig.seller?.id
    ? await supabase.from('greyin_scores').select('is_verified_expert, flexpro_score, flexpro_evidence').eq('user_id', gig.seller.id).maybeSingle()
    : { data: null }
  const isTopTier = !!(
    scoreRow?.is_verified_expert &&
    (scoreRow.flexpro_score ?? 0) >= 85 &&
    (scoreRow.flexpro_evidence ?? 0) >= 3
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b sticky top-0 z-10 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/gigs" className="text-orange-600 hover:text-orange-700 flex items-center gap-2 dark:text-orange-400 dark:hover:text-orange-300">
            <ArrowLeft className="w-5 h-5" />
            Back to Browse Gigs
          </Link>
            <ThemeToggle />
          </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Gig Header */}
            <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2 dark:text-gray-400">
                    <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded dark:bg-orange-950/40 dark:text-orange-400">
                      {gig.category?.name}
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-3 dark:text-gray-50">{gig.title}</h1>
                  
                  {/* Seller Info */}
                  <div className="flex items-center gap-3">
                    {gig.seller?.avatar_url ? (
                      <img
                        src={gig.seller.avatar_url}
                        alt={gig.seller.full_name}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white font-semibold">
                        {gig.seller?.full_name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-50">{gig.seller?.full_name}</p>
                      {gig.seller?.seller_rating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">{gig.seller.seller_rating.toFixed(1)}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">({gig.seller.total_reviews})</span>
                        </div>
                      )}
                      {trackRecord && (
                        <div className="flex items-center gap-1 text-xs text-green-700 font-medium mt-0.5 dark:text-green-400">
                          <BadgeCheck className="w-3.5 h-3.5" />
                          {trackRecord.count} verified on StackWorks · avg {trackRecord.avgScore}/100
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rating Badge */}
                {gig.average_rating > 0 && (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 bg-yellow-50 px-3 py-2 rounded-lg dark:bg-yellow-950/40">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span className="font-bold text-lg">{gig.average_rating.toFixed(1)}</span>
                    </div>
                    <span className="text-sm text-gray-500 mt-1 dark:text-gray-400">
                      {gig.review_count} {gig.review_count === 1 ? 'review' : 'reviews'}
                    </span>
                  </div>
                )}
              </div>

              {/* Gig Image */}
              {gig.images?.[0] && (
                <img
                  src={gig.images[0]}
                  alt={gig.title}
                  className="w-full h-96 object-cover rounded-lg mb-6"
                />
              )}

              {/* Description */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3">About This Gig</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap dark:text-gray-300">{gig.description}</p>
                {gig.tags && gig.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <Tag className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    {gig.tags.map((tag: string) => (
                      <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm dark:bg-gray-800 dark:text-gray-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Packages */}
              <div className="border-t pt-6">
                <h2 className="text-xl font-semibold mb-4">Packages</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Basic Package */}
                  <div className="border rounded-lg p-4 hover:border-orange-500 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg">Basic</h3>
                      <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">₹{gig.basic_price?.toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">{gig.basic_description}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 dark:text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span>{gig.basic_delivery_days} days delivery</span>
                    </div>
                    <Link
                      href={user ? `/checkout/${gig.id}?package=basic` : '/login'}
                      className="block w-full px-4 py-2 bg-orange-600 text-white text-center rounded-lg hover:bg-orange-700 font-medium"
                    >
                      Order Now
                    </Link>
                  </div>

                  {/* Standard Package */}
                  {gig.standard_price && (
                    <div className="border-2 border-orange-500 rounded-lg p-4 relative">
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-semibold">
                          POPULAR
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-lg">Standard</h3>
                        <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">₹{gig.standard_price.toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">{gig.standard_description}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>{gig.standard_delivery_days} days delivery</span>
                      </div>
                      <Link
                        href={user ? `/checkout/${gig.id}?package=standard` : '/login'}
                        className="block w-full px-4 py-2 bg-orange-600 text-white text-center rounded-lg hover:bg-orange-700 font-medium"
                      >
                        Order Now
                      </Link>
                    </div>
                  )}

                  {/* Premium Package */}
                  {gig.premium_price && (
                    <div className="border rounded-lg p-4 hover:border-orange-500 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-lg">Premium</h3>
                        <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">₹{gig.premium_price.toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">{gig.premium_description}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>{gig.premium_delivery_days} days delivery</span>
                      </div>
                      <Link
                        href={user ? `/checkout/${gig.id}?package=premium` : '/login'}
                        className="block w-full px-4 py-2 bg-orange-600 text-white text-center rounded-lg hover:bg-orange-700 font-medium"
                      >
                        Order Now
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Reviews Section */}
            <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
              <GigReviews gigId={gig.id} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Seller Card */}
            <div className="bg-white rounded-lg shadow p-6 sticky top-24 dark:bg-gray-900">
              <h2 className="text-lg font-semibold mb-4">About the Seller</h2>
              <div className="flex items-center gap-3 mb-4">
                {gig.seller?.avatar_url ? (
                  <img
                    src={gig.seller.avatar_url}
                    alt={gig.seller.full_name}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-orange-600 flex items-center justify-center text-white font-semibold text-xl">
                    {gig.seller?.full_name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-lg">{gig.seller?.full_name}</p>
                    {isTopTier && (
                      <span className="flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full dark:bg-amber-950/40 dark:text-amber-400" title="Verified Expert with a demonstrated FlexPro track record">
                        <Award className="w-3 h-3" />
                        Top Tier
                      </span>
                    )}
                  </div>
                  {gig.seller?.seller_rating > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{gig.seller.seller_rating.toFixed(1)}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">({gig.seller.total_reviews})</span>
                    </div>
                  )}
                </div>
              </div>

              {trackRecord && (
                <div className="flex items-center gap-1 text-sm text-green-700 font-medium mb-4 dark:text-green-400">
                  <BadgeCheck className="w-4 h-4" />
                  {trackRecord.count} verified outcome{trackRecord.count === 1 ? '' : 's'} on StackWorks · avg {trackRecord.avgScore}/100
                </div>
              )}

              {gig.seller?.bio && (
                <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">{gig.seller.bio}</p>
              )}

              {gig.seller?.id && (
                <Link
                  href={`/sellers/${gig.seller.id}`}
                  className="block w-full px-4 py-2 border-2 border-orange-600 text-orange-600 text-center rounded-lg hover:bg-orange-50 font-medium dark:text-orange-400 dark:hover:bg-orange-950/40"
                >
                  View Profile
                </Link>
              )}

              {user && gig.seller?.id && user.id !== gig.seller.id && (
                <FollowButton targetUserId={gig.seller.id} isFollowing={!!myFollow} next={`/gigs/${gig.id}`} />
              )}
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
              <h3 className="font-semibold mb-4">Gig Stats</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Orders in Queue</span>
                  <span className="font-semibold">{gig.orders_in_queue || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Reviews</span>
                  <span className="font-semibold">{gig.review_count || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Average Rating</span>
                  <span className="font-semibold">{gig.average_rating ? gig.average_rating.toFixed(1) : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
