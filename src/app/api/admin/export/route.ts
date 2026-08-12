import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { listUsers } from '@/lib/adminData'
import { apiError } from '@/lib/apiError'

/**
 * Per-participant usage as CSV, for the thesis write-up and for cost reporting.
 *
 * Emails are included because the export is admin-only and the researcher needs
 * to match rows to consent records; treat the file as personal data.
 */

/**
 * Quote a CSV field.
 *
 * The leading apostrophe on values starting with =, +, - or @ is deliberate: a
 * bare one makes Excel and Sheets treat the cell as a formula, and these values
 * include participant-supplied text.
 */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${guarded.replace(/"/g, '""')}"`
}

const COLUMNS = [
  'email',
  'name',
  'organization',
  'position',
  'role',
  'signed_up_at',
  'deactivated',
  'deactivated_at',
  'deactivation_reason',
  'last_active_at',
  'chat_calls_total',
  'document_calls_total',
  'export_calls_total',
  'llm_calls_total',
  'provider_requests',
  'failed_requests',
  'prompt_tokens',
  'completion_tokens',
  'total_tokens',
  'estimated_cost_usd',
  'projects',
  'chat_messages',
] as const

export async function GET() {
  try {
    await requireAdmin()

    const users = await listUsers()

    const rows = users.map(user =>
      [
        user.email,
        user.name,
        user.organization,
        user.position,
        user.role,
        user.createdAt,
        user.blocked ? 'yes' : 'no',
        user.blockedAt,
        user.blockedReason,
        user.lastActiveAt,
        user.quota.chatTotal,
        user.quota.uploadsTotal,
        user.quota.exportsTotal,
        user.quota.llmCallsTotal,
        user.tokens.requests,
        user.tokens.failedRequests,
        user.tokens.promptTokens,
        user.tokens.completionTokens,
        user.tokens.totalTokens,
        user.tokens.costUsd.toFixed(6),
        user.projects,
        user.chatMessages,
      ]
        .map(csvField)
        .join(',')
    )

    const csv = [COLUMNS.join(','), ...rows].join('\n')
    const filename = `participant-usage-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return apiError('Failed to export usage', error)
  }
}
