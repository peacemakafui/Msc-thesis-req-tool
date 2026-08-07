import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkIpRateLimit, getClientIp } from '@/lib/ipRateLimit'
import { apiError, PublicError } from '@/lib/apiError'
import { clamp } from '@/lib/limits'

/**
 * Participant signup.
 *
 * Per-user quotas are only meaningful if accounts are scarce — otherwise anyone
 * can reset their limits by registering again. Signup is therefore gated by a
 * shared access code you hand to participants, backed by a hard ceiling on total
 * accounts and a per-IP throttle.
 */

/** Total accounts allowed. Sized for the study; override with MAX_ACCOUNTS. */
const MAX_ACCOUNTS = Number.parseInt(process.env.MAX_ACCOUNTS ?? '60', 10)

/** Signup attempts allowed per IP per hour. */
const SIGNUP_ATTEMPTS_PER_HOUR = 5

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Constant-time compare so the code cannot be recovered by timing the response. */
function codeMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const throttle = checkIpRateLimit(`signup:${ip}`, SIGNUP_ATTEMPTS_PER_HOUR, 60 * 60 * 1000)

    if (!throttle.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many signup attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds) } }
      )
    }

    const body = await request.json()
    const { email, password, name, organization, position, experience, accessCode } = body ?? {}

    // ── Access code ──────────────────────────────────────────────────────────
    const expectedCode = process.env.PARTICIPANT_ACCESS_CODE

    if (!expectedCode) {
      // Fail closed. An unset code must not silently mean "open registration".
      console.error('PARTICIPANT_ACCESS_CODE is not set — refusing all signups.')
      throw new PublicError('Registration is not currently open. Please contact the researcher.', 503)
    }

    if (typeof accessCode !== 'string' || !codeMatches(accessCode.trim(), expectedCode)) {
      throw new PublicError('Invalid access code. Please check the code you were given.', 403)
    }

    // ── Field validation ─────────────────────────────────────────────────────
    if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
      throw new PublicError('A valid email address is required')
    }

    if (typeof password !== 'string' || password.length < 8) {
      throw new PublicError('Password must be at least 8 characters')
    }

    if (password.length > 200) {
      throw new PublicError('Password is too long')
    }

    // Normalise so casing cannot be used to register the same address twice.
    const normalizedEmail = email.trim().toLowerCase()

    let experienceYears: number | null = null
    if (experience !== undefined && experience !== null && experience !== '') {
      const parsed = Number.parseInt(String(experience), 10)
      // Guard against NaN reaching Prisma, and against absurd values.
      experienceYears = Number.isFinite(parsed) && parsed >= 0 && parsed <= 80 ? parsed : null
    }

    // ── Account ceiling ──────────────────────────────────────────────────────
    if (MAX_ACCOUNTS > 0) {
      const accounts = await prisma.user.count()
      if (accounts >= MAX_ACCOUNTS) {
        throw new PublicError(
          'The study has reached its participant capacity. Please contact the researcher.',
          403
        )
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existingUser) {
      throw new PublicError('An account with this email already exists')
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: typeof name === 'string' && name.trim() ? clamp(name.trim(), 120) : null,
        organization:
          typeof organization === 'string' && organization.trim()
            ? clamp(organization.trim(), 160)
            : null,
        position:
          typeof position === 'string' && position.trim() ? clamp(position.trim(), 160) : null,
        experience: experienceYears,
      },
    })

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (error) {
    return apiError('Signup error', error)
  }
}
