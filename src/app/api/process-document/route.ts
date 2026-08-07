import { NextRequest, NextResponse } from 'next/server'
import { analyzeDocument } from '@/lib/llm'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { consumeLlmCall } from '@/lib/rateLimit'
import { apiError, PublicError } from '@/lib/apiError'
import { MAX_DOCUMENT_TEXT_CHARS } from '@/lib/limits'
import { extractRequirements } from '@/lib/parseRequirements'

/** Ceiling on LLM analysis runs per document, so a failing document cannot be retried forever. */
const MAX_ANALYSIS_ATTEMPTS = 3

export async function POST(request: NextRequest) {
  let documentId: string | undefined

  try {
    const user = await requireAuth()

    const body = await request.json()
    documentId = typeof body?.documentId === 'string' ? body.documentId : undefined

    if (!documentId) {
      throw new PublicError('Document ID is required')
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        project: { select: { id: true, userId: true } },
        _count: { select: { requirements: true } },
      },
    })

    if (!document) {
      throw new PublicError('Document not found', 404)
    }

    if (document.project.userId !== user.id) {
      throw new PublicError('Unauthorized', 403)
    }

    // Already analysed: return what was stored instead of paying for the same
    // work twice. This also makes the upload page's retry behaviour free.
    if (document._count.requirements > 0) {
      const existing = await prisma.requirement.findMany({
        where: { documentId: document.id },
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          priority: true,
          confidence: true,
          llmModel: true,
        },
      })
      return NextResponse.json({ success: true, requirements: existing, cached: true })
    }

    if (document.analysisAttempts >= MAX_ANALYSIS_ATTEMPTS) {
      throw new PublicError(
        'This document could not be analysed after several attempts. Please upload a different file.',
        409
      )
    }

    if (!document.extractedText?.trim()) {
      throw new PublicError('No text content available for processing')
    }

    // The document quota was charged at upload time. This still enforces the
    // kill switch, the per-user ceiling and the deployment-wide daily ceiling.
    await consumeLlmCall(user.id)

    // Count the attempt before the call, so a crash mid-request still counts.
    await prisma.document.update({
      where: { id: documentId },
      data: { analysisAttempts: { increment: 1 } },
    })

    const startTime = Date.now()
    const { result: llmResponse, model: usedModel } = await analyzeDocument(
      // llm.ts truncates too; doing it here keeps the cap visible at the call site.
      document.extractedText.slice(0, MAX_DOCUMENT_TEXT_CHARS),
      'gemini'
    )
    const responseTime = Date.now() - startTime

    if (!llmResponse) {
      throw new Error('No response from LLM')
    }

    // Recovers whatever the model completed, even if it stopped mid-array.
    const { requirements, truncated } = extractRequirements(llmResponse)

    if (truncated) {
      console.warn(
        `Model output was truncated for document ${documentId}; salvaged ${requirements.length} requirements`
      )
    }

    // Storing the raw response as a placeholder requirement (the old fallback)
    // produced unusable rows that then flowed into SRS and Trello exports.
    // Failing outright is more honest, and the attempt counter bounds retries.
    if (requirements.length === 0) {
      console.error(
        'No requirements could be parsed from model response:',
        llmResponse.slice(0, 500)
      )
      throw new PublicError(
        'The document could not be analysed into structured requirements. It may not contain enough detail — try a more descriptive document.',
        422
      )
    }

    const savedRequirements = []
    for (const req of requirements) {
      try {
        const requirement = await prisma.requirement.create({
          data: {
            ...req,
            source: 'DOCUMENT_UPLOAD',
            llmModel: usedModel,
            projectId: document.projectId,
            documentId: document.id,
            processing: {
              create: {
                processingType: 'LLM_ANALYSIS',
                model: usedModel,
                responseTime,
                success: true,
              },
            },
          },
        })
        savedRequirements.push(requirement)
      } catch (reqError) {
        console.error('Failed to save requirement:', reqError)
      }
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSED', processedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      requirements: savedRequirements.map(req => ({
        id: req.id,
        title: req.title,
        description: req.description,
        type: req.type,
        priority: req.priority,
        confidence: req.confidence,
      })),
      model: usedModel,
      responseTime,
    })
  } catch (error) {
    // Mark the document as errored, but only for genuine processing failures —
    // a validation rejection leaves the document usable.
    if (documentId && !(error instanceof PublicError)) {
      try {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'ERROR' },
        })
      } catch (updateError) {
        console.error('Failed to update document status:', updateError)
      }
    }

    return apiError('Document processing error', error)
  }
}
