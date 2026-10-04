// Tipos compartilhados entre frontend e backend.
// Os dados agora vivem no Postgres via Prisma (src/lib/db.ts).

export type ContactStatus =
  | 'not_contacted'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'

export type CandidateSource = 'manual' | 'csv' | 'gupy_api' | 'gupy_webhook'

export interface Vaga {
  id: string
  title: string
  location: string
  openings: number
  gupyJobId?: string | null
  nomeCurto?: string | null
  unidade?: string | null
}

export interface Candidate {
  id: string
  vagaId: string
  gupyApplicationId?: string | null
  source: CandidateSource
  name: string
  phone?: string | null
  hasPhone: boolean
  city?: string | null
  stage: string
  contactStatus: ContactStatus
  lastError?: string | null
  messageId?: string | null
  statusAt?: string | null
  gupyUpdatedAt?: string | null
}
