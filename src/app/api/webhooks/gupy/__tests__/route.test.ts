import { describe, it, expect, vi, beforeEach } from 'vitest'

// ──────────────────────────────────────────────────────────────────────────────
// Mock Prisma antes de importar a rota
// ──────────────────────────────────────────────────────────────────────────────

const mockPrisma = {
  gupyEvent: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  candidate: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  vaga: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

// Setar env antes de importar a rota
process.env.GUPY_WEBHOOK_SECRET = 'secret-de-teste'

// Importar após os mocks
const { POST } = await import('../route')

// ──────────────────────────────────────────────────────────────────────────────
// Helper — cria um NextRequest fake
// ──────────────────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, secret?: string) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (secret !== undefined) headers.set('x-convoca-secret', secret)
  return new Request('http://localhost/api/webhooks/gupy', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest
}

// ──────────────────────────────────────────────────────────────────────────────
// Payload de exemplo — application.created
// ──────────────────────────────────────────────────────────────────────────────

const createdPayload = {
  id: 'evt-001',
  action: 'application.created',
  date: '2026-09-01T10:00:00.000Z',
  data: {
    application: { id: 1001 },
    job: { id: 99, name: 'Atendente', city: 'São Paulo' },
    candidate: {
      name: 'Joana',
      lastName: 'Silva',
      mobileNumber: '+5511999990001',
      addressCity: 'São Paulo',
    },
    currentStep: { name: 'Triagem' },
  },
}

const movedPayload = {
  id: 'evt-002',
  action: 'application.moved',
  date: '2026-09-02T10:00:00.000Z',
  data: {
    application: { id: 1001 },
    job: { id: 99, name: 'Atendente', city: 'São Paulo' },
    candidate: {
      name: 'Joana',
      lastName: 'Silva',
      mobileNumber: '+5511999990001',
      addressCity: 'São Paulo',
    },
    currentStep: { name: 'Entrevista' },
  },
}

// ──────────────────────────────────────────────────────────────────────────────
// Testes
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/gupy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.gupyEvent.findUnique.mockResolvedValue(null)
    mockPrisma.gupyEvent.create.mockResolvedValue({})
    mockPrisma.candidate.findUnique.mockResolvedValue(null)
    mockPrisma.candidate.create.mockResolvedValue({})
    mockPrisma.vaga.findFirst.mockResolvedValue({ id: 'vaga-99', gupyJobId: '99' })
    mockPrisma.vaga.upsert.mockResolvedValue({ id: 'vaga-99' })
  })

  it('retorna 401 com secret errado', async () => {
    const req = makeRequest(createdPayload, 'secret-errado')
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(mockPrisma.gupyEvent.create).not.toHaveBeenCalled()
  })

  it('retorna 401 sem secret', async () => {
    const req = makeRequest(createdPayload)
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('processa evento criado com secret correto', async () => {
    const req = makeRequest(createdPayload, 'secret-de-teste')
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.deduped).toBe(false)
    expect(mockPrisma.gupyEvent.create).toHaveBeenCalledOnce()
  })

  it('deduplica: evento duplicado retorna 200 sem nova escrita', async () => {
    mockPrisma.gupyEvent.findUnique.mockResolvedValue({ id: 'evt-001' })
    const req = makeRequest(createdPayload, 'secret-de-teste')
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deduped).toBe(true)
    expect(mockPrisma.gupyEvent.create).not.toHaveBeenCalled()
    expect(mockPrisma.candidate.create).not.toHaveBeenCalled()
  })

  it('moved mais antigo que o estado atual não regride a etapa', async () => {
    // Candidato já existe com gupyUpdatedAt mais novo que o evento
    mockPrisma.candidate.findUnique.mockResolvedValue({
      id: 'c-existing',
      gupyApplicationId: '1001',
      stage: 'Aprovado',
      gupyUpdatedAt: new Date('2026-09-10T10:00:00.000Z'), // mais novo que o evento
    })

    const oldMovedPayload = {
      ...movedPayload,
      id: 'evt-003',
      date: '2026-08-01T10:00:00.000Z', // mais antigo
    }

    const req = makeRequest(oldMovedPayload, 'secret-de-teste')
    const res = await POST(req)
    expect(res.status).toBe(200)
    // Gupyevent deve ser gravado
    expect(mockPrisma.gupyEvent.create).toHaveBeenCalledOnce()
    // Mas candidato NÃO deve ser atualizado (etapa regredida)
    expect(mockPrisma.candidate.update).not.toHaveBeenCalled()
  })
})
