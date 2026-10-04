import { NextRequest, NextResponse } from 'next/server'
import { listApprovedTemplates } from '@/lib/infobip'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'

  try {
    const data = await listApprovedTemplates(forceRefresh)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { httpStatus?: number; message?: string }
    if (e.httpStatus === 401 || e.httpStatus === 403) {
      return NextResponse.json(
        {
          error:
            'A API key da Infobip não tem permissão para listar templates — ' +
            'gere uma key com escopo de gerenciamento de templates do WhatsApp.',
        },
        { status: 403 }
      )
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
