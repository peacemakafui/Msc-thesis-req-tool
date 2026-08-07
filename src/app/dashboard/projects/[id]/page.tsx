import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { FileText, MessageSquare, Upload, Calendar, ArrowLeft } from "lucide-react"
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  PRIORITY_TONES,
  TYPE_TONES,
  humanize,
} from "@/components/ui"

export default async function ProjectDetailPage({
  params,
}: {
  // Next 15 passes route params as a promise.
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const { id } = await params
  const userId = (session.user as any).id as string

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: 'desc' }, take: 6 },
      requirements: { orderBy: { createdAt: 'desc' }, take: 10 },
      _count: { select: { documents: true, requirements: true, chatMessages: true } },
    },
  })

  if (!project) {
    notFound()
  }

  if (project.userId !== userId) {
    redirect('/dashboard/projects')
  }

  const stats = [
    { label: 'Documents', value: project._count.documents, icon: Upload },
    { label: 'Requirements', value: project._count.requirements, icon: FileText },
    { label: 'Chat messages', value: project._count.chatMessages, icon: MessageSquare },
  ]

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
      <Link
        href="/dashboard/projects"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All projects
      </Link>

      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold text-ink">{project.name}</h1>
          {project.description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
              {project.description}
            </p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-subtle">
            <Calendar className="h-3 w-3" />
            Created {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/upload?projectId=${project.id}`}>
            <Button>
              <Upload className="h-3.5 w-3.5" />
              Upload document
            </Button>
          </Link>
          <Link href={`/dashboard/chat?projectId=${project.id}`}>
            <Button variant="primary">
              <MessageSquare className="h-3.5 w-3.5" />
              Start chat
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-2 text-ink-subtle">
              <Icon className="h-3.5 w-3.5" />
              <span className="truncate text-[11px] font-medium uppercase tracking-wider">
                {label}
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Documents */}
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>Documents</CardTitle>
            <Link
              href={`/dashboard/upload?projectId=${project.id}`}
              className="text-[13px] font-medium text-accent hover:underline"
            >
              Upload
            </Link>
          </CardHeader>

          {project.documents.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <FileText className="mx-auto mb-2.5 h-6 w-6 text-ink-subtle" />
              <p className="text-[13px] text-ink-muted">No documents yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {project.documents.map(doc => (
                <li key={doc.id} className="flex items-start gap-2.5 px-5 py-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{doc.originalName}</p>
                    <p className="mt-0.5 text-[11px] text-ink-subtle">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {doc.status === 'ERROR' && <Badge tone="critical">error</Badge>}
                </li>
              ))}
              {project._count.documents > project.documents.length && (
                <li className="px-5 py-2.5 text-center text-[11px] text-ink-subtle">
                  +{project._count.documents - project.documents.length} more
                </li>
              )}
            </ul>
          )}
        </Card>

        {/* Requirements */}
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>Requirements</CardTitle>
            <Link
              href={`/dashboard/requirements?projectId=${project.id}`}
              className="text-[13px] font-medium text-accent hover:underline"
            >
              View all
            </Link>
          </CardHeader>

          {project.requirements.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <FileText className="mx-auto mb-2.5 h-6 w-6 text-ink-subtle" />
              <p className="text-[13px] text-ink-muted">No requirements yet</p>
              <p className="mt-1 text-[11px] text-ink-subtle">
                Upload a document or start a chat to generate some
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {project.requirements.map(req => (
                <li key={req.id} className="px-5 py-3">
                  <p className="text-[13px] font-medium text-ink">{req.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={TYPE_TONES[req.type] ?? 'neutral'}>{humanize(req.type)}</Badge>
                    <Badge tone={PRIORITY_TONES[req.priority] ?? 'neutral'}>
                      {req.priority.toLowerCase()}
                    </Badge>
                  </div>
                </li>
              ))}
              {project._count.requirements > project.requirements.length && (
                <li className="px-5 py-2.5 text-center text-[11px] text-ink-subtle">
                  +{project._count.requirements - project.requirements.length} more
                </li>
              )}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
