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
    apiKey: requireEnv('INFOBIP_API_KEY'),
    baseUrl: requireEnv('INFOBIP_BASE_URL'),
    sender: requireEnv('INFOBIP_SENDER'),
    lang: process.env.WHATSAPP_TEMPLATE_LANG || 'pt_BR',
    testPhone: process.env.TEST_OVERRIDE_PHONE?.trim() || null,
  }
}

export interface OutboundMessage {
  to: string
  candidateName: string
  templateName: string
  placeholders: string[]
}

export interface SentResult {
  messageId: string
  status: string
}

export async function sendTemplateMessages(
  messages: OutboundMessage[]
): Promise<SentResult[]> {
  const { apiKey, baseUrl, sender, lang, testPhone } = getConfig()

  const payload = {
    messages: messages.map((m) => ({
      from: sender,
      // ⚠ TRAVA DE TESTE: quando TEST_OVERRIDE_PHONE está setada,
      // o destino é SEMPRE o número de teste — nenhum candidato real é atingido.
      to: testPhone ?? m.to,
      content: {
        templateName: m.templateName,
        templateData: {
          body: {
            placeholders: m.placeholders,
          },
        },
        language: lang,
      },
    })),
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

  const json = await res.json() as { messages: Array<{ messageId: string; status: { groupName: string } }> }
  return (json.messages).map(
    (m) => ({ messageId: m.messageId, status: m.status.groupName })
  )
}

export async function listTemplates() {
  const { apiKey, baseUrl, sender } = getConfig()

  const res = await fetch(`${baseUrl}/whatsapp/2/senders/${sender}/templates`, {
    headers: {
      Authorization: `App ${apiKey}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Infobip HTTP ${res.status}: ${body}`)
  }

  return res.json()
}
