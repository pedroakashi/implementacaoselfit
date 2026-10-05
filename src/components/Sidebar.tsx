'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Vaga } from '@/lib/store'
import GupyImportModal from '@/components/GupyImportModal'
import { resyncVagaAction } from '@/actions/gupy'

interface Props {
  vagas: Vaga[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRefreshVagas: () => void
  onSelectVaga: (id: string) => void
  onDeleteVaga: (id: string) => Promise<void>
  testPhone?: string | null
}

function SelfitLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="81"
      height="56"
      viewBox="0 0 81 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Selfit Academias"
    >
      <g clipPath="url(#sidebar-clip)">
        <path d="M56.343 17.1243C55.6161 17.1243 54.8867 17.1243 54.1598 17.1243C53.7073 17.1243 53.4252 17.3542 53.3413 17.7988C52.805 20.6499 52.3018 23.5088 51.7248 26.3497C51.1098 29.3823 50.4871 32.4174 49.7449 35.4219C49.0536 38.227 47.8819 40.8457 46.2959 43.2677C43.8203 47.0462 40.506 49.854 36.48 51.8391C33.4122 53.3541 30.164 54.2866 26.8014 54.8512C23.4108 55.4209 19.9948 55.5742 16.5661 55.4567C13.7068 55.3596 10.8627 55.0658 8.04906 54.5216C7.97789 54.5089 7.88893 54.514 7.84318 54.4731C7.75931 54.3939 7.70339 54.2866 7.63477 54.1921C7.74152 54.1205 7.86351 53.9749 7.95501 53.9928C10.5526 54.5012 13.1832 54.634 15.8189 54.6034C19.9084 54.5574 23.9268 54.0132 27.8257 52.7154C32.0931 51.2949 35.8624 49.0671 38.9378 45.728C41.5735 42.864 43.4187 39.5325 44.5345 35.8179C45.1572 33.7433 45.6401 31.6203 46.0849 29.4972C47.2058 24.1628 48.2885 18.8181 49.3484 13.4709C49.783 11.2814 50.4998 9.22736 51.7808 7.3879C54.0479 4.13562 57.1589 2.19652 60.9892 1.32022C64.1535 0.597207 67.3535 0.410706 70.5814 0.530782C70.8 0.538447 71.1151 0.474576 71.1151 0.83225C71.1151 1.19759 70.8025 1.11328 70.5814 1.12094C68.1871 1.21036 65.831 1.49395 63.5435 2.27572C59.7209 3.58123 57.1182 6.15903 55.545 9.84818C55.2908 10.4435 55.0671 11.0515 54.8358 11.657C54.6859 12.0453 54.8079 12.2165 55.2323 12.219C56.5032 12.2216 57.7765 12.219 59.0474 12.2216C59.2304 12.2216 59.4159 12.2395 59.5964 12.2701C60.3614 12.4081 60.8011 13.0264 60.6842 13.7979C60.5927 14.3983 60.5012 14.9987 60.397 15.5965C60.214 16.6389 59.6574 17.0987 58.5619 17.1192C58.5416 17.1192 58.5212 17.1192 58.5009 17.1192C57.7842 17.1192 57.0649 17.1192 56.3481 17.1192L56.343 17.1243Z" fill="white"/>
        <path d="M29.3227 22.6733C28.2552 22.6733 27.1903 22.6759 26.1228 22.6733C25.2789 22.6708 24.9587 22.262 25.1341 21.424C25.1849 21.1813 25.2383 20.9412 25.2891 20.701C25.4441 19.9755 25.7644 19.7098 26.5066 19.7072C27.7875 19.7021 29.0711 19.6995 30.3521 19.6995C31.0307 19.6995 31.2442 19.5411 31.3179 18.859C31.3814 18.2714 31.4094 17.671 31.384 17.0809C31.3637 16.5903 31.0587 16.2327 30.5935 16.0743C30.2174 15.9465 29.8234 15.8137 29.4345 15.8009C28.5348 15.7728 27.63 15.76 26.7353 15.8418C25.4899 15.9567 24.6435 16.6823 24.2902 17.878C23.9878 18.8999 23.7819 19.9525 23.5633 20.9999C23.3524 22.0168 23.1211 23.0336 23.0016 24.0632C22.8161 25.6344 23.4922 26.3727 25.0756 26.5081C27.0276 26.6742 28.9389 26.4391 30.835 25.9844C31.3433 25.8617 31.8567 25.7672 32.3702 25.6804C33.2623 25.5296 33.9028 26.1709 33.7503 27.0753C33.6664 27.5709 33.5419 28.0614 33.4249 28.552C33.2572 29.2494 32.7692 29.6531 32.1134 29.8013C31.1069 30.0286 30.0903 30.2356 29.066 30.3659C27.4876 30.5652 25.8991 30.6111 24.308 30.4987C23.2507 30.4246 22.2162 30.2484 21.2225 29.8549C19.5577 29.1958 18.6808 27.9516 18.4648 26.1964C18.2818 24.707 18.4444 23.2405 18.7062 21.774C19.0112 20.0572 19.3899 18.3634 20.0711 16.7538C20.7446 15.1571 21.6825 13.7928 23.332 13.057C24.2114 12.6636 25.129 12.4056 26.077 12.2982C28.1739 12.0607 30.2733 12.0377 32.3498 12.4771C32.8861 12.5895 33.4173 12.7786 33.9129 13.011C35.2244 13.6268 35.8903 14.7125 36.0505 16.1407C36.1801 17.3057 35.9895 18.44 35.7709 19.5744C35.6972 19.9576 35.6336 20.3459 35.5269 20.7189C35.1914 21.8916 34.3857 22.5533 33.1708 22.6427C32.5277 22.6887 31.8822 22.6887 31.2366 22.6963C30.6012 22.704 29.9657 22.6963 29.3303 22.6963C29.3303 22.6887 29.3303 22.6836 29.3303 22.6759L29.3227 22.6733Z" fill="white"/>
        <path d="M6.57479 30.5497C4.81342 30.5191 3.05459 30.4348 1.34406 29.9366C1.18648 29.8906 1.03144 29.8369 0.88148 29.7705C0.220649 29.4793 -0.0894325 28.9453 0.0224003 28.2325C0.108817 27.673 0.218108 27.1161 0.350274 26.5668C0.563773 25.6803 1.30339 25.2102 2.19552 25.4299C3.1588 25.6649 4.1043 25.9817 5.06759 26.2168C6.5697 26.5821 8.09216 26.6102 9.61715 26.3701C10.2983 26.2628 10.9185 25.9971 11.193 25.2919C11.5742 24.3032 11.2845 23.8715 10.5169 23.6364C9.43923 23.3094 8.34886 23.0284 7.25341 22.7678C6.15541 22.5072 5.06504 22.244 4.03059 21.7688C2.93005 21.263 2.27431 20.4455 2.19297 19.2089C2.09385 17.6939 2.33785 16.2479 3.13084 14.9347C3.96197 13.5551 5.27346 12.8679 6.77812 12.5281C7.56349 12.3518 8.37174 12.2266 9.1749 12.1857C11.4217 12.0657 13.6635 12.1168 15.8595 12.7018C15.9484 12.7248 16.0374 12.7452 16.1263 12.7708C17.176 13.0672 17.5395 13.6471 17.3412 14.7329C17.2599 15.1774 17.1811 15.6245 17.082 16.0665C16.8787 16.976 16.1492 17.4819 15.2469 17.2698C14.3218 17.0501 13.422 16.7308 12.4994 16.4932C11.0913 16.1304 9.66544 16.0716 8.23195 16.3348C7.58891 16.4523 7.12633 16.8048 6.96366 17.4793C6.82387 18.0542 6.95604 18.4578 7.50249 18.6699C8.1862 18.9356 8.89532 19.1527 9.61207 19.3137C11.0125 19.6279 12.4155 19.9141 13.755 20.4531C13.9176 20.517 14.0727 20.5962 14.2303 20.6703C15.6256 21.3141 16.2204 22.3437 16.0679 24.1525C15.9687 25.3175 15.6866 26.4263 15.0766 27.4329C14.1947 28.8866 12.8273 29.6402 11.2413 30.0618C9.71119 30.468 8.14553 30.5242 6.57225 30.5523L6.57479 30.5497Z" fill="white"/>
        <path d="M77.4622 16.8534C76.8573 16.8534 76.2524 16.8432 75.6475 16.8559C75.129 16.8661 74.9307 17.0424 74.8291 17.5534C74.4402 19.541 74.0361 21.5287 73.6777 23.5214C73.5887 24.0196 73.5862 24.5485 73.6421 25.0543C73.7387 25.9076 74.2648 26.393 75.1137 26.3547C75.9982 26.3164 76.8827 26.181 77.7596 26.0379C78.761 25.8744 79.3227 26.3828 79.1651 27.3869C79.094 27.8442 78.9847 28.2938 78.8957 28.7486C78.7203 29.6555 78.0875 30.095 77.264 30.2559C75.5001 30.5983 73.7209 30.6902 71.9519 30.3147C70.0889 29.9187 69.0595 28.7026 68.8587 26.8018C68.6834 25.1386 68.9324 23.5163 69.2527 21.8991C70.0253 18.0056 70.8006 14.1121 71.5732 10.216C71.6927 9.61559 71.9062 9.07397 72.5314 8.84659C72.7652 8.76228 73.0296 8.72907 73.2812 8.72141C73.8658 8.70352 74.4504 8.71119 75.0349 8.7163C75.9601 8.72652 76.4379 9.32945 76.26 10.2466C76.1482 10.8215 76.0389 11.3989 75.9322 11.9737C75.8356 12.4898 75.9982 12.689 76.5218 12.689C77.5563 12.6916 78.5933 12.689 79.6277 12.689C80.6723 12.6916 81.1375 13.2307 80.9646 14.2602C80.8808 14.7559 80.7765 15.2515 80.6571 15.7395C80.4995 16.3961 80.042 16.7895 79.3659 16.8202C78.7305 16.8483 78.0951 16.8253 77.4597 16.8253C77.4597 16.8329 77.4597 16.838 77.4597 16.8457L77.4622 16.8534Z" fill="white"/>
        <path d="M41.843 26.9397C42.1048 26.9397 42.3285 26.9346 42.5496 26.9397C43.2054 26.955 43.5714 27.3382 43.4951 27.9897C43.4367 28.4981 43.3452 29.0117 43.2054 29.5022C43.0478 30.0591 42.6564 30.4704 42.0692 30.4858C40.956 30.5139 39.8326 30.5215 38.7244 30.4194C37.629 30.3172 37.0749 29.6682 37.1308 28.5646C37.1816 27.5426 37.3341 26.5182 37.5248 25.509C38.4194 20.7903 39.342 16.0766 40.257 11.363C40.5671 9.76881 40.8772 8.17205 41.1873 6.57785C41.3677 5.65811 41.9498 5.17781 42.8902 5.17781C43.4951 5.17781 44.1 5.1727 44.7049 5.17781C45.5233 5.18547 45.9427 5.71432 45.7851 6.51653C44.9972 10.5863 44.2119 14.6562 43.4214 18.7234C42.9207 21.3089 42.4149 23.8918 41.9142 26.4773C41.8862 26.6152 41.871 26.7558 41.8405 26.9397H41.843Z" fill="white"/>
        <path d="M62.3943 30.3607C62.0867 30.3607 61.7792 30.3633 61.4717 30.3607C60.6126 30.3479 60.1525 29.8625 60.2568 28.9939C60.3381 28.3117 60.4982 27.6373 60.6304 26.9602C61.3217 23.3835 62.0181 19.8093 62.712 16.2326C62.8772 15.3844 63.0373 14.5362 63.2076 13.688C63.3932 12.7555 63.9091 12.3288 64.8571 12.3161C65.4722 12.3084 66.0873 12.3058 66.7024 12.3161C67.5462 12.3288 68.0393 12.9062 67.8817 13.7442C67.4471 16.0691 66.9947 18.3914 66.5448 20.7163C66.0187 23.4346 65.49 26.1504 64.9639 28.8661C64.7555 29.9443 64.2649 30.3556 63.1644 30.3582C62.9077 30.3582 62.651 30.3582 62.3943 30.3582V30.3607Z" fill="white"/>
      </g>
      <defs>
        <clipPath id="sidebar-clip">
          <rect width="81" height="55" fill="white" transform="translate(0 0.5)"/>
        </clipPath>
      </defs>
    </svg>
  )
}

