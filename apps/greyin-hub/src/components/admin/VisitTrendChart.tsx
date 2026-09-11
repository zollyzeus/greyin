interface TrendRow {
  day: string
  visit_count: number
}

/**
 * Hand-rolled inline SVG, no charting library -- mirrors
 * apps/deepedge/src/components/SalaryTrendChart.tsx's own approach,
 * confirmed the only charting precedent anywhere in this codebase (no
 * charting library in any package.json); every other numeric display on
 * the platform is plain text/lists, so this doesn't introduce a new
 * dependency for one chart. A simple day-by-day bar of anonymous
 * page-visit counts (get_page_visit_trend(), 145).
 */
export function VisitTrendChart({ rows }: { rows: TrendRow[] }) {
  if (rows.length === 0) {
    return <p className="text-gray-500 text-sm dark:text-gray-400">No visits recorded yet.</p>
  }

  const max = Math.max(...rows.map((r) => r.visit_count), 1)
  const barWidth = 18
  const gap = 6
  const chartHeight = 140
  const width = rows.length * (barWidth + gap) + gap

  return (
    <svg viewBox={`0 0 ${width} ${chartHeight + 30}`} className="w-full h-40" role="img" aria-label="Anonymous page visits, last 30 days">
      {rows.map((row, i) => {
        const barHeight = (row.visit_count / max) * chartHeight
        const x = gap + i * (barWidth + gap)
        const y = chartHeight - barHeight
        const day = new Date(row.day)
        return (
          <g key={row.day}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} fill="#4F46E5" rx={2} />
            {row.visit_count > 0 && (
              <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#1F2937">
                {row.visit_count}
              </text>
            )}
            {i % 5 === 0 && (
              <text x={x + barWidth / 2} y={chartHeight + 16} textAnchor="middle" fontSize="9" fill="#9CA3AF">
                {day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
