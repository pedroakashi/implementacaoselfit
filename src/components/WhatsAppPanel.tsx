'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Candidate, Vaga } from '@/lib/store'
import type { TemplateInfo, Mapping, MappingEntry } from '@/lib/templates'
import {
  CANDIDATE_FIELDS,
  FILL_ON_SEND_TYPES,
  MEDIA_URL_KEY,
  DOCUMENT_NAME_KEY,
  varLabel,
  getVariableContext,
  suggestMapping,
  renderPreview,
  hasUnmappedVars,
  hasUnmappedMedia,
  validateMediaUrl,
  resolveMappingEntry,
} from '@/lib/templates'

interface DispatchOpts {
  templateName: string
  language: string
  mapping: Mapping
  fillValues?: Record<string, string>
}

interface Props {
  selectedCandidates: Candidate[]
  selectedVaga: Vaga | null
  onDispatch: (opts: DispatchOpts) => Promise<void>
  dispatching: boolean
}

export default function WhatsAppPanel({
  selectedCandidates,
  selectedVaga,
  onDispatch,
  dispatching,
}: Props) {
  const [templates, setTemplates]             = useState<TemplateInfo[]>([])
  const [templatesError, setTemplatesError]   = useState<string | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedKey, setSelectedKey]         = useState<string>('')
  const [mapping, setMapping]                 = useState<Mapping>({})
  const [fillValues, setFillValues]           = useState<Record<string, string>>({})

  const selectedCount    = selectedCandidates.length
  const previewCandidate = selectedCandidates[0] ?? null
  const nomeCurto        = selectedVaga?.nomeCurto ?? ''
  const unidade          = selectedVaga?.unidade ?? ''

  const selectedTemplate =
    templates.find((t) => `${t.name}|${t.language}` === selectedKey) ?? null

  // ── Carrega templates ────────────────────────────────────────────────────
  const loadTemplates = useCallback(async (refresh = false) => {
    setLoadingTemplates(true)
    setTemplatesError(null)
    try {
      const res  = await fetch(refresh ? '/api/templates?refresh=1' : '/api/templates')
      const data = await res.json()
      if (!res.ok) { setTemplatesError(data.error ?? 'Erro ao carregar templates'); return }
      setTemplates(data as TemplateInfo[])
    } catch {
      setTemplatesError('Falha de rede ao buscar templates')
    } finally {
      setLoadingTemplates(false)
    }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  // ── Ao trocar template: carrega mapeamento salvo ou sugere ───────────────
  useEffect(() => {
    if (!selectedTemplate) { setMapping({}); setFillValues({}); return }

    fetch(
      `/api/templates/mapping?name=${encodeURIComponent(selectedTemplate.name)}&lang=${encodeURIComponent(selectedTemplate.language)}`
    )
      .then((r) => r.json())
      .then((saved: Mapping | null) => {
        if (saved) {
          setMapping(saved)
          setFillValues({})
        } else {
          // Nenhum mapeamento salvo: sugerir automaticamente
          setMapping(suggestMapping(selectedTemplate))
          setFillValues({})
        }
      })
      .catch(() => {
        setMapping(suggestMapping(selectedTemplate))
        setFillValues({})
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey])

  const setEntry = (key: string, entry: MappingEntry) =>
    setMapping((prev) => ({ ...prev, [key]: entry }))

  const setFillValue = (key: string, val: string) =>
    setFillValues((prev) => ({ ...prev, [key]: val }))

  const unmapped = selectedTemplate
    ? hasUnmappedVars(selectedTemplate.variables, mapping, fillValues)
    : false
  const unmappedMedia = selectedTemplate
    ? hasUnmappedMedia(selectedTemplate.headerFormat, mapping)
    : false
  const canSend = selectedCount > 0 && !!selectedTemplate && !unmapped && !unmappedMedia && !dispatching

  const handleSend = async () => {
    if (!canSend || !selectedTemplate) return
    await onDispatch({
      templateName: selectedTemplate.name,
      language:     selectedTemplate.language,
      mapping,
      fillValues,
    })
    setFillValues({})
  }

  // ── Renderiza preview com destaque vermelho para variáveis vazias ─────────
  function renderPreviewParts(text: string): React.ReactNode[] {
    const parts = text.split(/(\{\{\d+\}\})/g)
    return parts.map((part, i) => {
      const m = part.match(/\{\{(\d+)\}\}/)
      if (!m) {
        return <Fragment key={i}>{part}</Fragment>
      }
      const key       = `body_${m[1]}`
      const entry     = mapping[key]
      const fillValue = entry?.type === 'fill_on_send' ? (fillValues[key] ?? '') : undefined
      const resolved  = entry
        ? resolveMappingEntry(
            entry,
            previewCandidate?.name ?? 'Candidato',
            previewCandidate?.city,
            previewCandidate?.stage ?? '',
            nomeCurto,
            unidade,
            fillValue
          )
        : ''
      return resolved ? (
        <span key={i} className="font-semibold text-[#111b21]">{resolved}</span>
      ) : (
        <span key={i} className="font-bold text-red-500 bg-red-50 rounded px-0.5">{part}</span>
      )
    })
  }

  return (
    <div className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-border bg-white">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-5 py-4">
        <p className="text-[13px] font-bold tracking-tight text-foreground">Envio WhatsApp</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {selectedCount === 0
            ? 'Selecione candidatos na lista'
            : `${selectedCount} candidato${selectedCount !== 1 ? 's' : ''} selecionado${selectedCount !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-5 px-5 py-4">

        {/* Template selector */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Template
            </label>
            <button
              onClick={() => loadTemplates(true)}
              disabled={loadingTemplates}
              className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              {loadingTemplates ? 'Carregando…' : '↻ Atualizar'}
            </button>
          </div>

          {templatesError ? (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-700">
              {templatesError}
            </p>
          ) : (
            <Select
              value={selectedKey || undefined}
              onValueChange={(val) => { if (val != null) setSelectedKey(val as string) }}
              disabled={loadingTemplates || templates.length === 0}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue
                  placeholder={
                    loadingTemplates
                      ? 'Carregando…'
                      : templates.length === 0
                      ? 'Nenhum template aprovado'
                      : 'Escolha um template'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-1.5 text-muted-foreground text-[11px]">
                      · {t.language}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Aviso para selfit2026 sem variáveis */}
          {selectedTemplate && selectedTemplate.variables.length === 0 && (
            <p className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700 leading-relaxed">
              Este template não tem variáveis — o texto é fixo. Verifique se é o template correto.
            </p>
          )}
        </div>

        {/* Mídia do cabeçalho */}
        {selectedTemplate?.headerFormat && (() => {
          const fmt      = selectedTemplate.headerFormat!
          const mediaUrl = mapping[MEDIA_URL_KEY]?.value ?? ''
          const docName  = mapping[DOCUMENT_NAME_KEY]?.value ?? ''
          const urlError = mediaUrl ? validateMediaUrl(mediaUrl, fmt) : null
          const isLocalhost = typeof window !== 'undefined' && mediaUrl.includes('localhost')

          return (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Mídia do cabeçalho — {fmt}
              </label>
              <Input
                className={cn('h-8 text-[12px]', urlError ? 'border-red-400 focus-visible:ring-red-400' : '')}
                type="url"
                placeholder={
                  fmt === 'IMAGE'    ? 'https://…/imagem.jpg'
                  : fmt === 'VIDEO'  ? 'https://…/video.mp4'
                  : 'https://…/arquivo.pdf'
                }
                value={mediaUrl}
                onChange={(e) =>
                  setMapping((prev) => ({
                    ...prev,
                    [MEDIA_URL_KEY]: { type: 'fixed', value: e.target.value },
                  }))
                }
              />
              {fmt === 'DOCUMENT' && (
                <Input
                  className="h-7 text-[12px]"
                  placeholder="Nome do arquivo (ex: convocacao.pdf)"
                  value={docName}
                  onChange={(e) =>
                    setMapping((prev) => ({
                      ...prev,
                      [DOCUMENT_NAME_KEY]: { type: 'fixed', value: e.target.value },
                    }))
                  }
                />
              )}
              {urlError && (
                <p className="text-[11px] text-red-600">{urlError}</p>
              )}
              {isLocalhost && !urlError && (
                <p className="text-[11px] text-amber-600">
                  URL localhost não é acessível pela Infobip. Use PUBLIC_BASE_URL com ngrok ou domínio público.
                </p>
              )}
            </div>
          )
        })()}

        {/* Variable mapping */}
        {selectedTemplate && selectedTemplate.variables.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Variáveis
            </label>

            {selectedTemplate.variables.map((v) => {
              const ctx   = getVariableContext(v, selectedTemplate)
              const entry = mapping[v.key]
              const isFillOnSend = entry?.type === 'fill_on_send'
              const isFixed      = entry?.type === 'fixed'
              const fillVal      = fillValues[v.key] ?? ''

              // Highlight context at "■"
              const [ctxBefore, ctxAfter] = ctx.split('■')

              return (
                <div
                  key={v.key}
                  className={cn(
                    'flex flex-col gap-1.5 rounded border p-2.5',
                    entry && !hasUnmappedVars([v], mapping, fillValues)
                      ? 'border-border'
                      : 'border-red-200 bg-red-50/40'
                  )}
                >
                  {/* Context */}
                  <span className="text-[11px] text-muted-foreground leading-snug">
                    {ctxBefore}
                    <span className="rounded bg-amber-100 px-1 font-bold text-amber-700">
                      {varLabel(v).split(' — ')[0]}
                    </span>
                    {ctxAfter}
                  </span>

                  {/* Field selector */}
                  <Select
                    value={
                      entry?.type === 'field'       ? entry.value
                      : entry?.type === 'fixed'     ? '__fixed__'
                      : entry?.type === 'fill_on_send' ? `__fos_${entry.fillType ?? 'text'}__`
                      : ''
                    }
                    onValueChange={(val) => {
                      if (val == null) return
                      const v2 = val as string
                      if (v2 === '__fixed__') {
                        setEntry(v.key, { type: 'fixed', value: '' })
                      } else if (v2.startsWith('__fos_')) {
                        const ft = v2.replace('__fos_', '').replace('__', '') as 'date' | 'time' | 'url' | 'text'
                        setEntry(v.key, { type: 'fill_on_send', value: '', fillType: ft })
                      } else {
                        setEntry(v.key, { type: 'field', value: v2 })
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-[12px]">
                      <SelectValue placeholder="Escolha o campo…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CANDIDATE_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="__fixed__">Texto fixo…</SelectItem>
                      {FILL_ON_SEND_TYPES.map((ft) => (
                        <SelectItem key={ft.value} value={`__fos_${ft.value}__`}>
                          Preencher no envio — {ft.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Texto fixo */}
                  {isFixed && (
                    <Input
                      className="h-7 text-[12px]"
                      placeholder="Texto fixo…"
                      value={entry.value}
                      onChange={(e) => setEntry(v.key, { type: 'fixed', value: e.target.value })}
                    />
                  )}

                  {/* Preencher no envio */}
                  {isFillOnSend && (
                    <Input
                      className="h-7 text-[12px]"
                      type={entry.fillType === 'date' ? 'date' : entry.fillType === 'time' ? 'time' : entry.fillType === 'url' ? 'url' : 'text'}
                      placeholder={
                        entry.fillType === 'url'  ? 'https://…'
                        : entry.fillType === 'date' ? 'dd/mm/aaaa'
                        : entry.fillType === 'time' ? 'hh:mm'
                        : 'Preencha aqui…'
                      }
                      value={fillVal}
                      onChange={(e) => setFillValue(v.key, e.target.value)}
                    />
                  )}
                </div>
              )
            })}

            {unmapped && (
              <p className="text-[11px] text-amber-600">
                Preencha todas as variáveis antes de enviar.
              </p>
            )}
          </div>
        )}

        {/* Aviso cargo/unidade ausentes */}
        {selectedTemplate && selectedVaga && (
          (selectedTemplate.variables.some(v => mapping[v.key]?.value === 'cargo') && !nomeCurto) ||
          (selectedTemplate.variables.some(v => mapping[v.key]?.value === 'unidade') && !unidade)
        ) ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700 leading-relaxed">
            {!nomeCurto && 'Cargo curto não definido. '}
            {!unidade && 'Unidade não definida. '}
            Edite no cabeçalho da vaga.
          </p>
        ) : null}

        {/* Preview */}
        {selectedTemplate && selectedTemplate.bodyText && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Prévia{previewCandidate ? ` — ${previewCandidate.name.split(' ')[0]}` : ''}
            </label>
            <div className="whatsapp-preview">
              <div className="whatsapp-bubble">
                <p className="mb-1 text-[12px] font-bold" style={{ color: '#25d366' }}>
                  Selfit Academias
                </p>
                {selectedTemplate.headerText && (
                  <p className="mb-1 text-[12px] font-semibold text-[#111b21]">
                    {renderPreview(
                      selectedTemplate.headerText ?? '',
                      mapping,
                      previewCandidate?.name ?? 'Candidato',
                      previewCandidate?.city,
                      previewCandidate?.stage ?? '',
                      nomeCurto,
                      unidade,
                      fillValues
                    )}
                  </p>
                )}
                <p className="text-[12px] text-[#111b21] whitespace-pre-line">
                  {renderPreviewParts(selectedTemplate.bodyText)}
                </p>
                <div
                  className="mt-1 flex items-center justify-end gap-1 text-[10px]"
                  style={{ color: '#8696a0' }}
                >
                  agora
                  <span className="text-[#53bdeb] text-[12px]">✓✓</span>
                </div>
              </div>
            </div>
            {selectedCount > 1 && (
              <p className="text-[11px] text-muted-foreground">
                +{selectedCount - 1} mensagem{selectedCount - 1 !== 1 ? 'ns' : ''} com os dados de cada candidato.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-5 py-4">
        <Button
          className={cn(
            'w-full h-10 text-sm font-bold',
            canSend
              ? 'bg-[#25d366] hover:bg-[#1db954] text-white shadow-sm hover:shadow-md transition-all'
              : ''
          )}
          disabled={!canSend}
          onClick={handleSend}
          variant={canSend ? 'default' : 'secondary'}
          style={canSend ? { background: '#25d366' } : undefined}
        >
          {dispatching ? (
            'Enviando…'
          ) : selectedCount === 0 ? (
            'Selecione candidatos'
          ) : !selectedTemplate ? (
            'Escolha um template'
          ) : unmapped ? (
            'Preencha as variáveis'
          ) : unmappedMedia ? (
            'Configure a mídia do cabeçalho'
          ) : (
            `Enviar · ${selectedCount} mensagem${selectedCount !== 1 ? 'ns' : ''}`
          )}
        </Button>
      </div>
    </div>
  )
}
