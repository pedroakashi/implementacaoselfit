'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  selectedCount: number
  selectedNames: string[]
  onDispatch: (templateName: string) => Promise<void>
  dispatching: boolean
}

export default function WhatsAppPanel({ selectedCount, selectedNames, onDispatch, dispatching }: Props) {
  const [templateName, setTemplateName] = useState('')

  const canSend = selectedCount > 0 && templateName.trim().length > 0 && !dispatching

  const handleSend = async () => {
    if (!canSend) return
    await onDispatch(templateName.trim())
    setTemplateName('')
  }

  return (
    <div className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-border bg-white">
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
        {/* Template input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Template
          </label>
          <Input
            placeholder="ex: selfit_convite_entrevista"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canSend && handleSend()}
            className="h-9 text-sm font-medium"
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Nome exato do template aprovado pela Meta.{' '}
            <span className="font-medium text-foreground/60">
              Infobip → Channels → WhatsApp → Message Templates
            </span>
          </p>
        </div>

        {/* Preview */}
        {templateName.trim() && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Prévia
            </label>
            <div className="whatsapp-preview">
              <div className="whatsapp-bubble">
                <p className="mb-1 text-[12px] font-bold" style={{ color: '#25d366' }}>
                  Selfit Academias
                </p>
                <p className="text-[#111b21]">
                  Olá {selectedNames[0] || 'Candidato'}! Temos uma novidade para você no seu processo seletivo na Selfit.
                </p>
                <span
                  className="mt-2 inline-block rounded bg-[#f0f2f5] px-1.5 py-0.5 font-mono text-[10px]"
                  style={{ color: '#8696a0' }}
                >
                  {templateName}
                </span>
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px]" style={{ color: '#8696a0' }}>
                  agora
                  <span className="text-[#53bdeb] text-[12px]">✓✓</span>
                </div>
              </div>
            </div>
            {selectedCount > 1 && (
              <p className="text-[11px] text-muted-foreground">
                +{selectedCount - 1} mensagem{selectedCount - 1 !== 1 ? 'ns' : ''} similar{selectedCount - 1 !== 1 ? 'es' : ''} para os demais.
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
            'Enviando...'
          ) : selectedCount === 0 ? (
            'Selecione candidatos'
          ) : !templateName.trim() ? (
            'Informe o template'
          ) : (
            `Enviar · ${selectedCount} mensagem${selectedCount !== 1 ? 'ns' : ''}`
          )}
        </Button>
      </div>
    </div>
  )
}
