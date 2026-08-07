'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, ArrowRight } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button, Card, IconButton } from './ui'

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
  const [confirming, setConfirming] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete project')
      toast.success('Project deleted')
      router.refresh()
    } catch (error) {
      console.error('Error deleting project:', error)
      toast.error('Failed to delete project. Please try again.')
    } finally {
      setIsDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <Card className="group flex flex-col p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{project.name}</h3>
        <IconButton
          label="Delete project"
          variant="danger"
          onClick={() => setConfirming(true)}
          disabled={isDeleting}
          className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-[13px] leading-relaxed text-ink-muted">
        {project.description || <span className="text-ink-subtle">No description</span>}
      </p>

      {confirming ? (
        <div className="mt-3 rounded-lg border border-critical/30 bg-critical-soft p-3">
          <p className="text-[13px] font-medium text-critical">
            Delete this project and everything in it?
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setConfirming(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDelete}
              loading={isDeleting}
              className="border-critical/40 bg-critical-soft text-critical hover:bg-critical-soft"
            >
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <>
          <dl className="mt-3 flex gap-5 border-t border-line pt-3">
            <div>
              <dd className="text-lg font-semibold tabular-nums text-ink">
                {project._count.documents}
              </dd>
              <dt className="text-[11px] text-ink-subtle">Documents</dt>
            </div>
            <div>
              <dd className="text-lg font-semibold tabular-nums text-ink">
                {project._count.requirements}
              </dd>
              <dt className="text-[11px] text-ink-subtle">Requirements</dt>
            </div>
          </dl>

          <Link
            href={`/dashboard/projects/${project.id}`}
            className="mt-3 flex items-center justify-between rounded-lg bg-surface-subtle px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-surface-hover"
          >
            Open project
            <ArrowRight className="h-3.5 w-3.5 text-ink-subtle" />
          </Link>
        </>
      )}
    </Card>
  )
}
