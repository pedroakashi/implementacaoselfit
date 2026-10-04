import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTemplateMessages, listApprovedTemplates } from '@/lib/infobip'
import { resolveMappingEntry, buildButtonItems, validateMediaUrl, MEDIA_URL_KEY, DOCUMENT_NAME_KEY } from '@/lib/templates'
import type { Mapping, TemplateVar } from '@/lib/templates'

interface DispatchBody {
  candidateIds: string[]
  templateName: string
  language: string
  /** Mapeamento original (pode conter fill_on_send) */
  mapping: Mapping
  /** Valores de runtime para variáveis fill_on_send */
  fillValues?: Record<string, string>
}

function buildBodyPlaceholders(
  vars: TemplateVar[],
  section: TemplateVar['section'],
  mapping: Mapping,
  name: string,
  city: string | null | undefined,
  stage: string,
  nomeCurto: string,
  unidade: string
): string[] {
  return vars
    .filter((v) => v.section === section)
    .sort((a, b) => a.index - b.index)
    .map((v) => {
      const entry = mapping[v.key]
      if (!entry) return ''
      return resolveMappingEntry(entry, name, city, stage, nomeCurto, unidade)
    })
}


export async function POST(req: NextRequest) {
  let body: DispatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { candidateIds, templateName, language, mapping, fillValues } = body
  if (!candidateIds?.length || !templateName || !language || !mapping) {
    return NextResponse.json(
      { error: 'candidateIds, templateName, language e mapping são obrigatórios' },
      { status: 400 }
    )
  }

  // ── Resolve fill_on_send → fixed ─────────────────────────────────────────
  const resolvedMapping: Mapping = {}
  for (const [key, entry] of Object.entries(mapping)) {
    if (entry.type === 'fill_on_send') {
      const val = (fillValues?.[key] ?? '').trim()
      if (!val) {
        return NextResponse.json(
          { error: `Variável "${key}" (preencher no envio) está vazia. Preencha antes de enviar.` },
          { status: 422 }
        )
      }
      resolvedMapping[key] = { type: 'fixed', value: val }
    } else {
      resolvedMapping[key] = entry
    }
  }

  // ── Revalida que o template ainda está APPROVED ───────────────────────────
  let templates
  try {
    templates = await listApprovedTemplates(true)
  } catch (err: unknown) {
    const e = err as { httpStatus?: number; message?: string }
    if (e.httpStatus === 401 || e.httpStatus === 403) {
      return NextResponse.json(
        { error: 'A API key da Infobip não tem permissão para verificar templates.' },
        { status: 502 }
      )
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Falha ao verificar template: ${message}` }, { status: 502 })
  }

  const templateInfo = templates.find(
    (t) => t.name === templateName && t.language === language
  )
  if (!templateInfo) {
    return NextResponse.json(
      {
        error: `Template "${templateName}" (${language}) não está mais APROVADO na Infobip. ` +
               `Selecione outro template ou aguarde a aprovação da Meta.`,
      },
      { status: 422 }
    )
  }

  // ── Valida contagem: body vars e botões com parâmetro ─────────────────────
  const expectedBodyCount = templateInfo.variables.filter((v) => v.section === 'body').length
  const expectedButtonCount = templateInfo.buttons.filter(
    (btn) =>
      btn.type === 'QUICK_REPLY' ||
      (btn.type === 'URL' &&
        templateInfo.variables.some((v) => v.section === 'button_url' && v.buttonIndex === btn.index))
  ).length

  // ── Valida mídia de cabeçalho ────────────────────────────────────────────
  let headerMedia: { format: string; mediaUrl: string; filename?: string } | undefined
  if (templateInfo.headerFormat) {
    const mediaUrl = (resolvedMapping[MEDIA_URL_KEY]?.value ?? '').trim()
    if (!mediaUrl) {
      return NextResponse.json(
        { error: 'Este template requer uma URL de mídia no cabeçalho. Configure antes de enviar.' },
        { status: 422 }
      )
    }
    const mediaError = validateMediaUrl(mediaUrl, templateInfo.headerFormat)
    if (mediaError) {
      return NextResponse.json({ error: `Mídia inválida: ${mediaError}` }, { status: 422 })
    }
    const filename =
      templateInfo.headerFormat === 'DOCUMENT'
        ? (resolvedMapping[DOCUMENT_NAME_KEY]?.value ?? '').trim() || undefined
        : undefined
    headerMedia = { format: templateInfo.headerFormat, mediaUrl, filename }
  }

  const targets = await prisma.candidate.findMany({
    where: { id: { in: candidateIds }, hasPhone: true },
  })
  if (!targets.length) {
    return NextResponse.json({ error: 'Nenhum candidato com telefone encontrado' }, { status: 404 })
  }

  // ── Busca nomeCurto/unidade da vaga ──────────────────────────────────────
  const vaga = await prisma.vaga.findUnique({ where: { id: targets[0]!.vagaId } })
  const nomeCurto = vaga?.nomeCurto ?? ''
  const unidade   = vaga?.unidade   ?? ''

  // ── Valida placeholders e botões por candidato ────────────────────────────
  const bodyVars = templateInfo.variables
    .filter((v) => v.section === 'body')
    .sort((a, b) => a.index - b.index)

  for (const c of targets) {
    const bodyPhs = buildBodyPlaceholders(
      templateInfo.variables, 'body', resolvedMapping, c.name, c.city, c.stage, nomeCurto, unidade
    )

    if (bodyPhs.length !== expectedBodyCount) {
      return NextResponse.json(
        {
          error: `Contagem de variáveis incompatível para "${c.name}": ` +
                 `template espera ${expectedBodyCount} no body, mapeamento gerou ${bodyPhs.length}.`,
        },
        { status: 422 }
      )
    }

    const emptyIdx = bodyPhs.findIndex((p) => !p.trim())
    if (emptyIdx !== -1) {
      const v = bodyVars[emptyIdx]
      return NextResponse.json(
        {
          error: `Variável {{${v?.index}}} (corpo) está vazia para "${c.name}". ` +
                 `Verifique o campo mapeado (cargo/unidade pode estar em branco na vaga).`,
        },
        { status: 422 }
      )
    }

    const candidateRef = c.gupyApplicationId ?? c.id
    const btnItems = buildButtonItems(
      templateInfo.buttons, templateInfo.variables, resolvedMapping,
      candidateRef, c.name, c.city, c.stage, nomeCurto, unidade
    )
    if (btnItems.length !== expectedButtonCount) {
      return NextResponse.json(
        {
          error: `Contagem de botões incompatível para "${c.name}": ` +
                 `template espera ${expectedButtonCount} parâmetro(s) de botão, foram gerados ${btnItems.length}.`,
        },
        { status: 422 }
      )
    }
  }

  // ── Persiste o mapeamento original (com fill_on_send) ────────────────────
  const mappingJson = mapping as unknown as Parameters<typeof prisma.templateMapping.upsert>[0]['create']['mapping']
  await prisma.templateMapping.upsert({
    where:  { templateName_language: { templateName, language } },
    create: { templateName, language, mapping: mappingJson },
    update: { mapping: mappingJson },
  })

  // ── Enfileira candidatos ──────────────────────────────────────────────────
  await prisma.candidate.updateMany({
    where: { id: { in: targets.map((c) => c.id) } },
    data:  { contactStatus: 'queued' },
  })

  let results: { messageId: string; status: string }[]
  try {
    results = await sendTemplateMessages(
      targets.map((c) => ({
        to:            c.phone!,
        candidateName: c.name,
        templateName,
        language,
        bodyPlaceholders: buildBodyPlaceholders(
          templateInfo.variables, 'body', resolvedMapping, c.name, c.city, c.stage, nomeCurto, unidade
        ),
        headerPlaceholders: (() => {
          if (headerMedia) return undefined
          const phs = buildBodyPlaceholders(
            templateInfo.variables, 'header', resolvedMapping, c.name, c.city, c.stage, nomeCurto, unidade
          )
          return phs.length ? phs : undefined
        })(),
        headerMedia,
        buttonItems: buildButtonItems(
          templateInfo.buttons, templateInfo.variables, resolvedMapping,
          c.gupyApplicationId ?? c.id, c.name, c.city, c.stage, nomeCurto, unidade
        ),
      }))
    )
  } catch (err) {
    await prisma.candidate.updateMany({
      where: { id: { in: targets.map((c) => c.id) } },
      data:  { contactStatus: 'not_contacted' },
    })
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Falha no envio: ${message}` }, { status: 502 })
  }

  await prisma.$transaction([
    ...results.map((r, i) =>
      prisma.candidate.update({
        where: { id: targets[i]!.id },
        data:  { messageId: r.messageId, contactStatus: 'sent', statusAt: new Date() },
      })
    ),
    prisma.messageRecord.createMany({
      data: results.map((r, i) => ({
        messageId:   r.messageId,
        candidateId: targets[i]!.id,
        status:      'sent' as const,
      })),
      skipDuplicates: true,
    }),
  ])

  return NextResponse.json({
    sent:      results.length,
    testMode:  !!process.env.TEST_OVERRIDE_PHONE,
    testPhone: process.env.TEST_OVERRIDE_PHONE || null,
    results:   results.map((r, i) => ({
      candidateId:   targets[i]?.id,
      candidateName: targets[i]?.name,
      messageId:     r.messageId,
      status:        r.status,
    })),
  })
}
