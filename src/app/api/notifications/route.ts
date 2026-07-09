import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/notifications — list notification history
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const channel = searchParams.get('channel') || ''
  const status = searchParams.get('status') || ''

  const where: Record<string, unknown> = {}
  if (channel) where.channel = channel
  if (status) where.status = status

  const notifications = await db.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ notifications })
}
