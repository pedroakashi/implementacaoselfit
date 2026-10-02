import { NextRequest, NextResponse } from 'next/server'
import { candidates, messageRecords, ContactStatus } from '@/lib/store'

const GROUP_MAP: Record<string, ContactStatus> = {
  PENDING: 'sent',
  DELIVERED: 'delivered',
  SEEN: 'read',
  READ: 'read',
  REJECTED: 'failed',
  UNDELIVERABLE: 'failed',
  EXPIRED: 'failed',
}

export async function POST(req: NextRequest) {
  let body: { results?: Array<{ messageId: string; status: { groupName: string } }> }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const updated: string[] = []

  for (const result of body.results ?? []) {
    const { messageId, status } = result
    const record = messageRecords.get(messageId)
    if (!record) continue

    const newStatus = GROUP_MAP[status?.groupName] ?? null
    if (!newStatus) continue

    record.status = newStatus

    const candidate = candidates.find((c) => c.id === record.candidateId)
    if (candidate) {
      candidate.contactStatus = newStatus
    }

    updated.push(messageId)
  }

  return NextResponse.json({ updated })
}
