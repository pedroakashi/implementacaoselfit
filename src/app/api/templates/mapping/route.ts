import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { Mapping } from '@/lib/templates'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  const lang = req.nextUrl.searchParams.get('lang')

  if (!name || !lang) {
    return NextResponse.json(null)
  }

  const row = await prisma.templateMapping.findUnique({
    where: { templateName_language: { templateName: name, language: lang } },
  })

  return NextResponse.json((row?.mapping as unknown as Mapping) ?? null)
}
