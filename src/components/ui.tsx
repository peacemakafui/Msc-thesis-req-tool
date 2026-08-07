import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import clsx, { type ClassValue } from 'clsx'

/**
 * Shared UI primitives.
 *
 * These exist so surface, border, radius and focus treatments are declared once.
 * Colours come from the tokens in globals.css, which already adapt to light and
 * dark, so nothing here needs `dark:` variants.
 */

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Button ────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover border border-transparent',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-hover',
  ghost: 'bg-transparent text-ink-muted border border-transparent hover:bg-surface-hover hover:text-ink',
  danger: 'bg-transparent text-critical border border-transparent hover:bg-critical-soft',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, disabled, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors',
        'disabled:opacity-45 disabled:pointer-events-none',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
})

/** Square icon-only button, sized to align with `Button` in a row. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; label: string }
>(function IconButton({ variant = 'ghost', label, className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
        'disabled:opacity-45 disabled:pointer-events-none',
        BUTTON_VARIANTS[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})

// ── Surfaces ──────────────────────────────────────────────────────────────────

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-card border border-line bg-surface', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-line px-5 py-4', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold text-ink', className)} {...props} />
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}

// ── Badge ─────────────────────────────────────────────────────────────────────

type BadgeTone = 'neutral' | 'accent' | 'positive' | 'caution' | 'critical' | 'info' | 'alt'

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-subtle text-ink-muted',
  accent: 'bg-accent-soft text-accent',
  positive: 'bg-positive-soft text-positive',
  caution: 'bg-caution-soft text-caution',
  critical: 'bg-critical-soft text-critical',
  info: 'bg-info-soft text-info',
  alt: 'bg-accent-alt-soft text-accent-alt',
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide',
        BADGE_TONES[tone],
        className
      )}
      {...props}
    />
  )
}

/** Requirement type → badge tone. Kept here so every view labels types identically. */
export const TYPE_TONES: Record<string, BadgeTone> = {
  FUNCTIONAL: 'info',
  NON_FUNCTIONAL: 'alt',
  BUSINESS: 'neutral',
  USER_STORY: 'positive',
  ACCEPTANCE_CRITERIA: 'accent',
}

/** Requirement priority → badge tone. */
export const PRIORITY_TONES: Record<string, BadgeTone> = {
  CRITICAL: 'critical',
  HIGH: 'caution',
  MEDIUM: 'info',
  LOW: 'neutral',
}

export const humanize = (value: string) => value.replace(/_/g, ' ').toLowerCase()

// ── Form controls ─────────────────────────────────────────────────────────────

const CONTROL_BASE =
  'w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink transition-colors ' +
  'hover:border-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL_BASE, 'h-9', className)} {...props} />
  }
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(CONTROL_BASE, 'py-2 leading-relaxed', className)} {...props} />
  }
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(CONTROL_BASE, 'h-9 cursor-pointer pr-8 appearance-none', className)}
        style={{
          // Inline so the caret colour tracks the theme without a second asset.
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2397948a' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.5rem center',
        }}
        {...props}
      />
    )
  }
)

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-subtle">{hint}</span>}
    </label>
  )
}

// ── Layout helpers ────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <Card className="px-6 py-14 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-subtle text-ink-subtle">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">{description}</p>
      )}
      {children && <div className="mt-6 flex justify-center gap-3">{children}</div>}
    </Card>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-ink-subtle', className)} />
}

/** Skeleton block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-subtle', className)} />
}
