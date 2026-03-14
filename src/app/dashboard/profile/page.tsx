import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { User, Mail, Briefcase, Building2, Calendar, FileText, MessageSquare, FolderOpen } from "lucide-react"
import SignOutButton from "@/components/SignOutButton"

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as any).id as string

  // Fetch user details and statistics
  const [user, stats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        organization: true,
        position: true,
        experience: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    Promise.all([
      prisma.project.count({ where: { userId } }),
      prisma.document.count({ where: { project: { userId } } }),
      prisma.requirement.count({ where: { project: { userId } } }),
      prisma.chatMessage.count({ where: { userId } })
    ])
  ])

  if (!user) {
    redirect('/login')
  }

  const [projectsCount, documentsCount, requirementsCount, messagesCount] = stats

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Manage your account information and view your activity
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {user.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                  <p className="text-gray-900 dark:text-white">{user.email}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Full Name</p>
                  <p className="text-gray-900 dark:text-white">{user.name || 'Not provided'}</p>
                </div>
              </div>

              {user.organization && (
                <div className="flex items-start space-x-3">
                  <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Organization</p>
                    <p className="text-gray-900 dark:text-white">{user.organization}</p>
                  </div>
                </div>
              )}

              {user.position && (
                <div className="flex items-start space-x-3">
                  <Briefcase className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Position</p>
                    <p className="text-gray-900 dark:text-white">{user.position}</p>
                  </div>
                </div>
              )}

              {user.experience && (
                <div className="flex items-start space-x-3">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Experience</p>
                    <p className="text-gray-900 dark:text-white">{user.experience}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Member Since</p>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(user.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Activity Statistics
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {projectsCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Projects</p>
            </div>

            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {documentsCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Documents</p>
            </div>

            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {requirementsCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Requirements</p>
            </div>

            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {messagesCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Chat Messages</p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Actions */}
      <div className="mt-8 flex justify-end space-x-4">
        <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          Edit Profile
        </button>
        <SignOutButton />
      </div>
    </div>
  )
}
