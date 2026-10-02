import { NextResponse } from 'next/server'
import { vagas } from '@/lib/store'

export async function GET() {
  return NextResponse.json(vagas)
}
