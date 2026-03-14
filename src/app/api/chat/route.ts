import { NextRequest, NextResponse } from 'next/server'
import { chatWithGemini, chatWithGPT } from '@/lib/llm'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await requireAuth()
    
    const { message, conversationHistory, projectId } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    // Prepare conversation history for LLM
    const messages = conversationHistory?.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content
    })) || []

    // Add current message
    messages.push({ role: 'user', content: message })

    // Get response from LLM with fallback
    const startTime = Date.now()
    let llmResponse: string | null = null
    let usedModel = 'gemini'
    
    try {
      // Try Gemini first (user has credits)
      console.log('Attempting chat with Gemini...')
      const geminiResponse = await chatWithGemini(messages)
      llmResponse = geminiResponse || null
      usedModel = 'gemini'
      console.log('Chat successful with Gemini')
    } catch (geminiError) {
      console.warn('Gemini failed, trying GPT:', geminiError)
      try {
        const gptResponse = await chatWithGPT(messages)
        llmResponse = gptResponse || null
        usedModel = 'gpt'
        console.log('Chat successful with GPT')
      } catch (gptError) {
        console.error('Both Gemini and GPT failed')
        throw new Error('All LLM providers failed')
      }
    }
    
    const responseTime = Date.now() - startTime
    
    if (!llmResponse) {
      throw new Error('No response from LLM')
    }

    // Try to extract requirements if the response contains them
    let requirements: any[] = []
    try {
      // Check if the response contains JSON with requirements
      const jsonMatch = llmResponse.match(/```json\n([\s\S]*?)\n```/) || 
                       llmResponse.match(/\[[\s\S]*\]/)
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0]
        const parsed = JSON.parse(jsonStr)
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
          requirements = parsed
        }
      }
    } catch (e) {
      // Not a problem if we can't parse requirements
      console.log('No requirements found in response')
    }

    // Get or create default project if projectId not provided
    let targetProjectId = projectId
    if (!targetProjectId) {
      let project = await prisma.project.findFirst({
        where: {
          userId: user.id,
          name: 'Default Project'
        }
      })

      if (!project) {
        project = await prisma.project.create({
          data: {
            name: 'Default Project',
            description: 'Default project for chat sessions',
            userId: user.id
          }
        })
      }
      targetProjectId = project.id
    }

    // Save user message to database
    await prisma.chatMessage.create({
      data: {
        content: message,
        role: 'USER',
        userId: user.id,
        projectId: targetProjectId
      }
    })

    // Save assistant response to database
    await prisma.chatMessage.create({
      data: {
        content: llmResponse,
        role: 'ASSISTANT',
        userId: user.id,
        projectId: targetProjectId,
        llmModel: usedModel,
        responseTime
      }
    })

    return NextResponse.json({
      success: true,
      message: llmResponse,
      requirements: requirements,
      model: usedModel,
      responseTime
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}