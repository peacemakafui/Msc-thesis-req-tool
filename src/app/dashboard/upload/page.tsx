'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File, Loader2, CheckCircle, XCircle, Send, Trash2, FolderOpen } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'

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

export default function UploadPage() {
  const searchParams = useSearchParams()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatting, setIsChatting] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState(true)

  // Session persistence key
  const SESSION_KEY = 'upload_session_state'

  // Load projects on mount
  useEffect(() => {
    fetchProjects()
  }, [])

  // Set project from URL params
  useEffect(() => {
    const projectIdFromUrl = searchParams.get('projectId')
    if (projectIdFromUrl) {
      setSelectedProjectId(projectIdFromUrl)
    }
  }, [searchParams])

  // Load session state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(SESSION_KEY)
      if (savedState) {
        const parsed = JSON.parse(savedState)
        if (parsed.selectedProjectId) {
          setSelectedProjectId(parsed.selectedProjectId)
        }
        // Note: We don't restore files/chat as they're tied to backend data
        // Only restore UI state like selected project
      }
    } catch (error) {
      console.error('Failed to load session state:', error)
    }
  }, [])

  // Save session state to localStorage whenever it changes
  useEffect(() => {
    try {
      const stateToSave = {
        selectedProjectId,
        timestamp: new Date().toISOString()
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(stateToSave))
    } catch (error) {
      console.error('Failed to save session state:', error)
    }
  }, [selectedProjectId])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
        
        // If no project selected and projects exist, select the first one
        if (!selectedProjectId && data.projects.length > 0) {
          setSelectedProjectId(data.projects[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setLoadingProjects(false)
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!selectedProjectId) {
      toast.error('Please select a project first')
      return
    }

    const newFiles = acceptedFiles.map(file => ({
      id: Date.now() + Math.random().toString(),
      name: file.name,
      size: file.size,
      status: 'uploading' as const
    }))

    setFiles(prev => [...prev, ...newFiles])

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i]
      const fileId = newFiles[i].id

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('projectId', selectedProjectId)

        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'uploading' } : f
        ))

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }

        const result = await response.json()

        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'processing' } : f
        ))

        const processResponse = await fetch('/api/process-document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId: result.documentId
          })
        })

        if (!processResponse.ok) {
          throw new Error('Processing failed')
        }

        const processResult = await processResponse.json()

        const completedFile = { 
          ...newFiles[i], 
          status: 'completed' as const,
          requirements: processResult.requirements || [],
          extractedText: result.extractedText || '',
          documentId: result.documentId
        }
        
        setFiles(prev => prev.map(f => 
          f.id === fileId ? completedFile : f
        ))

        if (i === 0) {
          setSelectedFile(completedFile)
          setChatMessages([{
            id: '1',
            content: `I've analyzed "${file.name}" and generated ${processResult.requirements?.length || 0} requirements. You can see the extracted text on the right and refine the requirements by chatting with me.`,
            role: 'assistant',
            timestamp: new Date()
          }])
        }

        toast.success(`${file.name} processed successfully! Generated ${processResult.requirements?.length || 0} requirements.`)

      } catch (error) {
        console.error('Upload error:', error)
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { 
            ...f, 
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          } : f
        ))
        toast.error(`Failed to process ${file.name}`)
      }
    }
  }, [selectedProjectId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxSize: 10 * 1024 * 1024,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false)
  })

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedFile || isChatting) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: chatInput,
      role: 'user',
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsChatting(true)

    try {
      const contextMessage = `Document: ${selectedFile.name}

Extracted Text:
${selectedFile.extractedText}

Current Generated Requirements:
${selectedFile.requirements?.map((req, idx) => 
  `${idx + 1}. ${req.title} (${req.type}, ${req.priority}): ${req.description}`
).join('\n') || 'None generated yet'}

User Request: ${chatInput}`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: contextMessage,
          conversationHistory: chatMessages.slice(-3)
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: data.message,
        role: 'assistant',
        timestamp: new Date()
      }

      setChatMessages(prev => [...prev, assistantMessage])

    } catch (error) {
      toast.error('Failed to send message')
      console.error('Chat error:', error)
    } finally {
      setIsChatting(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
    }
  }

  const deleteFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
    if (selectedFile?.id === fileId) {
      setSelectedFile(null)
      setChatMessages([])
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Document Analysis</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Upload documents to extract text and generate requirements with AI assistance
        </p>
        
        {/* Project Selector */}
        <div className="mt-4 flex items-center space-x-3">
          <FolderOpen className="h-5 w-5 text-gray-400" />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Project:
          </label>
          {loadingProjects ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : projects.length === 0 ? (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                No projects found.
              </span>
              <a
                href="/dashboard/projects/new"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Create one
              </a>
            </div>
          ) : (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 p-6 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="mb-6">
            <div
              {...getRootProps()}
              className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${isDragActive || dragActive
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
              <div className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Drop files here or click to upload
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Supports PDF, Word documents, and text files (max 10MB)
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Uploaded Files ({files.length})
              </h3>
              <div className="space-y-3">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedFile?.id === file.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => {
                      if (file.status === 'completed') {
                        setSelectedFile(file)
                        if (chatMessages.length === 0) {
                          setChatMessages([{
                            id: '1',
                            content: `I've analyzed "${file.name}". How can I help you refine the requirements?`,
                            role: 'assistant',
                            timestamp: new Date()
                          }])
                        }
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <File className="h-6 w-6 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {file.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(file.status)}
                        {file.status === 'completed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteFile(file.id)
                            }}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {file.error && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                        Error: {file.error}
                      </div>
                    )}

                    {file.requirements && file.requirements.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                        Generated {file.requirements.length} requirements
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-1/2 flex flex-col">
          {selectedFile ? (
            <>
              <div className="flex-1 p-6 border-b border-gray-200 dark:border-gray-700 overflow-y-auto">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Extracted Text - {selectedFile.name}
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-4 text-sm text-gray-900 dark:text-white max-h-80 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono">
                    {selectedFile.extractedText || 'No text extracted'}
                  </pre>
                </div>
                
                {selectedFile.requirements && selectedFile.requirements.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">
                      Generated Requirements ({selectedFile.requirements.length})
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedFile.requirements.map((req: any, idx: number) => (
                        <div key={idx} className="bg-white dark:bg-gray-700 rounded p-3 border border-gray-200 dark:border-gray-600">
                          <div className="font-medium text-sm text-gray-900 dark:text-white">
                            {req.title}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                            {req.type} • {req.priority} • {Math.round(req.confidence * 100)}% confidence
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Refine Requirements
                </h3>
                
                <div className="flex-1 overflow-y-auto mb-4 space-y-3 max-h-64">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md px-3 py-2 rounded-lg text-sm ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isChatting && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Ask me to refine requirements, fix errors, or explain something..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim() || isChatting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <div className="text-lg font-medium">Select a processed document</div>
                <div className="text-sm">Upload and process a document to see extracted text and chat with AI</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
