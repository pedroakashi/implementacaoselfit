import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const vagaId = searchParams.get('vagaId')
  const name   = searchParams.get('name')
  const stage  = searchParams.get('stage')
  const city   = searchParams.get('city')

  const where: Prisma.CandidateWhereInput = {}
  if (vagaId) where.vagaId = vagaId
  if (stage)  where.stage  = stage
  if (city)   where.city   = city
  if (name)   where.name   = { contains: name, mode: 'insensitive' }

  const candidates = await prisma.candidate.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(candidates)
}
