import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FlaskConical } from 'lucide-react'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; message?: string }>
}) {
  const { next, error, message } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // SEC-021 (2026-08-25 security audit): this redirect() had zero
    // validation on `next` at all (worse than auth/login/route.ts's
    // POST handler, which at least checked startsWith('/')) -- an
    // already-logged-in user visiting /login?next=https://evil.com got
    // sent straight there just by loading the page, no form submission
    // needed. Same validation as the POST route: relative, single-
    // leading-slash, no backslash (browsers normalize \ to / , turning
    // /\evil.com into //evil.com, a protocol-relative redirect).
    const safeNext =
      next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/dashboard'
    redirect(safeNext)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <a href="https://greyin.net" className="inline-flex items-center gap-2 text-3xl font-bold text-teal-600 dark:text-teal-400">
            <FlaskConical className="w-8 h-8" />
            <span>StackWorks</span>
          </a>
          <h2 className="font-display mt-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">Welcome back</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 dark:bg-gray-900">
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
              {decodeURIComponent(error)}
            </div>
          )}
          {message && (
            <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
              {decodeURIComponent(message)}
            </div>
          )}

          <form action="/auth/login" method="POST" className="space-y-6">
            {next && <input type="hidden" name="next" value={next} />}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-end">
              <Link href="/reset-password" className="text-sm font-medium text-teal-600 hover:text-teal-500 dark:text-teal-400">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
            >
              Sign in
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500 dark:bg-gray-900 dark:text-gray-400">New to StackWorks?</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/signup"
                className="w-full flex justify-center py-3 px-4 border border-teal-600 rounded-lg shadow-sm text-sm font-medium text-teal-600 bg-white hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors dark:text-teal-400 dark:bg-gray-900 dark:hover:bg-teal-950/40"
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
