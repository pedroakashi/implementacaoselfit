// Mapeamento puro: candidatura Gupy → campos do model Candidate
import type { GupyApplication } from './gupy'

/**
 * Extrai o nome curto da vaga: tudo antes do primeiro " - ".
 * Ex.: "Assistente de Atendimento - Vaga exclusiva para PcD" → "Assistente de Atendimento"
 */
export function extractNomeCurto(fullName: string): string {
  const idx = fullName.indexOf(' - ')
  return (idx !== -1 ? fullName.slice(0, idx) : fullName).trim()
}

/**
 * Extrai o nome da unidade a partir do branchName da Gupy.
 * Remove o prefixo "SELFIT > N - UNIDADE " e converte para Title Case.
 * Ex.: "SELFIT > 60 - UNIDADE PRESIDENTE VARGAS" → "Presidente Vargas"
 */
export function extractUnidade(branchName: string | null | undefined): string | null {
  if (!branchName?.trim()) return null
  const cleaned = branchName.replace(/^SELFIT\s*>\s*\d+\s*-\s*UNIDADE\s+/i, '').trim()
  if (!cleaned) return null
  return cleaned.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
}

export interface MappedCandidate {
  gupyApplicationId: string
  name: string
  phone: string | null
  hasPhone: boolean
  city: string | null
  stage: string
}

/**
 * Normaliza um número de telefone para E.164 sem o "+".
 * A Gupy pode enviar "+5511912345678" ou "5511912345678".
 * Retorna null se o número não tiver ao menos 8 dígitos.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  // Mínimo 8 dígitos para ser válido
  if (digits.length < 8) return null
  return digits
}

export function mapApplication(application: GupyApplication): MappedCandidate {
  // Preferir candidate; fallback para manualCandidate
  const person = application.candidate ?? application.manualCandidate

  const firstName = person?.name?.trim() ?? ''
  const lastName  = person?.lastName?.trim() ?? ''
  const name      = [firstName, lastName].filter(Boolean).join(' ') || 'Sem nome'

  const phone   = normalizePhone(person?.mobileNumber)
  const hasPhone = phone !== null
  const city    = person?.addressCity?.trim() || null
  const stage   = application.currentStep?.name?.trim() || 'Triagem'

  return {
    gupyApplicationId: String(application.id),
    name,
    phone,
    hasPhone,
    city,
    stage,
  }
}
