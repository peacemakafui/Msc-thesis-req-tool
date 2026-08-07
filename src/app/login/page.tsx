'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { Sparkles } from 'lucide-react'
import { Button, Card, Field, Input, Spinner } from '@/components/ui'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '' })

  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })
      if (result?.error) {
        // The credentials provider also surfaces the sign-in throttle here.
        toast.error(
          result.error.includes('Too many') ? result.error : 'Incorrect email or password'
        )
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Field label="Email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={formData.email}
          onChange={e => setFormData({ ...formData, email: e.target.value })}
          placeholder="you@example.com"
          disabled={isLoading}
        />
      </Field>

      <Field label="Password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={formData.password}
          onChange={e => setFormData({ ...formData, password: e.target.value })}
          placeholder="••••••••"
          disabled={isLoading}
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" loading={isLoading} className="w-full">
        Sign in
      </Button>

      <p className="text-center text-[13px] text-ink-muted">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <Sparkles className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-semibold text-ink">Welcome back</h1>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            AI-assisted requirements gathering — MSc research study
          </p>
        </div>

        <Card className="p-6">
          <Suspense
            fallback={
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </Card>
      </div>
    </div>
  )
}
