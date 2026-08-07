import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { getUsage } from '@/lib/rateLimit'
import { apiError } from '@/lib/apiError'

export async function GET() {
  try {
    const user = await requireAuth()
    return NextResponse.json(await getUsage(user.id))
  } catch (error) {
    return apiError('Failed to fetch usage', error)
  }
}
