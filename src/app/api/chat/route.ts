import { NextRequest, NextResponse } from 'next/server'
import { chatWithGemini, chatWithGPT, chatWithClaude } from '@/lib/llm'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { consumeQuota, refundQuota } from '@/lib/rateLimit'
import { apiError, PublicError } from '@/lib/apiError'
import {
  clamp,
  MAX_CHAT_MESSAGE_CHARS,
  MAX_HISTORY_MESSAGE_CHARS,
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_TOTAL_CHARS,
  truncate,
} from '@/lib/limits'
import { extractRequirements } from '@/lib/parseRequirements'

type Turn = { role: 'user' | 'assistant'; content: string }

/**
 * Normalise client-supplied conversation history.
 *
 * The client sends history rather than the server reading it back, so it is
 * treated as untrusted: the role is coerced to a known value, each turn is
 * truncated, the turn count is capped, and the running total is capped so a
 * caller cannot smuggle a huge prompt into a request that counts as one message.
 * Turns are taken from the end, which is the part that matters for context.
 */
function normalizeHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return []

  const recent = raw.slice(-MAX_HISTORY_MESSAGES)
  const turns: Turn[] = []
  let total = 0

  for (let i = recent.length - 1; i >= 0; i--) {
    const entry = recent[i]
    if (!entry || typeof entry.content !== 'string' || !entry.content.trim()) continue

    const content = clamp(entry.content, MAX_HISTORY_MESSAGE_CHARS)
    if (total + content.length > MAX_HISTORY_TOTAL_CHARS) break

    total += content.length
    turns.unshift({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content,
    })
  }

  return turns
}

export async function POST(request: NextRequest) {
  let quotaConsumedBy: string | null = null

  try {
    const user = await requireAuth()

    const { message, conversationHistory, projectId } = await request.json()

    // Validate before consuming quota so a malformed request costs nothing.
    if (typeof message !== 'string' || !message.trim()) {
      throw new PublicError('Message is required')
    }

    // Truncate rather than reject: the upload page legitimately pastes document
    // context into a chat turn, and rejecting would break that flow.
    const userMessage = truncate(message, MAX_CHAT_MESSAGE_CHARS)
    const history = normalizeHistory(conversationHistory)

    // Resolve the target project up front, and verify ownership if one is named.
    let targetProjectId: string
    if (typeof projectId === 'string' && projectId) {
      const owned = await prisma.project.findFirst({
        where: { id: projectId, userId: user.id },
        select: { id: true },
      })
      if (!owned) {
        throw new PublicError('Project not found or access denied', 403)
      }
      targetProjectId = owned.id
    } else {
      let project = await prisma.project.findFirst({
        where: { userId: user.id, name: 'Default Project' },
        select: { id: true },
      })
      if (!project) {
        project = await prisma.project.create({
          data: {
            name: 'Default Project',
            description: 'Default project for chat sessions',
            userId: user.id,
          },
          select: { id: true },
        })
      }
      targetProjectId = project.id
    }

    await consumeQuota(user.id, 'chat')
    quotaConsumedBy = user.id

    const messages: Turn[] = [...history, { role: 'user', content: userMessage }]

    const startTime = Date.now()
    let llmResponse: string | null = null
    let usedModel = 'gemini'

    try {
      llmResponse = (await chatWithGemini(messages)) || null
      usedModel = 'gemini'
    } catch {
      try {
        llmResponse = (await chatWithGPT(messages)) || null
        usedModel = 'gpt'
      } catch {
        llmResponse = (await chatWithClaude(messages)) || null
        usedModel = 'claude'
      }
    }

    const responseTime = Date.now() - startTime

    if (!llmResponse) {
      throw new Error('No response from LLM')
    }

    // Extract the structured requirements block and strip it from the reply.
    // The closing tag is optional in the strip so a reply truncated mid-block
    // doesn't leak raw JSON into the chat bubble.
    const reqMatch = llmResponse.match(/\[REQUIREMENTS_JSON\]([\s\S]*?)(?:\[\/REQUIREMENTS_JSON\]|$)/)
    const displayContent = llmResponse
      .replace(/\[REQUIREMENTS_JSON\][\s\S]*$/, '')
      .trim()

    const { requirements } = reqMatch
      ? extractRequirements(reqMatch[1])
      : { requirements: [] }

    const llmDisplayResponse = displayContent || llmResponse

    await prisma.chatMessage.create({
      data: {
        content: userMessage,
        role: 'USER',
        userId: user.id,
        projectId: targetProjectId,
      },
    })

    await prisma.chatMessage.create({
      data: {
        content: llmDisplayResponse,
        role: 'ASSISTANT',
        userId: user.id,
        projectId: targetProjectId,
        llmModel: usedModel,
        responseTime,
      },
    })

    const savedRequirements: any[] = []
    for (const req of requirements) {
      try {
        const saved = await prisma.requirement.create({
          data: {
            ...req,
            source: 'CHAT_INPUT',
            llmModel: usedModel,
            projectId: targetProjectId,
          },
        })
        savedRequirements.push(saved)
      } catch (reqError) {
        console.error('Failed to save chat requirement:', reqError)
      }
    }

    return NextResponse.json({
      success: true,
      message: llmDisplayResponse,
      requirements: savedRequirements,
      model: usedModel,
      responseTime,
    })
  } catch (error) {
    // Validation failures happen before any provider call, so refund the unit.
    if (quotaConsumedBy && error instanceof PublicError) {
      await refundQuota(quotaConsumedBy, 'chat')
    }
    return apiError('Chat API error', error)
  }
}
