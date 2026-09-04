import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Building2 } from 'lucide-react'

export default async function EmployerSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const { success } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/employer/settings')
  }

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center gap-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-6 h-6" />
              DeepEdge
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/employer/dashboard" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="bg-white rounded-lg shadow p-8 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 dark:text-gray-50">Company Settings</h1>

          {success && (
            <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
              Company profile updated.
            </div>
          )}

          <form action="/api/profile/update" method="POST" className="space-y-6">
            <input type="hidden" name="redirect_to" value="/employer/settings" />
            <div>
              <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company name</label>
              <input id="company_name" name="company_name" type="text" defaultValue={company?.name || ''}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <div>
              <label htmlFor="industry" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Industry</label>
              <input id="industry" name="industry" type="text" defaultValue={company?.industry || ''}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <div>
              <label htmlFor="company_size" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company size</label>
              <select id="company_size" name="company_size" defaultValue={company?.size || ''}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="">Select size</option>
                <option value="1-10">1-10</option>
                <option value="11-50">11-50</option>
                <option value="51-200">51-200</option>
                <option value="201-500">201-500</option>
                <option value="500+">500+</option>
              </select>
            </div>

            <div>
              <label htmlFor="company_description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea id="company_description" name="company_description" rows={4} defaultValue={company?.description || ''}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <button type="submit"
              className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 font-semibold">
              Save Changes
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
