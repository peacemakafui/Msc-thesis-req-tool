'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, Field, Input, Textarea } from '@/components/ui'
import { MAX_PROJECT_DESCRIPTION_CHARS, MAX_PROJECT_NAME_CHARS } from '@/lib/limits'

export default function NewProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Please enter a project name')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create project')
      }

      toast.success('Project created')
      router.push('/dashboard/projects')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-8 lg:px-10">
      <button
        onClick={() => router.back()}
        className="mb-5 flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <h1 className="text-[22px] font-semibold text-ink">New project</h1>
      <p className="mt-1 text-sm text-ink-muted">
        A project groups the documents, requirements and conversations for one piece of work.
      </p>

      <Card className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Project name" required>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Leave management system"
              maxLength={MAX_PROJECT_NAME_CHARS}
              required
            />
          </Field>

          <Field label="Description" hint="Optional — helps the assistant understand the context">
            <Textarea
              id="description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              maxLength={MAX_PROJECT_DESCRIPTION_CHARS}
              placeholder="What is this project for?"
              className="resize-y"
            />
          </Field>

          <div className="flex gap-2 pt-1">
            <Button type="submit" variant="primary" loading={loading} className="flex-1">
              Create project
            </Button>
            <Button type="button" onClick={() => router.back()} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
