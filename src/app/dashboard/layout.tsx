import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { ShieldOff } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { isBootstrapAdminEmail } from "@/lib/admin"
import Sidebar from "@/components/Sidebar"
import SignOutButton from "@/components/SignOutButton"
import { Card } from "@/components/ui"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await getCurrentUser()

  // The middleware matcher already covers /dashboard, but guarding here too means
  // the layout never renders with an empty session.
  if (!user?.id) {
    redirect('/login')
  }

  // Read the role and block state from the database rather than the session: the
  // JWT is issued at sign-in and never revalidated, so an account deactivated or
  // promoted mid-session would otherwise keep its old state until the token
  // expired. This is the page-level counterpart to requireAuth().
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, blocked: true, blockedReason: true },
  })

  if (!account) {
    redirect('/login')
  }

  const email = user.email ?? ''
  const userName = user.name || email || 'Participant'

  // A deactivated participant gets the notice instead of the app. Signing out is
  // the only action offered — there is nothing here they can still use.
  if (account.blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md px-6 py-10 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-critical-soft text-critical">
            <ShieldOff className="h-5 w-5" />
          </div>
          <h1 className="text-base font-semibold text-ink">Account deactivated</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
            {account.blockedReason
              ? `This account has been deactivated: ${account.blockedReason}`
              : 'This account has been deactivated. Please contact the researcher if you think this is a mistake.'}
          </p>
          <div className="mt-6 flex justify-center">
            <SignOutButton />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ADMIN_EMAILS counts here too, so the first admin of a fresh deployment
          can find the page before the role has been written to the database. */}
      <Sidebar
        userName={userName}
        userEmail={email}
        isAdmin={account.role === 'ADMIN' || isBootstrapAdminEmail(email)}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
