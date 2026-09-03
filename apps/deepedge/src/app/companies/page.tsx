import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Building2, MapPin, Users } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'

export default async function CompaniesPage() {
  const supabase = await createClient()

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, logo_url, industry, size, location, description')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Companies Hiring</h1>

        {companies && companies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/companies/${company.id}`}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {company.logo_url ? (
                      <img src={company.logo_url} alt={company.name} className="w-10 h-10 object-contain" />
                    ) : (
                      <Building2 className="h-7 w-7 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{company.name}</h3>
                    {company.industry && <p className="text-sm text-gray-500">{company.industry}</p>}
                  </div>
                </div>
                {company.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">{company.description}</p>
                )}
                <div className="flex gap-4 text-xs text-gray-500">
                  {company.location && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{company.location}</span>
                  )}
                  {company.size && (
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{company.size}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No companies yet</h3>
            <p className="text-gray-600">Check back soon as employers join the platform</p>
          </div>
        )}
      </div>
    </main>
  )
}
