import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { apiError, PublicError } from '@/lib/apiError'
import { clamp, MAX_REQUIREMENT_DESCRIPTION_CHARS, MAX_REQUIREMENT_TITLE_CHARS } from '@/lib/limits'

const VALID_TYPES = new Set([
  'FUNCTIONAL',
  'NON_FUNCTIONAL',
  'BUSINESS',
  'USER_STORY',
  'ACCEPTANCE_CRITERIA',
])
const VALID_PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { title, description, type, priority } = await request.json()
    const { id } = await params

    const existing = await prisma.requirement.findUnique({
      where: { id },
      include: { project: { select: { userId: true } } }
    })

    if (!existing || existing.project.userId !== user.id) {
      throw new PublicError('Requirement not found or access denied', 403)
    }

    // Only overwrite fields that were supplied and are valid, so a partial or
    // malformed PATCH cannot blank out a requirement or write an invalid enum.
    const data: Record<string, unknown> = { updatedAt: new Date() }

    if (typeof title === 'string') {
      if (!title.trim()) throw new PublicError('Title cannot be empty')
      data.title = clamp(title.trim(), MAX_REQUIREMENT_TITLE_CHARS)
    }

    if (typeof description === 'string') {
      data.description = clamp(description, MAX_REQUIREMENT_DESCRIPTION_CHARS)
    }

    if (typeof type === 'string') {
      if (!VALID_TYPES.has(type)) throw new PublicError('Invalid requirement type')
      data.type = type
    }

    if (typeof priority === 'string') {
      if (!VALID_PRIORITIES.has(priority)) throw new PublicError('Invalid priority')
      data.priority = priority
    }

    const requirement = await prisma.requirement.update({ where: { id }, data })

    return NextResponse.json({ success: true, requirement })
  } catch (error) {
    return apiError('Update requirement error', error)
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const existing = await prisma.requirement.findUnique({
      where: { id },
      include: { project: { select: { userId: true } } }
    })

    if (!existing || existing.project.userId !== user.id) {
      throw new PublicError('Requirement not found or access denied', 403)
    }

    await prisma.requirement.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Requirement deleted successfully' })
  } catch (error) {
    return apiError('Delete requirement error', error)
  }
}
