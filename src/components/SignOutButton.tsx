'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { Button } from './ui'

export default function SignOutButton() {
  return (
    <Button onClick={() => signOut({ callbackUrl: '/login' })}>
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </Button>
  )
}
