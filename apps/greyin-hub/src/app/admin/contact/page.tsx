import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Mail } from 'lucide-react'

export default async function AdminContactPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/contact')
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: newInquiries } = await supabase
    .from('business_inquiries')
    .select('id, name, email, company_name, source_app, message, created_at')
    .eq('status', 'new')
    .order('created_at', { ascending: true })
    .limit(100)

  const { data: handledInquiries } = await supabase
    .from('business_inquiries')
    .select('id, name, email, company_name, source_app, message, status, created_at')
    .in('status', ['contacted', 'closed'])
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to admin
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <Mail className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Business Inquiries</h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
          <h2 className="font-semibold text-gray-900 mb-4 dark:text-gray-50">New ({newInquiries?.length || 0})</h2>
          {newInquiries && newInquiries.length > 0 ? (
            <div className="divide-y">
              {newInquiries.map((i: any) => (
                <div key={i.id} className="py-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-50">{i.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">&lt;{i.email}&gt;</span>
                      {i.company_name && <span className="text-xs text-gray-500 dark:text-gray-400">· {i.company_name}</span>}
                      <span className="text-xs text-gray-400 capitalize dark:text-gray-500">{i.source_app}</span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(i.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-gray-700 mb-3 dark:text-gray-300">{i.message}</p>
                  <div className="flex gap-2">
                    <form action="/api/admin/contact/update-status" method="POST">
                      <input type="hidden" name="inquiry_id" value={i.id} />
                      <input type="hidden" name="status" value="contacted" />
                      <button type="submit" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                        Mark contacted
                      </button>
                    </form>
                    <form action="/api/admin/contact/update-status" method="POST">
                      <input type="hidden" name="inquiry_id" value={i.id} />
                      <input type="hidden" name="status" value="closed" />
                      <button type="submit" className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                        Close
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">Nothing new.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
          <h2 className="font-semibold text-gray-900 mb-4 dark:text-gray-50">Recently handled</h2>
          {handledInquiries && handledInquiries.length > 0 ? (
            <div className="divide-y">
              {handledInquiries.map((i: any) => (
                <div key={i.id} className="py-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{i.name} <span className="text-xs text-gray-400 font-normal dark:text-gray-500">&lt;{i.email}&gt;</span></p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${i.status === 'closed' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' : 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'}`}>
                      {i.status === 'closed' ? 'Closed' : 'Contacted'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{i.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">Nothing handled yet.</p>
          )}
        </div>
      </div>
    </>
  )
}
