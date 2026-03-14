'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Edit2, Save, AlertCircle, FileText, Calendar, TrendingUp } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface RequirementModalProps {
  requirement: {
    id: string
    title: string
    description: string
    type: string
    priority: string
    source: string
    confidence?: number
    sourceText?: string
    rationale?: string
    createdAt: string
    updatedAt?: string
    project?: {
      id: string
      name: string
    }
    document?: {
      id: string
      originalName: string
    }
  } | null
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export default function RequirementModal({ requirement, isOpen, onClose, onUpdate }: RequirementModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: '',
    priority: ''
  })

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (requirement) {
      setFormData({
        title: requirement.title,
        description: requirement.description,
        type: requirement.type,
        priority: requirement.priority
      })
    }
  }, [requirement])

  const handleSave = async () => {
    if (!requirement) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/requirements/${requirement.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Failed to update requirement')
      }

      toast.success('Requirement updated successfully!')
      setIsEditing(false)
      onUpdate()
    } catch (error) {
      console.error('Update error:', error)
      toast.error('Failed to update requirement')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (requirement) {
      setFormData({
        title: requirement.title,
        description: requirement.description,
        type: requirement.type,
        priority: requirement.priority
      })
    }
    setIsEditing(false)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'FUNCTIONAL': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'NON_FUNCTIONAL': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      case 'BUSINESS': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400'
      case 'USER_STORY': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-400'
      case 'ACCEPTANCE_CRITERIA': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  if (!isOpen || !requirement || !mounted) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          {/* Header */}
          <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                Requirement Details
              </h3>
              <div className="flex items-center space-x-2">
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Edit requirement"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
            {isEditing ? (
              /* Edit Mode */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="FUNCTIONAL">Functional</option>
                      <option value="NON_FUNCTIONAL">Non-Functional</option>
                      <option value="BUSINESS">Business</option>
                      <option value="USER_STORY">User Story</option>
                      <option value="ACCEPTANCE_CRITERIA">Acceptance Criteria</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="space-y-6">
                {/* Title and Badges */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {requirement.title}
                  </h2>
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(requirement.type)}`}>
                      {requirement.type.replace('_', ' ')}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(requirement.priority)}`}>
                      {requirement.priority}
                    </span>
                    {requirement.confidence && (
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium flex items-center">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {Math.round(requirement.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                    Description
                  </h3>
                  <p className="text-gray-900 dark:text-white leading-relaxed whitespace-pre-wrap">
                    {requirement.description}
                  </p>
                </div>

                {/* Rationale */}
                {requirement.rationale && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Rationale
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {requirement.rationale}
                    </p>
                  </div>
                )}

                {/* Source Text */}
                {requirement.sourceText && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                      Source Text
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap">
                        {requirement.sourceText}
                      </p>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                    Metadata
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Source:</span>
                      <span className="ml-2 text-gray-900 dark:text-white font-medium">
                        {requirement.source.replace('_', ' ')}
                      </span>
                    </div>
                    {requirement.project && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Project:</span>
                        <span className="ml-2 text-gray-900 dark:text-white font-medium">
                          {requirement.project.name}
                        </span>
                      </div>
                    )}
                    {requirement.document && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Document:</span>
                        <span className="ml-2 text-gray-900 dark:text-white font-medium">
                          {requirement.document.originalName}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-gray-500 dark:text-gray-400">Created:</span>
                      <span className="ml-2 text-gray-900 dark:text-white font-medium">
                        {new Date(requirement.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {requirement.updatedAt && (
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-gray-500 dark:text-gray-400">Updated:</span>
                        <span className="ml-2 text-gray-900 dark:text-white font-medium">
                          {new Date(requirement.updatedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {isEditing && (
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center transition-colors"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
