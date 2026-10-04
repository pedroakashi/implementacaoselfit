import { NextRequest, NextResponse } from 'next/server'

/** Verifica o header x-admin-secret. Retorna null se OK, NextResponse 401 se não. */
export function requireAdminSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'ADMIN_SECRET não configurado' }, { status: 500 })
  }
  const incoming = req.headers.get('x-admin-secret') ?? ''
  if (incoming !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
