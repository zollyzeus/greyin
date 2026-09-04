interface TrendRow {
  source: string
  avg_salary_low: number
  avg_salary_high: number
  sample_size: number
}

const SOURCE_LABELS: Record<string, string> = {
  past: 'Past (verified experts)',
  expected: 'Expected',
  market: 'Market (open jobs)',
}

const SOURCE_COLORS: Record<string, string> = {
  past: '#4338CA',
  expected: '#0EA5E9',
  market: '#059669',
}

/**
 * Hand-rolled inline SVG, no charting library -- every other numeric
 * display on this platform is plain text/icons, and this is a Server
 * Component with no client JS. A grouped bar per source
 * (past/expected/market), using the midpoint of each row's
 * avg_salary_low/avg_salary_high as the bar height.
 */
export function SalaryTrendChart({ rows }: { rows: TrendRow[] }) {
  if (rows.length === 0) {
    return <p className="text-gray-500 text-sm dark:text-gray-400">Not enough data yet for this filter (at least 3 people/postings are needed per group).</p>
  }

  const midpoints = rows.map((r) => (r.avg_salary_low + r.avg_salary_high) / 2)
  const max = Math.max(...midpoints, 1)
  const barWidth = 100
  const gap = 40
  const chartHeight = 220
  const width = rows.length * (barWidth + gap) + gap

  return (
    <svg viewBox={`0 0 ${width} ${chartHeight + 60}`} className="w-full h-64" role="img" aria-label="Average salary by source">
      {rows.map((row, i) => {
        const mid = (row.avg_salary_low + row.avg_salary_high) / 2
        const barHeight = (mid / max) * chartHeight
        const x = gap + i * (barWidth + gap)
        const y = chartHeight - barHeight
        return (
          <g key={row.source}>
            <rect x={x} y={y} width={barWidth} height={barHeight} fill={SOURCE_COLORS[row.source] || '#6B7280'} rx={4} />
            <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" fontSize="13" fontWeight="600" fill="#1F2937">
              {mid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
            <text x={x + barWidth / 2} y={chartHeight + 20} textAnchor="middle" fontSize="12" fill="#4B5563">
              {SOURCE_LABELS[row.source] || row.source}
            </text>
            <text x={x + barWidth / 2} y={chartHeight + 38} textAnchor="middle" fontSize="11" fill="#9CA3AF">
              n={row.sample_size}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
