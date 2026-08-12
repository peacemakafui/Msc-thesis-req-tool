'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Upload,
  MessageSquare,
  FileText,
  FolderOpen,
  User,
  LogOut,
  Menu,
  X,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import { cn } from './ui'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/upload', label: 'Documents', icon: Upload },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageSquare },
  { href: '/dashboard/requirements', label: 'Requirements', icon: FileText },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderOpen },
]

/** Shown only to admins. The page re-checks the role server-side regardless. */
const ADMIN_NAV_ITEM = { href: '/dashboard/admin', label: 'Admin', icon: ShieldCheck }

interface Usage {
  chatDailyRemaining: number
  chatLifetimeRemaining: number
  uploadDailyRemaining: number
  uploadLifetimeRemaining: number
  totalRequestsRemaining: number
  limits: { dailyChat: number; dailyUpload: number; totalRequests: number }
}

export default function Sidebar({
  userName,
  userEmail,
  isAdmin = false,
}: {
  userName: string
  userEmail: string
  isAdmin?: boolean
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [usage, setUsage] = useState<Usage | null>(null)

  // Close the drawer on navigation, so a tap on a link doesn't leave it open.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    fetch('/api/usage')
      .then(res => (res.ok ? res.json() : null))
      .then(data => data && setUsage(data))
      .catch(() => {
        /* the meter is informational; failing quietly is fine */
      })
  }, [pathname])

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  const initial = (userName || userEmail || '?').charAt(0).toUpperCase()

  const nav = (
    <>
      <div className="px-3 py-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 py-1">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-ink">
              ReqAssist
            </span>
            <span className="block truncate text-[11px] text-ink-subtle">MSc research study</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {(isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS).map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-accent-soft text-accent'
                  : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Usage meter. Participants can see their remaining allowance without
          discovering it by hitting a limit mid-task. */}
      {usage && (
        <div className="mx-3 mb-3 rounded-xl border border-line bg-surface-subtle p-3">
          {/* Values are what's *left*, not what's used — the heading says so, so
              the numbers don't have to be read as a fraction. */}
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Remaining
          </p>
          <dl className="space-y-1.5 text-[12px]">
            {[
              { label: 'Chats today', value: usage.chatDailyRemaining },
              { label: 'Documents today', value: usage.uploadDailyRemaining },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-baseline justify-between gap-2">
                <dt className="text-ink-muted">{label}</dt>
                <dd
                  className={cn(
                    'font-medium tabular-nums',
                    value === 0 ? 'text-critical' : 'text-ink'
                  )}
                >
                  {value}
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-2 border-t border-line pt-1.5">
              <dt className="text-ink-muted">Total in study</dt>
              <dd
                className={cn(
                  'font-medium tabular-nums',
                  usage.totalRequestsRemaining === 0 ? 'text-critical' : 'text-ink'
                )}
              >
                {usage.totalRequestsRemaining}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="border-t border-line p-3">
        <Link
          href="/dashboard/profile"
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors',
            isActive('/dashboard/profile') ? 'bg-surface-hover' : 'hover:bg-surface-hover'
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-alt-soft text-[11px] font-semibold text-accent-alt">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-ink">{userName}</span>
            <span className="block truncate text-[11px] text-ink-subtle">View profile</span>
          </span>
          <User className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
        </Link>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/85 px-4 py-2.5 backdrop-blur lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-fg">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          ReqAssist
        </span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-line bg-surface">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover"
            >
              <X className="h-4 w-4" />
            </button>
            {nav}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        {nav}
      </aside>
    </>
  )
}
