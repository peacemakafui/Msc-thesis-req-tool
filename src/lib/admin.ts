import { prisma } from './prisma'
import { PublicError } from './apiError'
import { getCurrentUser, type SessionUser } from './session'

/**
 * Admin authorisation.
 *
 * Two things can make an account an admin:
 *
 *  1. `role = ADMIN` on the user row — the normal case, set with
 *     `npm run db:make-admin -- <email>`.
 *  2. Its email appearing in the `ADMIN_EMAILS` env var — a bootstrap path for
 *     deployments where there is no shell to run the script in. On first check
 *     the role is promoted in the database so the two agree from then on.
 *
 * The role is always read from the database, never from the session JWT: the
 * token is minted at sign-in and never revalidated, so trusting it would mean a
 * demoted or deactivated admin kept their access until the token expired.
 */

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * True if this address is named in ADMIN_EMAILS.
 *
 * Exported so the dashboard layout can show the Admin link on the very first
 * sign-in of a bootstrap admin. The database promotion happens in
 * `getAdminUser()`, which only runs once an admin route is actually visited — so
 * without this, the first admin would have to know to type the URL by hand. This
 * only reveals the link; access is still decided by getAdminUser()/requireAdmin().
 */
export function isBootstrapAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmails().includes(email.toLowerCase())
}

export interface AdminUser extends SessionUser {
  email: string
}

/**
 * Resolve the current user if they are an active admin, otherwise null.
 * Used by pages, which redirect rather than throw.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const user = await getCurrentUser()
  if (!user?.id) return null

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, role: true, blocked: true },
  })

  // A deactivated account loses admin access too — otherwise an admin who
  // deactivated themselves by mistake would still hold the keys.
  if (!account || account.blocked) return null

  if (account.role === 'ADMIN') {
    return { id: account.id, email: account.email, name: account.name, role: 'ADMIN' }
  }

  if (adminEmails().includes(account.email.toLowerCase())) {
    // Promote so the database becomes the single source of truth, and the env
    // var can be removed once the first admin exists.
    await prisma.user.update({ where: { id: account.id }, data: { role: 'ADMIN' } })
    console.info(`Promoted ${account.email} to ADMIN via ADMIN_EMAILS`)
    return { id: account.id, email: account.email, name: account.name, role: 'ADMIN' }
  }

  return null
}

/**
 * Guard for admin API routes. Throws the same 403 for "signed in but not an
 * admin" as for "not signed in at all", so the existence of the admin surface
 * isn't confirmed to a participant probing it.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser()
  if (!admin) {
    throw new PublicError('Forbidden', 403)
  }
  return admin
}
