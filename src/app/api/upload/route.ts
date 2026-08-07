import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join, resolve } from 'path'
import { randomUUID } from 'crypto'
import { extractTextFromDocument } from '@/lib/fileProcessing'
import { analyzePDFWithGemini } from '@/lib/llm'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { consumeQuota, refundQuota } from '@/lib/rateLimit'
import { apiError, PublicError } from '@/lib/apiError'
import {
  clamp,
  MAX_PDF_BYTES_FOR_LLM,
  MAX_STORED_TEXT_CHARS,
  MAX_UPLOAD_BYTES,
  uploadDir,
} from '@/lib/limits'

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
}

const PDF_FALLBACK_MESSAGE = `Text extraction failed for this PDF file. This may be because:
1. The PDF contains only images (scanned document)
2. The PDF is encrypted or password-protected
3. The PDF uses unsupported encoding

Please try:
- Converting the PDF to a Word document (.docx)
- Converting the PDF to a text file (.txt)
- Using OCR software to extract text first

You can still generate requirements by describing the document content in the chat below.`

export async function POST(request: NextRequest) {
  let quotaConsumedBy: string | null = null

  try {
    const user = await requireAuth()

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      throw new PublicError('No file provided')
    }

    // Validate the file *before* consuming quota, so a bad request is free.
    const extension = ALLOWED_TYPES[file.type]
    if (!extension) {
      throw new PublicError(
        'Invalid file type. Only PDF, Word documents, and text files are allowed.'
      )
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new PublicError(
        `File too large. Maximum size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`
      )
    }

    if (file.size === 0) {
      throw new PublicError('File is empty.')
    }

    // Resolve the target project before spending quota, for the same reason.
    const projectIdFromForm = formData.get('projectId')
    let project

    if (typeof projectIdFromForm === 'string' && projectIdFromForm) {
      project = await prisma.project.findFirst({
        where: { id: projectIdFromForm, userId: user.id },
      })
      if (!project) {
        throw new PublicError('Project not found or access denied', 403)
      }
    } else {
      project = await prisma.project.findFirst({
        where: { userId: user.id, name: 'Default Project' },
      })
      if (!project) {
        project = await prisma.project.create({
          data: {
            name: 'Default Project',
            description: 'Default project for uploaded documents',
            userId: user.id,
          },
        })
      }
    }

    // A document costs one unit of the document quota. This is charged here
    // rather than in /api/process-document because uploading a PDF already
    // triggers a full-document model call during text extraction, and this route
    // is the only entry point for creating a document.
    await consumeQuota(user.id, 'document')
    quotaConsumedBy = user.id

    // Resolved against cwd when relative, so UPLOAD_DIR can be an absolute
    // volume path in production.
    const targetDir = resolve(process.cwd(), uploadDir())
    await mkdir(targetDir, { recursive: true })

    // Never build a path from user-controlled input: a crafted filename could
    // otherwise escape the upload directory. The original name is kept in the
    // database column, and the stored name is a random identifier.
    const filename = `${Date.now()}-${randomUUID()}.${extension}`
    const filePath = join(targetDir, filename)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    let extractedText = ''
    let extractionError: string | null = null
    let llmAnalysis: unknown[] | null = null

    try {
      extractedText = await extractTextFromDocument(filePath, file.type)
    } catch (error) {
      console.error('Text extraction failed:', error)
      extractionError = 'Text extraction failed'

      // PDFs always land here: extractTextFromPDF throws by design so the
      // multimodal model handles both text and scanned PDFs. That call sends the
      // whole document, so it is gated on size.
      if (file.type === 'application/pdf') {
        if (file.size > MAX_PDF_BYTES_FOR_LLM) {
          extractedText = `This PDF is too large for automatic analysis (limit ${Math.floor(
            MAX_PDF_BYTES_FOR_LLM / (1024 * 1024)
          )}MB). Please upload a smaller PDF, or convert it to .docx or .txt.`
          extractionError = 'PDF too large for analysis'
        } else {
          try {
            const llmResponse = await analyzePDFWithGemini(buffer.toString('base64'), file.name)
            if (!llmResponse) throw new Error('LLM response is empty')

            let cleanResponse = llmResponse.trim()
            if (cleanResponse.startsWith('```json')) {
              cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
            } else if (cleanResponse.startsWith('```')) {
              cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
            }

            const parsed = JSON.parse(cleanResponse)
            extractedText =
              typeof parsed.extractedText === 'string'
                ? parsed.extractedText
                : 'LLM extracted text not available'
            llmAnalysis = Array.isArray(parsed.requirements) ? parsed.requirements : []
          } catch (llmError) {
            console.error('LLM PDF analysis failed:', llmError)
            extractedText = PDF_FALLBACK_MESSAGE
          }
        }
      }
    }

    // Bound what is persisted so a large upload cannot bloat the database.
    const storedText = clamp(extractedText, MAX_STORED_TEXT_CHARS)

    const document = await prisma.document.create({
      data: {
        filename,
        originalName: clamp(file.name, 255),
        mimeType: file.type,
        size: file.size,
        filePath,
        extractedText: storedText || null,
        status: 'PROCESSED',
        processedAt: new Date(),
        projectId: project.id,
      },
    })

    return NextResponse.json({
      success: true,
      documentId: document.id,
      filename: document.filename,
      originalName: document.originalName,
      size: document.size,
      extractedText: storedText,
      extractionError,
      llmAnalysis,
    })
  } catch (error) {
    // Refund quota only for failures that happened before any model call —
    // PublicError covers validation, which is always pre-consumption.
    if (quotaConsumedBy && error instanceof PublicError) {
      await refundQuota(quotaConsumedBy, 'document')
    }
    return apiError('Upload error', error)
  }
}
