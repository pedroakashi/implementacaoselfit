// Client da API Gupy — base: https://api.gupy.io/api/v1

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val?.trim()) throw new Error(`[Gupy] Variável obrigatória ausente: ${name}`)
  return val.trim()
}

function getToken(): string {
  return requireEnv('GUPY_API_TOKEN')
}

const BASE = 'https://api.gupy.io/api/v1'

// ──────────────────────────────────────────────
// Tipos da API
// ──────────────────────────────────────────────

export interface GupyJob {
  id: number
  name: string
  status: string
  branchId?: number
  branchName?: string
  departmentId?: number
  departmentName?: string
  cityId?: number
  city?: string
  state?: string
  numVacancies?: number
  publishedAt?: string
  createdAt?: string
  updatedAt?: string
}

export type ApplicationStatus = 'in_process' | 'give_up' | 'reproved' | 'hired'

export interface GupyApplicationCandidate {
  name: string
  lastName: string
  email?: string
  mobileNumber?: string
  addressCity?: string
}

export interface GupyApplication {
  id: number
  jobId?: number
  status: ApplicationStatus
  currentStep?: { name: string }
  candidate?: GupyApplicationCandidate
  manualCandidate?: GupyApplicationCandidate
  createdAt?: string
  updatedAt?: string
}

export interface GupyPaginatedResponse<T> {
  results: T[]
  totalResults: number
  page: number
  totalPages: number
}

export interface GupyWebhook {
  id: string
  action: string
  postbackUrl: string
  status: string
  techOwnerName?: string
  techOwnerEmail?: string
}

// ──────────────────────────────────────────────
// Helper HTTP com retry em 429
// ──────────────────────────────────────────────

async function gupyFetch(
  path: string,
  options: RequestInit = {},
  attempt = 1
): Promise<Response> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  })

  if (res.status === 429 && attempt <= 3) {
    const resetHeader = res.headers.get('X-RateLimit-Reset')
    const resetMs = resetHeader ? parseInt(resetHeader) * 1000 - Date.now() : 1000
    const delay = Math.max(resetMs, 500)
    await new Promise((r) => setTimeout(r, delay))
    return gupyFetch(path, options, attempt + 1)
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `[Gupy] Token sem permissão para ${path} (HTTP ${res.status}). ` +
        'Verifique os escopos do GUPY_API_TOKEN no painel da Gupy.'
    )
  }

  return res
}

async function gupyJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await gupyFetch(path, options)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[Gupy] HTTP ${res.status} em ${path}: ${body}`)
  }
  return res.json() as Promise<T>
}

// ──────────────────────────────────────────────
// Endpoints
// ──────────────────────────────────────────────

export async function listJobs(params: {
  page?: number
  perPage?: number
  status?: string | string[]
  name?: string
  id?: number
  fields?: string
} = {}): Promise<GupyPaginatedResponse<GupyJob>> {
  const qs = new URLSearchParams()
  if (params.page)    qs.set('page',    String(params.page))
  if (params.perPage) qs.set('perPage', String(params.perPage))
  if (params.name)    qs.set('name',    params.name)
  if (params.id)      qs.set('id',      String(params.id))
  if (params.fields)  qs.set('fields',  params.fields)
  const statuses = params.status
    ? (Array.isArray(params.status) ? params.status : [params.status])
    : []
  statuses.forEach((s) => qs.append('status', s))
  return gupyJson<GupyPaginatedResponse<GupyJob>>(`/jobs?${qs}`)
}

// addressCity não vem nos campos padrão da listagem — solicitar explicitamente
const APPLICATION_FIELDS =
  'id,status,currentStep.name,' +
  'candidate.name,candidate.lastName,candidate.mobileNumber,candidate.addressCity,' +
  'manualCandidate.name,manualCandidate.lastName,manualCandidate.mobileNumber'

export async function listApplications(
  jobId: string | number,
  params: {
    page?: number
    perPage?: number
    status?: ApplicationStatus
    currentStepName?: string
    fields?: string
  } = {}
): Promise<GupyPaginatedResponse<GupyApplication>> {
  const qs = new URLSearchParams()
  if (params.page)            qs.set('page',             String(params.page))
  if (params.perPage)         qs.set('perPage',          String(params.perPage))
  if (params.status)          qs.set('status',           params.status)
  if (params.currentStepName) qs.set('currentStep.name', params.currentStepName)
  qs.set('fields', params.fields ?? APPLICATION_FIELDS)
  return gupyJson<GupyPaginatedResponse<GupyApplication>>(`/jobs/${jobId}/applications?${qs}`)
}

export async function listWebhooks(): Promise<GupyWebhook[]> {
  return gupyJson<GupyWebhook[]>('/webhooks')
}

export async function createWebhook(data: {
  action: string
  postbackUrl: string
  clientHeaders?: Record<string, string>
  techOwnerName: string
  techOwnerEmail: string
  status?: string
}): Promise<GupyWebhook> {
  return gupyJson<GupyWebhook>('/webhooks', {
    method: 'POST',
    body: JSON.stringify({ status: 'active', ...data }),
  })
}

export async function deleteWebhook(id: string): Promise<void> {
  const res = await gupyFetch(`/webhooks/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    const body = await res.text()
    throw new Error(`[Gupy] Erro ao deletar webhook ${id} (HTTP ${res.status}): ${body}`)
  }
}

export async function tagApplication(
  applicationId: string | number,
  tagId: string | number
): Promise<void> {
  const res = await gupyFetch(`/applications/${applicationId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tagId }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[Gupy] Erro ao taguear candidatura ${applicationId}: ${body}`)
  }
}
