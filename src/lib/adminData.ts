import { prisma } from './prisma'
import { LIMITS } from './rateLimit'

/**
 * Read models for the admin dashboard.
 *
 * Two sources are combined, and they answer different questions:
 *
 *  - The counters on `users` say how much of each participant's *quota* is gone.
 *    They are authoritative for enforcement, and they exist for every account.
 *  - The `llm_usage` rows say what those calls actually *cost* in tokens. They
 *    only exist from the point token metering was added, so an account that was
 *    active before then shows quota consumed but no tokens. `meteredSince` is
 *    exposed so the UI can say so rather than implying the spend was zero.
 */

/** UTC midnight today — the boundary the daily quota counters reset on. */
function utcMidnight(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function daysAgo(days: number): Date {
  const d = utcMidnight()
  d.setUTCDate(d.getUTCDate() - days)
  return d
}

const dayKey = (date: Date): string => date.toISOString().slice(0, 10)

export interface AdminUserRow {
  id: string
  email: string
  name: string | null
  organization: string | null
  position: string | null
  role: string
  createdAt: string
  blocked: boolean
  blockedAt: string | null
  blockedReason: string | null
  blockedBy: string | null

  /** Quota consumption, from the counters on the user row. */
  quota: {
    chatToday: number
    uploadsToday: number
    exportsToday: number
    chatTotal: number
    uploadsTotal: number
    exportsTotal: number
    llmCallsTotal: number
    /** Percentage of the kind-agnostic lifetime ceiling used, 0-100. */
    percentOfCeiling: number
  }

  /** Real token spend, from the metering rows. */
  tokens: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    costUsd: number
    /** Provider requests recorded, which exceeds metered calls when fallbacks fire. */
    requests: number
    failedRequests: number
    tokensToday: number
  }

  projects: number
  chatMessages: number
  lastActiveAt: string | null
}

/**
 * One row per account, with quota and token usage folded in.
 *
 * Deliberately three queries rather than a per-user loop: the participant pool is
 * small, but an N+1 over accounts is the kind of thing that quietly becomes slow
 * once the study grows, and the aggregate form is no harder to read.
 */
export async function listUsers(): Promise<AdminUserRow[]> {
  const today = utcMidnight()

  const [users, usageTotals, usageToday] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        organization: true,
        position: true,
        role: true,
        createdAt: true,
        blocked: true,
        blockedAt: true,
        blockedReason: true,
        blockedBy: true,
        usageResetDate: true,
        dailyChatCount: true,
        dailyUploadCount: true,
        dailyExportCount: true,
        totalChatCount: true,
        totalUploadCount: true,
        totalExportCount: true,
        totalLlmCalls: true,
        _count: { select: { projects: true, chatMessages: true } },
      },
    }),
    prisma.llmUsage.groupBy({
      by: ['userId'],
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true, costUsd: true },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.llmUsage.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: today } },
      _sum: { totalTokens: true },
    }),
  ])

  // Failed requests need their own pass: a filtered _count inside the grouped
  // aggregate above isn't expressible, and counting them separately is cheaper
  // than pulling every row back to tally in memory.
  const failures = await prisma.llmUsage.groupBy({
    by: ['userId'],
    where: { success: false },
    _count: { _all: true },
  })

  const totalsById = new Map(usageTotals.map(row => [row.userId, row]))
  const todayById = new Map(usageToday.map(row => [row.userId, row]))
  const failuresById = new Map(failures.map(row => [row.userId, row._count._all]))

  const ceiling = LIMITS.userTotalLlmCalls

  return users.map(user => {
    const totals = totalsById.get(user.id)
    const sum = totals?._sum

    // Daily counters are reset lazily, on the account's next metered call, so a
    // stale reset date means today's counts are really zero.
    const staleDaily = !user.usageResetDate || user.usageResetDate < today
    const daily = (value: number) => (staleDaily ? 0 : value)

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organization: user.organization,
      position: user.position,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      blocked: user.blocked,
      blockedAt: user.blockedAt?.toISOString() ?? null,
      blockedReason: user.blockedReason,
      blockedBy: user.blockedBy,
      quota: {
        chatToday: daily(user.dailyChatCount),
        uploadsToday: daily(user.dailyUploadCount),
        exportsToday: daily(user.dailyExportCount),
        chatTotal: user.totalChatCount,
        uploadsTotal: user.totalUploadCount,
        exportsTotal: user.totalExportCount,
        llmCallsTotal: user.totalLlmCalls,
        percentOfCeiling:
          ceiling > 0 ? Math.min(100, Math.round((user.totalLlmCalls / ceiling) * 100)) : 0,
      },
      tokens: {
        promptTokens: sum?.promptTokens ?? 0,
        completionTokens: sum?.completionTokens ?? 0,
        totalTokens: sum?.totalTokens ?? 0,
        costUsd: sum?.costUsd ?? 0,
        requests: totals?._count._all ?? 0,
        failedRequests: failuresById.get(user.id) ?? 0,
        tokensToday: todayById.get(user.id)?._sum.totalTokens ?? 0,
      },
      projects: user._count.projects,
      chatMessages: user._count.chatMessages,
      lastActiveAt: totals?._max.createdAt?.toISOString() ?? null,
    }
  })
}

