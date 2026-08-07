'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { KeyRound, Sparkles } from 'lucide-react'
import { Button, Card, Field, Input } from '@/components/ui'

export default function SignupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    accessCode: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    organization: '',
    position: '',
    experience: '',
  })

  const set = (key: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(prev => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.accessCode.trim()) {
      toast.error('An access code is required to join the study')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessCode: formData.accessCode.trim(),
          email: formData.email,
          password: formData.password,
          name: formData.name,
          organization: formData.organization,
          position: formData.position,
          experience: formData.experience,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Something went wrong')
      }

      const signInResult = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (signInResult?.error) {
        toast.success('Account created — please sign in')
        router.push('/login')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <Sparkles className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-semibold text-ink">Join the study</h1>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            Create an account to take part in the requirements gathering research
          </p>
        </div>

        <Card className="p-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Access code first — it is the gate, so it shouldn't be a surprise
                at the end of a long form. */}
            <Field label="Access code" required hint="Provided by the researcher">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
                <Input
                  id="accessCode"
                  value={formData.accessCode}
                  onChange={set('accessCode')}
                  required
                  autoComplete="off"
                  placeholder="Enter your code"
                  disabled={isLoading}
                  className="pl-9"
                />
              </div>
            </Field>

            <div className="border-t border-line pt-4">
              <Field label="Email" required>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={set('email')}
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
              </Field>
            </div>

            <Field label="Full name">
              <Input
                id="name"
                value={formData.name}
                onChange={set('name')}
                placeholder="Ada Lovelace"
                disabled={isLoading}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Organization">
                <Input
                  id="organization"
                  value={formData.organization}
                  onChange={set('organization')}
                  placeholder="Your company"
                  disabled={isLoading}
                />
              </Field>

              <Field label="Position">
                <Input
                  id="position"
                  value={formData.position}
                  onChange={set('position')}
                  placeholder="Software developer"
                  disabled={isLoading}
                />
              </Field>
            </div>

            <Field label="Years of experience">
              <Input
                id="experience"
                type="number"
                min="0"
                max="80"
                value={formData.experience}
                onChange={set('experience')}
                placeholder="5"
                disabled={isLoading}
              />
            </Field>

            <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <Field label="Password" required hint="At least 8 characters">
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={set('password')}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </Field>

              <Field label="Confirm password" required>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={set('confirmPassword')}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </Field>
            </div>

            <Button type="submit" variant="primary" size="lg" loading={isLoading} className="w-full">
              Create account
            </Button>

            <p className="text-center text-[13px] text-ink-muted">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-accent hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  )
}
