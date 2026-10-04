import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    isTestMode: !!process.env.TEST_OVERRIDE_PHONE,
    testPhone: process.env.TEST_OVERRIDE_PHONE || null,
  })
}
