import {
  clamp,
  MAX_REQUIREMENT_DESCRIPTION_CHARS,
  MAX_REQUIREMENT_TITLE_CHARS,
  MAX_REQUIREMENTS_PER_DOCUMENT,
} from './limits'

/**
 * Parsing model output into requirements.
 *
 * Models wrap JSON in prose, in ``` fences, or stop mid-array when they reach
 * their output ceiling. A strict `JSON.parse` of the whole blob throws on all
 * three, and the previous behaviour on a throw was to store the raw response as
 * a single requirement — which produced cards titled "Extracted Requirements"
 * containing a wall of JSON.
 *
 * So parsing is layered: try the whole array, and if that fails, recover every
 * complete object from what did arrive. A truncated response then yields all
 * the requirements the model finished, losing only the one it was mid-way
 * through.
 */

// Mirrors the ReqType / Priority enums in schema.prisma. Declared as literal
// unions so the sanitised output is assignable to Prisma's create input without
// a cast — a typo here becomes a compile error rather than a runtime failure.
const VALID_TYPES = [
  'FUNCTIONAL',
  'NON_FUNCTIONAL',
  'BUSINESS',
  'USER_STORY',
  'ACCEPTANCE_CRITERIA',
] as const
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

type RequirementType = (typeof VALID_TYPES)[number]
type RequirementPriority = (typeof VALID_PRIORITIES)[number]

const isType = (value: unknown): value is RequirementType =>
  typeof value === 'string' && (VALID_TYPES as readonly string[]).includes(value)

const isPriority = (value: unknown): value is RequirementPriority =>
  typeof value === 'string' && (VALID_PRIORITIES as readonly string[]).includes(value)

export interface ParsedRequirement {
  title: string
  description: string
  type: RequirementType
  priority: RequirementPriority
  confidence: number | null
  sourceText?: string
}

/**
 * Scan for balanced top-level `{...}` objects, tracking string state so braces
 * inside string values don't corrupt the depth count. Anything after the last
 * complete object — the half-written one — is simply not returned.
 */
function extractCompleteObjects(source: string): string[] {
  const objects: string[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let i = 0; i < source.length; i++) {
    const char = source[i]

    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }

    if (char === '"') {
      inString = true
    } else if (char === '{') {
      if (depth === 0) start = i
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        objects.push(source.slice(start, i + 1))
        start = -1
      }
      if (depth < 0) depth = 0
    }
  }

  return objects
}

/** Strip markdown fences, including an unterminated one from a truncated reply. */
function stripFences(text: string): string {
  const closed = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (closed) return closed[1].trim()
  return text.replace(/^\s*```(?:json)?\s*/, '').trim()
}

/**
 * Extract a requirement array from raw model output.
 *
 * `truncated` is true when the response had to be salvaged, which tells the
 * caller the model ran out of room rather than genuinely finding this many.
 */
export function parseRequirementArray(raw: string | null | undefined): {
  requirements: unknown[]
  truncated: boolean
} {
  if (!raw?.trim()) return { requirements: [], truncated: false }

  let text = stripFences(raw.trim())

  // Drop any preamble before the array/object actually starts.
  const arrayStart = text.indexOf('[')
  const objectStart = text.indexOf('{')
  const start =
    arrayStart === -1 ? objectStart : objectStart === -1 ? arrayStart : Math.min(arrayStart, objectStart)
  if (start > 0) text = text.slice(start)

  // Happy path: the model returned well-formed, complete JSON.
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return { requirements: parsed, truncated: false }
    if (parsed && typeof parsed === 'object') return { requirements: [parsed], truncated: false }
  } catch {
    // Fall through and salvage.
  }

  const requirements: unknown[] = []
  for (const chunk of extractCompleteObjects(text)) {
    try {
      requirements.push(JSON.parse(chunk))
    } catch {
      // A single malformed object shouldn't discard the rest.
    }
  }

  return { requirements, truncated: requirements.length > 0 }
}

/** Coerce one model-produced object into a row that is safe to store. */
export function sanitizeRequirement(input: any): ParsedRequirement | null {
  const title = typeof input?.title === 'string' ? input.title.trim() : ''
  if (!title) return null

  const description =
    typeof input?.description === 'string' && input.description.trim()
      ? input.description.trim()
      : title

  const confidence =
    typeof input?.confidence === 'number' && input.confidence >= 0 && input.confidence <= 1
      ? input.confidence
      : null

  return {
    title: clamp(title, MAX_REQUIREMENT_TITLE_CHARS),
    description: clamp(description, MAX_REQUIREMENT_DESCRIPTION_CHARS),
    type: isType(input?.type) ? input.type : 'FUNCTIONAL',
    priority: isPriority(input?.priority) ? input.priority : 'MEDIUM',
    confidence,
    sourceText:
      typeof input?.sourceText === 'string' && input.sourceText.trim()
        ? clamp(input.sourceText.trim(), 1_000)
        : undefined,
  }
}

/**
 * Full pipeline: raw model output → validated, de-duplicated requirement rows.
 * Returns an empty array when nothing usable was produced, so callers can fail
 * honestly instead of inventing a placeholder requirement.
 */
export function extractRequirements(raw: string | null | undefined): {
  requirements: ParsedRequirement[]
  truncated: boolean
} {
  const { requirements: parsed, truncated } = parseRequirementArray(raw)

  const seen = new Set<string>()
  const requirements: ParsedRequirement[] = []

  for (const candidate of parsed) {
    const requirement = sanitizeRequirement(candidate)
    if (!requirement) continue

    // Models frequently restate the same requirement; keep the first wording.
    const key = requirement.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (seen.has(key)) continue
    seen.add(key)

    requirements.push(requirement)
    if (requirements.length >= MAX_REQUIREMENTS_PER_DOCUMENT) break
  }

  return { requirements, truncated }
}
