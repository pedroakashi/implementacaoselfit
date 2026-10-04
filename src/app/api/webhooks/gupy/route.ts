import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { mapApplication, extractNomeCurto, extractUnidade } from '@/lib/gupy-mapper'
import type { GupyApplication } from '@/lib/gupy'

// Comparação em tempo constante para evitar timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Percorre de qualquer forma para manter tempo constante
    let diff = 0
    for (let i = 0; i < Math.max(a.length, b.length); i++) diff += 1
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// Extrai o id da candidatura de forma defensiva (dois caminhos possíveis na doc Gupy)
function extractApplicationId(payload: Record<string, unknown>): string | null {
  const data = payload.data as Record<string, unknown> | undefined
  const fromData = data?.application
    ? String((data.application as Record<string, unknown>).id ?? '')
    : null
  const fromRoot = payload.id ? String(payload.id) : null
  const fromDataId = data?.id ? String(data.id) : null
  return fromData || fromDataId || fromRoot || null
}

export async function POST(req: NextRequest) {
  // 1. Validar secret em tempo constante
  const secret = process.env.GUPY_WEBHOOK_SECRET
  const incomingSecret = req.headers.get('x-convoca-secret') ?? ''
  if (!secret || !timingSafeEqual(incomingSecret, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // 2. Responder rápido — a Gupy exige resposta em < 30s
  // Todo o processamento real acontece antes do return, mas sem chamadas externas lentas

  const eventId     = payload.id ? String(payload.id) : null
  const action      = typeof payload.action === 'string' ? payload.action : 'unknown'
  const eventDateRaw = payload.date ?? payload.eventDate
  const eventDate   = eventDateRaw ? new Date(String(eventDateRaw)) : new Date()

  if (!eventId) {
    // Sem id de evento: gravar mesmo assim, mas logar só as chaves
    console.warn('[gupy-webhook] Evento sem id. Chaves do payload:', Object.keys(payload))
    return NextResponse.json({ ok: true, deduped: false })
  }

  // 3. Deduplicar
  const existing = await prisma.gupyEvent.findUnique({ where: { id: eventId } })
  if (existing) {
    return NextResponse.json({ ok: true, deduped: true })
  }

  const applicationId = extractApplicationId(payload)

  // 4. Gravar evento
  await prisma.gupyEvent.create({
    data: {
      id: eventId,
      action,
      eventDate,
      applicationId,
      payload: payload as never,
      receivedAt: new Date(),
    },
  })

  // 5. Processar apenas os eventos de candidatura
  if (
    (action === 'application.created' || action === 'application.moved') &&
    applicationId
  ) {
    const data = payload.data as Record<string, unknown> | undefined
    if (data) {
      await upsertCandidateFromWebhook(data, applicationId, eventDate, action)
    }
  }

  return NextResponse.json({ ok: true, deduped: false })
}

async function upsertCandidateFromWebhook(
  data: Record<string, unknown>,
  applicationId: string,
  eventDate: Date,
  action: string
) {
  try {
    // Montar objeto GupyApplication a partir do payload
    const rawCandidate = data.candidate as Record<string, unknown> | undefined
    const rawManual    = data.manualCandidate as Record<string, unknown> | undefined
    const rawStep      = data.currentStep as Record<string, unknown> | undefined
    const rawJob       = data.job as Record<string, unknown> | undefined

    const application: GupyApplication = {
      id: parseInt(applicationId, 10),
      jobId: rawJob?.id ? parseInt(String(rawJob.id), 10) : undefined,
      status: 'in_process',
      currentStep: rawStep?.name ? { name: String(rawStep.name) } : undefined,
      candidate: rawCandidate
        ? {
            name:         String(rawCandidate.name ?? ''),
            lastName:     String(rawCandidate.lastName ?? ''),
            email:        rawCandidate.email ? String(rawCandidate.email) : undefined,
            mobileNumber: rawCandidate.mobileNumber ? String(rawCandidate.mobileNumber) : undefined,
            addressCity:  rawCandidate.addressCity ? String(rawCandidate.addressCity) : undefined,
          }
        : undefined,
      manualCandidate: rawManual
        ? {
            name:         String(rawManual.name ?? ''),
            lastName:     String(rawManual.lastName ?? ''),
            email:        rawManual.email ? String(rawManual.email) : undefined,
            mobileNumber: rawManual.mobileNumber ? String(rawManual.mobileNumber) : undefined,
            addressCity:  rawManual.addressCity ? String(rawManual.addressCity) : undefined,
          }
        : undefined,
    }

    const mapped = mapApplication(application)

    // Encontrar ou criar a vaga correspondente
    let vaga = rawJob?.id
      ? await prisma.vaga.findFirst({ where: { gupyJobId: String(rawJob.id) } })
      : null

    if (rawJob?.id) {
      const jobTitle    = rawJob.name       ? String(rawJob.name)       : undefined
      const jobLocation = rawJob.branchName ? String(rawJob.branchName) : (rawJob.city ? String(rawJob.city) : undefined)
      const jobBranch   = rawJob.branchName ? String(rawJob.branchName) : undefined
      const nomeCurto   = jobTitle ? extractNomeCurto(jobTitle) : undefined
      const unidade     = extractUnidade(jobBranch)
      vaga = await prisma.vaga.upsert({
        where:  { gupyJobId: String(rawJob.id) },
        update: {
          ...(jobTitle    ? { title:    jobTitle,  nomeCurto } : {}),
          ...(jobLocation ? { location: jobLocation, unidade } : {}),
        },
        create: {
          title:     jobTitle    ?? 'Vaga sem nome',
          location:  jobLocation ?? '',
          nomeCurto: nomeCurto ?? null,
          unidade:   unidade ?? null,
          openings:  1,
          gupyJobId: String(rawJob.id),
        },
      })
    }

    const existing = await prisma.candidate.findUnique({
      where: { gupyApplicationId: applicationId },
    })

    // 4. Não regredir se evento é mais antigo que o estado atual
    if (
      existing?.gupyUpdatedAt &&
      eventDate <= existing.gupyUpdatedAt &&
      action === 'application.moved'
    ) {
      return
    }

    const updateData = {
      name:         mapped.name,
      phone:        mapped.phone,
      hasPhone:     mapped.hasPhone,
      city:         mapped.city,
      stage:        mapped.stage,
      gupyUpdatedAt: eventDate,
      source:       'gupy_webhook' as const,
    }

    if (existing) {
      // Upsert: NÃO sobrescrever status/messageId/statusAt de envio
      await prisma.candidate.update({
        where: { id: existing.id },
        data: updateData,
      })
    } else if (vaga) {
      await prisma.candidate.create({
        data: {
          ...mapped,
          vagaId:           vaga.id,
          source:           'gupy_webhook',
          contactStatus:    'not_contacted',
          gupyUpdatedAt:    eventDate,
        },
      })
    }
  } catch (err) {
    // Nunca deixar um erro interno quebrar o 200 para a Gupy
    console.error('[gupy-webhook] Erro ao processar candidatura:', err instanceof Error ? err.message : err)
  }
}
