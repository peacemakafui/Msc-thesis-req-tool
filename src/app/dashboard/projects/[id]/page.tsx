import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { FileText, MessageSquare, Calendar, Edit, Trash2 } from "lucide-react"

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as any).id as string

  // Fetch project with all related data
  const project = await prisma.project.findUnique({
    where: {
      id: params.id
    },
    include: {
      documents: {
        orderBy: {
          createdAt: 'desc'
        }
      },
      requirements: {
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      },
      _count: {
        select: {
          documents: true,
          requirements: true,
          chatMessages: true
        }
      }
    }
  })

  if (!project) {
    notFound()
  }

  // Verify ownership
  if (project.userId !== userId) {
    redirect('/dashboard/projects')
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {project.name}
              </h1>
              <button
                className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Edit project"
              >
                <Edit className="h-5 w-5" />
              </button>
              <button
                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Delete project"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
            {project.description && (
              <p className="text-gray-600 dark:text-gray-300">
                {project.description}
              </p>
            )}
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-2">
              <Calendar className="h-4 w-4 mr-1" />
              Created {new Date(project.createdAt).toLocaleDateString()}
            </div>
          </div>
          
          <div className="flex space-x-3">
            <a
              href={`/dashboard/upload?projectId=${project.id}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Document
            </a>
            <a
              href={`/dashboard/chat?projectId=${project.id}`}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Start Chat
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {project._count.documents}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Documents</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {project._count.requirements}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Requirements</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {project._count.chatMessages}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Chat Messages</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Documents */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Documents
            </h2>
            <a
              href={`/dashboard/upload?projectId=${project.id}`}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Upload New
            </a>
          </div>
          <div className="p-6">
            {project.documents.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No documents yet</p>
                <p className="text-sm">Upload documents to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {project.documents.slice(0, 5).map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {doc.originalName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {project.documents.length > 5 && (
                  <p className="text-sm text-center text-gray-500 dark:text-gray-400 pt-2">
                    + {project.documents.length - 5} more documents
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Requirements
            </h2>
            <a
              href={`/dashboard/requirements?projectId=${project.id}`}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View All
            </a>
          </div>
          <div className="p-6">
            {project.requirements.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No requirements yet</p>
                <p className="text-sm">Upload documents or chat with AI to generate requirements</p>
              </div>
            ) : (
              <div className="space-y-3">
                {project.requirements.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      {req.title}
                    </p>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className={`px-2 py-0.5 rounded ${
                        req.priority === 'HIGH' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                        req.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                        'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      }`}>
                        {req.priority}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                        {req.type}
                      </span>
                    </div>
                  </div>
                ))}
                {project._count.requirements > 10 && (
                  <p className="text-sm text-center text-gray-500 dark:text-gray-400 pt-2">
                    + {project._count.requirements - 10} more requirements
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
