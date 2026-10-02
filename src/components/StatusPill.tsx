'use client'

import { cn } from '@/lib/utils'
import type { ContactStatus } from '@/lib/store'

const STATUS_CONFIG: Record<ContactStatus, { label: string; className: string }> = {
  not_contacted: { label: 'Não contatado', className: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
  queued:        { label: 'Na fila',       className: 'bg-amber-50 text-amber-700 border-amber-200' },
  sent:          { label: 'Enviado',       className: 'bg-blue-50 text-blue-700 border-blue-200' },
  delivered:     { label: 'Entregue',      className: 'bg-green-50 text-green-700 border-green-200' },
  read:          { label: 'Lido',          className: 'bg-violet-50 text-violet-700 border-violet-200' },
  failed:        { label: 'Falhou',        className: 'bg-red-50 text-red-700 border-red-200' },
}

export default function StatusPill({ status }: { status: ContactStatus }) {
  const { label, className } = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_contacted
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold border whitespace-nowrap',
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70 shrink-0" />
      {label}
    </span>
  )
}
