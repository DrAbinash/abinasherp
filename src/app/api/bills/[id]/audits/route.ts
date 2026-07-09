import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/bills/:id/audits — full audit trail for a bill
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const audits = await db.billAudit.findMany({
    where: { billId: id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ audits })
}
