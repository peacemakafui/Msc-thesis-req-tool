export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard/:path*', '/api/upload', '/api/process-document', '/api/requirements/:path*']
}
