import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Auth guard at the edge.
 *
 * Written as an explicit middleware rather than `export { default } from
 * 'next-auth/middleware'` for two reasons:
 *
 *  1. `config.matcher` is an optimisation, not a security boundary. Turbopack
 *     (Next 15.5) silently discards it and compiles the matcher down to
 *     `/:path*`, which made this middleware run on *every* route — including
 *     `/login`, which then redirected to the sign-in page in a loop. Doing the
 *     path check in code means the behaviour is the same either way.
 *  2. API routes should answer an unauthenticated request with a 401 JSON body,
 *     not a 307 to an HTML page. `fetch` callers can act on the former.
 *
 * Routes still call requireAuth() themselves; this is defence in depth.
 * /api/auth/* is deliberately not protected — NextAuth's own endpoints and
 * signup must stay reachable without a session.
 */

const PROTECTED_PAGES = [/^\/dashboard(\/|$)/]

const PROTECTED_APIS = [
  /^\/api\/(upload|process-document|chat|generate-srs|export-requirements|usage)(\/|$)/,
  /^\/api\/(requirements|projects|trello)(\/|$)/,
  // Authentication only. The ADMIN check is deliberately not done here: the JWT
  // carries the role from sign-in, so an account promoted afterwards would be
  // refused at the edge while the database says it is an admin. requireAdmin()
  // and the admin page both re-read the role from the database instead.
  /^\/api\/admin(\/|$)/,
]

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const isProtectedPage = PROTECTED_PAGES.some(pattern => pattern.test(pathname))
  const isProtectedApi = PROTECTED_APIS.some(pattern => pattern.test(pathname))

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next()
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (token) {
    return NextResponse.next()
  }

  if (isProtectedApi) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const signInUrl = new URL('/login', request.url)
  signInUrl.searchParams.set('callbackUrl', `${pathname}${search}`)
  return NextResponse.redirect(signInUrl)
}

// Kept so the middleware isn't invoked for static assets on bundlers that do
// honour it. The path checks above are what actually enforce access.
export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
