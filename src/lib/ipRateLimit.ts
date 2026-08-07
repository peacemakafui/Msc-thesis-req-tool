import { NextRequest } from 'next/server'

/**
 * In-memory per-IP throttle for unauthenticated endpoints (signup), where there
 * is no user record to hang a quota off.
 *
 * Deliberately simple: a fixed-window counter in process memory. That is
 * sufficient for a single-instance VPS deployment. It does NOT survive restarts
 * and is NOT shared across instances — if this app is ever scaled horizontally,
 * this needs to move to the database or a shared cache.
 */

type Window = { count: number; resetAt: number }

const windows = new Map<string, Window>()

/** Evict expired entries so the map cannot grow without bound. */
function sweep(now: number): void {
  if (windows.size < 5_000) return
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key)
  }
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * Consume one unit from `key`'s window. Returns false when the caller has
 * exceeded `limit` requests within `windowMs`.
 */
export function checkIpRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  sweep(now)

  const existing = windows.get(key)

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}
