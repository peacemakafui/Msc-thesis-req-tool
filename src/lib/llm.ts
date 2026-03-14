import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import {GoogleGenAI} from '@google/genai'

// OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Anthropic client
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Google GenAI client - Updated to use new package
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})

export async function analyzeDocumentWithGemini(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: `You are an expert business analyst. Carefully analyze ONLY the provided text and extract requirements that are explicitly mentioned or clearly implied in the document.

CRITICAL INSTRUCTIONS:
- ONLY extract requirements from the actual content provided
- DO NOT invent or assume requirements not mentioned in the text
- Focus on what the system/product actually needs to do based on the description
- Be conservative - if unsure, don't include it

Document to analyze:
"${text}"

Based ONLY on the above text, extract software requirements in these categories:
- FUNCTIONAL: What the system must do
- NON_FUNCTIONAL: Performance, security, usability requirements  
- BUSINESS: Business rules and constraints
- USER_STORY: User-focused requirements
- ACCEPTANCE_CRITERIA: Testable conditions

Return ONLY requirements that are clearly supported by the provided text.

Format as JSON array:
[
  {
    "title": "Requirement Title",
    "description": "Detailed description based on the text",
    "type": "FUNCTIONAL|NON_FUNCTIONAL|BUSINESS|USER_STORY|ACCEPTANCE_CRITERIA", 
    "priority": "LOW|MEDIUM|HIGH|CRITICAL",
    "confidence": 0.85,
    "sourceText": "quote from original text that supports this requirement"
  }
]`
    })

    return response.text
  } catch (error) {
    console.error('Gemini API Error:', error)
    throw new Error(`Failed to analyze document with Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function chatWithGemini(messages: Array<{role: 'user' | 'assistant', content: string}>) {
  try {
    // For chat, we'll use the latest message as the prompt and include context
    const conversationContext = messages.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n\n')

    const systemPrompt = `You are an expert software requirements analyst. Help users:
    1. Clarify and refine their requirements
    2. Identify missing requirements
    3. Convert informal descriptions into structured requirements
    4. Suggest improvements and best practices
    
    Always provide specific, actionable requirements that can be implemented by developers.
    
    Conversation so far:
    ${conversationContext}`

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: systemPrompt
    })

    return response.text
  } catch (error) {
    console.error('Gemini Chat Error:', error)
    throw new Error(`Failed to chat with Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function analyzePDFWithGemini(base64PDF: string, filename: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are an expert business analyst. This is a PDF document (${filename}). Please:

1. First, extract ALL readable text from the PDF document
2. Then, analyze the extracted text and generate software requirements

Return your response in this exact JSON format:
{
  "extractedText": "The complete text extracted from the PDF",
  "requirements": [
    {
      "title": "Requirement Title",
      "description": "Detailed description based on the text",
      "type": "FUNCTIONAL|NON_FUNCTIONAL|BUSINESS|USER_STORY|ACCEPTANCE_CRITERIA", 
      "priority": "LOW|MEDIUM|HIGH|CRITICAL",
      "confidence": 0.85,
      "sourceText": "quote from extracted text that supports this requirement"
    }
  ]
}

IMPORTANT: 
- Extract text accurately from the PDF
- Only generate requirements based on the actual content
- If the PDF is image-based, use OCR-like reasoning to extract text
- Be conservative - don't invent requirements not supported by the content`
            },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64PDF
              }
            }
          ]
        }
      ]
    })

    return response.text
  } catch (error) {
    console.error('Gemini PDF Analysis Error:', error)
    throw new Error(`Failed to analyze PDF with Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// OpenAI GPT-4 functions
export async function analyzeDocumentWithGPT(text: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert business analyst specializing in software requirements gathering. 
          Analyze the provided text and extract software requirements in the following categories:
          - Functional Requirements
          - Non-Functional Requirements
          - Business Requirements
          - User Stories
          - Acceptance Criteria
          
          Format your response as a JSON array of requirements with the following structure:
          [
            {
              "title": "Requirement Title",
              "description": "Detailed description",
              "type": "FUNCTIONAL|NON_FUNCTIONAL|BUSINESS|USER_STORY|ACCEPTANCE_CRITERIA",
              "priority": "LOW|MEDIUM|HIGH|CRITICAL",
              "confidence": 0.85
            }
          ]`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
    })

    return response.choices[0]?.message?.content
  } catch (error) {
    console.error('OpenAI API Error:', error)
    throw new Error(`Failed to analyze document with GPT: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function chatWithGPT(messages: Array<{role: 'user' | 'assistant', content: string}>) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert software requirements analyst. Help users:
          1. Clarify and refine their requirements
          2. Identify missing requirements
          3. Convert informal descriptions into structured requirements
          4. Suggest improvements and best practices
          
          Always provide specific, actionable requirements that can be implemented by developers.`
        },
        ...messages
      ],
      temperature: 0.7,
    })

    return response.choices[0]?.message?.content
  } catch (error) {
    console.error('OpenAI Chat Error:', error)
    throw new Error(`Failed to chat with GPT: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Claude functions
export async function analyzeDocumentWithClaude(text: string) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `As an expert business analyst, analyze this text and extract software requirements:

          ${text}

          Return a JSON array of requirements with this structure:
          [
            {
              "title": "Requirement Title",
              "description": "Detailed description", 
              "type": "FUNCTIONAL|NON_FUNCTIONAL|BUSINESS|USER_STORY|ACCEPTANCE_CRITERIA",
              "priority": "LOW|MEDIUM|HIGH|CRITICAL",
              "confidence": 0.85
            }
          ]`
        }
      ]
    })

    return response.content[0]?.type === 'text' ? response.content[0].text : null
  } catch (error) {
    console.error('Claude API Error:', error)
    throw new Error(`Failed to analyze document with Claude: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Unified analysis function with automatic fallback
export async function analyzeDocument(text: string, preferredModel: 'gemini' | 'gpt' | 'claude' = 'gemini') {
  const models = {
    gemini: analyzeDocumentWithGemini,
    gpt: analyzeDocumentWithGPT,
    claude: analyzeDocumentWithClaude
  }

  const fallbackOrder = preferredModel === 'gemini' 
    ? ['gemini', 'gpt', 'claude']
    : preferredModel === 'gpt'
    ? ['gpt', 'gemini', 'claude']
    : ['claude', 'gpt', 'gemini']

  for (const modelName of fallbackOrder) {
    try {
      console.log(`Attempting analysis with ${modelName}...`)
      const result = await models[modelName as keyof typeof models](text)
      console.log(`Successfully analyzed with ${modelName}`)
      return { result, model: modelName }
    } catch (error) {
      console.error(`${modelName} failed:`, error instanceof Error ? error.message : error)
      if (modelName === fallbackOrder[fallbackOrder.length - 1]) {
        // Last model in fallback chain
        throw error
      }
      // Continue to next model
      console.log(`Falling back to next model...`)
    }
  }


  throw new Error('All LLM providers failed')
}

// Generate complete SRS document from requirements
export async function generateSRSDocument(requirements: any[], projectName: string, projectDescription?: string) {
  const requirementsByType = requirements.reduce((acc, req) => {
    if (!acc[req.type]) acc[req.type] = []
    acc[req.type].push(req)
    return acc
  }, {} as Record<string, any[]>)

  const prompt = `You are a technical writer creating a Software Requirements Specification (SRS) document following IEEE 830 standard.

Project Name: ${projectName}
${projectDescription ? `Project Description: ${projectDescription}` : ''}

Requirements to include:
${JSON.stringify(requirements, null, 2)}

Generate a comprehensive, professional SRS document with the following sections:

1. Introduction
   1.1 Purpose
   1.2 Scope
   1.3 Definitions, Acronyms, and Abbreviations
   1.4 References
   1.5 Overview

2. Overall Description
   2.1 Product Perspective
   2.2 Product Functions
   2.3 User Characteristics
   2.4 Constraints
   2.5 Assumptions and Dependencies

3. Specific Requirements
   3.1 Functional Requirements
   3.2 Non-Functional Requirements
   3.3 Business Requirements
   3.4 User Stories
   3.5 Acceptance Criteria

4. System Features
   4.1 Feature Descriptions
   4.2 Priority Levels

5. External Interface Requirements
   5.1 User Interfaces
   5.2 Hardware Interfaces
   5.3 Software Interfaces
   5.4 Communications Interfaces

6. Quality Attributes
   6.1 Performance Requirements
   6.2 Security Requirements
   6.3 Reliability Requirements
   6.4 Maintainability

Use the provided requirements to populate relevant sections. Be professional, detailed, and comprehensive.
Format the output in Markdown with proper headings, bullet points, and numbered lists.`

  // Try Gemini first (since user has credits)
  try {
    console.log('Generating SRS document with Gemini...')
    const geminiResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt
    })

    console.log('SRS document generated successfully with Gemini')
    return geminiResponse.text
  } catch (geminiError) {
    console.warn('Gemini failed for SRS generation, trying GPT:', geminiError)
    
    try {
      const gptResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a professional technical writer specializing in Software Requirements Specification documents.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      })

      console.log('SRS document generated successfully with GPT')
      return gptResponse.choices[0]?.message?.content || null
    } catch (gptError) {
      console.warn('GPT failed for SRS generation, trying Claude:', gptError)
      
      try {
        const claudeResponse = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
        })

        const content = claudeResponse.content[0]
        return content.type === 'text' ? content.text : null
      } catch (claudeError) {
        console.error('Claude failed for SRS generation:', claudeError)
        throw new Error('All LLM providers failed for SRS generation')
      }
    }
  }
}
