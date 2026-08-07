import { prisma } from './prisma'

/**
 * Usage quotas for the participant study.
 *
 * Three layers, all of which must pass before any LLM call is made:
 *
 *  1. Per-user daily quota   — resets at UTC midnight, per operation kind.
 *  2. Per-user lifetime quota — never resets, per operation kind, plus a
 *     kind-agnostic ceiling (`totalLlmCalls`) so no single account can burn the
 *     budget by spreading calls across chat/documents/exports.
 *  3. Deployment-wide daily ceiling — the backstop. Even if someone creates many
 *     accounts, total spend per day is bounded.
 *
 * Every limit is overridable by env var so they can be tuned on the server
 * without a code change. `LLM_DISABLED=true` is a hard kill switch.
 *
 * Enforcement uses single atomic conditional UPDATE statements rather than
 * read-then-write, so two concurrent requests cannot both pass the same check.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export const LIMITS = {
  chat: {
    daily: envInt('CHAT_DAILY_LIMIT', 10),
    lifetime: envInt('CHAT_LIFETIME_LIMIT', 50),
  },
  document: {
    daily: envInt('DOCUMENT_DAILY_LIMIT', 3),
    lifetime: envInt('DOCUMENT_LIFETIME_LIMIT', 10),
  },
  export: {
    daily: envInt('EXPORT_DAILY_LIMIT', 5),
    lifetime: envInt('EXPORT_LIFETIME_LIMIT', 20),
  },
  /** Kind-agnostic per-user ceiling across every metered LLM operation. */
  userTotalLlmCalls: envInt('USER_TOTAL_LLM_CALL_LIMIT', 90),
  /** Deployment-wide daily ceiling. Sized for ~20-50 participants. */
  globalDailyLlmCalls: envInt('GLOBAL_DAILY_LLM_CALL_LIMIT', 500),
} as const

export type QuotaKind = 'chat' | 'document' | 'export'

const FIELDS: Record<
  QuotaKind,
  { daily: 'dailyChatCount' | 'dailyUploadCount' | 'dailyExportCount'; total: 'totalChatCount' | 'totalUploadCount' | 'totalExportCount'; noun: string }
> = {
  chat: { daily: 'dailyChatCount', total: 'totalChatCount', noun: 'chat messages' },
  document: { daily: 'dailyUploadCount', total: 'totalUploadCount', noun: 'documents' },
  export: { daily: 'dailyExportCount', total: 'totalExportCount', noun: 'AI exports' },
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    /** True when the limit will never reset on its own (lifetime or global cap). */
    public readonly isLifetime: boolean
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}

