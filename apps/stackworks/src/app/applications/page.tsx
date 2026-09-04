import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FlaskConical, ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  declined: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

export default async function ApplicationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/applications')
  }

  const { data: applications } = await supabase
    .from('project_applications')
    .select('id, pitch, status, created_at, project_asks:ask_id ( id, role_title, builder_projects:project_id ( id, title ) )')
    .eq('applicant_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <FlaskConical className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              <span className="ml-2 text-2xl font-bold">StackWorks</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-teal-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6 dark:text-gray-50">My Applications</h1>

        <div className="space-y-4">
          {applications?.map((app: any) => {
            const cardContent = (
              <>
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-50">{app.project_asks?.role_title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[app.status]}`}>
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{app.project_asks?.builder_projects?.title}</p>
              </>
            )
            return app.project_asks?.id ? (
              <Link
                key={app.id}
                href={`/asks/${app.project_asks.id}`}
                className="block bg-white rounded-lg shadow p-6 hover:shadow-md transition dark:bg-gray-900"
              >
                {cardContent}
              </Link>
            ) : (
              <div key={app.id} className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
                {cardContent}
              </div>
            )
          })}
          {(!applications || applications.length === 0) && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              You haven&apos;t applied to any asks yet. <Link href="/projects" className="text-teal-600 font-semibold dark:text-teal-400">Browse projects</Link>.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
