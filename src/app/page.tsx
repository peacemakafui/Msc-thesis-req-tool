import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { FileText, MessageSquare, Upload, Sparkles, ArrowRight } from "lucide-react"
import { Button, Card } from "@/components/ui"

const FEATURES = [
  {
    icon: Upload,
    title: 'Analyse documents',
    description:
      'Upload a PDF, Word file or plain text and have requirements extracted, categorised and prioritised for you.',
  },
  {
    icon: MessageSquare,
    title: 'Refine by conversation',
    description:
      'Describe your project in plain language. Requirements found in the conversation are captured automatically.',
  },
  {
    icon: FileText,
    title: 'Export anywhere',
    description:
      'Produce an IEEE 830 SRS document, a Word or Markdown file, or push a ready-made board to Trello.',
  },
]

export default async function Home() {
  const session = await getServerSession(authOptions)

  // Signed-in participants go straight to the workspace.
  if (session?.user) {
    redirect('/dashboard')
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:py-24">
      <header className="text-center">
        <span className="mx-auto mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
          <Sparkles className="h-5 w-5" />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          ReqAssist
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-muted">
          An AI-assisted tool for gathering software requirements — turning documents and
          conversations into structured, exportable specifications.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <Link href="/login">
            <Button variant="primary" size="lg">
              Sign in
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="lg">Join the study</Button>
          </Link>
        </div>

        <p className="mt-4 text-xs text-ink-subtle">
          Participation requires an access code from the researcher.
        </p>
      </header>

      <div className="mt-16 grid gap-3 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="p-5">
            <span className="mb-3.5 flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Icon className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{description}</p>
          </Card>
        ))}
      </div>

      <footer className="mt-16 border-t border-line pt-6 text-center">
        <p className="text-xs text-ink-subtle">
          MSc thesis research project · Usage is limited per participant for study purposes
        </p>
      </footer>
    </div>
  )
}
