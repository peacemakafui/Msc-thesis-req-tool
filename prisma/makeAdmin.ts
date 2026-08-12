/**
 * Promote an account to ADMIN.
 *
 *   npm run db:make-admin -- researcher@example.com
 *
 * The alternative is the ADMIN_EMAILS env var, which the app honours on sign-in
 * (see src/lib/admin.ts) — use that where there is no shell, such as a container
 * deployment. This script is the local path, and it also reports who currently
 * holds admin access when run with no argument.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'node:path'

function databasePath(): string {
  const raw = (process.env.DATABASE_URL ?? 'file:./dev.db').replace(/^file:/, '')
  return path.isAbsolute(raw) ? raw : path.resolve('prisma', raw)
}

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databasePath() }) })

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()

  if (!email) {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true, blocked: true },
    })

    console.log('Usage: npm run db:make-admin -- <email>\n')
    console.log(
      admins.length
        ? `Current admins:\n${admins
            .map(a => `  - ${a.email}${a.blocked ? ' (deactivated)' : ''}`)
            .join('\n')}`
        : 'No admins yet.'
    )
    return
  }

  // Signup lowercases emails, but accounts created before that change may be
  // mixed case — match the same way the login flow does.
  const user =
    (await prisma.user.findUnique({ where: { email } })) ??
    (await prisma.user.findFirst({
      where: { email: { equals: process.argv[2].trim() } },
    }))

  if (!user) {
    console.error(`No account found for ${email}. Sign up first, then run this again.`)
    process.exitCode = 1
    return
  }

  if (user.role === 'ADMIN' && !user.blocked) {
    console.log(`${user.email} is already an admin.`)
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    // Promoting a deactivated account would produce an admin who cannot sign in,
    // so clear the block at the same time.
    data: { role: 'ADMIN', blocked: false, blockedAt: null, blockedReason: null, blockedBy: null },
  })

  console.log(`${user.email} is now an admin. Sign out and back in if you are currently signed in.`)
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
