import { describe, it, expect } from 'vitest'
import { mapApplication, normalizePhone, extractNomeCurto, extractUnidade } from '../gupy-mapper'
import type { GupyApplication } from '../gupy'

// ──────────────────────────────────────────────────────────────────────────────
// normalizePhone
// ──────────────────────────────────────────────────────────────────────────────

describe('normalizePhone', () => {
  it('remove o + do E.164', () => {
    expect(normalizePhone('+5511912345678')).toBe('5511912345678')
  })
  it('aceita número já sem +', () => {
    expect(normalizePhone('5511912345678')).toBe('5511912345678')
  })
  it('retorna null para string vazia', () => {
    expect(normalizePhone('')).toBeNull()
  })
  it('retorna null para null/undefined', () => {
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
  })
  it('retorna null para número muito curto', () => {
    expect(normalizePhone('1234')).toBeNull()
  })
  it('remove traços e espaços', () => {
    expect(normalizePhone('(11) 9 1234-5678')).toBe('11912345678')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// mapApplication — application.created típico
// ──────────────────────────────────────────────────────────────────────────────

describe('mapApplication — application.created', () => {
  const application: GupyApplication = {
    id: 98765,
    jobId: 1001,
    status: 'in_process',
    currentStep: { name: 'Triagem' },
    candidate: {
      name: 'Ana',
      lastName: 'Souza',
      email: 'ana.souza@email.com',
      mobileNumber: '+5511987654321',
      addressCity: 'São Paulo',
    },
  }

  it('mapeia id corretamente', () => {
    expect(mapApplication(application).gupyApplicationId).toBe('98765')
  })
  it('concatena name + lastName', () => {
    expect(mapApplication(application).name).toBe('Ana Souza')
  })
  it('normaliza telefone', () => {
    expect(mapApplication(application).phone).toBe('5511987654321')
  })
  it('marca hasPhone = true', () => {
    expect(mapApplication(application).hasPhone).toBe(true)
  })
  it('mapeia cidade', () => {
    expect(mapApplication(application).city).toBe('São Paulo')
  })
  it('mapeia etapa', () => {
    expect(mapApplication(application).stage).toBe('Triagem')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// mapApplication — application.moved típico
// ──────────────────────────────────────────────────────────────────────────────

describe('mapApplication — application.moved', () => {
  const application: GupyApplication = {
    id: 11111,
    jobId: 2002,
    status: 'in_process',
    currentStep: { name: 'Entrevista Presencial' },
    candidate: {
      name: 'Pedro',
      lastName: 'Lima',
      mobileNumber: '5521999998888',
      addressCity: 'Rio de Janeiro',
    },
  }

  it('usa a etapa do moved', () => {
    expect(mapApplication(application).stage).toBe('Entrevista Presencial')
  })
  it('mantém telefone sem +', () => {
    expect(mapApplication(application).phone).toBe('5521999998888')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// mapApplication — manualCandidate
// ──────────────────────────────────────────────────────────────────────────────

describe('mapApplication — manualCandidate (sem candidate)', () => {
  const application: GupyApplication = {
    id: 22222,
    status: 'in_process',
    currentStep: { name: 'Documentação' },
    candidate: undefined,
    manualCandidate: {
      name: 'Carlos',
      lastName: 'Mendes',
      mobileNumber: '+5531988887777',
      addressCity: 'Belo Horizonte',
    },
  }

  it('usa manualCandidate quando candidate é undefined', () => {
    expect(mapApplication(application).name).toBe('Carlos Mendes')
  })
  it('normaliza telefone do manualCandidate', () => {
    expect(mapApplication(application).phone).toBe('5531988887777')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// mapApplication — sem celular
// ──────────────────────────────────────────────────────────────────────────────

describe('mapApplication — sem celular', () => {
  const application: GupyApplication = {
    id: 33333,
    status: 'in_process',
    currentStep: { name: 'Triagem' },
    candidate: {
      name: 'Maria',
      lastName: 'Oliveira',
      addressCity: 'Curitiba',
      // mobileNumber ausente
    },
  }

  it('retorna phone = null', () => {
    expect(mapApplication(application).phone).toBeNull()
  })
  it('retorna hasPhone = false', () => {
    expect(mapApplication(application).hasPhone).toBe(false)
  })
  it('ainda retorna nome e cidade', () => {
    const m = mapApplication(application)
    expect(m.name).toBe('Maria Oliveira')
    expect(m.city).toBe('Curitiba')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// extractNomeCurto
// ──────────────────────────────────────────────────────────────────────────────

describe('extractNomeCurto', () => {
  it('extrai tudo antes do primeiro " - "', () => {
    expect(extractNomeCurto('Assistente de Atendimento - Vaga exclusiva para PcD - Presidente Vargas'))
      .toBe('Assistente de Atendimento')
  })
  it('retorna o nome completo quando não há " - "', () => {
    expect(extractNomeCurto('Recepcionista')).toBe('Recepcionista')
  })
  it('remove espaços extras', () => {
    expect(extractNomeCurto('  Atendente  - São Paulo  ')).toBe('Atendente')
  })
  it('funciona com string vazia', () => {
    expect(extractNomeCurto('')).toBe('')
  })
  it('preserva múltiplos " - ": usa apenas o primeiro', () => {
    expect(extractNomeCurto('Cargo A - B - C')).toBe('Cargo A')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// extractUnidade
// ──────────────────────────────────────────────────────────────────────────────

describe('extractUnidade', () => {
  it('remove prefixo "SELFIT > N - UNIDADE " e converte para Title Case', () => {
    expect(extractUnidade('SELFIT > 60 - UNIDADE PRESIDENTE VARGAS'))
      .toBe('Presidente Vargas')
  })
  it('funciona com número de dois dígitos', () => {
    expect(extractUnidade('SELFIT > 5 - UNIDADE CRISTO REI'))
      .toBe('Cristo Rei')
  })
  it('case-insensitive no prefixo', () => {
    expect(extractUnidade('selfit > 12 - unidade bela vista'))
      .toBe('Bela Vista')
  })
  it('retorna null para string vazia', () => {
    expect(extractUnidade('')).toBeNull()
    expect(extractUnidade(null)).toBeNull()
    expect(extractUnidade(undefined)).toBeNull()
  })
  it('retorna o nome em Title Case quando não há prefixo SELFIT', () => {
    expect(extractUnidade('MOOCA')).toBe('Mooca')
  })
  it('faz Title Case de múltiplas palavras', () => {
    expect(extractUnidade('SELFIT > 99 - UNIDADE SANTO ANDRE')).toBe('Santo Andre')
  })
})
