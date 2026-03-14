import { ReactNode } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { User } from "lucide-react"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await getServerSession(authOptions)
  const userName = session?.user?.name || session?.user?.email || 'User'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-800 shadow-sm min-h-screen">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              LLM Requirements
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Requirements Gathering Tool
            </p>
          </div>
          
          <nav className="mt-6">
            <div className="px-3">
              <a
                href="/dashboard"
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Dashboard
              </a>
              <a
                href="/dashboard/upload"
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 mt-1"
              >
                Upload Documents
              </a>
              <a
                href="/dashboard/chat"
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 mt-1"
              >
                Chat with AI
              </a>
              <a
                href="/dashboard/requirements"
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 mt-1"
              >
                Requirements
              </a>
              <a
                href="/dashboard/projects"
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 mt-1"
              >
                Projects
              </a>
            </div>

            {/* User Section */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <a
                href="/dashboard/profile"
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <User className="h-4 w-4 mr-2" />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{userName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">View Profile</p>
                </div>
              </a>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}