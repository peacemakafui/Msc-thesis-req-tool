import { FileText, MessageSquare, Upload, BarChart3 } from "lucide-react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as any).id as string

  // Fetch user's stats
  const [requirementsCount, documentsCount, projectsCount, messagesCount] = await Promise.all([
    prisma.requirement.count({
      where: {
        project: {
          userId
        }
      }
    }),
    prisma.document.count({
      where: {
        project: {
          userId
        }
      }
    }),
    prisma.project.count({
      where: {
        userId
      }
    }),
    prisma.chatMessage.count({
      where: {
        userId
      }
    })
  ])

  // Get recent activity
  const recentDocuments = await prisma.document.findMany({
    where: {
      project: {
        userId
      }
    },
    include: {
      project: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5
  })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Welcome to your requirements gathering workspace
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Total Requirements
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">{requirementsCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Upload className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Documents Processed
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">{documentsCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MessageSquare className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    AI Conversations
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">{Math.ceil(messagesCount / 2)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Projects
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">{projectsCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Recent Activity
            </h3>
          </div>
          <div className="p-6">
            {recentDocuments.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                No recent activity yet. Start by uploading a document or chatting with AI.
              </div>
            ) : (
              <div className="space-y-4">
                {recentDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-start space-x-3 text-sm">
                    <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white font-medium truncate">
                        {doc.originalName}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">
                        {doc.project.name} • {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Quick Actions
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <a
              href="/dashboard/upload"
              className="flex items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Upload Document
              </span>
            </a>
            
            <a
              href="/dashboard/chat"
              className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            >
              <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400 mr-3" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Start AI Chat
              </span>
            </a>

            <a
              href="/dashboard/projects/new"
              className="flex items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-3" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Create New Project
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}