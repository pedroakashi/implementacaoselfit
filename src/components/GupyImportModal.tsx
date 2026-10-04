'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { toast } from 'sonner'
import { fetchGupyJobsAction, syncGupyJobAction } from '@/actions/gupy'
import type { GupyJob } from '@/lib/gupy'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onClose: () => void
  onImported: (vagaId: string) => void
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  published:        { label: 'Publicada',    className: 'bg-green-100 text-green-700 border-green-200' },
  draft:            { label: 'Rascunho',     className: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
  waiting_approval: { label: 'Aguardando',   className: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved:         { label: 'Aprovada',     className: 'bg-blue-100 text-blue-700 border-blue-200' },
  disapproved:      { label: 'Reprovada',    className: 'bg-red-100 text-red-600 border-red-200' },
  frozen:           { label: 'Congelada',    className: 'bg-sky-100 text-sky-700 border-sky-200' },
  closed:           { label: 'Fechada',      className: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
  canceled:         { label: 'Cancelada',    className: 'bg-red-100 text-red-600 border-red-200' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABEL[status] ?? { label: status, className: 'bg-zinc-100 text-zinc-500 border-zinc-200' }
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function useDebounce<T>(value: T, delay = 500): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoDateMinus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function isoYearStart(): string {
  return new Date().getFullYear() + '-01-01'
}

export default function GupyImportModal({ open, onClose, onImported }: Props) {
  const [jobs, setJobs]             = useState<GupyJob[]>([])
  const [loading, setLoading]       = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [uiPage, setUiPage]         = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch]         = useState('')
  const [showAll, setShowAll]       = useState(false)
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [importingId, setImportingId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const debouncedSearch = useDebounce(search, 500)

  const load = useCallback(async (page: number, reset: boolean) => {
    if (reset) setLoading(true)
    else       setLoadingMore(true)
    try {
      const res = await fetchGupyJobsAction({
        page,
        name: debouncedSearch,
        showAll,
        dateFrom: dateFrom || undefined,
        dateTo:   dateTo   || undefined,
      })
      setJobs((prev) => reset ? res.results : [...prev, ...res.results])
      setUiPage(page)
      setTotalPages(res.totalPages)
    } catch (err) {
      toast.error(`Erro ao buscar vagas: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [debouncedSearch, showAll, dateFrom, dateTo])

  useEffect(() => {
    if (!open) return
    load(1, true)
  }, [open, debouncedSearch, showAll, dateFrom, dateTo, load])

  const hasMore = uiPage < totalPages

  function applyShortcut(from: string, to: string) {
    setDateFrom(from)
    setDateTo(to)
  }

  function clearDates() {
    setDateFrom('')
    setDateTo('')
  }

  async function handleImport(job: GupyJob) {
    setImportingId(job.id)
    startTransition(async () => {
      try {
        const result = await syncGupyJobAction(String(job.id))
        const parts = [
          `${result.importados} novos`,
          `${result.atualizados} atualizados`,
        ]
        if (result.semTelefone)        parts.push(`${result.semTelefone} sem telefone`)
        if (result.ignoradosPorStatus) parts.push(`${result.ignoradosPorStatus} ignorados por status`)
        toast.success(`"${job.name}" importada — ${parts.join(', ')}`)
        onImported(result.vagaId)
        onClose()
      } catch (err) {
        toast.error(`Erro ao importar: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setImportingId(null)
      }
    })
  }

  if (!open) return null

  const hasDateFilter = !!(dateFrom || dateTo)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative flex w-full max-w-xl flex-col rounded-xl bg-white shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight">Importar vaga da Gupy</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Selecione uma vaga para importar os candidatos em processo
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 border-b border-border bg-muted/30 px-5 py-3 shrink-0">
          {/* Row 1: search + toggle */}
          <div className="flex items-center gap-3">
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[12px] text-muted-foreground">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="size-3.5 cursor-pointer accent-primary"
              />
              Mostrar fechadas
            </label>
          </div>

          {/* Row 2: date range */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground shrink-0">Criação:</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || isoToday()}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-7 rounded border border-input bg-white px-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-[11px] text-muted-foreground">até</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              max={isoToday()}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-7 rounded border border-input bg-white px-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center gap-1 ml-1">
              {[
                { label: '30d', from: isoDateMinus(30), to: isoToday() },
                { label: '90d', from: isoDateMinus(90), to: isoToday() },
                { label: 'Este ano', from: isoYearStart(), to: isoToday() },
              ].map(({ label, from, to }) => (
                <button
                  key={label}
                  onClick={() => applyShortcut(from, to)}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    dateFrom === from && dateTo === to
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {label}
                </button>
              ))}
              {hasDateFilter && (
                <button
                  onClick={clearDates}
                  className="rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <span className="text-3xl opacity-30">🔍</span>
              <p className="text-sm">Nenhuma vaga encontrada.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {jobs.map((job) => (
                <li key={job.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <span className="truncate text-[13px] font-semibold text-foreground">
                      {job.name}
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>#{job.id}</span>
                      {job.branchName && <><span>·</span><span className="truncate max-w-[120px]">{job.branchName}</span></>}
                      {job.createdAt && (
                        <><span>·</span><span>criada {new Date(job.createdAt).toLocaleDateString('pt-BR')}</span></>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-7 text-[12px]"
                    disabled={importingId === job.id || isPending}
                    onClick={() => handleImport(job)}
                  >
                    {importingId === job.id ? 'Importando...' : 'Importar'}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {!loading && hasMore && (
            <div className="px-5 py-3">
              <button
                onClick={() => load(uiPage + 1, false)}
                disabled={loadingMore}
                className="w-full rounded-md border border-border py-2 text-[12px] text-muted-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Carregando...' : 'Carregar mais'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
