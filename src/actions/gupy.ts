'use server'

import { listJobs, listApplications } from '@/lib/gupy'
import { mapApplication, extractNomeCurto, extractUnidade } from '@/lib/gupy-mapper'
import { prisma } from '@/lib/db'
import type { GupyJob, GupyPaginatedResponse } from '@/lib/gupy'

const PER_PAGE = 20
const FIELDS = 'id,name,status,branchId,branchName,numVacancies,publishedAt,createdAt'

// ──────────────────────────────────────────────
// Cache em memória (5 min) para evitar varredura
// total ao aplicar filtro de data
// ──────────────────────────────────────────────
const _cache = new Map<string, { jobs: GupyJob[]; exp: number }>()

async function fetchAllJobsCached(statuses: string[]): Promise<GupyJob[]> {
  const key = [...statuses].sort().join(',')
  const hit = _cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.jobs

  const all: GupyJob[] = []
  let page = 1
  while (true) {
    const data = await listJobs({ status: statuses, page, perPage: 100, fields: FIELDS })
    all.push(...data.results)
    if (page >= data.totalPages) break
    page++
  }
  _cache.set(key, { jobs: all, exp: Date.now() + 5 * 60_000 })
  return all
}

// ──────────────────────────────────────────────
// fetchGupyJobsAction
// ──────────────────────────────────────────────

export interface FetchJobsParams {
  page?: number
  name?: string
  showAll?: boolean
  dateFrom?: string   // "YYYY-MM-DD"
  dateTo?: string     // "YYYY-MM-DD"
}

export interface FetchJobsResult {
  results: GupyJob[]
  totalPages: number
  uiPage: number
  reversed: boolean
}

export async function fetchGupyJobsAction(params: FetchJobsParams): Promise<FetchJobsResult> {
  const { page = 1, name = '', showAll = false, dateFrom, dateTo } = params

  const statuses = showAll
    ? ['published', 'frozen', 'closed', 'draft', 'waiting_approval', 'approved']
    : ['published']

  const from = dateFrom ? new Date(dateFrom) : null
  const to   = dateTo   ? new Date(dateTo + 'T23:59:59.999Z') : null

  // ── Com filtro de data: busca tudo em cache e filtra client-side ──
  if (from || to) {
    const allJobs = await fetchAllJobsCached(statuses)

    let filtered = allJobs.filter((job) => {
      // Usar createdAt como referência; fallback publishedAt
      const raw = job.createdAt ?? job.publishedAt ?? ''
      const date = new Date(raw)
      if (isNaN(date.getTime())) return true
      if (from && date < from) return false
      if (to   && date > to)   return false
      return true
    })

    // Filtro por nome (se houver) sobre o subconjunto já filtrado
    if (name) {
      const q = name.toLowerCase()
      filtered = filtered.filter((j) => j.name.toLowerCase().includes(q))
    }

    // Mais recentes primeiro (o array original vem da paginação forward = mais antigo primeiro)
    const sorted = [...filtered].reverse()
    const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
    const start = (page - 1) * PER_PAGE
    return {
      results: sorted.slice(start, start + PER_PAGE),
      totalPages,
      uiPage: page,
      reversed: true,
    }
  }

  // ── Com busca por nome: paginação direta ──
  if (name) {
    const data = await listJobs({ name, status: statuses, page, perPage: PER_PAGE, fields: FIELDS })
    return { results: data.results, totalPages: data.totalPages, uiPage: page, reversed: false }
  }

  // ── Sem filtros: paginação reversa (mais recentes primeiro) ──
  const probe = await listJobs({ status: statuses, page: 1, perPage: 1 })
  // Calcular totalPages com base em PER_PAGE (probe.totalPages usa perPage=1, dando totalResults)
  const totalGupyPages = Math.max(1, Math.ceil(probe.totalResults / PER_PAGE))
  const gupyPage = Math.max(1, totalGupyPages - page + 1)

  const data = await listJobs({ status: statuses, page: gupyPage, perPage: PER_PAGE, fields: FIELDS })
  return {
    results: [...data.results].reverse(),
    totalPages: totalGupyPages,
    uiPage: page,
    reversed: true,
  }
}

// ──────────────────────────────────────────────
// syncGupyJobAction
// ──────────────────────────────────────────────

export interface SyncResult {
  importados: number
  atualizados: number
  semTelefone: number
  ignoradosPorStatus: number
  vagaId: string
}

export async function syncGupyJobAction(jobId: string | number): Promise<SyncResult> {
  const jobData = await listJobs({ id: Number(jobId), perPage: 1, fields: FIELDS })
  const gupyJob = jobData.results[0]

  const title     = gupyJob?.name ?? `Vaga Gupy #${jobId}`
  const location  = gupyJob?.branchName ?? gupyJob?.city ?? ''
  const openings  = gupyJob?.numVacancies ?? 1
  const nomeCurto = extractNomeCurto(title)
  const unidade   = extractUnidade(gupyJob?.branchName)

  const vaga = await prisma.vaga.upsert({
    where:  { gupyJobId: String(jobId) },
    update: { title, location, openings, nomeCurto, unidade },
    create: { title, location, openings, nomeCurto, unidade, gupyJobId: String(jobId) },
  })

  let importados  = 0
  let atualizados = 0
  let semTelefone = 0
  let page = 1

  // Importar apenas candidatos em processo (recrutáveis)
  while (true) {
    const res = await listApplications(jobId, { page, perPage: 100, status: 'in_process' })

    for (const application of res.results) {
      const mapped = mapApplication(application)
      if (!mapped.hasPhone) semTelefone++

      const existing = await prisma.candidate.findUnique({
        where: { gupyApplicationId: mapped.gupyApplicationId },
      })

      if (existing) {
        await prisma.candidate.update({
          where: { id: existing.id },
          data: {
            name: mapped.name, phone: mapped.phone, hasPhone: mapped.hasPhone,
            city: mapped.city, stage: mapped.stage, source: 'gupy_api',
            gupyUpdatedAt: new Date(),
          },
        })
        atualizados++
      } else {
        await prisma.candidate.create({
          data: {
            ...mapped, vagaId: vaga.id, source: 'gupy_api',
            contactStatus: 'not_contacted', gupyUpdatedAt: new Date(),
          },
        })
        importados++
      }
    }

    if (page >= res.totalPages) break
    page++
  }

  // Contar candidatos ignorados (outros status) para informação
  const [giveUpRes, reprovedRes, hiredRes] = await Promise.all([
    listApplications(jobId, { page: 1, perPage: 1, status: 'give_up' }),
    listApplications(jobId, { page: 1, perPage: 1, status: 'reproved' }),
    listApplications(jobId, { page: 1, perPage: 1, status: 'hired' }),
  ])
  const ignoradosPorStatus = giveUpRes.totalResults + reprovedRes.totalResults + hiredRes.totalResults

  return { importados, atualizados, semTelefone, ignoradosPorStatus, vagaId: vaga.id }
}

export async function resyncVagaAction(gupyJobId: string): Promise<SyncResult> {
  return syncGupyJobAction(gupyJobId)
}
