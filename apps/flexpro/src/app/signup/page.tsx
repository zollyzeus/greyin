import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Briefcase, ShoppingBag, Wrench } from 'lucide-react'

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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <a href="https://greyin.net" className="inline-flex items-center gap-2 text-3xl font-bold text-orange-600 dark:text-orange-400">
            <Briefcase className="w-8 h-8" />
            <span>FlexPro</span>
          </a>
          <h2 className="font-display mt-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">Create your account</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Freelance marketplace for verified experts, by and for the community</p>
        </div>

        {/* Role Selection */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-50">I want to:</h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <label className="relative flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all dark:border-gray-800 dark:hover:bg-orange-950/40">
              <input
                type="radio"
                name="role"
                value="client"
                defaultChecked
                className="sr-only peer dark:bg-gray-950 dark:text-gray-100"
              />
              <ShoppingBag className="w-12 h-12 text-gray-400 peer-checked:text-orange-600 mb-3 dark:text-gray-500" />
              <span className="text-lg font-medium text-gray-700 peer-checked:text-orange-600 dark:text-gray-300">
                Hire a Freelancer
              </span>
              <span className="text-sm text-gray-500 mt-1 dark:text-gray-400">Order gigs from community members</span>
              <div className="absolute inset-0 border-2 border-transparent peer-checked:border-orange-600 rounded-xl pointer-events-none" />
            </label>

            <label className="relative flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all dark:border-gray-800 dark:hover:bg-orange-950/40">
              <input
                type="radio"
                name="role"
                value="freelancer"
                className="sr-only peer dark:bg-gray-950 dark:text-gray-100"
              />
              <Wrench className="w-12 h-12 text-gray-400 peer-checked:text-orange-600 mb-3 dark:text-gray-500" />
              <span className="text-lg font-medium text-gray-700 peer-checked:text-orange-600 dark:text-gray-300">
                Offer Services
              </span>
              <span className="text-sm text-gray-500 mt-1 dark:text-gray-400">List gigs and keep 100% of earnings</span>
              <div className="absolute inset-0 border-2 border-transparent peer-checked:border-orange-600 rounded-xl pointer-events-none" />
            </label>
          </div>
        </div>

        {/* Signup Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 dark:bg-gray-900">
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action="/auth/signup" method="POST" className="space-y-6">
            <input type="hidden" name="role" id="selected-role" value="client" />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  First name
                </label>
                <input
                  id="first-name"
                  name="first_name"
                  type="text"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="John"
                />
              </div>

              <div>
                <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Last name
                </label>
                <input
                  id="last-name"
                  name="last_name"
                  type="text"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="years-experience" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Years of professional experience
              </label>
              <input
                id="years-experience"
                name="years_experience"
                type="number"
                min={0}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                FlexPro is for verified experts across the Greyin ecosystem — senior-level experience required to hire or offer paid services.
              </p>
            </div>

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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
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
                autoComplete="new-password"
                required
                minLength={8}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="••••••••"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Must be at least 8 characters</p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm password
              </label>
              <input
                id="confirm-password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-start">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                required
                className="h-4 w-4 mt-1 text-orange-600 focus:ring-orange-500 border-gray-300 rounded dark:text-orange-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                I agree to the{' '}
                <Link href="/terms" className="text-orange-600 hover:text-orange-500 dark:text-orange-400">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-orange-600 hover:text-orange-500 dark:text-orange-400">
                  Privacy Policy
                </Link>
              </label>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
            >
              Create account
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500 dark:bg-gray-900 dark:text-gray-400">Already have an account?</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/login"
                className="w-full flex justify-center py-3 px-4 border border-orange-600 rounded-lg shadow-sm text-sm font-medium text-orange-600 bg-white hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors dark:text-orange-400 dark:bg-gray-900 dark:hover:bg-orange-950/40"
              >
                Sign in instead
              </Link>
            </div>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{
        __html: `
          document.querySelectorAll('input[name="role"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
              document.getElementById('selected-role').value = e.target.value;
            });
          });
        `
      }} />
    </div>
  )
}
