import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { getOverview, listUsers, quotaLimits } from '@/lib/adminData'
import { apiError } from '@/lib/apiError'

/**
 * Everything the admin dashboard renders, in one response.
 *
 * The page itself is a server component and reads these functions directly for
 * its first paint; this route exists so the client can refresh after blocking or
 * unblocking someone without a full navigation.
 */
export async function GET() {
  try {
    await requireAdmin()

    const [overview, users] = await Promise.all([getOverview(), listUsers()])

    return NextResponse.json({
      success: true,
      overview,
      users,
      limits: quotaLimits(),
    })
  } catch (error) {
    return apiError('Failed to load admin dashboard', error)
  }
}