/** UTC midnight for the current day — the canonical value stored in usageResetDate. */
function utcMidnight(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** UTC date as YYYY-MM-DD, used as the GlobalUsage day key. */
function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function isLlmDisabled(): boolean {
  return process.env.LLM_DISABLED === 'true'
}

// ── Deployment-wide ceiling ───────────────────────────────────────────────────

/**
 * Read-only check that the deployment still has daily budget. Called before the
 * per-user increment so a rejected request never touches the global counter.
 */
async function assertGlobalCapacity(): Promise<void> {
  const cap = LIMITS.globalDailyLlmCalls
  if (cap === 0) return // 0 means "no global ceiling configured"

  const row = await prisma.globalUsage.findUnique({ where: { id: 'global' } })
  if (!row) return
  if (row.day !== utcDayKey()) return // stale row: today's count is effectively 0

  if (row.llmCalls >= cap) {
    throw new RateLimitError(
      'The study has reached its daily capacity for AI requests. Please try again tomorrow.',
      true
    )
  }
}

/**
 * Record one LLM call against the deployment-wide daily counter. Called only
 * after the per-user quota has been successfully consumed.
 */
async function recordGlobalCall(): Promise<void> {
  const day = utcDayKey()

  // Roll the counter over if the stored row is from a previous day.
  const rolled = await prisma.globalUsage.updateMany({
    where: { id: 'global', day: { not: day } },
    data: { day, llmCalls: 1 },
  })
  if (rolled.count > 0) return

  const bumped = await prisma.globalUsage.updateMany({
    where: { id: 'global', day },
    data: { llmCalls: { increment: 1 } },
  })
  if (bumped.count > 0) return

  // No row yet — create it. A concurrent create is harmless, so swallow the
  // unique-constraint failure and retry the increment.
  try {
    await prisma.globalUsage.create({ data: { id: 'global', day, llmCalls: 1 } })
  } catch {
    await prisma.globalUsage.updateMany({
      where: { id: 'global', day },
      data: { llmCalls: { increment: 1 } },
    })
  }
}

// ── Per-user quota ────────────────────────────────────────────────────────────

/**
 * Atomically consume one unit of `kind` from the user's quota.
 *
 * Throws RateLimitError if any limit is exhausted; the counters are only
 * incremented when every check passes, so a rejected request costs nothing.
 * Must be called *before* the LLM request, not after.
 */
export async function consumeQuota(userId: string, kind: QuotaKind): Promise<void> {
  if (isLlmDisabled()) {
    throw new RateLimitError('AI features are temporarily disabled. Please try again later.', true)
  }

  await assertGlobalCapacity()

  const { daily: dailyField, total: totalField, noun } = FIELDS[kind]
  const { daily: dailyLimit, lifetime: lifetimeLimit } = LIMITS[kind]
  const today = utcMidnight()

  // Guards shared by both paths below. Because these live inside the UPDATE's
  // WHERE clause, the check and the increment are a single atomic statement.
  const ceilingGuards = {
    blocked: false,
    [totalField]: { lt: lifetimeLimit },
    totalLlmCalls: { lt: LIMITS.userTotalLlmCalls },
  }

  // Path 1: counters already belong to today — increment in place.
  const sameDay = await prisma.user.updateMany({
    where: {
      id: userId,
      usageResetDate: today,
      [dailyField]: { lt: dailyLimit },
      ...ceilingGuards,
    },
    data: {
      [dailyField]: { increment: 1 },
      [totalField]: { increment: 1 },
      totalLlmCalls: { increment: 1 },
    },
  })

  if (sameDay.count > 0) {
    await recordGlobalCall()
    return
  }

  // Path 2: first call of a new UTC day — reset the daily counters and count 1.
  //
  // This path writes a count of 1 rather than checking `< dailyLimit`, which is
  // only sound while dailyLimit >= 1. A configured limit of 0 means "disabled",
  // so skip the path entirely rather than leaking one call per day.
  if (dailyLimit >= 1) {
    const newDay = await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ usageResetDate: null }, { usageResetDate: { lt: today } }],
        ...ceilingGuards,
      },
      data: {
        dailyChatCount: kind === 'chat' ? 1 : 0,
        dailyUploadCount: kind === 'document' ? 1 : 0,
        dailyExportCount: kind === 'export' ? 1 : 0,
        usageResetDate: today,
        [totalField]: { increment: 1 },
        totalLlmCalls: { increment: 1 },
      },
    })

    if (newDay.count > 0) {
      await recordGlobalCall()
      return
    }
  }

  // Both paths failed: work out which limit was hit so the message is useful.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      blocked: true,
      totalLlmCalls: true,
      dailyChatCount: true,
      dailyUploadCount: true,
      dailyExportCount: true,
      totalChatCount: true,
      totalUploadCount: true,
      totalExportCount: true,
    },
  })

  if (!user) {
    throw new RateLimitError('Account not found.', true)
  }

  if (user.blocked) {
    throw new RateLimitError('This account has been suspended. Please contact the researcher.', true)
  }

  if (user[totalField] >= lifetimeLimit) {
    throw new RateLimitError(
      `Study limit reached (${lifetimeLimit} ${noun}). Thank you for participating.`,
      true
    )
  }

  if (user.totalLlmCalls >= LIMITS.userTotalLlmCalls) {
    throw new RateLimitError(
      `Study limit reached (${LIMITS.userTotalLlmCalls} AI requests). Thank you for participating.`,
      true
    )
  }

  throw new RateLimitError(
    `Daily limit reached (${dailyLimit} ${noun} per day). Try again tomorrow.`,
    false
  )
}

