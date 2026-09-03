import { createServiceClient } from '@/lib/supabase/service'
import type { MetadataRoute } from 'next'

// SUPABASE_SERVICE_ROLE_KEY is only injected as a runtime env var
// (frontend-stack.yml), not available as a build ARG -- prerendering
// this at build time fails with "supabaseKey is required". Force it
// to render per-request instead. dynamic alone left the jobs query
// returning stale/empty results in practice (Next 14.2's metadata
// routes don't reliably propagate the per-request dynamic scope to
// fetch calls made by third-party clients) -- fetchCache is the
// documented stronger override for that.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

// Addresses the competitive audit's DeepEdge distribution gap vs
// Indeed: open jobs and public companies weren't indexable at all.
// Service-role client since this route has no user session to read
// RLS through, and only ever selects already-public rows.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://deepedge.greyin.net'
  const supabase = createServiceClient()

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, updated_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(5000)
  if (jobsError) {
    console.error('sitemap: jobs query failed', jobsError)
  }

  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('id, updated_at')
    .limit(2000)
  if (companiesError) {
    console.error('sitemap: companies query failed', companiesError)
  }

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/jobs`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/companies`, changeFrequency: 'daily', priority: 0.6 },
  ]

  const jobEntries: MetadataRoute.Sitemap = (jobs || []).map((j) => ({
    url: `${base}/jobs/${j.id}`,
    lastModified: j.updated_at,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  const companyEntries: MetadataRoute.Sitemap = (companies || []).map((c) => ({
    url: `${base}/companies/${c.id}`,
    lastModified: c.updated_at,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  return [...staticEntries, ...jobEntries, ...companyEntries]
}
