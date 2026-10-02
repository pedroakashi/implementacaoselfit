'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { Vaga, Candidate } from '@/lib/store'
import TestModeBanner from '@/components/TestModeBanner'
import Sidebar from '@/components/Sidebar'
import CandidateList from '@/components/CandidateList'
import WhatsAppPanel from '@/components/WhatsAppPanel'
import { Badge } from '@/components/ui/badge'

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

export default function Home() {
  const [config, setConfig] = useState<AppConfig>({ isTestMode: false, testPhone: null })
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [selectedVagaId, setSelectedVagaId] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({ name: '', stage: '', city: '' })
  const [dispatching, setDispatching] = useState(false)

  useEffect(() => {
    fetch('/api/config').then((r) => r.json()).then(setConfig)
    fetch('/api/vagas').then((r) => r.json()).then((data: Vaga[]) => {
      setVagas(data)
      if (data.length) setSelectedVagaId(data[0].id)
    })
  }, [])

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

  const handleDispatch = async (templateName: string) => {
    if (!selectedIds.size) return
    setDispatching(true)
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateIds: Array.from(selectedIds), templateName }),
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

  const selectedCandidates = candidates.filter((c) => selectedIds.has(c.id))
  const selectedVaga = vagas.find((v) => v.id === selectedVagaId)

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TestModeBanner testPhone={config.testPhone} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar vagas={vagas} selectedId={selectedVagaId} onSelect={setSelectedVagaId} />

        <main className="flex flex-1 flex-col overflow-hidden bg-background">
          {selectedVaga ? (
            <>
              {/* Content header */}
              <div className="flex shrink-0 items-center justify-between border-b border-border bg-white px-6 py-4">
                <div className="flex flex-col gap-0.5">
                  <h1 className="text-[17px] font-bold tracking-tight text-foreground">
                    {selectedVaga.title}
                  </h1>
                  <p className="text-[13px] text-muted-foreground">
                    {selectedVaga.location} · {selectedVaga.openings} vaga{selectedVaga.openings !== 1 ? 's' : ''} · {candidates.length} candidato{candidates.length !== 1 ? 's' : ''}
                  </p>
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
                  selectedCount={selectedIds.size}
                  selectedNames={selectedCandidates.map((c) => c.name)}
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
