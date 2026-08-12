import { prisma } from './prisma'

/**
 * Token accounting.
 *
 * The counters on `User` (see rateLimit.ts) bound how *many* LLM calls a
 * participant may make. They say nothing about what those calls cost: one
 * metered "call" can fan out to three providers through the fallback chain, and
 * a 30,000-character document costs orders of magnitude more than a chat turn.
 *
 * Every provider request in llm.ts therefore writes a row here with the token
 * counts the provider reported, so the admin dashboard can show real spend
 * rather than a call tally. Recording is best-effort: a logging failure must
 * never fail the participant's request.
 */

export type Provider = 'gemini' | 'openai' | 'anthropic'

/** Which app operation a provider request belongs to. */
export type UsageKind = 'chat' | 'document' | 'pdf' | 'srs' | 'subtasks'

/** Identifies the participant a provider request is charged to. */
export interface UsageContext {
  userId: string
}

/**
 * Published list prices in USD per million tokens, as of the models pinned in
 * llm.ts. These are used to turn token counts into an indicative cost — they are
 * not billing data, and they go stale when a provider changes its pricing or the
 * pinned model changes, so keep them next to the model constants they describe.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
}

/** Charged when a model has no entry above, so unknown spend reads as non-zero. */
const FALLBACK_PRICE = { input: 0.5, output: 1.5 }

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number) {
  const price = PRICING[model] ?? FALLBACK_PRICE
  return (promptTokens * price.input + completionTokens * price.output) / 1_000_000
}

/** Token counts, normalised across the three provider SDKs. */
export interface TokenCounts {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

const int = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0

/**
 * Pull token counts out of whatever usage object a provider returned.
 *
 * The three SDKs disagree on both shape and naming:
 *   Gemini    → usageMetadata { promptTokenCount, candidatesTokenCount, thoughtsTokenCount }
 *   OpenAI    → usage { prompt_tokens, completion_tokens }
 *   Anthropic → usage { input_tokens, output_tokens }
 *
 * Read defensively rather than against SDK types: usage is absent on some
 * responses (blocked content, empty candidates), and an SDK upgrade that renames
 * a field should degrade to zero rather than throw inside a logging call.
 */
export function normalizeUsage(raw: unknown): TokenCounts {
  if (!raw || typeof raw !== 'object') {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  }

  const u = raw as Record<string, unknown>

  const promptTokens = int(u.promptTokenCount ?? u.prompt_tokens ?? u.input_tokens)

  // Gemini bills reasoning tokens ("thoughts") on top of the visible candidate
  // tokens, and reports them separately. Both are output, so add them together.
  const completionTokens =
    int(u.candidatesTokenCount ?? u.completion_tokens ?? u.output_tokens) +
    int(u.thoughtsTokenCount)

  // Prefer the provider's own total when it gives one — it accounts for cached
  // and tool tokens that the two fields above don't cover.
  const reportedTotal = int(u.totalTokenCount ?? u.total_tokens)

  return {
    promptTokens,
    completionTokens,
    totalTokens: Math.max(reportedTotal, promptTokens + completionTokens),
  }
}

/**
 * Reduce a thrown provider error to a short, non-sensitive label.
 *
 * Provider error *messages* can echo back prompt content, so only the error
 * class and HTTP status are kept. `providerFailure()` in llm.ts already logs the
 * full error server-side for debugging.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return 'UnknownError'
  const status = (error as { status?: unknown }).status
  const label = typeof status === 'number' ? `${error.name} ${status}` : error.name
  return label.slice(0, 120)
}

interface RecordArgs {
  ctx: UsageContext
  provider: Provider
  model: string
  kind: UsageKind
  /** The raw provider usage object, when the call succeeded. */
  usage?: unknown
  responseTime: number
  success: boolean
  error?: unknown
}

/**
 * Append one row for a provider request. Never throws — a failure to record
 * usage is logged and swallowed so it cannot break the request it was measuring.
 */
export async function recordLlmUsage(args: RecordArgs): Promise<void> {
  const { promptTokens, completionTokens, totalTokens } = normalizeUsage(args.usage)

  try {
    await prisma.llmUsage.create({
      data: {
        userId: args.ctx.userId,
        provider: args.provider,
        model: args.model,
        kind: args.kind,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd: estimateCostUsd(args.model, promptTokens, completionTokens),
        success: args.success,
        error: args.success ? null : describeError(args.error),
        responseTime: args.responseTime,
      },
    })
  } catch (writeError) {
    console.error('Failed to record LLM usage:', writeError)
  }
}
