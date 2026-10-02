export type ContactStatus =
  | 'not_contacted'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'

export interface Vaga {
  id: string
  title: string
  location: string
  openings: number
}

export interface Candidate {
  id: string
  vagaId: string
  name: string
  phone: string
  city: string
  stage: 'Triagem' | 'Entrevista' | 'Aprovado'
  contactStatus: ContactStatus
  messageId?: string
}

export interface MessageRecord {
  messageId: string
  candidateId: string
  status: ContactStatus
  sentAt: Date
}

// ──────────────────────────────────────────────
// Mutable in-memory store (persists across requests in Next.js dev)
// ──────────────────────────────────────────────

export const vagas: Vaga[] = [
  { id: 'v1', title: 'Personal Trainer', location: 'São Paulo', openings: 3 },
  { id: 'v2', title: 'Instrutor de Musculação', location: 'Campinas', openings: 2 },
  { id: 'v3', title: 'Recepcionista', location: 'São Paulo', openings: 4 },
  { id: 'v4', title: 'Coordenador de Academia', location: 'Santos', openings: 1 },
]

// Todos os telefones são 5511995903793 (seed seguro para testes)
export const candidates: Candidate[] = [
  // Personal Trainer
  { id: 'c1', vagaId: 'v1', name: 'Ana Paula Ferreira', phone: '5511995903793', city: 'São Paulo', stage: 'Triagem', contactStatus: 'not_contacted' },
  { id: 'c2', vagaId: 'v1', name: 'Carlos Eduardo Lima', phone: '5511995903793', city: 'Guarulhos', stage: 'Entrevista', contactStatus: 'not_contacted' },
  { id: 'c3', vagaId: 'v1', name: 'Fernanda Souza', phone: '5511995903793', city: 'São Paulo', stage: 'Triagem', contactStatus: 'not_contacted' },
  { id: 'c4', vagaId: 'v1', name: 'Ricardo Matos', phone: '5511995903793', city: 'Santo André', stage: 'Aprovado', contactStatus: 'not_contacted' },
  { id: 'c5', vagaId: 'v1', name: 'Juliana Costa', phone: '5511995903793', city: 'São Paulo', stage: 'Triagem', contactStatus: 'not_contacted' },

  // Instrutor de Musculação
  { id: 'c6', vagaId: 'v2', name: 'Marcelo Andrade', phone: '5511995903793', city: 'Campinas', stage: 'Entrevista', contactStatus: 'not_contacted' },
  { id: 'c7', vagaId: 'v2', name: 'Priscila Nunes', phone: '5511995903793', city: 'Campinas', stage: 'Triagem', contactStatus: 'not_contacted' },
  { id: 'c8', vagaId: 'v2', name: 'Diego Rodrigues', phone: '5511995903793', city: 'Vinhedo', stage: 'Aprovado', contactStatus: 'not_contacted' },
  { id: 'c9', vagaId: 'v2', name: 'Tatiana Freitas', phone: '5511995903793', city: 'Campinas', stage: 'Triagem', contactStatus: 'not_contacted' },

  // Recepcionista
  { id: 'c10', vagaId: 'v3', name: 'Beatriz Alves', phone: '5511995903793', city: 'São Paulo', stage: 'Triagem', contactStatus: 'not_contacted' },
  { id: 'c11', vagaId: 'v3', name: 'Lucas Pereira', phone: '5511995903793', city: 'São Paulo', stage: 'Entrevista', contactStatus: 'not_contacted' },
  { id: 'c12', vagaId: 'v3', name: 'Camila Santos', phone: '5511995903793', city: 'Osasco', stage: 'Triagem', contactStatus: 'not_contacted' },
  { id: 'c13', vagaId: 'v3', name: 'Rodrigo Mendes', phone: '5511995903793', city: 'São Paulo', stage: 'Aprovado', contactStatus: 'not_contacted' },
  { id: 'c14', vagaId: 'v3', name: 'Vanessa Lima', phone: '5511995903793', city: 'Taboão da Serra', stage: 'Triagem', contactStatus: 'not_contacted' },
  { id: 'c15', vagaId: 'v3', name: 'Felipe Carvalho', phone: '5511995903793', city: 'São Paulo', stage: 'Entrevista', contactStatus: 'not_contacted' },

  // Coordenador de Academia
  { id: 'c16', vagaId: 'v4', name: 'Patricia Oliveira', phone: '5511995903793', city: 'Santos', stage: 'Entrevista', contactStatus: 'not_contacted' },
  { id: 'c17', vagaId: 'v4', name: 'Alexandre Rocha', phone: '5511995903793', city: 'Santos', stage: 'Aprovado', contactStatus: 'not_contacted' },
  { id: 'c18', vagaId: 'v4', name: 'Silvia Martins', phone: '5511995903793', city: 'Praia Grande', stage: 'Triagem', contactStatus: 'not_contacted' },
]

// messageId → record
export const messageRecords = new Map<string, MessageRecord>()
