import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'
import { apiError, PublicError } from '@/lib/apiError'

/**
 * Admin actions against a single account.
 *
 * Deactivation is a flag, not a delete: the participant's documents,
 * requirements and conversations are research data, and removing an abusive
 * account's rows would also remove the evidence of the abuse. `blocked` is
 * enforced in requireAuth() (all API routes), in the dashboard layout, and in the
 * quota guards, so setting it here takes effect on the account's next request.
 */

const ActionSchema = z
  .object({
    blocked: z.boolean().optional(),
    /** Free-text note stored alongside the block, for the audit trail. */
    reason: z.string().max(300).optional(),
    role: z.enum(['ADMIN', 'USER']).optional(),
    /** Zero today's counters, giving the account its daily allowance back. */
    resetDaily: z.boolean().optional(),
    /** Zero the lifetime counters — grants a fresh study allowance. */
    resetLifetime: z.boolean().optional(),
  })
  .refine(
    body =>
      body.blocked !== undefined ||
      body.role !== undefined ||
      body.resetDaily === true ||
      body.resetLifetime === true,
    { message: 'No action supplied' }
  )

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await context.params

    const parsed = ActionSchema.safeParse(await request.json())
    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? 'Invalid request')
    }
    const action = parsed.data

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, blocked: true },
    })
    if (!target) {
      throw new PublicError('Account not found', 404)
    }

    // Locking yourself out of the admin surface is not a recoverable mistake
    // through the UI — it needs database access to undo.
    const isSelf = target.id === admin.id
    if (isSelf && action.blocked === true) {
      throw new PublicError('You cannot deactivate your own account', 409)
    }
    if (isSelf && action.role === 'USER') {
      throw new PublicError('You cannot remove your own admin access', 409)
    }

    // Same reasoning one step out: don't let the last admin be demoted or
    // deactivated by another admin either. An already-deactivated admin isn't
    // part of the active count, so changing them cannot reduce it.
    const losesAdmin =
      target.role === 'ADMIN' &&
      !target.blocked &&
      (action.role === 'USER' || action.blocked === true)
    if (losesAdmin) {
      const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', blocked: false } })
      if (activeAdmins <= 1) {
        throw new PublicError('At least one active admin must remain', 409)
      }
    }

    const data: Record<string, unknown> = {}

    if (action.blocked !== undefined) {
      data.blocked = action.blocked
      data.blockedAt = action.blocked ? new Date() : null
      data.blockedReason = action.blocked ? action.reason?.trim() || null : null
      data.blockedBy = action.blocked ? admin.email : null
    }

    if (action.role !== undefined) {
      data.role = action.role
    }

    if (action.resetDaily) {
      // Clearing the reset date is what actually restores the allowance: the
      // quota check treats a stale date as "first call of a new day".
      data.dailyChatCount = 0
      data.dailyUploadCount = 0
      data.dailyExportCount = 0
      data.usageResetDate = null
    }

    if (action.resetLifetime) {
      data.totalChatCount = 0
      data.totalUploadCount = 0
      data.totalExportCount = 0
      data.totalLlmCalls = 0
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, role: true, blocked: true, blockedAt: true, blockedReason: true },
    })

    // Deliberately logged: these are the actions worth being able to reconstruct
    // from the server log if the dashboard's own audit fields are ever unclear.
    console.info(`[admin] ${admin.email} updated ${updated.email}: ${JSON.stringify(data)}`)

    return NextResponse.json({ success: true, user: updated })
  } catch (error) {
    return apiError('Failed to update account', error)
  }
}
