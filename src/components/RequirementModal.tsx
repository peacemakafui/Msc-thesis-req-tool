'use client'

import { useEffect, useState } from 'react'
import { Edit2, Save, AlertCircle, FileText, Calendar, TrendingUp } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Modal from './Modal'
import {
  Badge,
  Button,
  Field,
  IconButton,
  Input,
  PRIORITY_TONES,
  Select,
  Textarea,
  TYPE_TONES,
  humanize,
} from './ui'

export interface RequirementDetail {
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
  project?: { id: string; name: string }
  document?: { id: string; originalName: string }
}

interface RequirementModalProps {
  requirement: RequirementDetail | null
  isOpen: boolean
  /** Which mode to open in. The list's edit button opens straight into the form. */
  initialMode?: 'view' | 'edit'
  onClose: () => void
  onUpdate: () => void
}

const TYPE_OPTIONS = [
  'FUNCTIONAL',
  'NON_FUNCTIONAL',
  'BUSINESS',
  'USER_STORY',
  'ACCEPTANCE_CRITERIA',
]
const PRIORITY_OPTIONS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export default function RequirementModal({
  requirement,
  isOpen,
  initialMode = 'view',
  onClose,
  onUpdate,
}: RequirementModalProps) {
  const [isEditing, setIsEditing] = useState(initialMode === 'edit')
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'FUNCTIONAL',
    priority: 'MEDIUM',
  })

  // Reset the form and mode whenever a different requirement is opened, so the
  // dialog never shows a previous row's edits.
  useEffect(() => {
    if (!isOpen || !requirement) return
    setFormData({
      title: requirement.title,
      description: requirement.description,
      type: requirement.type,
      priority: requirement.priority,
    })
    setIsEditing(initialMode === 'edit')
  }, [isOpen, requirement, initialMode])

  const handleSave = async () => {
    if (!requirement) return

    if (!formData.title.trim()) {
      toast.error('Title cannot be empty')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/requirements/${requirement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update requirement')
      }

      toast.success('Requirement updated')
      setIsEditing(false)
      onUpdate()
    } catch (error) {
      console.error('Update error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update requirement')
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
        priority: requirement.priority,
      })
    }
    setIsEditing(false)
  }

  if (!requirement) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit requirement' : 'Requirement details'}
      icon={<FileText className="h-4 w-4 text-accent" />}
      headerActions={
        !isEditing && (
          <IconButton label="Edit requirement" onClick={() => setIsEditing(true)}>
            <Edit2 className="h-4 w-4" />
          </IconButton>
        )
      }
      footer={
        isEditing && (
          <>
            <Button variant="secondary" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={isSaving}>
              {!isSaving && <Save className="h-3.5 w-3.5" />}
              Save changes
            </Button>
          </>
        )
      }
    >
      {isEditing ? (
        <div className="space-y-4">
          <Field label="Title" required>
            <Input
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              maxLength={300}
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={7}
              maxLength={5000}
              className="resize-y"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
              >
                {TYPE_OPTIONS.map(option => (
                  <option key={option} value={option}>
                    {humanize(option).replace(/\b\w/g, c => c.toUpperCase())}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Priority">
              <Select
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
              >
                {PRIORITY_OPTIONS.map(option => (
                  <option key={option} value={option}>
                    {option.charAt(0) + option.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold leading-snug text-ink">{requirement.title}</h3>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={TYPE_TONES[requirement.type] ?? 'neutral'}>
                {humanize(requirement.type)}
              </Badge>
              <Badge tone={PRIORITY_TONES[requirement.priority] ?? 'neutral'}>
                {requirement.priority.toLowerCase()}
              </Badge>
              {requirement.confidence != null && (
                <Badge>
                  <TrendingUp className="h-3 w-3" />
                  {Math.round(requirement.confidence * 100)}% confidence
                </Badge>
              )}
            </div>
          </div>

          <section>
            <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Description
            </h4>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {requirement.description || <span className="text-ink-subtle">No description</span>}
            </p>
          </section>

          {requirement.rationale && (
            <section>
              <h4 className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                <AlertCircle className="h-3 w-3" />
                Rationale
              </h4>
              <p className="text-sm leading-relaxed text-ink-muted">{requirement.rationale}</p>
            </section>
          )}

          {requirement.sourceText && (
            <section>
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                Source text
              </h4>
              <blockquote className="rounded-lg border-l-2 border-accent bg-surface-subtle px-4 py-3">
                <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink-muted">
                  {requirement.sourceText}
                </p>
              </blockquote>
            </section>
          )}

          <section className="border-t border-line pt-4">
            <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Metadata
            </h4>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-subtle">Source</dt>
                <dd className="mt-0.5 text-ink">{humanize(requirement.source)}</dd>
              </div>
              {requirement.project && (
                <div>
                  <dt className="text-xs text-ink-subtle">Project</dt>
                  <dd className="mt-0.5 truncate text-ink">{requirement.project.name}</dd>
                </div>
              )}
              {requirement.document && (
                <div>
                  <dt className="text-xs text-ink-subtle">Document</dt>
                  <dd className="mt-0.5 truncate text-ink">{requirement.document.originalName}</dd>
                </div>
              )}
              <div>
                <dt className="flex items-center gap-1 text-xs text-ink-subtle">
                  <Calendar className="h-3 w-3" />
                  Created
                </dt>
                <dd className="mt-0.5 text-ink">
                  {new Date(requirement.createdAt).toLocaleString()}
                </dd>
              </div>
              {requirement.updatedAt && (
                <div>
                  <dt className="flex items-center gap-1 text-xs text-ink-subtle">
                    <Calendar className="h-3 w-3" />
                    Updated
                  </dt>
                  <dd className="mt-0.5 text-ink">
                    {new Date(requirement.updatedAt).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      )}
    </Modal>
  )
}
