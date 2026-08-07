/**
 * Trello REST API v1 helpers
 * Uses server-side API Key + Token from environment variables.
 * https://developer.atlassian.com/cloud/trello/rest/api-group-boards/
 */

const TRELLO_BASE = 'https://api.trello.com/1'

// Priority → Trello label colour mapping
export const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'red',
  HIGH: 'orange',
  MEDIUM: 'yellow',
  LOW: 'green',
}

/** Carries the HTTP status so callers can tell "board is gone" from a real failure. */
export class TrelloApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'TrelloApiError'
  }
}

function getCredentials(): { key: string; token: string } {
  const key = process.env.TRELLO_API_KEY
  const token = process.env.TRELLO_TOKEN
  if (!key || !token) {
    throw new Error('Trello credentials not configured. Set TRELLO_API_KEY and TRELLO_TOKEN in your environment.')
  }
  return { key, token }
}

// ─── base fetch ─────────────────────────────────────────────────────────────

async function trelloFetch<T = unknown>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: Record<string, unknown>
): Promise<T> {
  const { key, token } = getCredentials()
  const url = new URL(`${TRELLO_BASE}${path}`)
  url.searchParams.set('key', key)
  url.searchParams.set('token', token)

  const res = await fetch(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new TrelloApiError(
      `Trello API ${method} ${path} failed (${res.status}): ${text}`,
      res.status
    )
  }

  return res.json() as Promise<T>
}

// ─── boards ──────────────────────────────────────────────────────────────────

export async function createBoard(
  name: string,
  description: string | undefined | null
): Promise<{ id: string; url: string }> {
  const board = await trelloFetch<{ id: string; url: string; shortUrl: string }>(
    '/boards',
    'POST',
    {
      name,
      desc: description ?? '',
      defaultLists: false,
      // Anyone with the link can view the board — no Trello account required
      prefs_permissionLevel: 'public',
    }
  )
  return { id: board.id, url: board.shortUrl ?? board.url }
}

/**
 * True if the board still exists, is open, and the configured token can reach it.
 *
 * A board that was deleted in Trello — or created under different credentials —
 * answers 404, and Trello also uses 404 for boards the token may not see. An
 * archived (closed) board answers 200 but rejects writes. In every one of those
 * cases the stored id is unusable, so the caller should create a replacement.
 */
export async function boardIsReachable(boardId: string): Promise<boolean> {
  try {
    const board = await trelloFetch<{ closed: boolean }>(
      `/boards/${boardId}?fields=id,closed`,
      'GET'
    )
    return !board.closed
  } catch (error) {
    if (error instanceof TrelloApiError && (error.status === 404 || error.status === 401)) {
      return false
    }
    throw error
  }
}

// ─── lists ────────────────────────────────────────────────────────────────────

interface TrelloList {
  id: string
  name: string
  closed: boolean
}

export async function getOrCreateLists(
  boardId: string,
  listNames: string[]
): Promise<Record<string, string>> {
  const existing = await trelloFetch<TrelloList[]>(`/boards/${boardId}/lists`, 'GET')
  const result: Record<string, string> = {}

  for (const name of listNames) {
    const found = existing.find(l => l.name === name && !l.closed)
    if (found) {
      result[name] = found.id
    } else {
      const created = await trelloFetch<{ id: string }>(
        `/boards/${boardId}/lists`,
        'POST',
        { name, pos: 'bottom' }
      )
      result[name] = created.id
    }
  }

  return result
}

// ─── labels ──────────────────────────────────────────────────────────────────

interface TrelloLabel {
  id: string
  name: string
  color: string
}

export async function getOrCreateLabel(
  boardId: string,
  name: string,
  color: string
): Promise<string> {
  const labels = await trelloFetch<TrelloLabel[]>(`/boards/${boardId}/labels`, 'GET')
  const found = labels.find(l => l.name === name && l.color === color)
  if (found) return found.id

  const created = await trelloFetch<{ id: string }>(
    `/labels`,
    'POST',
    { name, color, idBoard: boardId }
  )
  return created.id
}

// ─── cards ────────────────────────────────────────────────────────────────────

export async function createCard(
  listId: string,
  name: string,
  desc: string,
  labelIds: string[]
): Promise<{ id: string }> {
  return trelloFetch<{ id: string }>(
    '/cards',
    'POST',
    {
      idList: listId,
      name,
      desc,
      idLabels: labelIds,
      pos: 'bottom',
    }
  )
}

// ─── checklists ───────────────────────────────────────────────────────────────

export async function createChecklist(
  cardId: string,
  name: string,
  items: string[]
): Promise<void> {
  const checklist = await trelloFetch<{ id: string }>(
    '/checklists',
    'POST',
    { idCard: cardId, name }
  )

  for (const item of items) {
    await trelloFetch(
      `/checklists/${checklist.id}/checkItems`,
      'POST',
      { name: item, checked: false }
    )
  }
}
