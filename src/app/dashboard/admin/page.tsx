import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin'
import { getOverview, listUsers, quotaLimits } from '@/lib/adminData'
import AdminDashboard from '@/components/admin/AdminDashboard'

/**
 * Admin dashboard.
 *
 * The role is checked here, server-side, before any data is read — the sidebar
 * link is only a convenience and hiding it is not the access control. A
 * non-admin is sent to their own dashboard rather than shown a "forbidden" page,
 * which keeps the admin surface unadvertised.
 */

// Always rendered fresh: these figures change on every participant request, and a
// cached page would show an admin stale sign-ups and spend.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Admin · ReqAssist',
}

export default async function AdminPage() {
  const admin = await getAdminUser()

  if (!admin) {
    redirect('/dashboard')
  }

  const [overview, users] = await Promise.all([getOverview(), listUsers()])

  return (
    <AdminDashboard
      initialData={{ overview, users, limits: quotaLimits() }}
      currentAdminId={admin.id}
    />
  )
}
