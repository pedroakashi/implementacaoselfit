'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { Vaga, Candidate } from '@/lib/store'
import type { Mapping } from '@/lib/templates'
import Sidebar from '@/components/Sidebar'
import CandidateList from '@/components/CandidateList'
import WhatsAppPanel from '@/components/WhatsAppPanel'
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
      <span className="text-muted-foreground/60">{label}</span>
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
              ? 'font-medium text-foreground hover:text-primary transition-colors'
              : 'text-muted-foreground/40 italic hover:text-muted-foreground transition-colors'
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
  const [config, setConfig]               = useState<AppConfig>({ isTestMode: false, testPhone: null })
  const [vagas, setVagas]                 = useState<Vaga[]>([])
  const [selectedVagaId, setSelectedVagaId] = useState<string | null>(null)
  const [candidates, setCandidates]       = useState<Candidate[]>([])
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [filters, setFilters]             = useState({ name: '', stage: '', city: '' })
  const [dispatching, setDispatching]     = useState(false)

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
      toast.error(`Erro no envio: ${msg}`)
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

  const handleDeleteVaga = async (id: string) => {
    try {
      const res = await fetch(`/api/vagas/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Erro ao remover vaga'); return }
      const remaining = vagas.filter((v) => v.id !== id)
      setVagas(remaining)
      if (selectedVagaId === id) {
        setSelectedVagaId(remaining[0]?.id ?? null)
        setCandidates([])
        setSelectedIds(new Set())
      }
      toast.success('Vaga removida')
    } catch {
      toast.error('Erro ao remover vaga')
    }
  }

  const selectedCandidates = candidates.filter((c) => selectedIds.has(c.id))
  const selectedVaga        = vagas.find((v) => v.id === selectedVagaId) ?? null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          vagas={vagas}
          selectedId={selectedVagaId}
          onSelect={setSelectedVagaId}
          onRefreshVagas={fetchVagas}
          onSelectVaga={setSelectedVagaId}
          onDeleteVaga={handleDeleteVaga}
          testPhone={config.testPhone}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
          {selectedVaga ? (
            <>
              {/* Vaga header */}
              <div className="shrink-0 border-b border-border bg-white px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <h1 className="text-[16px] font-bold tracking-tight text-foreground leading-snug truncate">
                      {selectedVaga.title}
                    </h1>
                    <p className="text-[12px] text-muted-foreground">
                      {selectedVaga.location}
                      <span className="mx-1.5 opacity-40">·</span>
                      {selectedVaga.openings} vaga{selectedVaga.openings !== 1 ? 's' : ''}
                      <span className="mx-1.5 opacity-40">·</span>
                      {candidates.length} candidato{candidates.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                      <InlineField
                        label="Cargo curto:"
                        value={selectedVaga.nomeCurto}
                        placeholder="clique para definir"
                        onSave={(v) => handleVagaFieldSave('nomeCurto', v)}
                      />
                      <InlineField
                        label="Unidade:"
                        value={selectedVaga.unidade}
                        placeholder="clique para definir"
                        onSave={(v) => handleVagaFieldSave('unidade', v)}
                      />
                    </div>
                  </div>

                  {selectedIds.size > 0 && (
                    <div className="shrink-0 flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span className="text-[12px] font-semibold text-primary">
                        {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
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
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="rounded-full bg-muted p-5">
                <svg className="size-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-medium text-foreground">Nenhuma vaga selecionada</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">Escolha uma vaga na barra lateral para começar.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
