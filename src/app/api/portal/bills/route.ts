import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPortalSession } from '../me/route'

// GET /api/portal/bills — patient's bills
export async function GET(req: NextRequest) {
  const session = await getPortalSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bills = await db.bill.findMany({
    where: { patientId: session.patientId, status: { not: 'cancelled' } },
    orderBy: { createdAt: 'desc' },
    include: {
      order: { include: { doctor: true, orderTests: { include: { test: true } } } },
      payments: true,
    },
  })

  return NextResponse.json({ bills })
}
