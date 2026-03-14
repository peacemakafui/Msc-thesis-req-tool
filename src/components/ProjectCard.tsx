'use client'

import { useState } from 'react'
import { FileText, Calendar, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ProjectCardProps {
  project: {
    id: string
    name: string
    description: string | null
    createdAt: Date
    _count: {
      documents: number
      requirements: number
    }
  }
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = async () => {
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete project')
      }

      // Refresh the page to show updated list
      router.refresh()
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project. Please try again.')
    } finally {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate mb-1">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                {project.description}
              </p>
            )}
          </div>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={`ml-2 p-2 transition-colors ${
              showConfirm
                ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded'
                : 'text-gray-400 hover:text-red-600 dark:hover:text-red-400'
            } ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={showConfirm ? 'Click again to confirm deletion' : 'Delete project'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {showConfirm && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200 font-medium">
              Click the trash icon again to confirm deletion
            </p>
            <button
              onClick={() => setShowConfirm(false)}
              className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
          <Calendar className="h-4 w-4 mr-1" />
          {new Date(project.createdAt).toLocaleDateString()}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {project._count.documents}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Documents</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {project._count.requirements}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Requirements</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <a
            href={`/dashboard/projects/${project.id}`}
            className="block text-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            View Project
          </a>
        </div>
      </div>
    </div>
  )
}
