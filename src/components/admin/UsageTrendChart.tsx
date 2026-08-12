'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatTokens, formatUsd } from '@/lib/format'

/**
 * Tokens consumed per day across the study, for the trailing two weeks.
 *
 * One measure, one series, so there is no legend (the card title names it) and no
 * second axis — cost tracks tokens almost linearly and belongs in the stat tiles
 * rather than as a second scale on the same plot. Colours are the theme's CSS
 * variables, passed straight through as SVG fills, so the chart follows light and
 * dark without a second palette.
 */

export interface DailyUsage {
  date: string
  tokens: number
  costUsd: number
  requests: number
  failed: number
}

/** "2026-08-12" → "12 Aug", in UTC to match how the buckets were built. */
function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function UsageTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: DailyUsage }[]
}) {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null

  const rows: [string, string][] = [
    ['Tokens', point.tokens.toLocaleString()],
    ['Estimated cost', formatUsd(point.costUsd)],
    ['Provider requests', String(point.requests)],
  ]
  if (point.failed > 0) rows.push(['Failed', String(point.failed)])

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-lg">
      <p className="mb-1 text-[12px] font-semibold text-ink">{formatDay(point.date)}</p>
      <dl className="space-y-0.5 text-[12px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="font-medium tabular-nums text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default function UsageTrendChart({ data }: { data: DailyUsage[] }) {
  const hasUsage = data.some(day => day.tokens > 0)

  if (!hasUsage) {
    return (
      <div className="flex h-56 items-center justify-center px-6 text-center">
        <p className="max-w-sm text-sm text-ink-muted">
          No token usage recorded in the last 14 days. The chart fills in as
          participants use the assistant.
        </p>
      </div>
    )
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
          {/* Horizontal rules only, and recessive: the bars carry the reading. */}
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDay}
            // Every other day: 14 labels crowd at tablet width.
            interval={1}
            tick={{ fill: 'var(--ink-subtle)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--line)' }}
            tickLine={false}
            dy={4}
          />
          <YAxis
            tickFormatter={value => formatTokens(Number(value))}
            tick={{ fill: 'var(--ink-subtle)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            content={<UsageTooltip />}
            // The hit area is the whole column, not just the drawn bar.
            cursor={{ fill: 'var(--surface-hover)' }}
          />
          <Bar
            dataKey="tokens"
            name="Tokens"
            fill="var(--accent)"
            // Rounded top only, so every bar stays anchored to the baseline.
            radius={[4, 4, 0, 0]}
            maxBarSize={38}
            // Recharts draws the bar paths from inside its animation driver, so
            // with the animation on, the bars only exist once a requestAnimationFrame
            // has run — they are missing entirely from the first paint and from any
            // headless render. A grow-in wipe buys nothing on an admin chart.
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
