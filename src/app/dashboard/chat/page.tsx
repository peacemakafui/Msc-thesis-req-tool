'use client'

import { useState, useEffect } from 'react'
import { Send, Loader2, FileText, Sparkles, FolderOpen } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'

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

export default function ChatPage() {
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Session persistence key
  const SESSION_KEY = 'chat_session_state'

  // Initialize welcome message after mount to avoid hydration mismatch
  useEffect(() => {
    setMessages([{
      id: '1',
      content: "Hello! I'm your AI assistant for requirements gathering. You can:\n\n• Paste your project notes or requirements\n• Describe your project in natural language\n• Ask me to analyze text and extract requirements\n• Request help refining existing requirements\n\nPlease select a project to get started!",
      role: 'assistant',
      timestamp: new Date()
    }])
  }, [])

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
        
        // Restore project selection
        if (parsed.selectedProjectId && !searchParams.get('projectId')) {
          setSelectedProjectId(parsed.selectedProjectId)
        }
        
        // Restore chat messages if from same session (within last hour)
        if (parsed.messages && parsed.timestamp && parsed.messages.length > 1) {
          const savedTime = new Date(parsed.timestamp).getTime()
          const currentTime = new Date().getTime()
          const hourInMs = 60 * 60 * 1000
          
          if (currentTime - savedTime < hourInMs) {
            // Restore messages with proper Date objects
            const restoredMessages = parsed.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
            setMessages(restoredMessages)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load session state:', error)
    }
  }, [searchParams])

  // Save session state to localStorage whenever it changes
  useEffect(() => {
    try {
      const stateToSave = {
        selectedProjectId,
        messages,
        timestamp: new Date().toISOString()
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(stateToSave))
    } catch (error) {
      console.error('Failed to save session state:', error)
    }
  }, [selectedProjectId, messages])

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

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    if (!selectedProjectId) {
      toast.error('Please select a project first')
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          conversationHistory: messages.slice(-5), // Send last 5 messages for context
          projectId: selectedProjectId
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
        timestamp: new Date(),
        requirements: data.requirements || []
      }

      setMessages(prev => [...prev, assistantMessage])

      // Show toast if requirements were generated
      if (data.requirements && data.requirements.length > 0) {
        toast.success(`Generated ${data.requirements.length} requirements!`)
      }
    } catch (error) {
      toast.error('Failed to send message')
      console.error('Chat error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Sparkles className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                AI Requirements Assistant
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Chat with AI to generate and refine software requirements
              </p>
            </div>
          </div>
          
          {/* Project Selector */}
          <div className="flex items-center space-x-3">
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
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* Requirements Preview */}
              {message.requirements && message.requirements.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center text-sm font-medium mb-2">
                    <FileText className="h-4 w-4 mr-1" />
                    Generated Requirements ({message.requirements.length})
                  </div>
                  <div className="space-y-2">
                    {message.requirements.map((req: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-gray-700 rounded p-2 text-xs"
                      >
                        <div className="font-medium">{req.title}</div>
                        <div className="text-gray-600 dark:text-gray-300 mt-1">
                          {req.type} • {req.priority}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className={`text-xs mt-2 opacity-70`}>
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-gray-600 dark:text-gray-300">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex space-x-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe your project, paste requirements, or ask for help..."
            className="flex-1 min-h-[50px] max-h-[150px] resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  )
}