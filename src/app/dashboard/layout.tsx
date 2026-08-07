import { ReactNode } from "react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import Sidebar from "@/components/Sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await getServerSession(authOptions)

  // The middleware matcher already covers /dashboard, but guarding here too means
  // the layout never renders with an empty session.
  if (!session?.user) {
    redirect('/login')
  }

  const email = session.user.email ?? ''
  const userName = session.user.name || email || 'Participant'

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar userName={userName} userEmail={email} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
