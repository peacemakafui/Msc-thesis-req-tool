import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { extractTextFromDocument } from '@/lib/fileProcessing'
import { analyzePDFWithGemini } from '@/lib/llm'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await requireAuth()
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only PDF, Word documents, and text files are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads')
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }

    // Generate unique filename
    const timestamp = Date.now()
    const filename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const filePath = join(uploadDir, filename)

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Extract text from document
    let extractedText = ''
    let extractionError = null
    let llmAnalysis = null
    try {
      extractedText = await extractTextFromDocument(filePath, file.type)
      console.log(`Successfully extracted ${extractedText.length} characters from ${file.name}`)
    } catch (error) {
      console.error('Text extraction failed:', error)
      extractionError = error instanceof Error ? error.message : 'Text extraction failed'
      
      // For PDFs that fail extraction, try LLM direct processing
      if (file.type === 'application/pdf') {
        try {
          console.log('Attempting LLM direct PDF analysis...')
          const base64PDF = buffer.toString('base64')
          const llmResponse = await analyzePDFWithGemini(base64PDF, file.name)
          
          // Parse the JSON response - handle markdown code blocks
          if (!llmResponse) {
            throw new Error('LLM response is empty or undefined')
          }
          
          // Clean the response - remove markdown code blocks if present
          let cleanResponse = llmResponse.trim()
          if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
          } else if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
          }
          
          // Try to parse JSON
          let parsedResponse
          try {
            parsedResponse = JSON.parse(cleanResponse)
          } catch (parseError) {
            console.error('JSON parse error:', parseError)
            console.error('Raw LLM response:', llmResponse)
            console.error('Cleaned response:', cleanResponse)
            throw new Error('LLM returned invalid JSON response')
          }
          
          extractedText = parsedResponse.extractedText || 'LLM extracted text not available'
          llmAnalysis = parsedResponse.requirements || []
          
          console.log(`LLM successfully processed PDF: ${extractedText.length} characters extracted, ${llmAnalysis.length} requirements generated`)
        } catch (llmError) {
          console.error('LLM PDF analysis failed:', llmError)
          extractedText = `Text extraction failed for this PDF file. This may be because:
1. The PDF contains only images (scanned document)
2. The PDF is encrypted or password-protected
3. The PDF uses unsupported encoding

Please try:
- Converting the PDF to a Word document (.docx)
- Converting the PDF to a text file (.txt)
- Using OCR software to extract text first

You can still generate requirements by describing the document content in the chat below.`
        }
      }
    }

    // Get or create a default project for the user
    const projectIdFromForm = formData.get('projectId') as string
    let project
    
    if (projectIdFromForm) {
      // Verify user owns this project
      project = await prisma.project.findUnique({
        where: {
          id: projectIdFromForm,
          userId: user.id
        }
      })
      
      if (!project) {
        return NextResponse.json(
          { success: false, error: 'Project not found or access denied' },
          { status: 403 }
        )
      }
    } else {
      // Fallback: Get or create a default project for the user
      project = await prisma.project.findFirst({
        where: {
          userId: user.id,
          name: 'Default Project'
        }
      })

      if (!project) {
        project = await prisma.project.create({
          data: {
            name: 'Default Project',
            description: 'Default project for uploaded documents',
            userId: user.id
          }
        })
      }
    }

    // Save document info to database
    const document = await prisma.document.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        filePath,
        extractedText: extractedText || null,
        status: 'PROCESSED',
        processedAt: new Date(),
        projectId: project.id
      },
    })

    return NextResponse.json({
      success: true,
      documentId: document.id,
      filename: document.filename,
      originalName: document.originalName,
      size: document.size,
      extractedText: extractedText, // Full text for immediate display
      extractionError: extractionError,
      llmAnalysis: llmAnalysis // Include LLM-generated requirements if available
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}