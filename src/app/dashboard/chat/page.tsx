'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Send, Loader2, FileText, ArrowUp, Sparkles } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'
import { Badge, Button, Select, cn } from '@/components/ui'
import { MAX_CHAT_MESSAGE_CHARS } from '@/lib/limits'

interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  requirements?: any[]
}

interface Project {
  id: string
  name: string
  description: string | null
}

const SESSION_KEY = 'chat_session_state'

const WELCOME =
  "I'm here to help you gather software requirements. You can paste project notes, describe your project in plain language, or ask me to refine requirements you already have.\n\nPick a project above and tell me what you're building."

const SUGGESTIONS = [
  'I need a system for tracking employee leave requests',
  'Help me turn these notes into structured requirements',
  'What non-functional requirements am I missing?',
]

export default function ChatPage() {
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [usage, setUsage] = useState<{
    chatDailyRemaining: number
    chatLifetimeRemaining: number
    limits: { dailyChat: number; lifetimeChat: number }
  } | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/usage')
      if (res.ok) setUsage(await res.json())
    } catch {
      /* the meter is informational */
    }
  }

  // Seed the welcome message after mount so the server and client markup match.
  useEffect(() => {
    setMessages([{ id: 'welcome', content: WELCOME, role: 'assistant', timestamp: new Date() }])
  }, [])

  useEffect(() => {
    fetchProjects()
    fetchUsage()
  }, [])

  useEffect(() => {
    const projectIdFromUrl = searchParams.get('projectId')
    if (projectIdFromUrl) setSelectedProjectId(projectIdFromUrl)
  }, [searchParams])

  // Restore the previous session, but only if it is less than an hour old.
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(SESSION_KEY)
      if (!savedState) return
      const parsed = JSON.parse(savedState)

      if (parsed.selectedProjectId && !searchParams.get('projectId')) {
        setSelectedProjectId(parsed.selectedProjectId)
      }

      if (parsed.messages?.length > 1 && parsed.timestamp) {
        const age = Date.now() - new Date(parsed.timestamp).getTime()
        if (age < 60 * 60 * 1000) {
          setMessages(
            parsed.messages.map((msg: any) => ({ ...msg, timestamp: new Date(msg.timestamp) }))
          )
        }
      }
    } catch (error) {
      console.error('Failed to load session state:', error)
    }
  }, [searchParams])

  useEffect(() => {
    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ selectedProjectId, messages, timestamp: new Date().toISOString() })
      )
    } catch (error) {
      console.error('Failed to save session state:', error)
    }
  }, [selectedProjectId, messages])

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
        if (!selectedProjectId && data.projects?.length > 0) {
          setSelectedProjectId(data.projects[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setLoadingProjects(false)
    }
  }

  /** Grow the composer with its content, up to a ceiling. */
  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const sendMessage = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || isLoading) return

    if (!selectedProjectId) {
      toast.error('Select a project first')
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: text,
      role: 'user',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: messages.filter(m => m.id !== 'welcome').slice(-5),
          projectId: selectedProjectId,
        }),
      })

      const data = await response.json().catch(() => null)

      if (response.status === 429) {
        toast.error(data?.error || 'Usage limit reached')
        fetchUsage()
        return
      }

      if (!response.ok) throw new Error(data?.error || 'Failed to send message')

      setMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          content: data.message,
          role: 'assistant',
          timestamp: new Date(),
          requirements: data.requirements || [],
        },
      ])
      fetchUsage()

      if (data.requirements?.length > 0) {
        toast.success(
          `${data.requirements.length} requirement${data.requirements.length !== 1 ? 's' : ''} saved`
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send message')
      console.error('Chat error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const outOfQuota = usage?.chatLifetimeRemaining === 0 || usage?.chatDailyRemaining === 0
  const showSuggestions = messages.length <= 1 && !isLoading

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col lg:h-screen">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3.5 lg:px-10">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-sm font-semibold text-ink">Requirements assistant</h1>
            <p className="text-[11px] text-ink-subtle">
              Requirements found in the conversation are saved to your project
            </p>
          </div>
        </div>

        {loadingProjects ? (
          <Loader2 className="h-4 w-4 animate-spin text-ink-subtle" />
        ) : projects.length === 0 ? (
          <Link href="/dashboard/projects/new" className="text-[13px] font-medium text-accent hover:underline">
            Create a project first →
          </Link>
        ) : (
          <Select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="w-auto min-w-[11rem]"
            aria-label="Project"
          >
            <option value="">Select a project</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        )}
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map(message => (
            <div key={message.id} className="flex gap-3.5">
              <span
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold',
                  message.role === 'user'
                    ? 'bg-surface-subtle text-ink-muted'
                    : 'bg-accent text-accent-fg'
                )}
                aria-hidden="true"
              >
                {message.role === 'user' ? 'You' : <Sparkles className="h-3.5 w-3.5" />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">
                  {message.content}
                </p>

                {message.requirements && message.requirements.length > 0 && (
                  <div className="mt-3 rounded-xl border border-line bg-surface p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                        <FileText className="h-3 w-3" />
                        {message.requirements.length} saved
                      </span>
                      <Link
                        href={
                          selectedProjectId
                            ? `/dashboard/requirements?projectId=${selectedProjectId}`
                            : '/dashboard/requirements'
                        }
                        className="text-[11px] font-medium text-accent hover:underline"
                      >
                        View all →
                      </Link>
                    </div>
                    <ul className="space-y-1.5">
                      {message.requirements.map((req: any, idx: number) => (
                        <li key={req.id ?? idx} className="flex items-start justify-between gap-2">
                          <span className="min-w-0 flex-1 text-[13px] text-ink">{req.title}</span>
                          <Badge>{(req.priority ?? '').toLowerCase()}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="flex items-center gap-2 pt-1 text-[14.5px] text-ink-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking…
              </span>
            </div>
          )}

          {showSuggestions && (
            <div className="ml-[2.625rem] flex flex-wrap gap-2 pt-1">
              {SUGGESTIONS.map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  disabled={!selectedProjectId || outOfQuota}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-ink disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-line px-6 py-4 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface p-2 transition-colors focus-within:border-accent">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                autoResize()
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={MAX_CHAT_MESSAGE_CHARS}
              disabled={outOfQuota}
              placeholder={
                outOfQuota
                  ? 'You have used your chat allowance for the study'
                  : 'Describe your project, paste notes, or ask for help…'
              }
              className="max-h-[200px] min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-[14.5px] leading-relaxed text-ink outline-none placeholder:text-ink-subtle disabled:cursor-not-allowed"
            />
            <Button
              variant="primary"
              onClick={() => sendMessage()}
              disabled={!input.trim() || outOfQuota}
              loading={isLoading}
              className="h-8 w-8 shrink-0 rounded-xl px-0"
              aria-label="Send message"
            >
              {!isLoading && <ArrowUp className="h-4 w-4" />}
            </Button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] text-ink-subtle">
            <span>Enter to send · Shift+Enter for a new line</span>
            {usage && (
              <span
                className={cn(
                  usage.chatLifetimeRemaining === 0
                    ? 'font-medium text-critical'
                    : usage.chatDailyRemaining === 0
                      ? 'font-medium text-caution'
                      : undefined
                )}
              >
                {usage.chatLifetimeRemaining === 0
                  ? 'Study chat allowance used'
                  : `${usage.chatDailyRemaining} of ${usage.limits.dailyChat} today · ${usage.chatLifetimeRemaining} left in study`}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
