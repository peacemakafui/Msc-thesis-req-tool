// Database types from Prisma
import type {
  User,
  Project,
  Document,
  Requirement,
  ChatMessage,
  UserInteraction,
  SessionAnalytics,
  ProcessingMetadata,
  UserRole,
  MessageRole,
  DocStatus,
  ReqType,
  Priority,
  ReqStatus,
  ReqSource,
  SessionType,
  InteractionType,
  ProcessingType,
} from '@prisma/client'

export type {
  User,
  Project,
  Document,
  Requirement,
  ChatMessage,
  UserInteraction,
  SessionAnalytics,
  ProcessingMetadata,
  UserRole,
  MessageRole,
  DocStatus,
  ReqType,
  Priority,
  ReqStatus,
  ReqSource,
  SessionType,
  InteractionType,
  ProcessingType,
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// File upload types
export interface FileUploadResult {
  id: string
  filename: string
  originalName: string
  size: number
  mimeType: string
  extractedText?: string
}

// LLM Analysis types
export interface LLMRequirement {
  title: string
  description: string
  type: 'FUNCTIONAL' | 'NON_FUNCTIONAL' | 'BUSINESS' | 'USER_STORY' | 'ACCEPTANCE_CRITERIA'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  confidence: number
}

export interface LLMAnalysisResult {
  requirements: LLMRequirement[]
  model: string
  tokens?: number
  responseTime?: number
}

// Chat types
export interface ChatMessageInput {
  content: string
  projectId?: string
}

export interface ChatResponse {
  message: string
  requirements?: LLMRequirement[]
  model: string
  tokens?: number
  responseTime?: number
}

// Project types
export interface ProjectWithDetails {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  documents: Document[]
  requirements: Requirement[]
  chatMessages: ChatMessage[]
  _count: {
    documents: number
    requirements: number
    chatMessages: number
  }
}

// Session tracking types
export interface SessionMetrics {
  documentsUploaded: number
  requirementsGenerated: number
  chatMessagesExchanged: number
  averageResponseTime: number
  totalDuration: number
}

// Form types
export interface CreateProjectForm {
  name: string
  description?: string
}

export interface LoginForm {
  email: string
  password: string
}

export interface RegisterForm {
  name: string
  email: string
  password: string
  organization?: string
  experience?: number
  position?: string
}