'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Candidate } from '@/lib/store'
import StatusPill from './StatusPill'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Filters {
  name: string
  stage: string
  city: string
}

interface Props {
  candidates: Candidate[]
  selectedIds: Set<string>
  filters: Filters
  onFiltersChange: (f: Filters) => void
  onToggle: (id: string) => void
  onToggleAll: (ids: string[]) => void
}

const STAGE_COLORS: Record<string, string> = {
  Aprovado:   'bg-green-50 text-green-700 border-green-200',
  Entrevista: 'bg-blue-50 text-blue-700 border-blue-200',
  Triagem:    'bg-zinc-100 text-zinc-600 border-zinc-200',
}

export default function CandidateList({
  candidates,
  selectedIds,
  filters,
  onFiltersChange,
  onToggle,
  onToggleAll,
}: Props) {
  const stages = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.stage))),
    [candidates]
  )
  const cities = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.city))).sort(),
    [candidates]
  )

  const filtered = useMemo(() => {
    let list = candidates
    if (filters.name)  list = list.filter((c) => c.name.toLowerCase().includes(filters.name.toLowerCase()))
    if (filters.stage) list = list.filter((c) => c.stage === filters.stage)
    if (filters.city)  list = list.filter((c) => c.city === filters.city)
    return list
  }, [candidates, filters])

  const filteredIds = filtered.map((c) => c.id)
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id))

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-r border-border bg-white">
      {/* Filters */}
      <div className="flex gap-2 px-4 py-3 border-b border-border bg-white shrink-0">
        <Input
          placeholder="Buscar por nome..."
          value={filters.name}
          onChange={(e) => onFiltersChange({ ...filters, name: e.target.value })}
          className="h-8 text-sm min-w-0 flex-1"
        />
        <Select
          value={filters.stage || '__all__'}
          onValueChange={(v) => onFiltersChange({ ...filters, stage: (v === '__all__' || !v) ? '' : v })}
        >
          <SelectTrigger className="h-8 text-sm w-40 shrink-0">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as etapas</SelectItem>
            {stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={filters.city || '__all__'}
          onValueChange={(v) => onFiltersChange({ ...filters, city: (v === '__all__' || !v) ? '' : v })}
        >
          <SelectTrigger className="h-8 text-sm w-40 shrink-0">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as cidades</SelectItem>
            {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
          <span className="text-3xl opacity-30">🔍</span>
          <p className="text-sm">Nenhum candidato encontrado.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-11 px-4 py-2.5">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => onToggleAll(filteredIds)}
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Nome
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Cidade
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Etapa
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isSelected = selectedIds.has(c.id)
                return (
                  <tr
                    key={c.id}
                    onClick={() => onToggle(c.id)}
                    className={cn(
                      'cursor-pointer border-b border-border transition-colors last:border-b-0',
                      isSelected
                        ? 'bg-red-50/60 hover:bg-red-50'
                        : 'hover:bg-muted/30'
                    )}
                  >
                    <td className="w-11 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggle(c.id)}
                        aria-label={`Selecionar ${c.name}`}
                      />
                    </td>
                    <td className="px-3 py-3 text-[13px] font-semibold text-foreground">
                      {c.name}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">
                      {c.city}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        'inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold',
                        STAGE_COLORS[c.stage] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      )}>
                        {c.stage}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={c.contactStatus} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