/**
 * Guards for an LLM call whose *operation* quota was already paid elsewhere —
 * for example document analysis, which is charged once at upload time but runs
 * as a second request. Skips the per-kind quota but still enforces the kill
 * switch, the block flag, the per-user total ceiling and the global ceiling, so
 * no LLM call anywhere in the app is completely unmetered.
 */
export async function consumeLlmCall(userId: string): Promise<void> {
  if (isLlmDisabled()) {
    throw new RateLimitError('AI features are temporarily disabled. Please try again later.', true)
  }

  await assertGlobalCapacity()

  const bumped = await prisma.user.updateMany({
    where: {
      id: userId,
      blocked: false,
      totalLlmCalls: { lt: LIMITS.userTotalLlmCalls },
    },
    data: { totalLlmCalls: { increment: 1 } },
  })

  if (bumped.count === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { blocked: true },
    })
    if (user?.blocked) {
      throw new RateLimitError('This account has been suspended. Please contact the researcher.', true)
    }
    throw new RateLimitError(
      `Study limit reached (${LIMITS.userTotalLlmCalls} AI requests). Thank you for participating.`,
      true
    )
  }

  await recordGlobalCall()
}

/** Named wrappers, kept so existing call sites read clearly. */
export const checkAndIncrementChatLimit = (userId: string) => consumeQuota(userId, 'chat')
export const checkAndIncrementUploadLimit = (userId: string) => consumeQuota(userId, 'document')
export const checkAndIncrementExportLimit = (userId: string) => consumeQuota(userId, 'export')

/**
 * Give a consumed unit back. Used when a request is rejected *after* the quota
 * was consumed but before any tokens were spent, so participants aren't charged
 * for our own validation failures.
 */
export async function refundQuota(userId: string, kind: QuotaKind): Promise<void> {
  const { daily: dailyField, total: totalField } = FIELDS[kind]
  try {
    await prisma.user.updateMany({
      where: { id: userId, [dailyField]: { gt: 0 }, [totalField]: { gt: 0 } },
      data: {
        [dailyField]: { decrement: 1 },
        [totalField]: { decrement: 1 },
        totalLlmCalls: { decrement: 1 },
      },
    })
  } catch (error) {
    console.error('Failed to refund quota:', error)
  }
}

export async function getUsage(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      blocked: true,
      usageResetDate: true,
      dailyChatCount: true,
      dailyUploadCount: true,
      dailyExportCount: true,
      totalChatCount: true,
      totalUploadCount: true,
      totalExportCount: true,
      totalLlmCalls: true,
    },
  })

  // Counters from a previous day read as zero even though the row hasn't been
  // reset yet — the reset happens lazily on the next consumeQuota call.
  const stale = !user.usageResetDate || user.usageResetDate < utcMidnight()
  const daily = (n: number) => (stale ? 0 : n)

  const remaining = (limit: number, used: number) => Math.max(0, limit - used)

  return {
    chatDailyRemaining: remaining(LIMITS.chat.daily, daily(user.dailyChatCount)),
    chatLifetimeRemaining: remaining(LIMITS.chat.lifetime, user.totalChatCount),
    uploadDailyRemaining: remaining(LIMITS.document.daily, daily(user.dailyUploadCount)),
    uploadLifetimeRemaining: remaining(LIMITS.document.lifetime, user.totalUploadCount),
    exportDailyRemaining: remaining(LIMITS.export.daily, daily(user.dailyExportCount)),
    exportLifetimeRemaining: remaining(LIMITS.export.lifetime, user.totalExportCount),
    totalRequestsRemaining: remaining(LIMITS.userTotalLlmCalls, user.totalLlmCalls),
    blocked: user.blocked,
    limits: {
      dailyChat: LIMITS.chat.daily,
      lifetimeChat: LIMITS.chat.lifetime,
      dailyUpload: LIMITS.document.daily,
      lifetimeUpload: LIMITS.document.lifetime,
      dailyExport: LIMITS.export.daily,
      lifetimeExport: LIMITS.export.lifetime,
      totalRequests: LIMITS.userTotalLlmCalls,
    },
  }
}
