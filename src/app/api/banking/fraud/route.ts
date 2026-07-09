import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const alerts = await db.fraudAlert.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  })
  return NextResponse.json({ alerts })
}
