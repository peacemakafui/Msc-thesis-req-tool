import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { generateSRSDocument } from '@/lib/llm'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { projectId, format = 'markdown' } = await request.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
        userId: user.id
      },
      include: {
        requirements: {
          orderBy: [
            { priority: 'desc' },
            { type: 'asc' }
          ]
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 403 }
      )
    }

    if (project.requirements.length === 0) {
      return NextResponse.json(
        { error: 'No requirements found for this project' },
        { status: 400 }
      )
    }

    // Generate SRS document using LLM
    const srsContent = await generateSRSDocument(
      project.requirements,
      project.name,
      project.description || undefined
    )

    if (!srsContent) {
      throw new Error('Failed to generate SRS document')
    }

    return NextResponse.json({
      success: true,
      document: srsContent,
      format,
      metadata: {
        projectName: project.name,
        requirementsCount: project.requirements.length,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('Error generating SRS document:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate SRS document' },
      { status: 500 }
    )
  }
}
