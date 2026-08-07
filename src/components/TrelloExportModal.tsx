'use client'

import { useState } from 'react'
import { ExternalLink, CheckCircle2, AlertCircle, Loader2, Copy, Check } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Modal from './Modal'
import { Button, cn } from './ui'

interface TrelloExportModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
  requirementsCount: number
}

type ExportStatus = 'idle' | 'exporting' | 'success' | 'error'

const EXPORT_STEPS = [
  'Connecting to Trello…',
  'Setting up board and lists…',
  'Creating priority labels…',
  'Generating technical sub-tasks with AI…',
  'Creating requirement cards…',
  'Finalising…',
]

const TrelloIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.657 1.343 3 3 3h18c1.657 0 3-1.343 3-3V3c0-1.657-1.343-3-3-3zM10.44 18.18a1.56 1.56 0 0 1-1.56 1.56H4.56a1.56 1.56 0 0 1-1.56-1.56V4.56A1.56 1.56 0 0 1 4.56 3h4.32a1.56 1.56 0 0 1 1.56 1.56v12.62zm10.56-6a1.56 1.56 0 0 1-1.56 1.56h-4.32a1.56 1.56 0 0 1-1.56-1.56V4.56A1.56 1.56 0 0 1 15.12 3h4.32A1.56 1.56 0 0 1 21 4.56v7.62z" />
  </svg>
)

export default function TrelloExportModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  requirementsCount,
}: TrelloExportModalProps) {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [stepIndex, setStepIndex] = useState(0)
  const [boardUrl, setBoardUrl] = useState<string | null>(null)
  const [cardsCreated, setCardsCreated] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [copied, setCopied] = useState(false)

  const copyBoardUrl = () => {
    if (!boardUrl) return
    navigator.clipboard.writeText(boardUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleExport = async () => {
    setStatus('exporting')
    setStepIndex(0)

    // Step through the labels while the request is in flight, so a slow export
    // still shows progress.
    const stepInterval = setInterval(() => {
      setStepIndex(prev => (prev < EXPORT_STEPS.length - 1 ? prev + 1 : prev))
    }, 2500)

    try {
      const res = await fetch('/api/trello/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      clearInterval(stepInterval)
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to export to Trello')
      }

      setBoardUrl(data.boardUrl)
      setCardsCreated(data.cardsCreated)
      setStatus('success')
      toast.success(data.message)
    } catch (error) {
      clearInterval(stepInterval)
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred')
      setStatus('error')
    }
  }

  const handleClose = () => {
    if (status === 'exporting') return // don't close mid-export
    setStatus('idle')
    setStepIndex(0)
    setBoardUrl(null)
    setCardsCreated(0)
    setErrorMessage('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Export to Trello"
      icon={<TrelloIcon className="h-4 w-4 fill-info" />}
      className="max-w-md"
    >
      {status === 'idle' && (
        <>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            Export <strong className="font-medium text-ink">{requirementsCount}</strong> requirements
            from <strong className="font-medium text-ink">{projectName}</strong> to Trello. This will:
          </p>
          <ul className="mt-4 space-y-2.5">
            {[
              <>
                Create or reuse a board with{' '}
                <strong className="font-medium text-ink">
                  Backlog / To Do / In Progress / Done
                </strong>{' '}
                columns
              </>,
              <>
                Add each requirement as a card in{' '}
                <strong className="font-medium text-ink">To Do</strong> with a colour-coded priority
                label
              </>,
              <>
                Use AI to generate{' '}
                <strong className="font-medium text-ink">3–5 technical sub-tasks</strong> as
                checklists on Functional and User Story cards
              </>,
            ].map((item, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 rounded-lg bg-surface-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-subtle">
            This counts as one AI export against your study allowance.
          </p>

          <div className="mt-5 flex gap-2">
            <Button variant="primary" onClick={handleExport} className="flex-1">
              Export now
            </Button>
            <Button onClick={handleClose}>Cancel</Button>
          </div>
        </>
      )}

      {status === 'exporting' && (
        <div className="py-6 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-accent" />
          <p className="text-sm font-medium text-ink">Exporting to Trello…</p>
          <p className="mt-1 min-h-[1.25rem] text-[13px] text-ink-muted">
            {EXPORT_STEPS[stepIndex]}
          </p>
          <div className="mt-4 flex justify-center gap-1">
            {EXPORT_STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1 w-5 rounded-full transition-colors',
                  i <= stepIndex ? 'bg-accent' : 'bg-line-strong'
                )}
              />
            ))}
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="py-2 text-center">
          <CheckCircle2 className="mx-auto mb-3.5 h-9 w-9 text-positive" />
          <h3 className="text-sm font-semibold text-ink">Export complete</h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            {cardsCreated} requirement card{cardsCreated !== 1 ? 's' : ''} created in Trello.
          </p>

          {boardUrl && (
            <div className="mt-5">
              <p className="mb-2 text-xs leading-relaxed text-ink-subtle">
                The board is public — share this link with anyone, no Trello account needed:
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-subtle px-3 py-2 text-left">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-muted">
                  {boardUrl}
                </span>
                <button
                  onClick={copyBoardUrl}
                  title="Copy link"
                  aria-label="Copy board link"
                  className="shrink-0 text-ink-subtle transition-colors hover:text-ink"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-positive" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              <a href={boardUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block">
                <Button variant="primary">
                  Open Trello board
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>
          )}

          <div className="mt-4">
            <button onClick={handleClose} className="text-[13px] text-ink-subtle hover:underline">
              Close
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="py-2 text-center">
          <AlertCircle className="mx-auto mb-3.5 h-9 w-9 text-critical" />
          <h3 className="text-sm font-semibold text-ink">Export failed</h3>
          <p className="mx-auto mt-1.5 max-w-sm break-words text-[13px] leading-relaxed text-critical">
            {errorMessage}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="primary" onClick={() => setStatus('idle')}>
              Try again
            </Button>
            <Button onClick={handleClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
