import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import {
  Mail,
  Briefcase,
  Building2,
  Calendar,
  FileText,
  MessageSquare,
  FolderOpen,
  Upload,
} from "lucide-react"
import SignOutButton from "@/components/SignOutButton"
import { getUsage } from "@/lib/rateLimit"
import { Badge, Card, CardHeader, CardTitle, PageHeader } from "@/components/ui"

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as any).id as string

  const [user, counts, usage] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        organization: true,
        position: true,
        experience: true,
        createdAt: true,
      },
    }),
    Promise.all([
      prisma.project.count({ where: { userId } }),
      prisma.document.count({ where: { project: { userId } } }),
      prisma.requirement.count({ where: { project: { userId } } }),
      prisma.chatMessage.count({ where: { userId } }),
    ]),
    getUsage(userId),
  ])

  if (!user) {
    redirect('/login')
  }

  const [projectsCount, documentsCount, requirementsCount, messagesCount] = counts

  const stats = [
    { label: 'Projects', value: projectsCount, icon: FolderOpen },
    { label: 'Documents', value: documentsCount, icon: Upload },
    { label: 'Requirements', value: requirementsCount, icon: FileText },
    { label: 'Chat messages', value: messagesCount, icon: MessageSquare },
  ]

  const details = [
    { label: 'Email', value: user.email, icon: Mail },
    { label: 'Organization', value: user.organization, icon: Building2 },
    { label: 'Position', value: user.position, icon: Briefcase },
    {
      label: 'Experience',
      value: user.experience != null ? `${user.experience} years` : null,
      icon: Calendar,
    },
    {
      label: 'Member since',
      value: new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      icon: Calendar,
    },
  ].filter(detail => detail.value)

  /** Remaining / total, shown as a proportion so limits are legible at a glance. */
  const allowances = [
    {
      label: 'Chat messages',
      dailyRemaining: usage.chatDailyRemaining,
      dailyLimit: usage.limits.dailyChat,
      lifetimeRemaining: usage.chatLifetimeRemaining,
      lifetimeLimit: usage.limits.lifetimeChat,
    },
    {
      label: 'Documents',
      dailyRemaining: usage.uploadDailyRemaining,
      dailyLimit: usage.limits.dailyUpload,
      lifetimeRemaining: usage.uploadLifetimeRemaining,
      lifetimeLimit: usage.limits.lifetimeUpload,
    },
    {
      label: 'AI exports',
      dailyRemaining: usage.exportDailyRemaining,
      dailyLimit: usage.limits.dailyExport,
      lifetimeRemaining: usage.exportLifetimeRemaining,
      lifetimeLimit: usage.limits.lifetimeExport,
    },
  ]

  const initial = (user.name || user.email || '?').charAt(0).toUpperCase()

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
      <PageHeader title="Profile" description="Your account details and study allowance." />

      {/* Identity */}
      <Card className="mb-5 p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-alt-soft text-base font-semibold text-accent-alt">
            {initial}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink">
              {user.name || 'Participant'}
            </h2>
            <p className="truncate text-[13px] text-ink-muted">{user.email}</p>
          </div>
          {usage.blocked && <Badge tone="critical">suspended</Badge>}
        </div>

        <dl className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          {details.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-start gap-2.5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
              <div className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wider text-ink-subtle">{label}</dt>
                <dd className="mt-0.5 truncate text-[13px] text-ink">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Card>

      {/* Study allowance */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Study allowance</CardTitle>
          <p className="mt-1 text-[13px] text-ink-muted">
            Usage is capped so the study stays within its budget. Daily counts reset at midnight
            UTC.
          </p>
        </CardHeader>
        <div className="divide-y divide-line">
          {allowances.map(({ label, dailyRemaining, dailyLimit, lifetimeRemaining, lifetimeLimit }) => (
            <div key={label} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <span className="text-[13px] font-medium text-ink">{label}</span>
              <div className="flex items-center gap-2">
                <Badge tone={dailyRemaining === 0 ? 'caution' : 'neutral'}>
                  {dailyRemaining} of {dailyLimit} left today
                </Badge>
                <Badge tone={lifetimeRemaining === 0 ? 'critical' : 'neutral'}>
                  {lifetimeRemaining} of {lifetimeLimit} left in study
                </Badge>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 bg-surface-subtle px-5 py-3.5">
            <span className="text-[13px] font-medium text-ink">Total AI requests remaining</span>
            <Badge tone={usage.totalRequestsRemaining === 0 ? 'critical' : 'accent'}>
              {usage.totalRequestsRemaining} of {usage.limits.totalRequests}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Activity */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="px-5 py-4">
              <div className="flex items-center gap-1.5 text-ink-subtle">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[11px] uppercase tracking-wider">{label}</span>
              </div>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-ink">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Integrations */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
        </CardHeader>
        <div className="flex items-start gap-3.5 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info-soft">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-info" aria-hidden="true">
              <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.657 1.343 3 3 3h18c1.657 0 3-1.343 3-3V3c0-1.657-1.343-3-3-3zM10.44 18.18a1.56 1.56 0 0 1-1.56 1.56H4.56a1.56 1.56 0 0 1-1.56-1.56V4.56A1.56 1.56 0 0 1 4.56 3h4.32a1.56 1.56 0 0 1 1.56 1.56v12.62zm10.56-6a1.56 1.56 0 0 1-1.56 1.56h-4.32a1.56 1.56 0 0 1-1.56-1.56V4.56A1.56 1.56 0 0 1 15.12 3h4.32A1.56 1.56 0 0 1 21 4.56v7.62z" />
            </svg>
          </span>
          <div>
            <p className="text-[13px] font-medium text-ink">Trello</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
              Requirements export to a shared board managed by the researcher. Use{' '}
              <strong className="font-medium text-ink">Export to Trello</strong> on the Requirements
              page — no account setup needed.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <SignOutButton />
      </div>
    </div>
  )
}
