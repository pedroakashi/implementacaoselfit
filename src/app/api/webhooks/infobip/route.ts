import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { ContactStatus } from '@/lib/store'

const GROUP_MAP: Record<string, ContactStatus> = {
  PENDING:       'sent',
  DELIVERED:     'delivered',
  SEEN:          'read',
  READ:          'read',
  REJECTED:      'failed',
  UNDELIVERABLE: 'failed',
  EXPIRED:       'failed',
}

export async function POST(req: NextRequest) {
  let body: {
    results?: Array<{
      messageId: string
      status: { groupName: string; name?: string; description?: string }
    }>
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const updated: string[] = []

  for (const result of body.results ?? []) {
    const { messageId, status } = result
    const newStatus = GROUP_MAP[status?.groupName] ?? null
    if (!newStatus) continue

    const record = await prisma.messageRecord.findUnique({ where: { messageId } })
    if (!record) continue

    const errorDescription =
      newStatus === 'failed' && status.description ? status.description : null

    await prisma.$transaction([
      prisma.messageRecord.update({ where: { messageId }, data: { status: newStatus } }),
      prisma.candidate.update({
        where: { id: record.candidateId },
        data: {
          contactStatus: newStatus,
          statusAt: new Date(),
          ...(errorDescription !== null ? { lastError: errorDescription } : {}),
        },
      }),
    ])

    updated.push(messageId)
  }

  return NextResponse.json({ updated })
}
