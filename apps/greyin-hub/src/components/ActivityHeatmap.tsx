'use client'

import { useMemo, useState } from 'react'

export interface ActivityEvent {
  pillar: string
  event_type: string
  occurred_at: string
}

// Found stale (2026-09-04): 'expertedge' was the pre-rename key
// (fixed 2026-09-03 in the DB view itself, migration 106) -- this map
// was never updated in that pass, so every DeepEdge activity square
// silently rendered colorless (fell through to the "no activity" gray)
// even though the count was correct. 'longlist' was missing outright --
// the view had no Longlist source at all until 108_pillar_activity_longlist.sql.
const PILLAR_COLORS: Record<string, string> = {
  deepedge: '#4F46E5',
  greymatters: '#0284C7',
  saltnpepper: '#9333EA',
  flexpro: '#EA580C',
  stackworks: '#0D9488',
  longlist: '#A16207',
}

const PILLAR_LABELS: Record<string, string> = {
  deepedge: 'DeepEdge',
  greymatters: 'GreyMatters',
  saltnpepper: 'Salt & Pepper',
  flexpro: 'FlexPro',
  stackworks: 'StackWorks',
  longlist: 'Longlist',
}

function toDayKey(iso: string): string {
  return iso.slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d
}

/**
 * GitHub-style contribution calendar, but unified across all 5 pillars
 * instead of one source -- each day cell is colored by whichever pillar
 * had the most activity that day, intensity by total event count, with a
 * full per-pillar breakdown on hover. Below it, a dual-handle range
 * slider (two overlaid native <input type="range">, the standard
 * accessible pattern for this without a component library) narrows which
 * portion of the already-fetched activity is rendered -- no server
 * round-trip on drag.
 */
export function ActivityHeatmap({ activity, joinDate }: { activity: ActivityEvent[]; joinDate: string }) {
  const todayKey = toDayKey(new Date().toISOString())
  const joinKey = toDayKey(joinDate) < todayKey ? toDayKey(joinDate) : todayKey
  const totalDays = Math.max(
    1,
    Math.round((new Date(todayKey).getTime() - new Date(joinKey).getTime()) / 86_400_000)
  )

  const [range, setRange] = useState<[number, number]>([0, totalDays])

  const byDay = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>()
    for (const event of activity) {
      const key = toDayKey(event.occurred_at)
      const bucket = map.get(key)
      if (bucket) bucket.push(event)
      else map.set(key, [event])
    }
    return map
  }, [activity])

  const rangeStart = addDays(new Date(joinKey), range[0])
  const rangeEnd = addDays(new Date(joinKey), range[1])

  const weeks = useMemo(() => {
    const gridStart = startOfWeek(rangeStart)
    const days: { date: Date; key: string }[] = []
    let cursor = gridStart
    while (cursor <= rangeEnd) {
      const key = toDayKey(cursor.toISOString())
      days.push({ date: cursor, key })
      cursor = addDays(cursor, 1)
    }
    const result: { date: Date; key: string }[][] = []
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7))
    }
    return result
  }, [range])

  const totalEvents = useMemo(() => {
    let count = 0
    for (const [key, events] of byDay) {
      if (key >= toDayKey(rangeStart.toISOString()) && key <= toDayKey(rangeEnd.toISOString())) {
        count += events.length
      }
    }
    return count
  }, [byDay, range])

  return (
    <div>
      <p className="text-sm text-gray-600 mb-3 dark:text-gray-400">
        {totalEvents} activit{totalEvents === 1 ? 'y' : 'ies'} between{' '}
        <span className="font-medium text-gray-900 dark:text-gray-50">{rangeStart.toLocaleDateString()}</span> and{' '}
        <span className="font-medium text-gray-900 dark:text-gray-50">{rangeEnd.toLocaleDateString()}</span>
      </p>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-1" style={{ minWidth: weeks.length * 14 }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map(({ date, key }) => {
                const inRange = date >= rangeStart && date <= rangeEnd
                const events = inRange ? byDay.get(key) : undefined
                const count = events?.length ?? 0
                const dominant = events?.length
                  ? Object.entries(
                      events.reduce<Record<string, number>>((acc, e) => {
                        acc[e.pillar] = (acc[e.pillar] ?? 0) + 1
                        return acc
                      }, {})
                    ).sort((a, b) => b[1] - a[1])[0][0]
                  : null
                const color = dominant ? PILLAR_COLORS[dominant] : undefined
                const opacity = count === 0 ? 0 : count <= 1 ? 0.35 : count <= 3 ? 0.65 : 1
                const tooltip = events?.length
                  ? Object.entries(
                      events.reduce<Record<string, number>>((acc, e) => {
                        acc[e.pillar] = (acc[e.pillar] ?? 0) + 1
                        return acc
                      }, {})
                    )
                      .map(([pillar, n]) => `${n} ${PILLAR_LABELS[pillar] ?? pillar}`)
                      .join(', ')
                  : date.toLocaleDateString()
                // "No activity" cells previously hardcoded a light-gray
                // fill (#e5e7eb) via inline style with no dark-mode
                // branch -- inline `style` always wins over `className`,
                // so no amount of dark: CSS elsewhere could ever apply
                // to it. Every empty cell (guaranteed to exist for any
                // real date range) rendered as a pale square standing
                // out against the dark dashboard. Fixed by only setting
                // backgroundColor via style when there's a real pillar
                // color to show, and using a themed className for the
                // empty case instead.
                const isEmpty = inRange && count === 0
                return (
                  <div
                    key={key}
                    title={inRange ? `${date.toLocaleDateString()} — ${tooltip}` : undefined}
                    className={`w-3 h-3 rounded-sm ${isEmpty ? 'bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700' : ''}`}
                    style={{
                      backgroundColor: inRange && !isEmpty ? color : undefined,
                      opacity: inRange ? (count === 0 ? 1 : opacity) : 0,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mt-4 mb-6 text-xs text-gray-500 dark:text-gray-400">
        {Object.entries(PILLAR_LABELS).map(([key, label]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PILLAR_COLORS[key] }} />
            {label}
          </span>
        ))}
      </div>

      {/* Dual-handle range slider -- two overlaid range inputs sharing the
          same track, each constrained so the handles can't cross. */}
      <div className="relative h-6">
        <input
          type="range"
          min={0}
          max={totalDays}
          value={range[0]}
          onChange={(e) => setRange(([, end]) => [Math.min(Number(e.target.value), end), end])}
          className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
          aria-label="Range start"
        />
        <input
          type="range"
          min={0}
          max={totalDays}
          value={range[1]}
          onChange={(e) => setRange(([start]) => [start, Math.max(Number(e.target.value), start)])}
          className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
          aria-label="Range end"
        />
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-gray-200 rounded-full" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-indigo-500 rounded-full"
          style={{
            left: `${(range[0] / totalDays) * 100}%`,
            right: `${100 - (range[1] / totalDays) * 100}%`,
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1 dark:text-gray-500">
        <span>{new Date(joinKey).toLocaleDateString()} (joined)</span>
        <span>{new Date(todayKey).toLocaleDateString()} (today)</span>
      </div>
    </div>
  )
}
