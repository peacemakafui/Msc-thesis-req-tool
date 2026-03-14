import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const { id } = params

    // Verify ownership
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            documents: true,
            requirements: true,
            chatMessages: true
          }
        }
      }
    })

    if (!project || project.userId !== user.id) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 403 }
      )
    }

    // Delete project and all related data (cascade)
    await prisma.project.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Project and all associated data deleted successfully'
    })

  } catch (error: any) {
    console.error('Delete project error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}