export default function Sidebar({ vagas, selectedId, onSelect, onRefreshVagas, onSelectVaga, onDeleteVaga, testPhone }: Props) {
  const [modalOpen, setModalOpen]           = useState(false)
  const [resyncingId, setResyncingId]       = useState<string | null>(null)
  const [deletingId, setDeletingId]         = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isPending, startTransition]        = useTransition()

  function handleResync(e: React.MouseEvent, vaga: Vaga & { gupyJobId?: string | null }) {
    e.stopPropagation()
    if (!vaga.gupyJobId) return
    setResyncingId(vaga.id)
    startTransition(async () => {
      try {
        const result = await resyncVagaAction(vaga.gupyJobId!)
        const parts = [`${result.importados} novos`, `${result.atualizados} atualizados`]
        if (result.semTelefone)        parts.push(`${result.semTelefone} sem telefone`)
        if (result.ignoradosPorStatus) parts.push(`${result.ignoradosPorStatus} ignorados`)
        toast.success(`"${vaga.title}" sincronizada — ${parts.join(', ')}`)
        onRefreshVagas()
      } catch (err) {
        toast.error(`Erro ao sincronizar: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setResyncingId(null)
      }
    })
  }

  async function handleDelete(e: React.MouseEvent, vagaId: string) {
    e.stopPropagation()
    if (confirmDeleteId !== vagaId) {
      setConfirmDeleteId(vagaId)
      return
    }
    setConfirmDeleteId(null)
    setDeletingId(vagaId)
    try {
      await onDeleteVaga(vagaId)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <aside
      className="flex flex-col w-64 flex-shrink-0 overflow-y-auto bg-sidebar border-r border-sidebar-border"
      onClick={() => setConfirmDeleteId(null)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <SelfitLogo className="h-7 w-auto" />
        <div className="flex flex-col min-w-0">
          <span className="text-sidebar-foreground text-[13px] font-bold leading-tight tracking-tight truncate">
            Selfit Academia
          </span>
          <span className="text-sidebar-foreground/40 text-[11px] mt-0.5">
            Recrutamento & Seleção
          </span>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 px-3 py-4">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/30">
            Vagas abertas
          </span>
        </div>

        {/* Import button */}
        <button
          onClick={() => setModalOpen(true)}
          className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-sidebar-foreground/20 px-3 py-2 mb-3 text-[12px] text-sidebar-foreground/40 hover:border-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Importar vaga da Gupy
        </button>

        <nav className="flex flex-col gap-0.5">
          {vagas.map((v) => {
            const vagaWithGupy = v as Vaga & { gupyJobId?: string | null }
            const isSyncing   = resyncingId === v.id
            const isDeleting  = deletingId === v.id
            const isConfirming = confirmDeleteId === v.id
            const isSelected  = selectedId === v.id

            return (
              <button
                key={v.id}
                onClick={() => { setConfirmDeleteId(null); onSelect(v.id) }}
                disabled={isDeleting}
                className={cn(
                  'group flex flex-col w-full text-left px-3 py-2.5 rounded-md transition-colors duration-100 relative',
                  isDeleting && 'opacity-40 pointer-events-none',
                  isSelected
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-[60%] before:bg-primary before:rounded-r'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                )}
              >
                <div className="flex items-center justify-between gap-1 min-w-0">
                  <span className="truncate text-[13px] font-medium leading-tight">{v.title}</span>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Resync */}
                    {vagaWithGupy.gupyJobId && (
                      <span
                        role="button"
                        onClick={(e) => handleResync(e, vagaWithGupy)}
                        title="Sincronizar com Gupy"
                        className={cn(
                          'rounded px-1 py-0.5 text-[10px] font-medium transition-colors',
                          isSyncing || isPending
                            ? 'text-sidebar-foreground/30 cursor-default'
                            : 'text-sidebar-foreground/30 hover:text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 cursor-pointer opacity-0 group-hover:opacity-100'
                        )}
                      >
                        {isSyncing ? '…' : '↻'}
                      </span>
                    )}

                    {/* Delete */}
                    {isConfirming ? (
                      <span
                        role="button"
                        onClick={(e) => handleDelete(e, v.id)}
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-600/80 text-white cursor-pointer"
                      >
                        Excluir?
                      </span>
                    ) : (
                      <span
                        role="button"
                        onClick={(e) => handleDelete(e, v.id)}
                        title="Remover vaga"
                        className="rounded px-1 py-0.5 text-[11px] text-sidebar-foreground/20 hover:text-red-400 hover:bg-red-500/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-colors"
                      >
                        ✕
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] mt-0.5 opacity-50">
                  {v.location} · {v.openings} vaga{v.openings !== 1 ? 's' : ''}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sidebar-border flex flex-col gap-1.5">
        {testPhone && (
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="text-[10px] text-sidebar-foreground/35 truncate">
              Teste → {testPhone}
            </span>
          </div>
        )}
        <p className="text-[11px] text-sidebar-foreground/20">Convoca v1.0 · Selfit</p>
      </div>

      <GupyImportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onImported={(vagaId) => {
          onRefreshVagas()
          onSelectVaga(vagaId)
        }}
      />
    </aside>
  )
}
