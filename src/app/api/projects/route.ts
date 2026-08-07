import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { apiError, PublicError } from '@/lib/apiError'
import { clamp, MAX_PROJECT_DESCRIPTION_CHARS, MAX_PROJECT_NAME_CHARS } from '@/lib/limits'

/** Projects are free to create, so cap how many one participant can accumulate. */
const MAX_PROJECTS_PER_USER = 25

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { name, description } = body ?? {}

    if (typeof name !== 'string' || !name.trim()) {
      throw new PublicError('Project name is required')
    }

    const existingCount = await prisma.project.count({ where: { userId: user.id } })
    if (existingCount >= MAX_PROJECTS_PER_USER) {
      throw new PublicError(
        `You have reached the maximum of ${MAX_PROJECTS_PER_USER} projects. Delete one to create another.`
      )
    }

    const project = await prisma.project.create({
      data: {
        name: clamp(name.trim(), MAX_PROJECT_NAME_CHARS),
        description:
          typeof description === 'string' && description.trim()
            ? clamp(description.trim(), MAX_PROJECT_DESCRIPTION_CHARS)
            : null,
        userId: user.id
      }
    })

    return NextResponse.json({ success: true, project })
  } catch (error) {
    return apiError('Error creating project', error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const projects = await prisma.project.findMany({
      where: {
        userId: user.id
      },
      include: {
        _count: {
          select: {
            documents: true,
            requirements: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      projects
    })

  } catch (error: any) {
    console.error('Error fetching projects:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}
