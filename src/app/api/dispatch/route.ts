import { NextRequest, NextResponse } from 'next/server'
import { candidates, messageRecords, ContactStatus } from '@/lib/store'
import { sendTemplateMessages } from '@/lib/infobip'

export async function POST(req: NextRequest) {
  let body: { candidateIds: string[]; templateName: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { candidateIds, templateName } = body

  if (!candidateIds?.length || !templateName) {
    return NextResponse.json(
      { error: 'candidateIds e templateName são obrigatórios' },
      { status: 400 }
    )
  }

  const targets = candidates.filter((c) => candidateIds.includes(c.id))
  if (!targets.length) {
    return NextResponse.json({ error: 'Nenhum candidato encontrado' }, { status: 404 })
  }

  // Marcar como enfileirado
  targets.forEach((c) => {
    c.contactStatus = 'queued'
  })

  let results: { messageId: string; status: string }[]
  try {
    results = await sendTemplateMessages(
      targets.map((c) => ({
        to: c.phone,
        candidateName: c.name,
        templateName,
        placeholders: [],
      }))
    )
  } catch (err) {
    // Reverter status em caso de erro
    targets.forEach((c) => {
      c.contactStatus = 'not_contacted'
    })
    const message = err instanceof Error ? err.message : String(err)
    // Não logar a mensagem completa pois pode conter detalhes sensíveis
    return NextResponse.json(
      { error: `Falha no envio: ${message}` },
      { status: 502 }
    )
  }

  // Associar messageIds aos candidatos
  results.forEach((r, i) => {
    const candidate = targets[i]
    if (!candidate) return
    candidate.messageId = r.messageId
    candidate.contactStatus = 'sent'
    messageRecords.set(r.messageId, {
      messageId: r.messageId,
      candidateId: candidate.id,
      status: 'sent',
      sentAt: new Date(),
    })
  })

  return NextResponse.json({
    sent: results.length,
    testMode: !!process.env.TEST_OVERRIDE_PHONE,
    testPhone: process.env.TEST_OVERRIDE_PHONE || null,
    results: results.map((r, i) => ({
      candidateId: targets[i]?.id,
      candidateName: targets[i]?.name,
      messageId: r.messageId,
      status: r.status,
    })),
  })
}
