// Tipos e helpers compartilhados entre servidor e cliente para templates dinâmicos.

export interface TemplateVar {
  section: 'header' | 'body' | 'button_url'
  index: number
  buttonIndex?: number
  /** Chave no mapeamento: "body_1", "header_1", "button_0_1" */
  key: string
}

export interface TemplateButton {
  /** Tipo do botão no template Meta/WhatsApp */
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
  /** Posição 0-indexed na lista de botões do template */
  index: number
}

export interface TemplateInfo {
  name: string
  language: string
  category: string
  bodyText: string
  headerText?: string
  /** Presente quando o template tem cabeçalho de mídia */
  headerFormat?: 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  variables: TemplateVar[]
  /** Botões do template, na ordem original */
  buttons: TemplateButton[]
}

/** Chave especial no Mapping para a URL da mídia do cabeçalho */
export const MEDIA_URL_KEY = '__header_media_url__'
/** Chave especial para o nome do arquivo (somente DOCUMENT) */
export const DOCUMENT_NAME_KEY = '__header_document_name__'

/** Valida URL de mídia — retorna mensagem de erro ou null se OK */
export function validateMediaUrl(url: string, format: string): string | null {
  if (!url.startsWith('https://')) return 'URL deve começar com https://'
  const lower = (url.split('?')[0] ?? '').toLowerCase()
  if (format === 'IMAGE' && !/\.(jpg|jpeg|png)$/.test(lower))
    return 'IMAGE requer extensão .jpg ou .png'
  if (format === 'VIDEO' && !/\.mp4$/.test(lower))
    return 'VIDEO requer extensão .mp4'
  if (format === 'DOCUMENT' && !/\.pdf$/.test(lower))
    return 'DOCUMENT requer extensão .pdf'
  return null
}

/** Retorna true se o template tem mídia mas a URL não está configurada/válida */
export function hasUnmappedMedia(
  headerFormat: string | undefined,
  mapping: Mapping
): boolean {
  if (!headerFormat) return false
  const url = (mapping[MEDIA_URL_KEY]?.value ?? '').trim()
  if (!url) return true
  return validateMediaUrl(url, headerFormat) !== null
}

export interface MappingEntry {
  type: 'field' | 'fixed' | 'fill_on_send'
  value: string
  /** Tipo de input quando type === 'fill_on_send' */
  fillType?: 'date' | 'time' | 'url' | 'text'
}

export type Mapping = Record<string, MappingEntry>

export const CANDIDATE_FIELDS = [
  { value: 'firstName', label: 'Primeiro nome' },
  { value: 'name',      label: 'Nome completo' },
  { value: 'cargo',     label: 'Cargo (nomeCurto da vaga)' },
  { value: 'unidade',   label: 'Unidade' },
  { value: 'city',      label: 'Cidade' },
  { value: 'stage',     label: 'Etapa' },
] as const

export const FILL_ON_SEND_TYPES = [
  { value: 'text', label: 'Texto livre' },
  { value: 'date', label: 'Data' },
  { value: 'time', label: 'Horário' },
  { value: 'url',  label: 'Link (URL)' },
] as const

export function resolveField(
  field: string,
  name: string,
  city: string | null | undefined,
  stage: string,
  nomeCurto?: string | null,
  unidade?: string | null
): string {
  switch (field) {
    case 'firstName': return name.split(' ')[0] ?? name
    case 'name':      return name
    case 'city':      return city ?? ''
    case 'stage':     return stage
    case 'cargo':     return nomeCurto ?? ''
    case 'unidade':   return unidade ?? ''
    default:          return ''
  }
}

export function resolveMappingEntry(
  entry: MappingEntry,
  name: string,
  city: string | null | undefined,
  stage: string,
  nomeCurto?: string | null,
  unidade?: string | null,
  fillValue?: string
): string {
  if (entry.type === 'fixed')       return entry.value
  if (entry.type === 'fill_on_send') return fillValue ?? ''
  return resolveField(entry.value, name, city, stage, nomeCurto, unidade)
}

// ─── Button payload building ─────────────────────────────────────────────────

/**
 * Constrói o array de buttonItems para o payload da Infobip.
 * QUICK_REPLY: payload "convoca:<candidateRef>:<buttonIndex>"
 * URL com variável: parâmetro resolvido do mapeamento
 */
export function buildButtonItems(
  buttons: TemplateButton[],
  variables: TemplateVar[],
  mapping: Mapping,
  candidateRef: string,
  name: string,
  city: string | null | undefined,
  stage: string,
  nomeCurto?: string | null,
  unidade?: string | null
): Array<{ type: string; parameter: string }> {
  return buttons.flatMap((btn) => {
    if (btn.type === 'QUICK_REPLY') {
      return [{ type: 'QUICK_REPLY', parameter: `convoca:${candidateRef}:${btn.index}` }]
    }
    if (btn.type === 'URL') {
      const urlVars = variables
        .filter((v) => v.section === 'button_url' && v.buttonIndex === btn.index)
        .sort((a, b) => a.index - b.index)
      if (!urlVars.length) return []
      const parameter = urlVars
        .map((v) => {
          const entry = mapping[v.key]
          return entry ? resolveMappingEntry(entry, name, city, stage, nomeCurto, unidade) : ''
        })
        .join('')
      return [{ type: 'URL', parameter }]
    }
    return []
  })
}

