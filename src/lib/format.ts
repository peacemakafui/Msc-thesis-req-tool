/**
 * Display formatting shared by server and client components.
 *
 * Kept separate from tokenUsage.ts deliberately: that module imports the Prisma
 * client, and a client component importing a formatter from it would pull the
 * native SQLite driver into the browser bundle.
 */

/** Compact token count for table cells: 1200 → "1.2k". */
export function formatTokens(count: number): string {
  if (count < 1_000) return String(count)
  if (count < 1_000_000) return `${(count / 1_000).toFixed(1)}k`
  return `${(count / 1_000_000).toFixed(2)}M`
}

/** USD amount, keeping sub-cent figures legible rather than rounding to $0.00. */
export function formatUsd(amount: number): string {
  if (amount <= 0) return '$0.00'
  if (amount < 0.01) return '<$0.01'
  if (amount < 1) return `$${amount.toFixed(3)}`
  return `$${amount.toFixed(2)}`
}

/** Absolute date, e.g. "12 Aug 2026". */
export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Date with time, for the audit fields where the hour matters. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "3 days ago" / "just now", falling back to a date beyond a month. */
export function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'

  const then = new Date(iso).getTime()
  const minutes = Math.floor((Date.now() - then) / 60_000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 31) return `${days}d ago`

  return formatDate(iso)
}

/** Provider slug → the name a reader recognises. */
export const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
}

/** Operation slug (LlmUsage.kind) → what the participant was doing. */
export const KIND_LABELS: Record<string, string> = {
  chat: 'Chat',
  document: 'Document analysis',
  pdf: 'PDF extraction',
  srs: 'SRS generation',
  subtasks: 'Trello sub-tasks',
}
