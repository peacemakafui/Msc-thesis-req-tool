# Copilot Instructions for MSc Thesis Project

## Project Overview
This is a Next.js full-stack web application for MSc thesis research on "Enhancing Software Requirements Gathering with Large Language Model-Based Tools for Improved Development Efficiency and Reduced Cognitive Workload".

## Key Features
- Document upload and processing (PDF, Word documents)
- Speech-to-text integration for voice requirements capture
- LLM-powered requirements analysis and generation
- Research analytics dashboard for UTAUT study metrics
- User authentication and session management
- Real-time collaboration features

## Technology Stack
- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes with server-side processing
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **File Processing**: Mammoth (Word docs), pdfjs-dist (PDF text extraction), LLM-based PDF processing for image-based PDFs
- **LLM Integration**: OpenAI GPT-4, Anthropic Claude
- **Speech-to-Text**: Google Cloud Speech-to-Text or OpenAI Whisper
- **UI Components**: Radix UI, Headless UI, Lucide React icons
- **Analytics**: Custom research metrics tracking

## Development Guidelines
- Follow TypeScript best practices with strict type checking
- Use Tailwind CSS for responsive, mobile-first design
- Implement proper error handling and loading states
- Follow Next.js 14 App Router conventions
- Use Prisma for database operations with proper migrations
- Implement proper security measures for file uploads and API endpoints
- Include comprehensive logging for research data collection
- Follow accessibility guidelines (WCAG 2.1)

## Research Context
- Target users: Software development professionals in Ghana
- Focus on measuring Performance Expectancy, Effort Expectancy, and Facilitating Conditions (UTAUT model)
- Design for mobile-friendly usage and slower internet connections
- Include proper analytics for user behavior tracking

## File Structure
```
src/
├── app/                 # Next.js App Router pages and layouts
├── components/          # Reusable UI components
├── lib/                # Utility functions, database config, LLM clients
├── types/              # TypeScript type definitions
└── hooks/              # Custom React hooks

prisma/                 # Database schema and migrations
public/                 # Static assets
```

## Priority Features for Development
1. User authentication and project management
2. Document upload with drag-and-drop interface
3. LLM integration for requirements analysis
4. Speech-to-text functionality
5. Research analytics dashboard
6. Export capabilities for generated requirements