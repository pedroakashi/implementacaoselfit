import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSecret } from '@/lib/auth'
import { listJobs } from '@/lib/gupy'

const FIELDS = 'id,name,status,branchId,branchName,numVacancies,publishedAt,createdAt'
const PER_PAGE = 20

export async function GET(req: NextRequest) {
  const authErr = requireAdminSecret(req)
  if (authErr) return authErr

  const sp = req.nextUrl.searchParams
  const uiPage   = parseInt(sp.get('page') ?? '1', 10)
  const name     = sp.get('name') ?? ''
  const showAll  = sp.get('showAll') === 'true'

  const statuses = showAll
    ? ['published', 'frozen', 'closed', 'draft', 'waiting_approval', 'approved']
    : ['published']

  // Quando há busca por nome, paginação direta (não sabemos o total a priori)
  if (name) {
    const data = await listJobs({
      name,
      status: statuses,
      page: uiPage,
      perPage: PER_PAGE,
      fields: FIELDS,
    })
    return json({ ...data, uiPage, reversed: false })
  }

  // Sem busca: paginação reversa para mostrar mais recentes primeiro
  // 1. Call rápido com perPage=1 para obter totalResults; calcular totalPages com PER_PAGE real
  const probe = await listJobs({ status: statuses, page: 1, perPage: 1 })
  const totalGupyPages = Math.max(1, Math.ceil(probe.totalResults / PER_PAGE))

  // Mapeia: uiPage 1 → gupyPage = totalGupyPages, uiPage 2 → totalGupyPages-1, ...
  const gupyPage = Math.max(1, totalGupyPages - uiPage + 1)

  const data = await listJobs({
    status: statuses,
    page: gupyPage,
    perPage: PER_PAGE,
    fields: FIELDS,
  })

  // Inverter resultados para mostrar mais recentes primeiro dentro da página
  const results = [...data.results].reverse()

  return json({
    results,
    totalResults: data.totalResults,
    totalPages: totalGupyPages,
    page: uiPage,
    uiPage,
    reversed: true,
  })
}

function json(data: unknown) {
  return new NextResponse(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
