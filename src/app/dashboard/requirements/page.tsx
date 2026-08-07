'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileText, Download, Edit, Trash2, Eye, FileCode, ChevronDown } from 'lucide-react'
import { toast } from 'react-hot-toast'
import RequirementModal, { type RequirementDetail } from '@/components/RequirementModal'
import TrelloExportModal from '@/components/TrelloExportModal'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  PageHeader,
  PRIORITY_TONES,
  Select,
  Skeleton,
  TYPE_TONES,
  humanize,
} from '@/components/ui'

interface Project {
  id: string
  name: string
}

export default function RequirementsPage() {
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [requirements, setRequirements] = useState<RequirementDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequirement, setSelectedRequirement] = useState<RequirementDetail | null>(null)
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [generatingSRS, setGeneratingSRS] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showTrelloModal, setShowTrelloModal] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState({ type: 'ALL', priority: 'ALL', source: 'ALL' })

  useEffect(() => {
    fetchProjects()
    const pidFromUrl = searchParams.get('projectId') || ''
    setSelectedProjectId(pidFromUrl)
    fetchRequirements(pidFromUrl)
    // Intentionally runs once: later project changes go through handleProjectChange.
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }
    if (showExportMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showExportMenu])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    }
  }

  const fetchRequirements = async (projectId?: string) => {
    try {
      const pid = projectId ?? selectedProjectId
      const url = pid ? `/api/requirements?projectId=${pid}` : '/api/requirements'
      const response = await fetch(url)
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

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId)
    setLoading(true)
    fetchRequirements(projectId)
  }

  const filteredRequirements = useMemo(
    () =>
      requirements.filter(
        req =>
          (filter.type === 'ALL' || req.type === filter.type) &&
          (filter.priority === 'ALL' || req.priority === filter.priority) &&
          (filter.source === 'ALL' || req.source === filter.source)
      ),
    [requirements, filter]
  )

  const openRequirement = (requirement: RequirementDetail, mode: 'view' | 'edit') => {
    setSelectedRequirement(requirement)
    setModalMode(mode)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedRequirement(null)
  }

  const handleDelete = async (requirementId: string) => {
    if (!confirm('Delete this requirement? This cannot be undone.')) return

    try {
      const response = await fetch(`/api/requirements/${requirementId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete requirement')
      await fetchRequirements()
      toast.success('Requirement deleted')
    } catch (error) {
      toast.error('Failed to delete requirement')
      console.error('Delete error:', error)
    }
  }

  /** Trigger a client-side download from a blob. */
  const download = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(anchor)
  }

  const handleGenerateSRS = async () => {
    const projectId = selectedProjectId || requirements[0]?.project?.id
    if (!projectId) {
      toast.error('Select a project first')
      return
    }

    setGeneratingSRS(true)
    try {
      const response = await fetch('/api/generate-srs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      const data = await response.json().catch(() => null)

      // Quota responses carry a usable message — surface it rather than a generic error.
      if (response.status === 429) {
        toast.error(data?.error || 'Usage limit reached')
        return
      }
      if (!response.ok) throw new Error(data?.error || 'Failed to generate SRS document')

      download(
        new Blob([data.document], { type: 'text/markdown' }),
        `${data.metadata.projectName.replace(/\s+/g, '_')}_SRS_${new Date().toISOString().split('T')[0]}.md`
      )
      toast.success(
        data.metadata.truncated
          ? `SRS generated from the top ${data.metadata.requirementsCount} requirements`
          : 'SRS document generated'
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate SRS document')
      console.error('SRS generation error:', error)
    } finally {
      setGeneratingSRS(false)
    }
  }

  const handleExport = async (format: 'markdown' | 'word' | 'json') => {
    setShowExportMenu(false)

    try {
      const projectId = selectedProjectId || requirements[0]?.project?.id

      const response = await fetch('/api/export-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, format, filters: filter }),
      })

      if (!response.ok) throw new Error('Failed to export requirements')

      if (format === 'word') {
        const projectName = requirements[0]?.project?.name || 'Requirements'
        download(
          await response.blob(),
          `${projectName.replace(/\s+/g, '_')}_Requirements_${new Date().toISOString().split('T')[0]}.docx`
        )
        toast.success('Exported as Word document')
      } else {
        const data = await response.json()
        download(new Blob([data.content], { type: data.mimeType }), data.filename)
        toast.success(`Exported ${data.count} requirements as ${format.toUpperCase()}`)
      }
    } catch (error) {
      toast.error('Failed to export requirements')
      console.error('Export error:', error)
    }
  }

  const hasRequirements = requirements.length > 0

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-3 h-4 w-72" />
        <Skeleton className="mt-8 h-16 w-full" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
      <PageHeader
        title="Requirements"
        description="Review, edit and export the requirements generated for your projects."
        actions={
          <>
            <Button onClick={handleGenerateSRS} disabled={!hasRequirements} loading={generatingSRS}>
              {!generatingSRS && <FileCode className="h-3.5 w-3.5" />}
              Generate SRS
            </Button>

            <div className="relative" ref={exportMenuRef}>
              <Button onClick={() => setShowExportMenu(v => !v)} disabled={!hasRequirements}>
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown className="h-3 w-3 text-ink-subtle" />
              </Button>

              {showExportMenu && (
                <div className="absolute right-0 z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg shadow-black/5">
                  {(
                    [
                      ['markdown', 'Markdown (.md)'],
                      ['word', 'Word (.docx)'],
                      ['json', 'JSON (.json)'],
                    ] as const
                  ).map(([format, label]) => (
                    <button
                      key={format}
                      onClick={() => handleExport(format)}
                      className="w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink transition-colors hover:bg-surface-hover"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button variant="primary" onClick={() => setShowTrelloModal(true)} disabled={!hasRequirements}>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.657 1.343 3 3 3h18c1.657 0 3-1.343 3-3V3c0-1.657-1.343-3-3-3zM10.44 18.18a1.56 1.56 0 0 1-1.56 1.56H4.56a1.56 1.56 0 0 1-1.56-1.56V4.56A1.56 1.56 0 0 1 4.56 3h4.32a1.56 1.56 0 0 1 1.56 1.56v12.62zm10.56-6a1.56 1.56 0 0 1-1.56 1.56h-4.32a1.56 1.56 0 0 1-1.56-1.56V4.56A1.56 1.56 0 0 1 15.12 3h4.32A1.56 1.56 0 0 1 21 4.56v7.62z" />
              </svg>
              Export to Trello
            </Button>
          </>
        }
      />

      {/* Filters */}
      <Card className="mb-5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedProjectId}
            onChange={e => handleProjectChange(e.target.value)}
            className="w-auto min-w-[10rem]"
            aria-label="Filter by project"
          >
            <option value="">All projects</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              value={filter.type}
              onChange={e => setFilter(prev => ({ ...prev, type: e.target.value }))}
              className="w-auto"
              aria-label="Filter by type"
            >
              <option value="ALL">All types</option>
              <option value="FUNCTIONAL">Functional</option>
              <option value="NON_FUNCTIONAL">Non-functional</option>
              <option value="BUSINESS">Business</option>
              <option value="USER_STORY">User story</option>
              <option value="ACCEPTANCE_CRITERIA">Acceptance criteria</option>
            </Select>

            <Select
              value={filter.priority}
              onChange={e => setFilter(prev => ({ ...prev, priority: e.target.value }))}
              className="w-auto"
              aria-label="Filter by priority"
            >
              <option value="ALL">All priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </Select>

            <Select
              value={filter.source}
              onChange={e => setFilter(prev => ({ ...prev, source: e.target.value }))}
              className="w-auto"
              aria-label="Filter by source"
            >
              <option value="ALL">All sources</option>
              <option value="DOCUMENT_UPLOAD">Document upload</option>
              <option value="CHAT_INPUT">Chat input</option>
              <option value="MANUAL_INPUT">Manual input</option>
              <option value="LLM_GENERATED">LLM generated</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* List */}
      {filteredRequirements.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title={hasRequirements ? 'No requirements match these filters' : 'No requirements yet'}
          description={
            hasRequirements
              ? 'Try clearing a filter to see more results.'
              : 'Upload a document or start a chat session to generate requirements.'
          }
        >
          {!hasRequirements && (
            <>
              <Button variant="primary" onClick={() => (window.location.href = '/dashboard/upload')}>
                Upload document
              </Button>
              <Button onClick={() => (window.location.href = '/dashboard/chat')}>Start chat</Button>
            </>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-2.5">
          {filteredRequirements.map(requirement => (
            <Card
              key={requirement.id}
              className="group p-5 transition-colors hover:border-line-strong"
            >
              <div className="flex items-start justify-between gap-4">
                <button
                  onClick={() => openRequirement(requirement, 'view')}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-ink">{requirement.title}</h3>
                    <Badge tone={TYPE_TONES[requirement.type] ?? 'neutral'}>
                      {humanize(requirement.type)}
                    </Badge>
                    <Badge tone={PRIORITY_TONES[requirement.priority] ?? 'neutral'}>
                      {requirement.priority.toLowerCase()}
                    </Badge>
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                    {requirement.description}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
                    <span>{humanize(requirement.source)}</span>
                    {requirement.confidence != null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{Math.round(requirement.confidence * 100)}% confidence</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{new Date(requirement.createdAt).toLocaleDateString()}</span>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                  <IconButton
                    label="View details"
                    onClick={() => openRequirement(requirement, 'view')}
                  >
                    <Eye className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Edit" onClick={() => openRequirement(requirement, 'edit')}>
                    <Edit className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label="Delete"
                    variant="danger"
                    onClick={() => handleDelete(requirement.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {filteredRequirements.length > 0 && (
        <p className="mt-5 text-center text-xs text-ink-subtle">
          Showing {filteredRequirements.length} of {requirements.length} requirements
        </p>
      )}

      <RequirementModal
        requirement={selectedRequirement}
        isOpen={isModalOpen}
        initialMode={modalMode}
        onClose={closeModal}
        onUpdate={() => {
          fetchRequirements()
          closeModal()
        }}
      />

      <TrelloExportModal
        isOpen={showTrelloModal}
        onClose={() => setShowTrelloModal(false)}
        projectId={selectedProjectId || (requirements[0]?.project?.id ?? '')}
        projectName={
          projects.find(p => p.id === selectedProjectId)?.name ??
          requirements[0]?.project?.name ??
          'Project'
        }
        requirementsCount={filteredRequirements.length}
      />
    </div>
  )
}
