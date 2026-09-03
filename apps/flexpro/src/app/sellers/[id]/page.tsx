import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Briefcase, Star, Clock, User, ArrowLeft, BadgeCheck, Award } from 'lucide-react'
import { FollowButton } from '@/components/FollowButton'

/**
 * Minimal read-only seller profile -- built to fix a pre-existing dead
 * link on gigs/[id]/page.tsx ("View Profile" pointed here before this
 * route existed, confirmed 404). No new RLS needed: profiles and gigs
 * already have public-facing SELECT policies covering this.
 */
export default async function SellerProfilePage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: seller } = await supabase
    .from('profiles')
    .select('id, full_name, bio, avatar_url, seller_rating, total_reviews')
    .eq('id', id)
    .single()

  if (!seller) {
    notFound()
  }

  const { data: gigs } = await supabase
    .from('gigs')
    .select('id, title, images, price_min, delivery_days, category:gig_categories(name)')
    .eq('freelancer_id', id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // StackWorks verified track record -- same cross-app read as the gigs
  // listing/detail pages.
  const { data: verifiedOutcomes } = await supabase
    .from('verified_outcomes')
    .select('score')
    .eq('subject_user_id', id)
    .eq('status', 'verified')
  const trackRecord = verifiedOutcomes && verifiedOutcomes.length > 0
    ? { count: verifiedOutcomes.length, avgScore: Math.round(verifiedOutcomes.reduce((s, o) => s + (o.score || 0), 0) / verifiedOutcomes.length) }
    : null

  const { data: myFollow } = user
    ? await supabase.from('user_follows').select('followed_id').eq('follower_id', user.id).eq('followed_id', id).maybeSingle()
    : { data: null }

  // "Worked together" discovery (059_collaborators.sql) -- surfaced
  // here as real evidence, same as StackWorks/Salt & Pepper's own
  // widgets and deepedge's candidate profile page.
  const { data: collaboratorRow } = user
    ? await supabase
        .from('collaborators')
        .select('collaborator_id, pillar, occurred_at')
        .eq('user_id', user.id)
        .eq('collaborator_id', id)
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }
  const PILLAR_LABEL: Record<string, string> = { stackworks: 'StackWorks', flexpro: 'FlexPro' }

  // FlexPro "Top Tier" badge -- addresses the competitive audit's
  // gap against Toptal's screened-admission tier: an auto-threshold
  // read of the existing greyin_scores view (036), not a new manual
  // review workflow. Deliberately stricter than Verified Expert alone
  // (years_experience + composite score) -- requires demonstrated
  // FlexPro-specific evidence, not just general standing.
  const { data: scoreRow } = await supabase
    .from('greyin_scores')
    .select('is_verified_expert, flexpro_score, flexpro_evidence')
    .eq('user_id', id)
    .maybeSingle()
  const isTopTier = !!(
    scoreRow?.is_verified_expert &&
    (scoreRow.flexpro_score ?? 0) >= 85 &&
    (scoreRow.flexpro_evidence ?? 0) >= 3
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/gigs" className="text-orange-600 hover:text-orange-700 flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
            Back to Browse Gigs
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {seller.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.avatar_url} alt={seller.full_name} className="w-20 h-20 rounded-full" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-orange-600 flex items-center justify-center text-white font-semibold text-2xl">
                {seller.full_name?.charAt(0).toUpperCase() || <User className="h-8 w-8" />}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{seller.full_name || 'Seller'}</h1>
                {isTopTier && (
                  <span className="flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full" title="Verified Expert with a demonstrated FlexPro track record">
                    <Award className="w-3.5 h-3.5" />
                    Top Tier
                  </span>
                )}
              </div>
              {seller.seller_rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{seller.seller_rating.toFixed(1)}</span>
                  <span className="text-sm text-gray-500">({seller.total_reviews} reviews)</span>
                </div>
              )}
              {trackRecord && (
                <div className="flex items-center gap-1 text-sm text-green-700 font-medium mt-0.5">
                  <BadgeCheck className="w-4 h-4" />
                  {trackRecord.count} verified on StackWorks · avg {trackRecord.avgScore}/100
                </div>
              )}
            </div>
          </div>

          {seller.bio && <p className="text-gray-700">{seller.bio}</p>}

          {collaboratorRow && (
            <p className="mt-3 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 inline-block">
              You&rsquo;ve worked together via {PILLAR_LABEL[collaboratorRow.pillar] || collaboratorRow.pillar}
              {collaboratorRow.occurred_at && ` · ${new Date(collaboratorRow.occurred_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
            </p>
          )}

          {user && user.id !== seller.id && (
            <div className="mt-3">
              <FollowButton targetUserId={seller.id} isFollowing={!!myFollow} next={`/sellers/${seller.id}`} />
            </div>
          )}
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Gigs</h2>
        {gigs && gigs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gigs.map((gig: any) => (
              <Link
                key={gig.id}
                href={`/gigs/${gig.id}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
              >
                <div className="h-40 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                  {gig.images && gig.images.length > 0 ? (
                    <img src={gig.images[0]} alt={gig.title} className="w-full h-full object-cover" />
                  ) : (
                    <Briefcase className="h-12 w-12 text-gray-300" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{gig.title}</h3>
                  {gig.category && (
                    <span className="inline-block px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs font-medium mb-2">
                      {gig.category.name}
                    </span>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {gig.delivery_days ? `${gig.delivery_days} days` : '—'}
                    </div>
                    {gig.price_min != null && (
                      <div className="font-semibold text-orange-600">From ₹{gig.price_min.toLocaleString()}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm bg-white rounded-lg shadow p-4">No active gigs right now.</p>
        )}
      </div>
    </div>
  )
}
