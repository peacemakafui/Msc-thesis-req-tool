import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { FolderOpen, Plus } from "lucide-react"
import ProjectCard from "@/components/ProjectCard"
import { Button, EmptyState, PageHeader } from "@/components/ui"

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as any).id as string

  const projects = await prisma.project.findMany({
    where: { userId },
    include: { _count: { select: { documents: true, requirements: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
      <PageHeader
        title="Projects"
        description="Each project groups its own documents, requirements and conversations."
        actions={
          <Link href="/dashboard/projects/new">
            <Button variant="primary">
              <Plus className="h-3.5 w-3.5" />
              New project
            </Button>
          </Link>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-5 w-5" />}
          title="No projects yet"
          description="Create your first project to start gathering requirements."
        >
          <Link href="/dashboard/projects/new">
            <Button variant="primary">
              <Plus className="h-3.5 w-3.5" />
              New project
            </Button>
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
