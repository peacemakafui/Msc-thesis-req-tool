import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { PublicError } from './apiError'

export interface SessionUser {
  id: string
  email: string | null | undefined
  name: string | null | undefined
  role: string
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return null
  }

  return {
    id: (session.user as any).id,
    email: session.user.email,
    name: session.user.name,
    role: (session.user as any).role
  }
}

/** Message shown to a participant whose account an admin has deactivated. */
export const SUSPENDED_MESSAGE =
  'This account has been deactivated. Please contact the researcher.'

/**
 * Require a signed-in, active account.
 *
 * The role and block state are read from the database rather than taken from the
 * JWT. The token is issued at sign-in and is not revalidated, so a session
 * minted before an admin deactivated the account would otherwise keep working
 * until it expired — which would make the "deactivate" action in the admin
 * dashboard advisory rather than real. One primary-key lookup per request is a
 * cheap price for that guarantee.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { blocked: true, role: true },
  })

  // The row is gone (deleted account) but the cookie is still valid.
  if (!account) {
    throw new Error('Unauthorized')
  }

  if (account.blocked) {
    throw new PublicError(SUSPENDED_MESSAGE, 403)
  }

  return { ...user, role: account.role }
}
