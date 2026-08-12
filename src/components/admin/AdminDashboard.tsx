'use client'

import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  Coins,
  Download,
  Gauge,
  RefreshCw,
  ShieldOff,
  Users,
  Zap,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  cn,
} from '@/components/ui'
import { KIND_LABELS, PROVIDER_LABELS, formatDateTime, formatTokens, formatUsd } from '@/lib/format'
import type { AdminOverview, AdminUserRow } from '@/lib/adminData'
import ParticipantsTable from './ParticipantsTable'
import UsageTrendChart from './UsageTrendChart'

/** Quota ceilings, mirrored from `quotaLimits()` on the server. */
export interface QuotaLimits {
  chatDaily: number
  chatLifetime: number
  documentDaily: number
  documentLifetime: number
  exportDaily: number
  exportLifetime: number
  userTotalLlmCalls: number
  globalDailyLlmCalls: number
  llmDisabled: boolean
}

export interface AdminData {
  overview: AdminOverview
  users: AdminUserRow[]
  limits: QuotaLimits
}

/**
 * The admin surface.
 *
 * Rendered from data the server component already fetched, and re-fetched from
 * /api/admin/dashboard after any account change so the totals and the row agree
 * without a full navigation.
 */
export default function AdminDashboard({
  initialData,
  currentAdminId,
}: {
  initialData: AdminData
  currentAdminId: string
}) {
  const [data, setData] = useState(initialData)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await fetch('/api/admin/dashboard', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? 'Could not refresh')
      }

      setData({ overview: payload.overview, users: payload.users, limits: payload.limits })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not refresh')
    } finally {
      setRefreshing(false)
    }
  }, [])

  const { overview, users, limits } = data

  const tiles = [
    {
      label: 'Participants',
      value: overview.users.total.toLocaleString(),
      hint:
        overview.users.newThisWeek > 0
          ? `${overview.users.newThisWeek} joined this week`
          : 'No new sign-ups this week',
      icon: Users,
    },
    {
      label: 'Active today',
      value: overview.users.activeToday.toLocaleString(),
      hint: `${overview.users.newToday} signed up today`,
      icon: Zap,
    },
    {
      label: 'Tokens used',
      value: formatTokens(overview.spend.totalTokens),
      hint: `${formatTokens(overview.spend.tokensToday)} today`,
      icon: Gauge,
    },
    {
      label: 'Estimated cost',
      value: formatUsd(overview.spend.totalCostUsd),
      hint: `${formatUsd(overview.spend.costTodayUsd)} today`,
      icon: Coins,
    },
    {
      label: 'Deactivated',
      value: overview.users.blocked.toLocaleString(),
      hint: `${overview.users.admins} admin${overview.users.admins === 1 ? '' : 's'}`,
      icon: ShieldOff,
    },
  ]

  const capacity = overview.globalDaily

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Admin"
        description="Sign-ups, token spend and account controls for the study deployment."
        actions={
          <>
            <Button onClick={refresh} loading={refreshing} disabled={refreshing}>
              {!refreshing && <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
            <Button variant="primary" onClick={() => window.open('/api/admin/export', '_blank')}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </>
        }
      />

      {limits.llmDisabled && (
        <Card className="mb-5 border-caution/40 bg-caution-soft">
          <CardBody className="flex items-start gap-3 py-3.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-caution" />
            <p className="text-[13px] text-ink">
              <span className="font-medium">AI features are switched off.</span>{' '}
              <code className="font-mono text-[12px]">LLM_DISABLED=true</code> is set, so every
              participant request is being refused. Unset it to resume the study.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Stat tiles: the five numbers worth knowing before reading anything else. */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map(({ label, value, hint, icon: Icon }) => (
          <Card key={label}>
            <CardBody className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  {label}
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
              </div>
              <p className="text-[22px] font-semibold tabular-nums leading-none text-ink">{value}</p>
              <p className="mt-1.5 text-[12px] text-ink-muted">{hint}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-3">
        {/* Daily capacity against the deployment-wide ceiling — the number that
            decides whether the study can still run today. */}
        <Card>
          <CardHeader className="flex items-center justify-between gap-2 py-3">
            <CardTitle>Daily capacity</CardTitle>
            <Badge
              tone={capacity.percentUsed >= 90 ? 'critical' : capacity.percentUsed >= 70 ? 'caution' : 'positive'}
            >
              {capacity.percentUsed}% used
            </Badge>
          </CardHeader>
          <CardBody className="py-4">
            <p className="text-[22px] font-semibold tabular-nums leading-none text-ink">
              {capacity.callsToday.toLocaleString()}
              <span className="ml-1 text-[13px] font-normal text-ink-subtle">
                / {capacity.limit > 0 ? capacity.limit.toLocaleString() : 'unlimited'}
              </span>
            </p>
            {capacity.limit > 0 && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                <div
                  className={cn(
                    'h-full rounded-full',
                    capacity.percentUsed >= 90
                      ? 'bg-critical'
                      : capacity.percentUsed >= 70
                        ? 'bg-caution'
                        : 'bg-accent'
                  )}
                  style={{ width: `${Math.max(capacity.percentUsed, capacity.callsToday > 0 ? 2 : 0)}%` }}
                />
              </div>
            )}
            <p className="mt-3 text-[12px] text-ink-muted">
              AI requests across every account today. Once this ceiling is reached, all
              participants are refused until UTC midnight.
            </p>

            {/* The per-participant ceilings that produced the numbers above, so the
                limits in force are visible without reading the env vars. */}
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                Limits per participant
              </p>
              <dl className="space-y-1 text-[12px]">
                {[
                  ['Chat', `${limits.chatDaily}/day · ${limits.chatLifetime} total`],
                  ['Documents', `${limits.documentDaily}/day · ${limits.documentLifetime} total`],
                  ['AI exports', `${limits.exportDaily}/day · ${limits.exportLifetime} total`],
                  ['All AI requests', `${limits.userTotalLlmCalls} total`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-2">
                    <dt className="text-ink-muted">{label}</dt>
                    <dd className="text-right font-medium tabular-nums text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="py-3">
            <CardTitle>Tokens per day, last 14 days</CardTitle>
          </CardHeader>
          <CardBody className="py-4 pr-4">
            <UsageTrendChart data={overview.daily} />
          </CardBody>
        </Card>
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <BreakdownCard
          title="By provider"
          rows={overview.perProvider.map(row => ({
            key: `${row.provider}-${row.model}`,
            label: PROVIDER_LABELS[row.provider] ?? row.provider,
            sublabel: row.model,
            requests: row.requests,
            tokens: row.totalTokens,
            costUsd: row.costUsd,
          }))}
          emptyMessage="No provider requests recorded yet."
        />
        <BreakdownCard
          title="By operation"
          rows={overview.perKind.map(row => ({
            key: row.kind,
            label: KIND_LABELS[row.kind] ?? row.kind,
            requests: row.requests,
            tokens: row.totalTokens,
            costUsd: row.costUsd,
          }))}
          emptyMessage="No operations recorded yet."
        />
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 py-3">
          <CardTitle>Participants</CardTitle>
          <span className="text-[12px] text-ink-subtle">
            {overview.spend.failedRequests > 0 &&
              `${overview.spend.failedRequests} failed provider request${
                overview.spend.failedRequests === 1 ? '' : 's'
              } · `}
            {overview.spend.requests.toLocaleString()} provider requests recorded
          </span>
        </CardHeader>
        <CardBody className="p-4">
          <ParticipantsTable
            users={users}
            limits={limits}
            currentAdminId={currentAdminId}
            onChanged={refresh}
          />

          {/* Token metering was added after the app went live, so an early
              participant can show quota consumed and no tokens. Say so rather
              than letting a zero read as "spent nothing". */}
          <p className="mt-3 text-[12px] text-ink-subtle">
            AI requests come from the quota counters and cover the whole study.
            {overview.meteredSince
              ? ` Token and cost figures cover requests since ${formatDateTime(overview.meteredSince)}.`
              : ' Token and cost figures start once the next AI request is made.'}
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

// ── Breakdown card ────────────────────────────────────────────────────────────

interface BreakdownRow {
  key: string
  label: string
  sublabel?: string
  requests: number
  tokens: number
  costUsd: number
}

/**
 * Share-of-total table. The bar behind each label is the row's share of the
 * largest row, which reads faster than the percentages would.
 */
function BreakdownCard({
  title,
  rows,
  emptyMessage,
}: {
  title: string
  rows: BreakdownRow[]
  emptyMessage: string
}) {
  const peak = Math.max(1, ...rows.map(row => row.tokens))

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className="py-4">
        {rows.length === 0 ? (
          <p className="text-[13px] text-ink-muted">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map(row => (
              <li key={row.key}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-ink">{row.label}</span>
                    {row.sublabel && (
                      <span className="ml-1.5 font-mono text-[11px] text-ink-subtle">
                        {row.sublabel}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {formatTokens(row.tokens)} · {formatUsd(row.costUsd)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-subtle">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(3, Math.round((row.tokens / peak) * 100))}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-ink-subtle">
                    {row.requests} call{row.requests === 1 ? '' : 's'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
