import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import {
  MAX_CHAT_MESSAGE_CHARS,
  MAX_DOCUMENT_TEXT_CHARS,
  MAX_OUTPUT_TOKENS,
  MAX_REQUIREMENTS_PER_DOCUMENT,
  MAX_SRS_REQUIREMENTS,
  MAX_SUBTASK_REQUIREMENTS,
  truncate,
} from './limits'

// OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Anthropic client
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Google GenAI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
})

const GEMINI_MODEL = 'gemini-2.5-flash-lite'
const GPT_MODEL = 'gpt-4o-mini'
const CLAUDE_MODEL = 'claude-3-5-haiku-20241022'

/**
 * Every call in this module caps its output tokens and truncates its input.
 * Quotas in rateLimit.ts bound how many calls a participant can make; these caps
 * bound what any single call can cost.
 */

const REQUIREMENTS_BLOCK_INSTRUCTION = `IMPORTANT: At the end of EVERY response you MUST append a requirements block in exactly this format (even if no requirements were discussed — output an empty array):
[REQUIREMENTS_JSON]
[{"title":"...","description":"...","type":"FUNCTIONAL","priority":"MEDIUM","confidence":0.85}]
[/REQUIREMENTS_JSON]
Valid types: FUNCTIONAL, NON_FUNCTIONAL, BUSINESS, USER_STORY, ACCEPTANCE_CRITERIA
Valid priorities: LOW, MEDIUM, HIGH, CRITICAL
Extract any requirements that were discussed. If nothing was discussed, output [].`

const CHAT_SYSTEM_PROMPT = `You are an expert software requirements analyst. Help users:
1. Clarify and refine their requirements
2. Identify missing requirements
3. Convert informal descriptions into structured requirements
4. Suggest improvements and best practices

Always provide specific, actionable requirements that can be implemented by developers.

${REQUIREMENTS_BLOCK_INSTRUCTION}`

type ChatMessage = { role: 'user' | 'assistant'; content: string }

/**
 * Log the real provider error server-side and raise a message that is safe to
 * surface. Provider errors can echo back prompt content and account detail, so
 * they must never reach the client verbatim.
 */
function providerFailure(provider: string, error: unknown): Error {
  console.error(`${provider} API error:`, error)
  return new Error(`${provider} request failed`)
}

/** Enforce the per-message cap on anything heading to a provider. */
function capMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(msg => ({
    role: msg.role,
    content: truncate(msg.content, MAX_CHAT_MESSAGE_CHARS),
  }))
}

const analysisPrompt = (text: string) => `You are an expert business analyst. Analyse ONLY the provided text and extract software requirements that are explicitly stated or clearly implied.

Document to analyse:
"""
${truncate(text, MAX_DOCUMENT_TEXT_CHARS)}
"""

GROUNDING
- Extract only from the text above. Do not invent requirements.
- If the text is thin, return few requirements. Fewer, well-formed requirements are better than many weak ones.

GRANULARITY — this matters most
- Produce between 5 and ${MAX_REQUIREMENTS_PER_DOCUMENT} requirements. Never exceed ${MAX_REQUIREMENTS_PER_DOCUMENT}.
- Do NOT create one requirement per sentence, clause, or comma-separated list item.
  A sentence like "offers reporting, integrations, and data security" describes
  capability areas, not three requirements — consolidate them into a single
  requirement, or expand the one that the document actually elaborates on.
- Each requirement must stand alone and be specific enough to implement and test.
- Reject anything that is only a noun phrase restating a feature name
  ("Robust Reporting", "Scalability", "Flexibility"). If you cannot say what the
  system must actually do, leave it out.

WRITING THE FIELDS
- "title": a short imperative capability, 3-10 words. Not a heading, not a slogan.
- "description": one or two complete sentences stating what the system must do
  and under what conditions. It must add information beyond the title — never
  restate the title as a sentence.
- "type": FUNCTIONAL (what it does) | NON_FUNCTIONAL (performance, security,
  usability, reliability) | BUSINESS (rules, policies, constraints) |
  USER_STORY (user-goal framing) | ACCEPTANCE_CRITERIA (testable condition)
- "priority": judge from the document's emphasis. Use the full range; do not mark
  everything HIGH.
- "confidence": calibrated 0.0-1.0. Use ~0.9 only when the text states the
  requirement outright, ~0.6 when you inferred it. Do not return 1.0 for everything.
- "sourceText": the shortest quote from the document supporting the requirement.

OUTPUT
Return ONLY a JSON array, with no prose before or after it:
[
  {
    "title": "...",
    "description": "...",
    "type": "FUNCTIONAL",
    "priority": "HIGH",
    "confidence": 0.85,
    "sourceText": "..."
  }
]`

