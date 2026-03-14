import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const { title, description, type, priority } = await request.json()
    const { id } = params

    // Verify ownership
    const existing = await prisma.requirement.findUnique({
      where: { id },
      include: {
        project: true
      }
    })

    if (!existing || existing.project.userId !== user.id) {
      return NextResponse.json(
        { error: 'Requirement not found or access denied' },
        { status: 403 }
      )
    }

    const requirement = await prisma.requirement.update({
      where: { id },
      data: {
        title,
        description,
        type,
        priority,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      requirement
    })

  } catch (error: any) {
    console.error('Update requirement error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return PUT(request, { params })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const { id } = params

    // Verify ownership
    const existing = await prisma.requirement.findUnique({
      where: { id },
      include: {
        project: true
      }
    })

    if (!existing || existing.project.userId !== user.id) {
      return NextResponse.json(
        { error: 'Requirement not found or access denied' },
        { status: 403 }
      )
    }

    await prisma.requirement.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Requirement deleted successfully'
    })

  } catch (error: any) {
    console.error('Delete requirement error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}