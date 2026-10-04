import type { TemplateInfo, TemplateVar, TemplateButton } from './templates'

// Boot-time validation — falha antes de aceitar qualquer requisição
function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val || !val.trim()) {
    throw new Error(
      `[Infobip] Variável de ambiente obrigatória ausente: ${name}.\n` +
      `Copie .env.example para .env e preencha os valores.`
    )
  }
  return val.trim()
}

export function getConfig() {
  return {
    apiKey:   requireEnv('INFOBIP_API_KEY'),
    baseUrl:  requireEnv('INFOBIP_BASE_URL'),
    sender:   requireEnv('INFOBIP_SENDER'),
    testPhone: process.env.TEST_OVERRIDE_PHONE?.trim() || null,
  }
}

// ─── Template listing ────────────────────────────────────────────────────────

interface RawInfobipTemplate {
  id: string
  name: string
  language: string
  status: string
  category: string
  structure?: {
    /** "STANDARD" | "MEDIA" | "CAROUSEL" */
    type?: string
    header?: { format: string; text?: string }
    body?: { text?: string }
    buttons?: Array<{ type: string; url?: string }>
  }
}

function extractVars(
  text: string | undefined,
  section: TemplateVar['section'],
  buttonIndex?: number
): TemplateVar[] {
  if (!text) return []
  const vars: TemplateVar[] = []
  const re = /\{\{(\d+)\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const index = parseInt(m[1])
    const key =
      section === 'button_url'
        ? `button_${buttonIndex}_${index}`
        : `${section}_${index}`
    vars.push({ section, index, buttonIndex, key })
  }
  return vars
}

function processTemplates(raw: RawInfobipTemplate[]): TemplateInfo[] {
  return raw
    .filter((t) => t.status === 'APPROVED')
    .map((t): TemplateInfo => {
      const bodyText   = t.structure?.body?.text ?? ''
      const hdrFormat  = t.structure?.header?.format?.toUpperCase()
      const headerText = hdrFormat === 'TEXT' ? t.structure!.header!.text : undefined

      // Apenas seta headerFormat quando a API retorna explicitamente IMAGE/VIDEO/DOCUMENT.
      // structure.type === 'MEDIA' indica outra classificação interna da Infobip — não usar.
      const headerFormat: TemplateInfo['headerFormat'] =
        hdrFormat === 'IMAGE' || hdrFormat === 'VIDEO' || hdrFormat === 'DOCUMENT'
          ? (hdrFormat as TemplateInfo['headerFormat'])
          : undefined

      const vars: TemplateVar[] = [
        ...extractVars(headerText, 'header'),
        ...extractVars(bodyText, 'body'),
        ...(t.structure?.buttons ?? []).flatMap((btn, i) =>
          btn.type === 'URL' ? extractVars(btn.url, 'button_url', i) : []
        ),
      ]

      const seen = new Set<string>()
      const variables = vars.filter((v) => {
        if (seen.has(v.key)) return false
        seen.add(v.key)
        return true
      })

      const buttons: TemplateButton[] = (t.structure?.buttons ?? []).map((btn, i) => ({
        type: btn.type?.toUpperCase() as TemplateButton['type'],
        index: i,
      }))

      return { name: t.name, language: t.language, category: t.category, bodyText, headerText, headerFormat, variables, buttons }
    })
}

// 5-minute in-memory cache
let templateCache: { data: TemplateInfo[]; at: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

export async function listApprovedTemplates(forceRefresh = false): Promise<TemplateInfo[]> {
  if (!forceRefresh && templateCache && Date.now() - templateCache.at < CACHE_TTL) {
    return templateCache.data
  }

  const { apiKey, baseUrl, sender } = getConfig()

  const res = await fetch(
    `${baseUrl}/whatsapp/2/senders/${encodeURIComponent(sender)}/templates`,
    {
      headers: { Authorization: `App ${apiKey}`, Accept: 'application/json' },
      cache: 'no-store',
    }
  )

  if (res.status === 401 || res.status === 403) {
    const e = Object.assign(new Error('permission'), { httpStatus: res.status })
    throw e
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Infobip HTTP ${res.status}: ${body}`)
  }

  const json = (await res.json()) as { templates: RawInfobipTemplate[] }
  const data  = processTemplates(json.templates ?? [])
  templateCache = { data, at: Date.now() }
  return data
}

// ─── Message sending ─────────────────────────────────────────────────────────

export interface OutboundMessage {
  to: string
  candidateName: string
  templateName: string
  language: string
  bodyPlaceholders: string[]
  headerPlaceholders?: string[]
  /** Mídia para templates com header IMAGE/VIDEO/DOCUMENT */
  headerMedia?: { format: string; mediaUrl: string; filename?: string }
  /** Botões na ordem do template: QUICK_REPLY (payload) e URL (parâmetro variável) */
  buttonItems?: Array<{ type: string; parameter: string }>
}

export interface SentResult {
  messageId: string
  status: string
}

export async function sendTemplateMessages(
  messages: OutboundMessage[]
): Promise<SentResult[]> {
  const { apiKey, baseUrl, sender, testPhone } = getConfig()

  const payload = {
    messages: messages.map((m) => {
      let headerPart: Record<string, unknown>
      if (m.headerMedia) {
        const h: Record<string, string> = {
          type:     m.headerMedia.format,
          mediaUrl: m.headerMedia.mediaUrl,
        }
        if (m.headerMedia.filename) h['filename'] = m.headerMedia.filename
        headerPart = { header: h }
      } else if (m.headerPlaceholders?.length) {
        headerPart = { header: { placeholders: m.headerPlaceholders } }
      } else {
        headerPart = {}
      }
      const buttonPart = m.buttonItems?.length
        ? { buttons: m.buttonItems }
        : {}

      return {
        from: sender,
        // ⚠ TRAVA DE TESTE: quando TEST_OVERRIDE_PHONE está setada,
        // o destino é SEMPRE o número de teste — nenhum candidato real é atingido.
        to: testPhone ?? m.to,
        content: {
          templateName: m.templateName,
          templateData: {
            ...headerPart,
            body: { placeholders: m.bodyPlaceholders },
            ...buttonPart,
          },
          language: m.language,
        },
      }
    }),
  }

  const res = await fetch(`${baseUrl}/whatsapp/1/message/template`, {
    method: 'POST',
    headers: {
      // NUNCA logue apiKey — apenas Authorization header
      Authorization: `App ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Infobip HTTP ${res.status}: ${body}`)
  }

  const json = (await res.json()) as {
    messages: Array<{ messageId: string; status: { groupName: string } }>
  }
  return json.messages.map((m) => ({ messageId: m.messageId, status: m.status.groupName }))
}
