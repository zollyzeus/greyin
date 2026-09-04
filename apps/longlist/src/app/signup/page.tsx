import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Telescope } from 'lucide-react'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-stone-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <a href="https://greyin.net" className="inline-flex items-center gap-2 text-3xl font-bold text-amber-700 dark:text-amber-400">
            <Telescope className="w-8 h-8" />
            <span>Longlist</span>
          </a>
          <h2 className="font-display mt-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">Create your account</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Future roles, quietly explored — no company sees your name unless you say so.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 dark:bg-gray-900">
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action="/auth/signup" method="POST" className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">First name</label>
                <input id="first-name" name="first_name" type="text" required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="John" />
              </div>
              <div>
                <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last name</label>
                <input id="last-name" name="last_name" type="text" required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="Doe" />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="you@example.com" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="••••••••" />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Must be at least 8 characters</p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm password</label>
              <input id="confirm-password" name="confirm_password" type="password" autoComplete="new-password" required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="••••••••" />
            </div>

            <div className="flex items-start">
              <input id="terms" name="terms" type="checkbox" required
                className="h-4 w-4 mt-1 text-amber-600 focus:ring-amber-500 border-gray-300 rounded dark:text-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                I agree to the{' '}
                <Link href="/terms" className="text-amber-700 hover:text-amber-600 dark:text-amber-400">Terms of Service</Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-amber-700 hover:text-amber-600 dark:text-amber-400">Privacy Policy</Link>
              </label>
            </div>

            <button type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors">
              Create account
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-gray-700" /></div>
              <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500 dark:bg-gray-900 dark:text-gray-400">Already have an account?</span></div>
            </div>
            <div className="mt-6">
              <Link href="/login"
                className="w-full flex justify-center py-3 px-4 border border-amber-700 rounded-lg shadow-sm text-sm font-medium text-amber-700 bg-white hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors dark:text-amber-400 dark:bg-gray-900 dark:hover:bg-amber-950/40">
                Sign in instead
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
