'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ArrowDown,
  ArrowUp,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  UserCog,
} from 'lucide-react'
import Modal from '@/components/Modal'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  cn,
} from '@/components/ui'
import { formatDateTime, formatRelative, formatTokens, formatUsd } from '@/lib/format'
import type { AdminUserRow } from '@/lib/adminData'
import type { QuotaLimits } from './AdminDashboard'

/**
 * The participant list: who signed up, what they have spent, and the controls to
 * deactivate an account that is abusing the study budget.
 *
 * Sorting and filtering are client-side on purpose. The study is sized for tens
 * of participants, so the whole list arrives in one response and paginating it
 * server-side would add a round trip per interaction for no benefit.
 */

type SortKey = 'createdAt' | 'tokens' | 'cost' | 'calls' | 'lastActive' | 'email'
type StatusFilter = 'all' | 'active' | 'deactivated' | 'admins'

const SORT_LABELS: Record<SortKey, string> = {
  createdAt: 'Signed up',
  tokens: 'Tokens used',
  cost: 'Estimated cost',
  calls: 'AI requests',
  lastActive: 'Last active',
  email: 'Email',
}

/** Sort value per key. Nulls sort last in descending order, which is what "never active" wants. */
function sortValue(user: AdminUserRow, key: SortKey): number | string {
  switch (key) {
    case 'createdAt':
      return new Date(user.createdAt).getTime()
    case 'tokens':
      return user.tokens.totalTokens
    case 'cost':
      return user.tokens.costUsd
    case 'calls':
      return user.quota.llmCallsTotal
    case 'lastActive':
      return user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0
    case 'email':
      return user.email.toLowerCase()
  }
}

