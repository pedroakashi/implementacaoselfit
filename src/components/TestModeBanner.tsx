'use client'

interface Props {
  testPhone: string | null
}

export default function TestModeBanner({ testPhone }: Props) {
  if (!testPhone) return null

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-xs font-semibold tracking-wide text-white">
      <span className="inline-block size-1.5 animate-pulse rounded-full bg-white/70" />
      MODO TESTE — todos os envios vão para {testPhone}
    </div>
  )
}
