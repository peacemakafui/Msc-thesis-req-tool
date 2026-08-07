'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn, IconButton } from './ui'

/**
 * Shared modal shell.
 *
 * The previous hand-rolled dialog had a layout bug that made it look broken: the
 * backdrop was `position: fixed` while the panel was a non-positioned
 * `inline-block`, so the backdrop painted *above* the panel. It was only
 * invisible because of `bg-opacity-75` — a utility Tailwind v4 removed, which
 * left the backdrop fully opaque and covering the content.
 *
 * Here the backdrop and panel are siblings in a flex container and both are
 * explicitly layered, so the stacking order can't regress. Also handles Escape,
 * background scroll locking, and focusing the panel on open.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  icon,
  headerActions,
  footer,
  children,
  className,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  icon?: ReactNode
  headerActions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}) {
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    // Lock background scroll while the dialog is open.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  if (!mounted || !isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      {/* Backdrop: explicitly behind the panel via z-index, not paint order. */}
      <div
        className="fixed inset-0 z-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative z-10 my-auto w-full max-w-2xl overflow-hidden rounded-card border border-line',
          'bg-surface shadow-2xl shadow-black/10 focus:outline-none',
          className
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-subtle px-5 py-3.5">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
            {icon}
            <span className="truncate">{title}</span>
          </h2>
          <div className="flex items-center gap-1">
            {headerActions}
            <IconButton label="Close" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-line bg-surface-subtle px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
