'use client'

export const dynamic = 'force-dynamic'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  File as FileIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  X,
  Sparkles,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'
import { Badge, Button, Card, IconButton, Select, cn } from '@/components/ui'
import { MAX_UPLOAD_BYTES } from '@/lib/limits'

interface UploadedFile {
  id: string
  name: string
  size: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  requirements?: any[]
  extractedText?: string
  documentId?: string
  error?: string
}

interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

interface Project {
  id: string
  name: string
  description: string | null
}

const SESSION_KEY = 'upload_session_state'

/** How much document text to include when asking the assistant about a file.
 *  The server truncates anyway; trimming here keeps the useful part. */
const CHAT_CONTEXT_CHARS = 6_000

const MAX_MB = Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))

export default function UploadPage() {
  const searchParams = useSearchParams()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatting, setIsChatting] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [usage, setUsage] = useState<{
    uploadDailyRemaining: number
    uploadLifetimeRemaining: number
    limits: { dailyUpload: number; lifetimeUpload: number }
  } | null>(null)

  const chatScrollRef = useRef<HTMLDivElement>(null)

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/usage')
      if (res.ok) setUsage(await res.json())
    } catch {
      /* the meter is informational */
    }
  }

  useEffect(() => {
    fetchProjects()
    fetchUsage()
  }, [])

  useEffect(() => {
    const projectIdFromUrl = searchParams.get('projectId')
    if (projectIdFromUrl) setSelectedProjectId(projectIdFromUrl)
  }, [searchParams])

  useEffect(() => {
    try {
      const savedState = localStorage.getItem(SESSION_KEY)
      if (savedState) {
        const parsed = JSON.parse(savedState)
        // Only the project selection is restored — file state lives server-side.
        if (parsed.selectedProjectId) setSelectedProjectId(parsed.selectedProjectId)
      }
    } catch (error) {
      console.error('Failed to load session state:', error)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ selectedProjectId, timestamp: new Date().toISOString() })
      )
    } catch (error) {
      console.error('Failed to save session state:', error)
    }
  }, [selectedProjectId])

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, isChatting])

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

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!selectedProjectId) {
        toast.error('Select a project first')
        return
      }

      const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        status: 'uploading',
      }))

      setFiles(prev => [...prev, ...newFiles])

      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i]
        const fileId = newFiles[i].id

        const markError = (message: string) => {
          setFiles(prev =>
            prev.map(f => (f.id === fileId ? { ...f, status: 'error', error: message } : f))
          )
        }

        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('projectId', selectedProjectId)

          const response = await fetch('/api/upload', { method: 'POST', body: formData })
          const result = await response.json().catch(() => null)

          // Quota and validation failures carry a message worth showing.
          if (!response.ok) {
            if (response.status === 429) fetchUsage()
            throw new Error(result?.error || 'Upload failed')
          }

          setFiles(prev => prev.map(f => (f.id === fileId ? { ...f, status: 'processing' } : f)))

          const processResponse = await fetch('/api/process-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: result.documentId }),
          })
          const processResult = await processResponse.json().catch(() => null)

          if (!processResponse.ok) {
            if (processResponse.status === 429) fetchUsage()
            throw new Error(processResult?.error || 'Processing failed')
          }

          fetchUsage()

          const completedFile: UploadedFile = {
            ...newFiles[i],
            status: 'completed',
            requirements: processResult.requirements || [],
            extractedText: result.extractedText || '',
            documentId: result.documentId,
          }

          setFiles(prev => prev.map(f => (f.id === fileId ? completedFile : f)))

          if (i === 0) {
            setSelectedFile(completedFile)
            setChatMessages([
              {
                id: 'intro',
                content: `I analysed "${file.name}" and generated ${
                  processResult.requirements?.length || 0
                } requirements. Ask me to refine them, or tell me what's missing.`,
                role: 'assistant',
                timestamp: new Date(),
              },
            ])
          }

          toast.success(
            `${file.name}: ${processResult.requirements?.length || 0} requirements generated`
          )
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          console.error('Upload error:', error)
          markError(message)
          toast.error(message)
        }
      }
    },
    [selectedProjectId]
  )

  const outOfQuota = usage?.uploadLifetimeRemaining === 0 || usage?.uploadDailyRemaining === 0

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxSize: MAX_UPLOAD_BYTES,
    disabled: !selectedProjectId || outOfQuota,
    onDropRejected: rejections => {
      const reason = rejections[0]?.errors[0]
      toast.error(
        reason?.code === 'file-too-large'
          ? `File is too large. The maximum is ${MAX_MB}MB.`
          : 'That file type is not supported.'
      )
    },
  })

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedFile || isChatting) return

    const question = chatInput.trim()
    setChatMessages(prev => [
      ...prev,
      { id: Date.now().toString(), content: question, role: 'user', timestamp: new Date() },
    ])
    setChatInput('')
    setIsChatting(true)

    try {
      const contextMessage = `Document: ${selectedFile.name}

Extracted Text:
${(selectedFile.extractedText || '').slice(0, CHAT_CONTEXT_CHARS)}

Current Generated Requirements:
${
  selectedFile.requirements
    ?.map(
      (req, idx) => `${idx + 1}. ${req.title} (${req.type}, ${req.priority}): ${req.description}`
    )
    .join('\n') || 'None generated yet'
}

User Request: ${question}`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: contextMessage,
          conversationHistory: chatMessages.filter(m => m.id !== 'intro').slice(-3),
          projectId: selectedProjectId,
        }),
      })

      const data = await response.json().catch(() => null)

      if (response.status === 429) {
        toast.error(data?.error || 'Usage limit reached')
        return
      }
      if (!response.ok) throw new Error(data?.error || 'Failed to send message')

      setChatMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          content: data.message,
          role: 'assistant',
          timestamp: new Date(),
        },
      ])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send message')
      console.error('Chat error:', error)
    } finally {
      setIsChatting(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 bytes'
    const units = ['bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`
  }

  const statusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-accent" />
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-positive" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-critical" />
    }
  }

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
    if (selectedFile?.id === fileId) {
      setSelectedFile(null)
      setChatMessages([])
    }
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col lg:h-screen">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3.5 lg:px-10">
        <div>
          <h1 className="text-sm font-semibold text-ink">Document analysis</h1>
          <p className="text-[11px] text-ink-subtle">
            Upload a document to extract requirements automatically
          </p>
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

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left: dropzone and file list */}
        <div className="w-full overflow-y-auto border-line px-6 py-6 lg:w-[42%] lg:border-r lg:px-8">
          <div
            {...getRootProps()}
            className={cn(
              'rounded-card border border-dashed px-6 py-9 text-center transition-colors',
              !selectedProjectId || outOfQuota
                ? 'cursor-not-allowed border-line bg-surface-subtle opacity-60'
                : isDragActive
                  ? 'cursor-pointer border-accent bg-accent-soft'
                  : 'cursor-pointer border-line-strong bg-surface hover:border-accent hover:bg-surface-hover'
            )}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto mb-3 h-7 w-7 text-ink-subtle" />
            <p className="text-sm font-medium text-ink">
              {outOfQuota
                ? 'Upload allowance used'
                : !selectedProjectId
                  ? 'Select a project to upload'
                  : 'Drop a file here, or click to browse'}
            </p>
            <p className="mt-1 text-[13px] text-ink-subtle">
              PDF, Word or text · up to {MAX_MB}MB
            </p>
          </div>

          {usage && (
            <p
              className={cn(
                'mt-2.5 text-right text-[11px]',
                usage.uploadLifetimeRemaining === 0
                  ? 'font-medium text-critical'
                  : usage.uploadDailyRemaining === 0
                    ? 'font-medium text-caution'
                    : 'text-ink-subtle'
              )}
            >
              {usage.uploadLifetimeRemaining === 0
                ? 'Study upload allowance used'
                : `${usage.uploadDailyRemaining} of ${usage.limits.dailyUpload} today · ${usage.uploadLifetimeRemaining} left in study`}
            </p>
          )}

          {files.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                Files ({files.length})
              </h2>
              <div className="space-y-2">
                {files.map(file => (
                  <Card
                    key={file.id}
                    onClick={() => {
                      if (file.status !== 'completed') return
                      setSelectedFile(file)
                      if (chatMessages.length === 0) {
                        setChatMessages([
                          {
                            id: 'intro',
                            content: `Ask me anything about "${file.name}" or how to refine its requirements.`,
                            role: 'assistant',
                            timestamp: new Date(),
                          },
                        ])
                      }
                    }}
                    className={cn(
                      'p-3 transition-colors',
                      file.status === 'completed' && 'cursor-pointer hover:bg-surface-hover',
                      selectedFile?.id === file.id && 'border-accent bg-accent-soft'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileIcon className="h-4 w-4 shrink-0 text-ink-subtle" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{file.name}</p>
                        <p className="text-[11px] text-ink-subtle">{formatFileSize(file.size)}</p>
                      </div>
                      {statusIcon(file.status)}
                      <IconButton
                        label="Remove from list"
                        onClick={e => {
                          e.stopPropagation()
                          removeFile(file.id)
                        }}
                        className="h-7 w-7"
                      >
                        <X className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>

                    {file.error && (
                      <p className="mt-2 rounded-lg bg-critical-soft px-2.5 py-1.5 text-[12px] text-critical">
                        {file.error}
                      </p>
                    )}

                    {file.requirements && file.requirements.length > 0 && (
                      <div className="mt-2">
                        <Badge tone="positive">
                          {file.requirements.length} requirement
                          {file.requirements.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: extracted text and refinement chat */}
        <div className="flex min-h-0 w-full flex-1 flex-col">
          {selectedFile ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 lg:px-8">
                <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Extracted text
                </h2>
                <Card className="max-h-64 overflow-y-auto bg-surface-subtle p-4">
                  <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink-muted">
                    {selectedFile.extractedText || 'No text extracted'}
                  </pre>
                </Card>

                {selectedFile.requirements && selectedFile.requirements.length > 0 && (
                  <>
                    <h2 className="mb-2.5 mt-6 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                      Generated requirements ({selectedFile.requirements.length})
                      <Link
                        href={`/dashboard/requirements?projectId=${selectedProjectId}`}
                        className="font-medium normal-case tracking-normal text-accent hover:underline"
                      >
                        Open in requirements →
                      </Link>
                    </h2>
                    <div className="space-y-2">
                      {selectedFile.requirements.map((req: any, idx: number) => (
                        <Card key={req.id ?? idx} className="p-3">
                          <p className="text-[13px] font-medium text-ink">{req.title}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge>{(req.type ?? '').replace(/_/g, ' ').toLowerCase()}</Badge>
                            <Badge>{(req.priority ?? '').toLowerCase()}</Badge>
                            {typeof req.confidence === 'number' && (
                              <span className="text-[11px] text-ink-subtle">
                                {Math.round(req.confidence * 100)}% confidence
                              </span>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Refinement chat */}
              <div className="flex min-h-0 shrink-0 flex-col border-t border-line">
                <div className="flex items-center gap-2 px-6 pt-4 lg:px-8">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                    Refine with the assistant
                  </h2>
                </div>

                <div
                  ref={chatScrollRef}
                  className="max-h-48 min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-3 lg:px-8"
                >
                  {chatMessages.map(message => (
                    <div key={message.id} className="flex gap-2.5">
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-semibold',
                          message.role === 'user'
                            ? 'bg-surface-subtle text-ink-muted'
                            : 'bg-accent text-accent-fg'
                        )}
                        aria-hidden="true"
                      >
                        {message.role === 'user' ? 'You' : <Sparkles className="h-2.5 w-2.5" />}
                      </span>
                      <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                        {message.content}
                      </p>
                    </div>
                  ))}
                  {isChatting && (
                    <div className="flex items-center gap-2 pl-7 text-[13px] text-ink-muted">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Thinking…
                    </div>
                  )}
                </div>

                <div className="px-6 pb-4 lg:px-8">
                  <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-surface p-1.5 focus-within:border-accent">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                      placeholder="Ask about this document…"
                      className="flex-1 bg-transparent px-2 text-[13px] text-ink outline-none placeholder:text-ink-subtle"
                    />
                    <Button
                      variant="primary"
                      onClick={sendChatMessage}
                      disabled={!chatInput.trim()}
                      loading={isChatting}
                      className="h-7 w-7 shrink-0 rounded-lg px-0"
                      aria-label="Send"
                    >
                      {!isChatting && <ArrowUp className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 py-16">
              <div className="max-w-xs text-center">
                <FileIcon className="mx-auto mb-3 h-8 w-8 text-ink-subtle" />
                <p className="text-sm font-medium text-ink">No document selected</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                  Upload a document, then select it to see the extracted text and refine its
                  requirements.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
