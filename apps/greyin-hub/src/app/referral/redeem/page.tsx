import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { Gift, CheckCircle2 } from 'lucide-react'

// Landing page for a shared referral link (?code=X). A code survives an
// unauthenticated visitor going through signup/email-confirm/login and
// back unchanged -- so no signup form on any of the 6 apps needs to know
// about referrals at all; the redemption itself only ever happens here,
// once the visitor has a real session.
export default async function ReferralRedeemPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; redeemed?: string }>
}) {
  const { code, error, redeemed } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-lg shadow p-8 text-center dark:bg-gray-900">
          {redeemed ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">You're in!</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Your referral has been recorded.</p>
              <Link href="/dashboard" className="inline-block text-sm font-medium bg-indigo-600 text-white rounded-lg px-6 py-2.5 hover:bg-indigo-700">
                Go to your dashboard
              </Link>
            </>
          ) : (
            <>
              <Gift className="w-12 h-12 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">You've been invited to Greyin</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Redeem this referral link to let the person who invited you know you joined.
              </p>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
                  {decodeURIComponent(error)}
                </div>
              )}
              {!code && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-4">No referral code was provided in this link.</p>
              )}
              {user ? (
                <form action="/api/referrals/redeem" method="POST">
                  <input type="hidden" name="code" value={code || ''} />
                  <button
                    type="submit"
                    disabled={!code}
                    className="w-full text-sm font-medium bg-indigo-600 text-white rounded-lg py-2.5 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Redeem referral
                  </button>
                </form>
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(`/referral/redeem?code=${code || ''}`)}`}
                  className="block w-full text-sm font-medium bg-indigo-600 text-white rounded-lg py-2.5 hover:bg-indigo-700"
                >
                  Log in or sign up to redeem
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
