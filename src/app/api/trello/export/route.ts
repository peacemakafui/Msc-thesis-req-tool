import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { generateTrelloSubTasks } from '@/lib/llm'
import { consumeQuota } from '@/lib/rateLimit'
import { apiError, PublicError } from '@/lib/apiError'
import { MAX_TRELLO_REQUIREMENTS } from '@/lib/limits'
import {
  boardIsReachable,
  createBoard,
  getOrCreateLists,
  getOrCreateLabel,
  createCard,
  createChecklist,
  PRIORITY_COLORS,
} from '@/lib/trello'

const BOARD_LISTS = ['Backlog', 'To Do', 'In Progress', 'Done']

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { projectId } = await request.json()

    if (typeof projectId !== 'string' || !projectId) {
      throw new PublicError('projectId is required')
    }

    // Fetch project with requirements, verify ownership. The take() bounds both
    // the sub-task prompt and the number of Trello API calls this can make.
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
      include: {
        requirements: {
          orderBy: [{ priority: 'desc' }, { type: 'asc' }],
          take: MAX_TRELLO_REQUIREMENTS,
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

    // The export runs an LLM sub-task generation pass, so it draws on the
    // export quota before any provider or Trello call is made.
    await consumeQuota(user.id, 'export')

    // ── Step 1: Get or create Trello board ──────────────────────────────────
    // A board stored on a previous export can be deleted from Trello afterwards,
    // which made every later export fail with a 404 on the stale id. Re-check
    // reachability and fall back to creating a replacement board.
    let boardId = project.trelloBoardId
    let boardUrl = project.trelloBoardUrl

    if (boardId && !(await boardIsReachable(boardId))) {
      boardId = null
      boardUrl = null
    }

    if (!boardId) {
      const board = await createBoard(project.name, project.description)
      boardId = board.id
      boardUrl = board.url

      await prisma.project.update({
        where: { id: projectId },
        data: { trelloBoardId: boardId, trelloBoardUrl: boardUrl }
      })
    }

    // ── Step 2: Ensure lists exist ───────────────────────────────────────────
    const lists = await getOrCreateLists(boardId, BOARD_LISTS)

    // ── Step 3: Ensure priority labels exist on the board ───────────────────
    const labelIds: Record<string, string> = {}
    for (const [priority, color] of Object.entries(PRIORITY_COLORS)) {
      labelIds[priority] = await getOrCreateLabel(boardId, priority, color)
    }

    // ── Step 4: Batch LLM call for sub-tasks (FUNCTIONAL + USER_STORY only) ─
    const subTaskCandidates = project.requirements.filter(
      r => r.type === 'FUNCTIONAL' || r.type === 'USER_STORY'
    )
    const subTasksMap = await generateTrelloSubTasks(
      subTaskCandidates.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        type: r.type,
      }))
    )

    // ── Step 5: Create cards in "To Do" list ────────────────────────────────
    const toDoListId = lists['To Do']
    let cardsCreated = 0

    for (const req of project.requirements) {
      const label = labelIds[req.priority]

      // Lead with the requirement text — the metadata is supporting detail, so
      // it goes underneath rather than pushing the actual content below the fold.
      const metadata = [
        `**Type:** ${req.type.replace(/_/g, ' ')}`,
        `**Priority:** ${req.priority}`,
        `**Source:** ${req.source.replace(/_/g, ' ')}`,
        req.confidence != null ? `**Confidence:** ${Math.round(req.confidence * 100)}%` : null,
      ]
        .filter(Boolean)
        .join(' · ')

      const cardDesc =
        `${req.description}\n\n` +
        (req.sourceText ? `> ${req.sourceText.replace(/\n/g, '\n> ')}\n\n` : '') +
        `---\n${metadata}`

      const card = await createCard(
        toDoListId,
        req.title,
        cardDesc,
        label ? [label] : []
      )
      cardsCreated++

      const subTasks = subTasksMap[req.id]
      if (subTasks && subTasks.length > 0) {
        await createChecklist(card.id, 'Technical Tasks', subTasks)
      }
    }

    const omitted = project._count.requirements - project.requirements.length

    return NextResponse.json({
      success: true,
      boardUrl,
      boardId,
      cardsCreated,
      omitted,
      message:
        omitted > 0
          ? `Exported ${cardsCreated} requirements to Trello (${omitted} omitted — the per-export limit is ${MAX_TRELLO_REQUIREMENTS})`
          : `Successfully exported ${cardsCreated} requirements to Trello`,
    })
  } catch (error) {
    return apiError('Trello export error', error)
  }
}
