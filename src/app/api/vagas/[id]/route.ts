import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { nomeCurto?: string; unidade?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const data: { nomeCurto?: string | null; unidade?: string | null } = {}
  if ('nomeCurto' in body) data.nomeCurto = body.nomeCurto?.trim() || null
  if ('unidade'   in body) data.unidade   = body.unidade?.trim()   || null

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: 'Nenhum campo enviado' }, { status: 400 })
  }

  const vaga = await prisma.vaga.update({
    where: { id: params.id },
    data,
  })

  return NextResponse.json(vaga)
}
