import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/corporates/aging — aging report (outstanding by corporate, 0-30/31-60/61-90/90+ days)
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const corporates = await db.corporate.findMany({
    where: { isActive: true },
    include: {
      invoices: { where: { status: { in: ['raised', 'partial', 'overdue'] } } },
    },
  })

  const today = new Date()
  const aging = corporates.map((c) => {
    let bucket030 = 0, bucket3160 = 0, bucket6190 = 0, bucket90Plus = 0
    let totalOutstanding = 0

    for (const inv of c.invoices) {
      const outstanding = inv.totalAmount - inv.paidAmount
      if (outstanding <= 0) continue
      totalOutstanding += outstanding

      const dueDate = new Date(inv.dueDate)
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysOverdue <= 30) bucket030 += outstanding
      else if (daysOverdue <= 60) bucket3160 += outstanding
      else if (daysOverdue <= 90) bucket6190 += outstanding
      else bucket90Plus += outstanding
    }

    return {
      corporateId: c.corporateId,
      corporateName: c.name,
      type: c.type,
      creditTermsDays: c.creditTermsDays,
      totalOutstanding,
      bucket030,
      bucket3160,
      bucket6190,
      bucket90Plus,
      invoiceCount: c.invoices.length,
    }
  }).filter((a) => a.totalOutstanding > 0)

  const totals = {
    corporates: aging.length,
    totalOutstanding: aging.reduce((s, a) => s + a.totalOutstanding, 0),
    bucket030: aging.reduce((s, a) => s + a.bucket030, 0),
    bucket3160: aging.reduce((s, a) => s + a.bucket3160, 0),
    bucket6190: aging.reduce((s, a) => s + a.bucket6190, 0),
    bucket90Plus: aging.reduce((s, a) => s + a.bucket90Plus, 0),
  }

  return NextResponse.json({ aging, totals })
}
