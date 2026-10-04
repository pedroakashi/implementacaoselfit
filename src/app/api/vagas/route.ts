import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const vagas = await prisma.vaga.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(vagas)
}