// ─── Context display ─────────────────────────────────────────────────────────

/** Retorna o trecho de texto em volta da variável para contextualizar o usuário. */
export function getVariableContext(v: TemplateVar, info: TemplateInfo): string {
  const src =
    v.section === 'header' ? (info.headerText ?? '') : info.bodyText
  const tag = `{{${v.index}}}`
  const idx = src.indexOf(tag)
  if (idx === -1) return tag

  const before = src
    .slice(Math.max(0, idx - 25), idx)
    .replace(/\n/g, ' ')
    .trimStart()
  const after = src
    .slice(idx + tag.length, idx + tag.length + 25)
    .replace(/\n/g, ' ')
    .trimEnd()

  if (before && after) return `…${before}■${after}…`
  if (before)           return `…${before}■`
  if (after)            return `■${after}…`
  return tag
}

// ─── Auto-sugestão de mapeamento ─────────────────────────────────────────────

function getContext(v: TemplateVar, info: TemplateInfo): string {
  const src =
    v.section === 'header' ? (info.headerText ?? '') : info.bodyText
  const tag = `{{${v.index}}}`
  const i = src.indexOf(tag)
  if (i === -1) return ''
  const before = src.slice(Math.max(0, i - 50), i).replace(/[\n\r]+/g, ' ')
  const after  = src.slice(i + tag.length, i + tag.length + 50).replace(/[\n\r]+/g, ' ')
  return (before + '__VAR__' + after).toLowerCase()
}

const PATTERNS: Array<[RegExp, MappingEntry]> = [
  [/olá,\s*__var__|^__var__[^a-z]/,                             { type: 'field',        value: 'firstName' }],
  [/nome\s+__var__|__var__\s*[,!]/,                             { type: 'field',        value: 'firstName' }],
  [/vaga\s+de\s+__var__|cargo\s+__var__|função\s+__var__/,      { type: 'field',        value: 'cargo'     }],
  [/unidade\s+__var__|__var__\s+e\s+gostar|filial\s+__var__/,   { type: 'field',        value: 'unidade'   }],
  [/data\s*:\s*__var__|dia\s+__var__|__var__.*\/20/,             { type: 'fill_on_send', value: '', fillType: 'date' }],
  [/horário\s*:\s*__var__|hora\s*:\s*__var__|__var__.*:\d\d/,    { type: 'fill_on_send', value: '', fillType: 'time' }],
  [/link\s*.*__var__|acesse.*__var__|__var__.*http|__var__.*link/, { type: 'fill_on_send', value: '', fillType: 'url' }],
]

function suggestEntry(ctx: string): MappingEntry {
  for (const [re, entry] of PATTERNS) {
    if (re.test(ctx)) return { ...entry }
  }
  return { type: 'fill_on_send', value: '', fillType: 'text' }
}

export function suggestMapping(info: TemplateInfo): Mapping {
  const mapping: Mapping = {}
  for (const v of info.variables) {
    mapping[v.key] = suggestEntry(getContext(v, info))
  }
  return mapping
}

// ─── Preview e validação ──────────────────────────────────────────────────────

export function renderPreview(
  bodyText: string,
  mapping: Mapping,
  name: string,
  city: string | null | undefined,
  stage: string,
  nomeCurto?: string | null,
  unidade?: string | null,
  fillValues?: Record<string, string>
): string {
  return bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => {
    const key   = `body_${n}`
    const entry = mapping[key]
    if (!entry) return `{{${n}}}`
    const fillValue = entry.type === 'fill_on_send' ? fillValues?.[key] : undefined
    const resolved  = resolveMappingEntry(entry, name, city, stage, nomeCurto, unidade, fillValue)
    return resolved || `{{${n}}}`
  })
}

export function varLabel(v: TemplateVar): string {
  switch (v.section) {
    case 'header':     return `{{${v.index}}} — cabeçalho`
    case 'body':       return `{{${v.index}}} — corpo`
    case 'button_url': return `{{${v.index}}} — botão ${(v.buttonIndex ?? 0) + 1} (URL)`
  }
}

export function hasUnmappedVars(
  variables: TemplateVar[],
  mapping: Mapping,
  fillValues?: Record<string, string>
): boolean {
  return variables.some((v) => {
    const entry = mapping[v.key]
    if (!entry) return true
    if (entry.type === 'field')       return !entry.value
    if (entry.type === 'fixed')       return !entry.value.trim()
    if (entry.type === 'fill_on_send') return !(fillValues?.[v.key] ?? '').trim()
    return false
  })
}
