import Link from "next/link"
import { FileText, MessageSquare, Upload, FolderOpen, ArrowRight } from "lucide-react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardBody, CardHeader, CardTitle, PageHeader } from "@/components/ui"

const QUICK_ACTIONS = [
  {
    href: '/dashboard/upload',
    icon: Upload,
    title: 'Analyse a document',
    description: 'Upload a PDF, Word file or text file and extract requirements from it.',
  },
  {
    href: '/dashboard/chat',
    icon: MessageSquare,
    title: 'Chat with the assistant',
    description: 'Describe your project in your own words and refine requirements together.',
  },
  {
    href: '/dashboard/projects/new',
    icon: FolderOpen,
    title: 'Create a project',
    description: 'Group documents, requirements and conversations under one project.',
  },
]

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as any).id as string
  const firstName = (session.user.name || '').split(' ')[0]

  const [requirementsCount, documentsCount, projectsCount, messagesCount, recentDocuments] =
    await Promise.all([
      prisma.requirement.count({ where: { project: { userId } } }),
      prisma.document.count({ where: { project: { userId } } }),
      prisma.project.count({ where: { userId } }),
      prisma.chatMessage.count({ where: { userId } }),
      prisma.document.findMany({
        where: { project: { userId } },
        include: { project: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

  const stats = [
    { label: 'Requirements', value: requirementsCount, icon: FileText },
    { label: 'Documents', value: documentsCount, icon: Upload },
    { label: 'Conversations', value: Math.ceil(messagesCount / 2), icon: MessageSquare },
    { label: 'Projects', value: projectsCount, icon: FolderOpen },
  ]

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        description="Your requirements gathering workspace."
      />

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-2 text-ink-subtle">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Quick actions */}
        <div className="lg:col-span-3">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Get started
          </h2>
          <div className="space-y-2.5">
            {QUICK_ACTIONS.map(({ href, icon: Icon, title, description }) => (
              <Link key={href} href={href} className="group block">
                <Card className="flex items-start gap-3.5 p-4 transition-colors group-hover:border-line-strong group-hover:bg-surface-hover">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{title}</span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-muted">
                      {description}
                    </span>
                  </span>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" />
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent documents */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Recent documents
          </h2>
          <Card>
            {recentDocuments.length === 0 ? (
              <CardBody className="py-10 text-center">
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  Nothing yet. Upload a document or start a chat to get going.
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {recentDocuments.map(doc => (
                  <li key={doc.id} className="flex items-start gap-2.5 px-4 py-3">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{doc.originalName}</p>
                      <p className="mt-0.5 truncate text-[11px] text-ink-subtle">
                        {doc.project.name} · {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
