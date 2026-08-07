/**
 * Input size caps.
 *
 * Quotas bound the *number* of LLM calls; these bound the *cost of each one*.
 * Without them a single request that counts as "1 chat" could carry a
 * multi-megabyte prompt, so the two layers are both needed.
 *
 * Roughly 4 characters per token, so 12,000 chars is ~3k input tokens.
 */

/** Largest accepted upload. Anything bigger is rejected before it is read. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/**
 * Where uploaded files are written.
 *
 * Defaults to `<cwd>/uploads` for local development. In a container deployment
 * this MUST point at a mounted volume (e.g. `/data/uploads`), otherwise every
 * redeploy silently discards the participants' source documents.
 */
export function uploadDir(): string {
  return process.env.UPLOAD_DIR || 'uploads'
}

/**
 * PDFs above this size are not sent to the multimodal model. Every PDF upload
 * triggers a full-document model call (text extraction is delegated to the LLM),
 * so this is the single most expensive path in the app.
 */
export const MAX_PDF_BYTES_FOR_LLM = 2 * 1024 * 1024

/** Document text sent to the model for requirement extraction. */
export const MAX_DOCUMENT_TEXT_CHARS = 30_000

/** Document text persisted to the database, to bound row growth. */
export const MAX_STORED_TEXT_CHARS = 60_000

/** A single chat turn. Generous because the upload page pastes document context. */
export const MAX_CHAT_MESSAGE_CHARS = 12_000

/** Conversation history accepted from the client. */
export const MAX_HISTORY_MESSAGES = 6
export const MAX_HISTORY_TOTAL_CHARS = 12_000
export const MAX_HISTORY_MESSAGE_CHARS = 4_000

/** Requirements fed into a single SRS generation prompt. */
export const MAX_SRS_REQUIREMENTS = 60

/** Requirements exported to Trello in one run (also bounds Trello API calls). */
export const MAX_TRELLO_REQUIREMENTS = 60

/** Requirements sent to the sub-task generation prompt. */
export const MAX_SUBTASK_REQUIREMENTS = 30

/**
 * Output token caps, applied to every provider.
 *
 * These must be generous enough for the model to finish the JSON structure it
 * was asked for. A cap that truncates mid-array is worse than no cap at all:
 * the response becomes unparseable and the whole analysis is wasted. 8,000 is
 * within the output ceiling of all three models used here
 * (gemini-2.5-flash-lite, gpt-4o-mini, claude-3-5-haiku).
 */
export const MAX_OUTPUT_TOKENS = {
  chat: 2_000,
  analysis: 8_000,
  /** PDF analysis echoes the document's extracted text, so it needs the most room. */
  pdfExtraction: 8_000,
  srs: 8_000,
  subTasks: 2_000,
} as const

/**
 * Requirements accepted from a single analysis. Also stated in the prompt, so
 * the model consolidates rather than having its output silently cut here.
 */
export const MAX_REQUIREMENTS_PER_DOCUMENT = 25

/** Free-text field caps for non-LLM writes, to bound database growth. */
export const MAX_PROJECT_NAME_CHARS = 120
export const MAX_PROJECT_DESCRIPTION_CHARS = 1_000
export const MAX_REQUIREMENT_TITLE_CHARS = 300
export const MAX_REQUIREMENT_DESCRIPTION_CHARS = 5_000

/**
 * Truncate `text` to `max` characters, appending a marker so the model is told
 * the input was cut rather than silently reasoning over a partial document.
 */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n\n[... truncated: document exceeds the ${max.toLocaleString()} character limit for analysis ...]`
}

/** Hard cut with no marker, for values being persisted rather than prompted. */
export function clamp(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max)
}
