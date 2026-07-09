import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { token } = body
  if (!token) return NextResponse.json({ active: false, userName: null })

  const sa = await db.superAdminSession.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!sa || !sa.isActive) return NextResponse.json({ active: false, userName: null })
  if (sa.expiresAt < new Date()) {
    await db.superAdminSession.update({ where: { id: sa.id }, data: { isActive: false } })
    return NextResponse.json({ active: false, userName: null })
  }
  if (!sa.user.isActive) return NextResponse.json({ active: false, userName: null })

  return NextResponse.json({
    active: true,
    userName: sa.user.name,
    expiresAt: sa.expiresAt.toISOString(),
  })
}
