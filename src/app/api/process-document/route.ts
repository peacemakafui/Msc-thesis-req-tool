import { NextRequest, NextResponse } from 'next/server'
import { analyzeDocument } from '@/lib/llm'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'

export async function POST(request: NextRequest) {
  let documentId: string | undefined
  
  try {
    // Get authenticated user
    const user = await requireAuth()
    
    const body = await request.json()
    documentId = body.documentId

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Get document from database and verify ownership
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { 
        project: {
          select: {
            id: true,
            userId: true
          }
        }
      }
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Verify user owns this document
    if (document.project.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    if (!document.extractedText) {
      return NextResponse.json(
        { success: false, error: 'No text content available for processing' },
        { status: 400 }
      )
    }

    // Analyze document with LLM (with automatic fallback)
    const startTime = Date.now()
    const { result: llmResponse, model: usedModel } = await analyzeDocument(
      document.extractedText,
      'gpt' // Start with GPT
    )
    const responseTime = Date.now() - startTime

    console.log(`Used model: ${usedModel}, Response time: ${responseTime}ms`)

    if (!llmResponse) {
      throw new Error('No response from LLM')
    }

    // Parse requirements from LLM response
    let requirements: any[] = []
    try {
      // Try to extract JSON from the response
      const jsonMatch = llmResponse.match(/```json\n([\s\S]*?)\n```/) || 
                       llmResponse.match(/\[[\s\S]*\]/)
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0]
        requirements = JSON.parse(jsonStr)
      } else {
        throw new Error('No valid JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse requirements:', parseError)
      
      // Fallback: create a single requirement with the full response
      requirements = [{
        title: 'Extracted Requirements',
        description: llmResponse,
        type: 'BUSINESS',
        priority: 'MEDIUM',
        confidence: 0.7
      }]
    }

    // Save requirements to database
    const savedRequirements = []
    for (const req of requirements) {
      try {
        const requirement = await prisma.requirement.create({
          data: {
            title: req.title || 'Untitled Requirement',
            description: req.description || '',
            type: req.type || 'FUNCTIONAL',
            priority: req.priority || 'MEDIUM',
            source: 'DOCUMENT_UPLOAD',
            confidence: req.confidence || null,
            llmModel: 'gemini-2.0-flash-exp',
            projectId: document.projectId,
            documentId: document.id,
            processing: {
              create: {
                processingType: 'LLM_ANALYSIS',
                model: 'gemini-2.0-flash-exp',
                responseTime,
                success: true
              }
            }
          }
        })
        savedRequirements.push(requirement)
      } catch (reqError) {
        console.error('Failed to save requirement:', reqError)
      }
    }

    // Update document status
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'PROCESSED',
        processedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      requirements: savedRequirements.map(req => ({
        id: req.id,
        title: req.title,
        description: req.description,
        type: req.type,
        priority: req.priority,
        confidence: req.confidence
      })),
      model: 'gemini-2.0-flash-exp',
      responseTime
    })

  } catch (error) {
    console.error('Document processing error:', error)
    
    // Update document status to error if we have a documentId
    try {
      const { documentId } = await request.json()
      if (documentId) {
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: 'ERROR'
          }
        })
      }
    } catch (updateError) {
      console.error('Failed to update document status:', updateError)
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}