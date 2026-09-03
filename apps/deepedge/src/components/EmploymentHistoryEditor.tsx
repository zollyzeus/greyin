interface EmploymentHistoryEntry {
  id: string
  title: string
  company: string
  location: string | null
  level: string | null
  start_date: string
  end_date: string | null
  is_current: boolean
  salary_amount: number | null
  currency: string | null
}

/**
 * Past/current employment history, including salary at the time --
 * feeds the k-anonymized salary_trends view (055) and nothing else;
 * this data is never shown to any other user
 * (candidate_employment_history has no public SELECT policy at all).
 * Server component -- add via a plain form, delete via a plain form
 * per row, same convention as the rest of this codebase.
 */
export function EmploymentHistoryEditor({ entries }: { entries: EmploymentHistoryEntry[] }) {
  return (
    <div className="space-y-4">
      {entries.length > 0 && (
        <div className="divide-y border rounded-lg">
          {entries.map((entry) => (
            <div key={entry.id} className="p-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">
                  {entry.title} &middot; {entry.company}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {entry.location ? `${entry.location} · ` : ''}
                  {entry.start_date} &ndash; {entry.is_current ? 'Present' : entry.end_date || '—'}
                  {entry.salary_amount ? ` · ${entry.currency || 'USD'} ${entry.salary_amount.toLocaleString()}` : ''}
                </p>
              </div>
              <form action={`/api/candidates/employment-history/${entry.id}`} method="POST">
                <button type="submit" className="text-xs font-medium text-red-600 hover:text-red-700 whitespace-nowrap">
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <form action="/api/candidates/employment-history" method="POST" className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Add a past role</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input name="title" type="text" required placeholder="Title" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <input name="company" type="text" required placeholder="Company" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <input name="location" type="text" placeholder="Location" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <select name="level" defaultValue="" className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Level (optional)</option>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead</option>
            <option value="director">Director</option>
            <option value="executive">Executive</option>
          </select>
          <div>
            <label htmlFor="start_date" className="block text-xs text-gray-500 mb-1">Start date</label>
            <input id="start_date" name="start_date" type="date" required className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full" />
          </div>
          <div>
            <label htmlFor="end_date" className="block text-xs text-gray-500 mb-1">End date (leave blank if current)</label>
            <input id="end_date" name="end_date" type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="is_current" value="true" className="rounded" />
          This is my current role
        </label>
        <div>
          <label htmlFor="salary_amount" className="block text-xs text-gray-500 mb-1">
            Salary at the time (private — only used in anonymized salary trend aggregates)
          </label>
          <input id="salary_amount" name="salary_amount" type="number" min={0} placeholder="e.g. 150000" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-48" />
        </div>
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold">
          Add
        </button>
      </form>
    </div>
  )
}
