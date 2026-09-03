import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { ArrowLeft, Bot, Sparkles } from 'lucide-react'

function maskKey(key: string | null): string {
  if (!key) return '—'
  return key.length <= 4 ? '••••' : `••••${key.slice(-4)}`
}

// Only these two feature keys have an actual sweep mechanism
// (sweepUnscoredPosts/sweepUnscoredReplies + a src/instrumentation.ts
// timer, on GreyMatters/Salt & Pepper's own apps) -- showing the interval
// field on the others (stackworks_verification, flexpro_delivery_quality,
// the e2e test flag) would offer a control that silently does nothing.
const SWEEPABLE_FEATURE_KEYS = new Set(['greymatters_post_quality', 'saltnpepper_reply_quality'])

/**
 * Moved here from StackWorks 2026-08-24 -- llm_providers/llm_feature_flags
 * (031) are shared tables feeding AI scoring across GreyMatters, Salt &
 * Pepper, and FlexPro, not a StackWorks-specific concern; Greyin Hub has
 * no pillar affiliation of its own, making it the natural single home for
 * genuinely platform-wide admin (see admin/threshold-votes, moved the
 * same day for the same reason).
 */
export default async function LLMAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/llm')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: providers } = await supabase
    .from('llm_providers')
    .select('*')
    .order('priority', { ascending: true })

  const { data: flags } = await supabase
    .from('llm_feature_flags')
    .select('*')
    .order('feature_key', { ascending: true })

  // Cross-pillar backlog overview -- read-only here (the "sweep now"
  // actions themselves live on each pillar's own /admin page, since
  // running the actual scoring pipeline means calling that app's own
  // scorer/prompt code, not something this app can reach into). All
  // three tables are in the same shared database this app already
  // queries directly, so no cross-app call is needed just to count.
  const [{ data: recentPosts }, { data: recentReplies }, { data: allScores }] = await Promise.all([
    supabase.from('posts').select('id').eq('status', 'published').order('published_at', { ascending: false }).limit(50),
    supabase.from('discussion_replies').select('id').order('created_at', { ascending: false }).limit(50),
    supabase.from('ai_quality_scores').select('content_type, post_id, discussion_reply_id'),
  ])
  const scoredPostIds = new Set((allScores || []).filter((s) => s.content_type === 'greymatters_post').map((s) => s.post_id))
  const scoredReplyIds = new Set((allScores || []).filter((s) => s.content_type === 'saltnpepper_reply').map((s) => s.discussion_reply_id))
  const backlog = {
    greymatters_post: (recentPosts || []).filter((p) => !scoredPostIds.has(p.id)).length,
    saltnpepper_reply: (recentReplies || []).filter((r) => !scoredReplyIds.has(r.id)).length,
    flexpro_delivery: (allScores || []).filter((s) => s.content_type === 'flexpro_delivery').length,
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to admin
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <Bot className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">AI Providers</h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            AI Quality Scoring — Backlog Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">GreyMatters posts</p>
              <p className="font-semibold text-gray-900">{backlog.greymatters_post} unscored <span className="text-gray-400 font-normal">(of last 50 published)</span></p>
              <a href="https://greymatters.greyin.net/admin" className="text-xs text-indigo-600 hover:text-indigo-700">Sweep on GreyMatters →</a>
            </div>
            <div>
              <p className="text-gray-500">Salt &amp; Pepper replies</p>
              <p className="font-semibold text-gray-900">{backlog.saltnpepper_reply} unscored <span className="text-gray-400 font-normal">(of last 50)</span></p>
              <a href="https://saltnpepper.greyin.net/admin" className="text-xs text-indigo-600 hover:text-indigo-700">Sweep on Salt &amp; Pepper →</a>
            </div>
            <div>
              <p className="text-gray-500">FlexPro deliveries</p>
              <p className="font-semibold text-gray-900">{backlog.flexpro_delivery} scored</p>
              <p className="text-xs text-gray-400">Scored once at review time, by design — no sweep/backlog here.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Configured providers</h2>
          {providers && providers.length > 0 ? (
            <div className="divide-y mb-6">
              {providers.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium">
                      {p.label} <span className="text-xs text-gray-500 capitalize">({p.provider} · {p.model})</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      priority {p.priority} · key {maskKey(p.api_key)}
                      {p.base_url ? ` · ${p.base_url}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <form action="/api/admin/llm/providers/update" method="POST">
                      <input type="hidden" name="provider_id" value={p.id} />
                      <input type="hidden" name="enabled" value={(!p.enabled).toString()} />
                      <button type="submit" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                        {p.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </form>
                    <form action="/api/admin/llm/providers/delete" method="POST">
                      <input type="hidden" name="provider_id" value={p.id} />
                      <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm mb-6">
              No providers configured — AI verification will run in manual-review-only mode until one is added.
            </p>
          )}

          <form action="/api/admin/llm/providers/create" method="POST" className="border-t pt-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Add a provider</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="provider" className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select id="provider" name="provider" required className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="ollama">Ollama (self-hosted)</option>
                </select>
              </div>
              <div>
                <label htmlFor="label" className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input id="label" name="label" type="text" required placeholder="e.g. Claude (primary)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <input id="model" name="model" type="text" required placeholder="e.g. claude-sonnet-4-5 / gpt-4o / llama3.1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <input id="priority" name="priority" type="number" defaultValue={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">Lower tried first; falls through to the next enabled provider on failure.</p>
              </div>
              <div>
                <label htmlFor="api_key" className="block text-sm font-medium text-gray-700 mb-1">API key (not needed for Ollama)</label>
                <input id="api_key" name="api_key" type="password" autoComplete="off"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label htmlFor="base_url" className="block text-sm font-medium text-gray-700 mb-1">Base URL (Ollama only)</label>
                <input id="base_url" name="base_url" type="text" placeholder="http://ollama-host:11434"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
            </div>
            <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-semibold">
              Add provider
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Feature access</h2>
          <div className="divide-y">
            {flags?.map((f) => (
              <div key={f.feature_key} className="py-3">
                <p className="font-medium mb-2">{f.feature_key}</p>
                <form action="/api/admin/llm/feature-flags/update" method="POST" className="flex items-center gap-3 flex-wrap">
                  <input type="hidden" name="feature_key" value={f.feature_key} />
                  <select name="enabled" defaultValue={f.enabled.toString()} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5">
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                  <select name="provider_id" defaultValue={f.provider_id || ''} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5">
                    <option value="">Use highest-priority enabled provider</option>
                    {providers?.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                  {SWEEPABLE_FEATURE_KEYS.has(f.feature_key) && (
                    <label className="flex items-center gap-1.5 text-sm text-gray-600">
                      Sweep every
                      <input
                        type="number"
                        name="sweep_interval_minutes"
                        min={1}
                        defaultValue={f.sweep_interval_minutes ?? ''}
                        placeholder="off"
                        className="w-20 text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                      />
                      min
                    </label>
                  )}
                  <button type="submit" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Save
                  </button>
                </form>
                {SWEEPABLE_FEATURE_KEYS.has(f.feature_key) && (
                  <p className="text-xs text-gray-400 mt-1">
                    {f.sweep_interval_minutes
                      ? `Periodic sweep last ran ${f.last_swept_at ? new Date(f.last_swept_at).toLocaleString() : 'never yet'}.`
                      : 'Periodic sweep off — leave blank to rely on page-visit-triggered catch-up only.'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
