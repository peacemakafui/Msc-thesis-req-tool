import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await requireAuth()
    
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const type = searchParams.get('type')
    const priority = searchParams.get('priority')
    const source = searchParams.get('source')

    // Build filter conditions - always filter by user's projects
    const where: any = {
      project: {
        userId: user.id
      }
    }
    
    if (projectId) {
      where.projectId = projectId
    }
    
    if (type && type !== 'ALL') {
      where.type = type
    }
    
    if (priority && priority !== 'ALL') {
      where.priority = priority
    }
    
    if (source && source !== 'ALL') {
      where.source = source
    }

    // Fetch requirements
    const requirements = await prisma.requirement.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            userId: true
          }
        },
        document: {
          select: {
            id: true,
            originalName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Get summary statistics
    const stats = {
      total: requirements.length,
      byType: await prisma.requirement.groupBy({
        by: ['type'],
        where,
        _count: {
          type: true
        }
      }),
      byPriority: await prisma.requirement.groupBy({
        by: ['priority'],
        where,
        _count: {
          priority: true
        }
      }),
      bySource: await prisma.requirement.groupBy({
        by: ['source'],
        where,
        _count: {
          source: true
        }
      })
    }

    return NextResponse.json({
      success: true,
      requirements,
      stats
    })

  } catch (error) {
    console.error('Requirements API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}