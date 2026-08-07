import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Resolve the SQLite file path from DATABASE_URL.
 *
 * IMPORTANT: a *relative* DATABASE_URL is resolved differently here than by the
 * Prisma CLI, which reads prisma.config.ts. Locally the two happen to agree
 * (`file:./dev.db` → `<root>/prisma/dev.db`), but the disagreement is real and
 * would mean `prisma db push` migrating one file while the app reads another.
 *
 * In production always set an ABSOLUTE path — e.g. `file:/data/prod.db` — which
 * both resolvers treat identically, and which is what puts the database on a
 * mounted volume rather than the container's ephemeral disk.
 */
function resolveDatabasePath(): string {
  const rawUrl = (process.env.DATABASE_URL ?? 'file:./dev.db').replace(/^file:/, '')

  if (path.isAbsolute(rawUrl)) return rawUrl

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      `DATABASE_URL is a relative path ("${rawUrl}"). In production this should be an ` +
        'absolute path on a mounted volume, or the database is lost on every redeploy.'
    )
  }

  return path.resolve('prisma', rawUrl)
}

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: resolveDatabasePath() })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
