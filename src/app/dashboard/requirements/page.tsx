'use client'

import { useState, useEffect, useRef } from 'react'
import { FileText, Filter, Download, Edit, Trash2, Eye, FileCode } from 'lucide-react'
import { toast } from 'react-hot-toast'
import RequirementModal from '@/components/RequirementModal'

interface Requirement {
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
}

export default function RequirementsPage() {
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [filteredRequirements, setFilteredRequirements] = useState<Requirement[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [generatingSRS, setGeneratingSRS] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState({
    type: 'ALL',
    priority: 'ALL',
    source: 'ALL',
    projectId: ''
  })

  useEffect(() => {
    fetchRequirements()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [requirements, filter])

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu])

  const fetchRequirements = async () => {
    try {
      const response = await fetch('/api/requirements')
      if (response.ok) {
        const data = await response.json()
        setRequirements(data.requirements || [])
      }
    } catch (error) {
      console.error('Failed to fetch requirements:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...requirements]

    if (filter.type !== 'ALL') {
      filtered = filtered.filter(req => req.type === filter.type)
    }
    if (filter.priority !== 'ALL') {
      filtered = filtered.filter(req => req.priority === filter.priority)
    }
    if (filter.source !== 'ALL') {
      filtered = filtered.filter(req => req.source === filter.source)
    }

    setFilteredRequirements(filtered)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'text-red-600 bg-red-50 dark:bg-red-900/20'
      case 'HIGH': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
      case 'LOW': return 'text-green-600 bg-green-50 dark:bg-green-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'FUNCTIONAL': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
      case 'NON_FUNCTIONAL': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20'
      case 'BUSINESS': return 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
      case 'USER_STORY': return 'text-teal-600 bg-teal-50 dark:bg-teal-900/20'
      case 'ACCEPTANCE_CRITERIA': return 'text-pink-600 bg-pink-50 dark:bg-pink-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-800'
    }
  }

  const handleEdit = (requirementId: string) => {
    const req = requirements.find(r => r.id === requirementId)
    if (req) {
      setSelectedRequirement(req)
      setIsModalOpen(true)
    }
  }

  const handleViewDetails = (requirement: Requirement) => {
    setSelectedRequirement(requirement)
    setIsModalOpen(true)
  }

  const handleDelete = async (requirementId: string) => {
    if (!confirm('Are you sure you want to delete this requirement?')) return

    try {
      const response = await fetch(`/api/requirements/${requirementId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete requirement')
      }

      // Refresh requirements list
      await fetchRequirements()
      toast.success('Requirement deleted successfully!')

    } catch (error) {
      toast.error('Failed to delete requirement')
      console.error('Delete error:', error)
    }
  }

  const handleGenerateSRS = async () => {
    if (requirements.length === 0) {
      toast.error('No requirements to generate SRS from')
      return
    }

    // Get unique project ID from requirements (assuming all from same project for now)
    const projectId = requirements[0]?.project?.id
    
    if (!projectId) {
      toast.error('Unable to determine project')
      return
    }

    setGeneratingSRS(true)
    
    try {
      const response = await fetch('/api/generate-srs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate SRS document')
      }

      const data = await response.json()
      
      // Download as markdown file
      const blob = new Blob([data.document], { type: 'text/markdown' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${data.metadata.projectName.replace(/\s+/g, '_')}_SRS_${new Date().toISOString().split('T')[0]}.md`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('SRS document generated and downloaded!')

    } catch (error) {
      toast.error('Failed to generate SRS document')
      console.error('SRS generation error:', error)
    } finally {
      setGeneratingSRS(false)
    }
  }

  const handleExport = async (format: 'markdown' | 'word' | 'json') => {
    if (requirements.length === 0) {
      toast.error('No requirements to export')
      return
    }

    setExporting(false)
    setShowExportMenu(false)

    try {
      const projectId = requirements[0]?.project?.id

      const response = await fetch('/api/export-requirements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          format,
          filters: filter
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to export requirements')
      }

      if (format === 'word') {
        // Handle Word document binary response
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const projectName = requirements[0]?.project?.name || 'Requirements'
        a.download = `${projectName.replace(/\s+/g, '_')}_Requirements_${new Date().toISOString().split('T')[0]}.docx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success(`Exported ${requirements.length} requirements as Word document`)
      } else {
        // Handle text-based formats
        const data = await response.json()
        const blob = new Blob([data.content], { type: data.mimeType })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = data.filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success(`Exported ${data.count} requirements as ${format.toUpperCase()}`)
      }

    } catch (error) {
      toast.error('Failed to export requirements')
      console.error('Export error:', error)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Requirements</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Manage and review your generated software requirements
            </p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={handleGenerateSRS}
              disabled={generatingSRS || requirements.length === 0}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              {generatingSRS ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <FileCode className="h-4 w-4 mr-2" />
                  Generate SRS
                </>
              )}
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exporting || requirements.length === 0}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting ? 'Exporting...' : 'Export'}
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                  <div className="py-1">
                    <button
                      onClick={() => handleExport('markdown')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      📝 Markdown (.md)
                    </button>
                    <button
                      onClick={() => handleExport('word')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      � Word (.docx)
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      � JSON (.json)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <Filter className="h-5 w-5 text-gray-400" />
          <div className="flex space-x-4">
            <select
              value={filter.type}
              onChange={(e) => setFilter(prev => ({...prev, type: e.target.value}))}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="ALL">All Types</option>
              <option value="FUNCTIONAL">Functional</option>
              <option value="NON_FUNCTIONAL">Non-Functional</option>
              <option value="BUSINESS">Business</option>
              <option value="USER_STORY">User Story</option>
              <option value="ACCEPTANCE_CRITERIA">Acceptance Criteria</option>
            </select>

            <select
              value={filter.priority}
              onChange={(e) => setFilter(prev => ({...prev, priority: e.target.value}))}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={filter.source}
              onChange={(e) => setFilter(prev => ({...prev, source: e.target.value}))}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="ALL">All Sources</option>
              <option value="DOCUMENT_UPLOAD">Document Upload</option>
              <option value="CHAT_INPUT">Chat Input</option>
              <option value="MANUAL_INPUT">Manual Input</option>
              <option value="LLM_GENERATED">LLM Generated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requirements List */}
      {filteredRequirements.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No requirements found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Upload documents or start a chat session to generate requirements.
          </p>
          <div className="flex justify-center space-x-4">
            <a
              href="/dashboard/upload"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Upload Document
            </a>
            <a
              href="/dashboard/chat"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Start Chat
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequirements.map((requirement) => (
            <div
              key={requirement.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {requirement.title}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(requirement.type)}`}>
                      {requirement.type.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(requirement.priority)}`}>
                      {requirement.priority}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                    {requirement.description}
                  </p>
                  
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
                    <span>Source: {requirement.source.replace('_', ' ')}</span>
                    {requirement.confidence && (
                      <span>Confidence: {Math.round(requirement.confidence * 100)}%</span>
                    )}
                    <span>{new Date(requirement.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex space-x-2 ml-4">
                  <button 
                    onClick={() => handleViewDetails(requirement)}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleEdit(requirement.id)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(requirement.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results Summary */}
      {filteredRequirements.length > 0 && (
        <div className="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center">
          Showing {filteredRequirements.length} of {requirements.length} requirements
        </div>
      )}

      {/* Requirement Detail Modal */}
      <RequirementModal
        requirement={selectedRequirement}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedRequirement(null)
        }}
        onUpdate={() => {
          fetchRequirements()
          setIsModalOpen(false)
          setSelectedRequirement(null)
        }}
      />
    </div>
  )
}