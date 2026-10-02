import { NextRequest, NextResponse } from 'next/server'
import { candidates } from '@/lib/store'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const vagaId = searchParams.get('vagaId')
  const name = searchParams.get('name')?.toLowerCase()
  const stage = searchParams.get('stage')
  const city = searchParams.get('city')

  let result = candidates

  if (vagaId) result = result.filter((c) => c.vagaId === vagaId)
  if (name) result = result.filter((c) => c.name.toLowerCase().includes(name))
  if (stage) result = result.filter((c) => c.stage === stage)
  if (city) result = result.filter((c) => c.city === city)

  return NextResponse.json(result)
}