// ── Gemini ────────────────────────────────────────────────────────────────────

export async function analyzeDocumentWithGemini(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: analysisPrompt(text),
      config: { maxOutputTokens: MAX_OUTPUT_TOKENS.analysis },
    })
    return response.text
  } catch (error) {
    throw providerFailure('Gemini', error)
  }
}

export async function chatWithGemini(messages: ChatMessage[]) {
  try {
    const conversationContext = capMessages(messages)
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n')

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `${CHAT_SYSTEM_PROMPT}\n\nConversation so far:\n${conversationContext}`,
      config: { maxOutputTokens: MAX_OUTPUT_TOKENS.chat },
    })
    return response.text
  } catch (error) {
    throw providerFailure('Gemini', error)
  }
}

export async function analyzePDFWithGemini(base64PDF: string, filename: string) {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
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
- Be conservative - don't invent requirements not supported by the content`,
            },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64PDF,
              },
            },
          ],
        },
      ],
      config: { maxOutputTokens: MAX_OUTPUT_TOKENS.pdfExtraction },
    })
    return response.text
  } catch (error) {
    throw providerFailure('Gemini', error)
  }
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

export async function analyzeDocumentWithGPT(text: string) {
  try {
    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS.analysis,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert business analyst specializing in software requirements gathering. Respond with only a valid JSON array.',
        },
        { role: 'user', content: analysisPrompt(text) },
      ],
      temperature: 0.3,
    })
    return response.choices[0]?.message?.content
  } catch (error) {
    throw providerFailure('OpenAI', error)
  }
}

export async function chatWithGPT(messages: ChatMessage[]) {
  try {
    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS.chat,
      messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...capMessages(messages)],
      temperature: 0.7,
    })
    return response.choices[0]?.message?.content
  } catch (error) {
    throw providerFailure('OpenAI', error)
  }
}

// ── Claude ────────────────────────────────────────────────────────────────────

export async function chatWithClaude(messages: ChatMessage[]) {
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS.chat,
      system: CHAT_SYSTEM_PROMPT,
      messages: capMessages(messages),
    })
    return response.content[0]?.type === 'text' ? response.content[0].text : null
  } catch (error) {
    throw providerFailure('Claude', error)
  }
}

export async function analyzeDocumentWithClaude(text: string) {
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS.analysis,
      messages: [{ role: 'user', content: analysisPrompt(text) }],
    })
    return response.content[0]?.type === 'text' ? response.content[0].text : null
  } catch (error) {
    throw providerFailure('Claude', error)
  }
}

// ── Unified analysis with fallback ────────────────────────────────────────────

/**
 * Try providers in order until one succeeds.
 *
 * Note that a failing provider can still have consumed input tokens before it
 * errored, so a request that falls all the way through costs more than one call.
 * That is the price of resilience; the per-user quota is what bounds it.
 */
export async function analyzeDocument(
  text: string,
  preferredModel: 'gemini' | 'gpt' | 'claude' = 'gemini'
) {
  const models = {
    gemini: analyzeDocumentWithGemini,
    gpt: analyzeDocumentWithGPT,
    claude: analyzeDocumentWithClaude,
  }

  const fallbackOrder =
    preferredModel === 'gemini'
      ? (['gemini', 'gpt', 'claude'] as const)
      : preferredModel === 'gpt'
        ? (['gpt', 'gemini', 'claude'] as const)
        : (['claude', 'gpt', 'gemini'] as const)

  for (const modelName of fallbackOrder) {
    try {
      const result = await models[modelName](text)
      if (result) return { result, model: modelName }
      console.warn(`${modelName} returned an empty response`)
    } catch (error) {
      console.error(`${modelName} failed:`, error instanceof Error ? error.message : error)
    }
  }

  throw new Error('All LLM providers failed')
}

// ── SRS generation ────────────────────────────────────────────────────────────

