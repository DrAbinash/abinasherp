import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { token } = body
  if (token) {
    await db.superAdminSession.updateMany({
      where: { token },
      data: { isActive: false },
    })
  }
  return NextResponse.json({ ok: true })
}
