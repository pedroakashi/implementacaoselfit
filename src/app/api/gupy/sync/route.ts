import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSecret } from '@/lib/auth'
import { listJobs, listApplications } from '@/lib/gupy'
import { mapApplication, extractNomeCurto, extractUnidade } from '@/lib/gupy-mapper'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const authErr = requireAdminSecret(req)
  if (authErr) return authErr

  let body: { jobId: string | number; currentStepName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { jobId, currentStepName } = body
  if (!jobId) return NextResponse.json({ error: 'jobId é obrigatório' }, { status: 400 })

  // Buscar dados reais da vaga na Gupy
  const jobData = await listJobs({ id: Number(jobId), perPage: 1, fields: 'id,name,status,branchId,branchName,numVacancies' })
  const gupyJob = jobData.results[0]

  const title     = gupyJob?.name ?? `Vaga Gupy #${jobId}`
  const location  = gupyJob?.branchName ?? gupyJob?.city ?? ''
  const openings  = gupyJob?.numVacancies ?? 1
  const nomeCurto = extractNomeCurto(title)
  const unidade   = extractUnidade(gupyJob?.branchName)

  // Upsert da vaga — atualiza title/location/nomeCurto/unidade se já existir
  const vaga = await prisma.vaga.upsert({
    where:  { gupyJobId: String(jobId) },
    update: { title, location, openings, nomeCurto, unidade },
    create: { title, location, openings, nomeCurto, unidade, gupyJobId: String(jobId) },
  })

  let importados  = 0
  let atualizados = 0
  let semTelefone = 0

  let page = 1
  const perPage = 100

  while (true) {
    const res = await listApplications(jobId, {
      page,
      perPage,
      status: 'in_process',
      ...(currentStepName ? { currentStepName } : {}),
    })

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
            name:     mapped.name,
            phone:    mapped.phone,
            hasPhone: mapped.hasPhone,
            city:     mapped.city,
            stage:    mapped.stage,
            source:   'gupy_api',
            gupyUpdatedAt: new Date(),
          },
        })
        atualizados++
      } else {
        await prisma.candidate.create({
          data: {
            ...mapped,
            vagaId:        vaga.id,
            source:        'gupy_api',
            contactStatus: 'not_contacted',
            gupyUpdatedAt: new Date(),
          },
        })
        importados++
      }
    }

    if (page >= res.totalPages) break
    page++
  }

  // Contar ignorados por status para relatório
  const [giveUpRes, reprovedRes, hiredRes] = await Promise.all([
    listApplications(jobId, { page: 1, perPage: 1, status: 'give_up' }),
    listApplications(jobId, { page: 1, perPage: 1, status: 'reproved' }),
    listApplications(jobId, { page: 1, perPage: 1, status: 'hired' }),
  ])
  const ignoradosPorStatus = giveUpRes.totalResults + reprovedRes.totalResults + hiredRes.totalResults

  return new NextResponse(
    JSON.stringify({ importados, atualizados, semTelefone, ignoradosPorStatus, vagaId: vaga.id }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  )
}
