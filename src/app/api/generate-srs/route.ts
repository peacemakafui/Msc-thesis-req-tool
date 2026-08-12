import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { generateSRSDocument } from '@/lib/llm'
import { consumeQuota } from '@/lib/rateLimit'
import { apiError, PublicError } from '@/lib/apiError'
import { MAX_SRS_REQUIREMENTS } from '@/lib/limits'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { projectId, format = 'markdown' } = await request.json()

    if (typeof projectId !== 'string' || !projectId) {
      throw new PublicError('Project ID is required')
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
      include: {
        requirements: {
          orderBy: [{ priority: 'desc' }, { type: 'asc' }],
          // Bound the prompt at the query, not just in the prompt builder.
          take: MAX_SRS_REQUIREMENTS,
        },
        _count: { select: { requirements: true } },
      },
    })

    if (!project) {
      throw new PublicError('Project not found or access denied', 403)
    }

    if (project.requirements.length === 0) {
      throw new PublicError('No requirements found for this project')
    }

    // SRS generation is the most expensive single call in the app (up to 4k
    // output tokens across three providers), so it draws on the export quota.
    await consumeQuota(user.id, 'export')

    const srsContent = await generateSRSDocument(
      project.requirements,
      project.name,
      { userId: user.id },
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
        totalRequirements: project._count.requirements,
        truncated: project._count.requirements > project.requirements.length,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    return apiError('Error generating SRS document', error)
  }
}