/** Horizontal meter showing quota consumed against the study ceiling. */
function QuotaMeter({ used, limit }: { used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0

  return (
    <div className="min-w-[104px]">
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="font-medium tabular-nums text-ink">{used}</span>
        <span className="text-ink-subtle tabular-nums">/ {limit || '∞'}</span>
      </div>
      {limit > 0 && (
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-subtle"
          role="img"
          aria-label={`${percent}% of the study allowance used`}
        >
          <div
            className={cn(
              'h-full rounded-full',
              percent >= 90 ? 'bg-critical' : percent >= 70 ? 'bg-caution' : 'bg-accent'
            )}
            style={{ width: `${Math.max(percent, used > 0 ? 3 : 0)}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function ParticipantsTable({
  users,
  limits,
  currentAdminId,
  onChanged,
}: {
  users: AdminUserRow[]
  limits: QuotaLimits
  currentAdminId: string
  onChanged: () => void
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [descending, setDescending] = useState(true)
  const [selected, setSelected] = useState<AdminUserRow | null>(null)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const filtered = users.filter(user => {
      if (status === 'active' && user.blocked) return false
      if (status === 'deactivated' && !user.blocked) return false
      if (status === 'admins' && user.role !== 'ADMIN') return false

      if (!needle) return true
      return [user.email, user.name, user.organization, user.position]
        .filter(Boolean)
        .some(field => String(field).toLowerCase().includes(needle))
    })

    return filtered.sort((a, b) => {
      const left = sortValue(a, sortKey)
      const right = sortValue(b, sortKey)
      const comparison =
        typeof left === 'string' && typeof right === 'string'
          ? left.localeCompare(right)
          : Number(left) - Number(right)
      return descending ? -comparison : comparison
    })
  }, [users, query, status, sortKey, descending])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDescending(previous => !previous)
      return
    }
    setSortKey(key)
    // Text reads naturally A→Z; every numeric column is most interesting at the top.
    setDescending(key !== 'email')
  }

  const SortableHeader = ({ column, className }: { column: SortKey; className?: string }) => (
    <th scope="col" className={cn('px-3 py-2 font-medium', className)}>
      <button
        onClick={() => toggleSort(column)}
        // `uppercase` is repeated here rather than inherited from the row: a
        // button does not inherit text-transform, which left these headers in
        // sentence case beside the non-button ones.
        className="inline-flex items-center gap-1 uppercase tracking-wider text-ink-muted transition-colors hover:text-ink"
        aria-label={`Sort by ${SORT_LABELS[column]}`}
      >
        {SORT_LABELS[column]}
        {sortKey === column &&
          (descending ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </button>
    </th>
  )

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search by name, email or organisation"
            className="pl-9"
            aria-label="Search participants"
          />
        </div>
        <Select
          value={status}
          onChange={event => setStatus(event.target.value as StatusFilter)}
          className="w-auto"
          aria-label="Filter by status"
        >
          <option value="all">All accounts ({users.length})</option>
          <option value="active">Active only</option>
          <option value="deactivated">Deactivated only</option>
          <option value="admins">Admins only</option>
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" />}
          title="No matching accounts"
          description="Adjust the search or the status filter."
        />
      ) : (
        // The table is wider than a phone; it scrolls in its own container so the
        // page itself never scrolls sideways.
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
            <thead className="border-b border-line bg-surface-subtle text-[11px] uppercase tracking-wider">
              <tr>
                <SortableHeader column="email" className="min-w-[220px]" />
                <SortableHeader column="createdAt" />
                <SortableHeader column="calls" />
                <SortableHeader column="tokens" />
                <SortableHeader column="cost" />
                <SortableHeader column="lastActive" />
                <th scope="col" className="px-3 py-2 font-medium text-ink-muted">
                  Status
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium text-ink-muted">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map(user => (
                <tr key={user.id} className="border-b border-line last:border-0 hover:bg-surface-hover">
                  <td className="px-3 py-2.5">
                    <span className="block truncate font-medium text-ink">
                      {user.name || '—'}
                    </span>
                    <span className="block truncate text-[12px] text-ink-subtle">{user.email}</span>
                    {user.organization && (
                      <span className="block truncate text-[11px] text-ink-subtle">
                        {user.organization}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">
                    {formatRelative(user.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <QuotaMeter used={user.quota.llmCallsTotal} limit={limits.userTotalLlmCalls} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="font-medium tabular-nums text-ink">
                      {formatTokens(user.tokens.totalTokens)}
                    </span>
                    {user.tokens.failedRequests > 0 && (
                      <span className="block text-[11px] text-caution">
                        {user.tokens.failedRequests} failed
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink-muted">
                    {formatUsd(user.tokens.costUsd)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">
                    {formatRelative(user.lastActiveAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="flex flex-wrap items-center gap-1">
                      {user.blocked ? (
                        <Badge tone="critical">Deactivated</Badge>
                      ) : (
                        <Badge tone="positive">Active</Badge>
                      )}
                      {user.role === 'ADMIN' && <Badge tone="alt">Admin</Badge>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <Button size="sm" onClick={() => setSelected(user)}>
                      <UserCog className="h-3.5 w-3.5" />
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ManageAccountModal
        user={selected}
        limits={limits}
        isSelf={selected?.id === currentAdminId}
        onClose={() => setSelected(null)}
        onChanged={() => {
          setSelected(null)
          onChanged()
        }}
      />
    </>
  )
}

// ── Manage dialog ─────────────────────────────────────────────────────────────

/**
 * Per-account detail and the actions that change it.
 *
 * The actions live behind a dialog rather than inline in the row so deactivation
 * takes a deliberate second step, and so there is room to state what it does
 * before it is done.
 */
function ManageAccountModal({
  user,
  limits,
  isSelf,
  onClose,
  onChanged,
}: {
  user: AdminUserRow | null
  limits: QuotaLimits
  isSelf: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<string | null>(null)

  if (!user) return null

  const act = async (action: string, body: Record<string, unknown>, successMessage: string) => {
    setPending(action)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? 'The change could not be saved')
      }

      toast.success(successMessage)
      setReason('')
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The change could not be saved')
    } finally {
      setPending(null)
    }
  }

  const detail: [string, string][] = [
    ['Email', user.email],
    ['Organisation', user.organization || '—'],
    ['Position', user.position || '—'],
    ['Signed up', formatDateTime(user.createdAt)],
    ['Last AI request', formatDateTime(user.lastActiveAt)],
    ['Projects', String(user.projects)],
    ['Chat messages', String(user.chatMessages)],
  ]

  const usage: [string, string][] = [
    ['AI requests (all kinds)', `${user.quota.llmCallsTotal} / ${limits.userTotalLlmCalls}`],
    ['Chat', `${user.quota.chatTotal} / ${limits.chatLifetime}  ·  today ${user.quota.chatToday}/${limits.chatDaily}`],
    ['Documents', `${user.quota.uploadsTotal} / ${limits.documentLifetime}  ·  today ${user.quota.uploadsToday}/${limits.documentDaily}`],
    ['AI exports', `${user.quota.exportsTotal} / ${limits.exportLifetime}  ·  today ${user.quota.exportsToday}/${limits.exportDaily}`],
    ['Prompt tokens', user.tokens.promptTokens.toLocaleString()],
    ['Completion tokens', user.tokens.completionTokens.toLocaleString()],
    ['Total tokens', user.tokens.totalTokens.toLocaleString()],
    ['Estimated cost', formatUsd(user.tokens.costUsd)],
    [
      'Provider requests',
      `${user.tokens.requests}${user.tokens.failedRequests ? ` (${user.tokens.failedRequests} failed)` : ''}`,
    ],
  ]

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={user.name || user.email}
      icon={<UserCog className="h-4 w-4 text-ink-subtle" />}
    >
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Account
          </h3>
          <dl className="grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
            {detail.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="min-w-0 truncate text-right font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Usage against limits
          </h3>
          <dl className="space-y-1.5 text-[13px]">
            {usage.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="text-right font-medium tabular-nums text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {user.blocked && (
          <div className="rounded-lg border border-line bg-critical-soft px-3.5 py-3 text-[13px]">
            <p className="font-medium text-critical">Account is deactivated</p>
            <p className="mt-1 text-ink-muted">
              {user.blockedReason || 'No reason recorded.'}
              {user.blockedAt && ` · ${formatDateTime(user.blockedAt)}`}
              {user.blockedBy && ` · by ${user.blockedBy}`}
            </p>
          </div>
        )}

        <section className="border-t border-line pt-5">
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Actions
          </h3>

          {isSelf ? (
            <p className="mb-3 text-[13px] text-ink-muted">
              This is your own account. Deactivating it or removing your own admin access is
              blocked, since neither can be undone from this page.
            </p>
          ) : (
            <p className="mb-3 text-[13px] text-ink-muted">
              Deactivating keeps all of this participant&apos;s data and blocks them from signing
              in or making any further AI requests. It can be undone at any time.
            </p>
          )}

          {!user.blocked && !isSelf && (
            <div className="mb-3">
              <Field label="Reason" hint="Stored with the account so the decision is on record.">
                <Textarea
                  rows={2}
                  value={reason}
                  onChange={event => setReason(event.target.value)}
                  placeholder="e.g. Repeated attempts to exhaust the daily budget"
                  maxLength={300}
                />
              </Field>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {user.blocked ? (
              <Button
                variant="primary"
                loading={pending === 'unblock'}
                disabled={pending !== null}
                onClick={() => act('unblock', { blocked: false }, 'Account reactivated')}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Reactivate account
              </Button>
            ) : (
              <Button
                variant="danger"
                loading={pending === 'block'}
                disabled={pending !== null || isSelf}
                onClick={() =>
                  act('block', { blocked: true, reason }, 'Account deactivated')
                }
              >
                <ShieldOff className="h-3.5 w-3.5" />
                Deactivate account
              </Button>
            )}

            <Button
              loading={pending === 'resetDaily'}
              disabled={pending !== null}
              onClick={() => act('resetDaily', { resetDaily: true }, "Today's allowance restored")}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset today&apos;s quota
            </Button>

            <Button
              loading={pending === 'resetLifetime'}
              disabled={pending !== null}
              onClick={() =>
                act('resetLifetime', { resetLifetime: true }, 'Study allowance reset')
              }
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset study allowance
            </Button>

            {user.role === 'ADMIN' ? (
              <Button
                disabled={pending !== null || isSelf}
                loading={pending === 'demote'}
                onClick={() => act('demote', { role: 'USER' }, 'Admin access removed')}
              >
                Remove admin access
              </Button>
            ) : (
              <Button
                disabled={pending !== null}
                loading={pending === 'promote'}
                onClick={() => act('promote', { role: 'ADMIN' }, 'Admin access granted')}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Make admin
              </Button>
            )}
          </div>
        </section>
      </div>
    </Modal>
  )
}
