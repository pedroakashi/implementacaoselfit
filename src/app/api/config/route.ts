import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    isTestMode: !!process.env.TEST_OVERRIDE_PHONE,
    testPhone: process.env.TEST_OVERRIDE_PHONE || null,
  })
}