export interface AdminOverview {
  users: {
    total: number
    blocked: number
    admins: number
    newToday: number
    newThisWeek: number
    activeToday: number
  }
  spend: {
    totalTokens: number
    totalCostUsd: number
    tokensToday: number
    costTodayUsd: number
    requests: number
    failedRequests: number
  }
  /** The deployment-wide daily ceiling from rateLimit.ts, and today's position against it. */
  globalDaily: {
    callsToday: number
    limit: number
    percentUsed: number
  }
  perProvider: {
    provider: string
    model: string
    requests: number
    totalTokens: number
    costUsd: number
  }[]
  perKind: { kind: string; requests: number; totalTokens: number; costUsd: number }[]
  /** Daily series for the trailing window, oldest first, with empty days filled in. */
  daily: { date: string; tokens: number; costUsd: number; requests: number; failed: number }[]
  /** When token metering first recorded anything — null if it never has. */
  meteredSince: string | null
}

const TREND_DAYS = 14

export async function getOverview(): Promise<AdminOverview> {
  const today = utcMidnight()
  const weekAgo = daysAgo(7)
  const windowStart = daysAgo(TREND_DAYS - 1)

  const [
    totalUsers,
    blockedUsers,
    adminUsers,
    newToday,
    newThisWeek,
    allTime,
    todayTotals,
    failedRequests,
    activeToday,
    perProvider,
    perKind,
    globalRow,
    firstUsage,
    trendRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { blocked: true } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.llmUsage.aggregate({ _sum: { totalTokens: true, costUsd: true }, _count: { _all: true } }),
    prisma.llmUsage.aggregate({
      where: { createdAt: { gte: today } },
      _sum: { totalTokens: true, costUsd: true },
    }),
    prisma.llmUsage.count({ where: { success: false } }),
    prisma.llmUsage.groupBy({ by: ['userId'], where: { createdAt: { gte: today } } }),
    prisma.llmUsage.groupBy({
      by: ['provider', 'model'],
      _sum: { totalTokens: true, costUsd: true },
      _count: { _all: true },
    }),
    prisma.llmUsage.groupBy({
      by: ['kind'],
      _sum: { totalTokens: true, costUsd: true },
      _count: { _all: true },
    }),
    prisma.globalUsage.findUnique({ where: { id: 'global' } }),
    prisma.llmUsage.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    // Bucketed in JS rather than SQL. Prisma's groupBy cannot group on a date
    // expression, and hand-written SQL here would depend on how the SQLite
    // adapter encodes DateTime. At study scale this window is a few thousand
    // narrow rows, so reading them back is the cheaper kind of correct.
    prisma.llmUsage.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true, totalTokens: true, costUsd: true, success: true },
    }),
  ])

  const buckets = new Map<string, { tokens: number; costUsd: number; requests: number; failed: number }>()
  for (let i = 0; i < TREND_DAYS; i++) {
    const date = new Date(windowStart)
    date.setUTCDate(date.getUTCDate() + i)
    buckets.set(dayKey(date), { tokens: 0, costUsd: 0, requests: 0, failed: 0 })
  }

  for (const row of trendRows) {
    const bucket = buckets.get(dayKey(row.createdAt))
    if (!bucket) continue
    bucket.tokens += row.totalTokens
    bucket.costUsd += row.costUsd
    bucket.requests += 1
    if (!row.success) bucket.failed += 1
  }

  const globalLimit = LIMITS.globalDailyLlmCalls
  // A row from an earlier day hasn't been rolled over yet, so today's count is 0.
  const callsToday = globalRow && globalRow.day === dayKey(new Date()) ? globalRow.llmCalls : 0

  return {
    users: {
      total: totalUsers,
      blocked: blockedUsers,
      admins: adminUsers,
      newToday,
      newThisWeek,
      activeToday: activeToday.length,
    },
    spend: {
      totalTokens: allTime._sum.totalTokens ?? 0,
      totalCostUsd: allTime._sum.costUsd ?? 0,
      tokensToday: todayTotals._sum.totalTokens ?? 0,
      costTodayUsd: todayTotals._sum.costUsd ?? 0,
      requests: allTime._count._all,
      failedRequests,
    },
    globalDaily: {
      callsToday,
      limit: globalLimit,
      percentUsed: globalLimit > 0 ? Math.min(100, Math.round((callsToday / globalLimit) * 100)) : 0,
    },
    perProvider: perProvider
      .map(row => ({
        provider: row.provider,
        model: row.model,
        requests: row._count._all,
        totalTokens: row._sum.totalTokens ?? 0,
        costUsd: row._sum.costUsd ?? 0,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens),
    perKind: perKind
      .map(row => ({
        kind: row.kind,
        requests: row._count._all,
        totalTokens: row._sum.totalTokens ?? 0,
        costUsd: row._sum.costUsd ?? 0,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens),
    daily: [...buckets.entries()].map(([date, values]) => ({ date, ...values })),
    meteredSince: firstUsage?.createdAt.toISOString() ?? null,
  }
}

/** Quota ceilings, so the dashboard shows usage against the configured limits. */
export function quotaLimits() {
  return {
    chatDaily: LIMITS.chat.daily,
    chatLifetime: LIMITS.chat.lifetime,
    documentDaily: LIMITS.document.daily,
    documentLifetime: LIMITS.document.lifetime,
    exportDaily: LIMITS.export.daily,
    exportLifetime: LIMITS.export.lifetime,
    userTotalLlmCalls: LIMITS.userTotalLlmCalls,
    globalDailyLlmCalls: LIMITS.globalDailyLlmCalls,
    llmDisabled: process.env.LLM_DISABLED === 'true',
  }
}
