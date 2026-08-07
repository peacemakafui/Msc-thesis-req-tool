import { NextResponse } from 'next/server'
import { RateLimitError } from './rateLimit'

/**
 * Shared error responder for API routes.
 *
 * Two things it fixes:
 *  - `requireAuth()` throws a plain Error, which several routes previously let
 *    fall into a generic 500. Unauthenticated requests now get a 401.
 *  - Raw error messages (Prisma, provider SDKs) were being returned to the
 *    client. In production the client gets a generic message; the detail is
 *    logged server-side only.
 */

/** Thrown for expected, client-facing failures whose message is safe to return. */
export class PublicError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400
  ) {
    super(message)
    this.name = 'PublicError'
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof Error && error.message === 'Unauthorized'
}

export function apiError(context: string, error: unknown): NextResponse {
  if (isUnauthorized(error)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { success: false, error: error.message, isLifetime: error.isLifetime },
      { status: 429 }
    )
  }

  if (error instanceof PublicError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }

  console.error(`${context}:`, error)

  const detail =
    process.env.NODE_ENV === 'production'
      ? 'Something went wrong. Please try again.'
      : error instanceof Error
        ? error.message
        : 'Internal server error'

  return NextResponse.json({ success: false, error: detail }, { status: 500 })
}
