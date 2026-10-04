'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { Vaga, Candidate } from '@/lib/store'
import type { Mapping } from '@/lib/templates'
import TestModeBanner from '@/components/TestModeBanner'
import Sidebar from '@/components/Sidebar'
import CandidateList from '@/components/CandidateList'
import WhatsAppPanel from '@/components/WhatsAppPanel'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface AppConfig {
  isTestMode: boolean
  testPhone: string | null
}

interface DispatchResult {
  sent: number
  testMode: boolean
  testPhone: string | null
  results: Array<{ candidateId: string; candidateName: string; messageId: string; status: string }>
}

// ── Inline editable field ────────────────────────────────────────────────────
function InlineField({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string
  value: string | null | undefined
  placeholder: string
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')

  const start = () => { setDraft(value ?? ''); setEditing(true) }
  const save  = () => { setEditing(false); onSave(draft.trim()) }

  return (
    <span className="inline-flex items-center gap-1 text-[12px]">
      <span className="text-muted-foreground">{label}:</span>
      {editing ? (
        <Input
          autoFocus
          className="h-5 w-32 px-1 text-[12px] rounded"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  save()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <button
          onClick={start}
          className={
            value
              ? 'font-medium text-foreground hover:underline'
              : 'text-muted-foreground/60 italic hover:text-foreground'
          }
        >
          {value || placeholder}
        </button>
      )}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [config, setConfig]         = useState<AppConfig>({ isTestMode: false, testPhone: null })
  const [vagas, setVagas]           = useState<Vaga[]>([])
  const [selectedVagaId, setSelectedVagaId] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filters, setFilters]       = useState({ name: '', stage: '', city: '' })
  const [dispatching, setDispatching] = useState(false)

  const fetchVagas = useCallback(async () => {
    const data: Vaga[] = await fetch('/api/vagas').then((r) => r.json())
    setVagas(data)
    return data
  }, [])

  useEffect(() => {
    fetch('/api/config').then((r) => r.json()).then(setConfig)
    fetchVagas().then((data) => {
      if (data.length) setSelectedVagaId(data[0].id)
    })
  }, [fetchVagas])

  const fetchCandidates = useCallback(async (vagaId: string) => {
    const params = new URLSearchParams({ vagaId })
    const data: Candidate[] = await fetch(`/api/candidates?${params}`).then((r) => r.json())
    setCandidates(data)
    setSelectedIds((prev) => {
      const ids = new Set(data.map((c) => c.id))
      return new Set(Array.from(prev).filter((id) => ids.has(id)))
    })
  }, [])

  useEffect(() => {
    if (!selectedVagaId) return
    setSelectedIds(new Set())
    setFilters({ name: '', stage: '', city: '' })
    fetchCandidates(selectedVagaId)
  }, [selectedVagaId, fetchCandidates])

  useEffect(() => {
    if (!selectedVagaId) return
    const interval = setInterval(() => fetchCandidates(selectedVagaId), 5000)
    return () => clearInterval(interval)
  }, [selectedVagaId, fetchCandidates])

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleToggleAll = (ids: string[]) => {
    setSelectedIds((prev) => {
      const allIn = ids.every((id) => prev.has(id))
      if (allIn) {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      }
      return new Set(Array.from(prev).concat(ids))
    })
  }

  const handleDispatch = async (opts: {
    templateName: string
    language: string
    mapping: Mapping
    fillValues?: Record<string, string>
  }) => {
    if (!selectedIds.size) return
    setDispatching(true)
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateIds: Array.from(selectedIds), ...opts }),
      })
      const data: DispatchResult & { error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro desconhecido')

      setSelectedIds(new Set())
      if (selectedVagaId) await fetchCandidates(selectedVagaId)

      toast.success(
        `${data.sent} mensagem${data.sent !== 1 ? 'ns' : ''} enviada${data.sent !== 1 ? 's' : ''}` +
          (data.testMode ? ` · teste → ${data.testPhone}` : '')
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro: ${msg}`)
    } finally {
      setDispatching(false)
    }
  }

  const handleVagaFieldSave = async (field: 'nomeCurto' | 'unidade', value: string) => {
    if (!selectedVagaId) return
    try {
      const res = await fetch(`/api/vagas/${selectedVagaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) { toast.error('Erro ao salvar'); return }
      const updated: Vaga = await res.json()
      setVagas((prev) => prev.map((v) => (v.id === updated.id ? { ...v, ...updated } : v)))
    } catch {
      toast.error('Erro ao salvar')
    }
  }

  const selectedCandidates = candidates.filter((c) => selectedIds.has(c.id))
  const selectedVaga = vagas.find((v) => v.id === selectedVagaId) ?? null

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TestModeBanner testPhone={config.testPhone} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          vagas={vagas}
          selectedId={selectedVagaId}
          onSelect={setSelectedVagaId}
          onRefreshVagas={fetchVagas}
          onSelectVaga={setSelectedVagaId}
        />

        <main className="flex flex-1 flex-col overflow-hidden bg-background">
          {selectedVaga ? (
            <>
              {/* Content header */}
              <div className="flex shrink-0 items-center justify-between border-b border-border bg-white px-6 py-4">
                <div className="flex flex-col gap-1">
                  <h1 className="text-[17px] font-bold tracking-tight text-foreground">
                    {selectedVaga.title}
                  </h1>
                  <p className="text-[13px] text-muted-foreground">
                    {selectedVaga.location} · {selectedVaga.openings} vaga{selectedVaga.openings !== 1 ? 's' : ''} · {candidates.length} candidato{candidates.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-0.5">
                    <InlineField
                      label="Cargo curto"
                      value={selectedVaga.nomeCurto}
                      placeholder="clique para definir"
                      onSave={(v) => handleVagaFieldSave('nomeCurto', v)}
                    />
                    <InlineField
                      label="Unidade"
                      value={selectedVaga.unidade}
                      placeholder="clique para definir"
                      onSave={(v) => handleVagaFieldSave('unidade', v)}
                    />
                  </div>
                </div>
                {selectedIds.size > 0 && (
                  <Badge variant="default" className="rounded-full px-3 py-1 text-xs font-semibold">
                    {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              {/* Content body */}
              <div className="flex flex-1 overflow-hidden">
                <CandidateList
                  candidates={candidates}
                  selectedIds={selectedIds}
                  filters={filters}
                  onFiltersChange={setFilters}
                  onToggle={handleToggle}
                  onToggleAll={handleToggleAll}
                />
                <WhatsAppPanel
                  selectedCandidates={selectedCandidates}
                  selectedVaga={selectedVaga}
                  onDispatch={handleDispatch}
                  dispatching={dispatching}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
              <span className="text-4xl opacity-20">📋</span>
              <p className="text-sm">Selecione uma vaga na barra lateral.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