export async function generateSRSDocument(
  requirements: any[],
  projectName: string,
  projectDescription?: string
) {
  // Cap the requirement set so the prompt cannot grow without bound.
  const included = requirements.slice(0, MAX_SRS_REQUIREMENTS)
  const omitted = requirements.length - included.length

  const slim = included.map(req => ({
    title: req.title,
    description: req.description,
    type: req.type,
    priority: req.priority,
  }))

  const prompt = `You are a technical writer creating a Software Requirements Specification (SRS) document following IEEE 830 standard.

Project Name: ${projectName}
${projectDescription ? `Project Description: ${projectDescription}` : ''}

Requirements to include:
${JSON.stringify(slim, null, 2)}
${omitted > 0 ? `\nNote: ${omitted} further requirements were omitted to stay within length limits.` : ''}

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

  try {
    const geminiResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { maxOutputTokens: MAX_OUTPUT_TOKENS.srs },
    })
    if (geminiResponse.text) return geminiResponse.text
  } catch (error) {
    console.error('Gemini failed for SRS generation:', error)
  }

  try {
    const gptResponse = await openai.chat.completions.create({
      model: GPT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS.srs,
      messages: [
        {
          role: 'system',
          content:
            'You are a professional technical writer specializing in Software Requirements Specification documents.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    })
    const content = gptResponse.choices[0]?.message?.content
    if (content) return content
  } catch (error) {
    console.error('OpenAI failed for SRS generation:', error)
  }

  try {
    const claudeResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS.srs,
      messages: [{ role: 'user', content: prompt }],
    })
    const content = claudeResponse.content[0]
    if (content?.type === 'text') return content.text
  } catch (error) {
    console.error('Claude failed for SRS generation:', error)
  }

  throw new Error('All LLM providers failed for SRS generation')
}

// ── Trello sub-task generation ────────────────────────────────────────────────

/**
 * Generate technical sub-tasks for Trello card checklists.
 * Returns a map of requirementId → sub-task strings.
 */
export async function generateTrelloSubTasks(
  requirements: { id: string; title: string; description: string; type: string }[]
): Promise<Record<string, string[]>> {
  if (requirements.length === 0) return {}

  // Cap the batch so one export cannot build an unbounded prompt.
  const included = requirements.slice(0, MAX_SUBTASK_REQUIREMENTS)

  const prompt = `You are a senior software engineer helping a development team break down software requirements into concrete technical tasks.

For each requirement below, generate 3 to 5 specific, actionable technical sub-tasks a developer would put on their task board (e.g. "Create database schema for X", "Develop REST API endpoint for Y", "Build React component for Z", "Write unit tests for W").

Requirements:
${JSON.stringify(
  included.map(r => ({
    id: r.id,
    title: truncate(r.title, 300),
    description: truncate(r.description, 1_000),
  })),
  null,
  2
)}

Return ONLY a JSON object where keys are requirement IDs and values are arrays of sub-task strings. No extra text.
Example format:
{
  "req-id-1": ["Sub-task A", "Sub-task B", "Sub-task C"],
  "req-id-2": ["Sub-task D", "Sub-task E"]
}`

  const parseResult = (text: string | null | undefined): Record<string, string[]> => {
    if (!text) return {}
    try {
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch?.[1] ?? jsonMatch?.[0] ?? text
      const parsed = JSON.parse(jsonStr)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
      const result: Record<string, string[]> = {}
      for (const [key, val] of Object.entries(parsed)) {
        if (Array.isArray(val) && val.every(v => typeof v === 'string')) {
          // Bound both the number of sub-tasks and their length.
          result[key] = val.slice(0, 8).map(v => v.slice(0, 300))
        }
      }
      return result
    } catch {
      return {}
    }
  }

  try {
    const geminiResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { maxOutputTokens: MAX_OUTPUT_TOKENS.subTasks },
    })
    const result = parseResult(geminiResponse.text)
    if (Object.keys(result).length > 0) return result
  } catch (error) {
    console.error('Gemini failed for sub-task generation:', error)
  }

  try {
    const gptResponse = await openai.chat.completions.create({
      model: GPT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS.subTasks,
      messages: [
        { role: 'system', content: 'You are a senior software engineer. Respond with only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    })
    const result = parseResult(gptResponse.choices[0]?.message?.content)
    if (Object.keys(result).length > 0) return result
  } catch (error) {
    console.error('OpenAI failed for sub-task generation:', error)
  }

  try {
    const claudeResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS.subTasks,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = claudeResponse.content[0]?.type === 'text' ? claudeResponse.content[0].text : null
    return parseResult(text)
  } catch (error) {
    console.error('Claude failed for sub-task generation:', error)
    return {}
  }
}
