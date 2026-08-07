import { NextResponse } from 'next/server'

// Per-user Trello credentials are no longer used.
// The researcher's shared credentials are stored in TRELLO_API_KEY / TRELLO_TOKEN env vars.
export async function POST() {
  return NextResponse.json(
    { error: 'Per-user Trello credentials are not required. Export uses the shared researcher account.' },
    { status: 410 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Per-user Trello credentials are not required.' },
    { status: 410 }
  )
}
