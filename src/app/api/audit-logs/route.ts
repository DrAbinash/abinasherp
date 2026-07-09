import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '100')

  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json({ logs })
}
