import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPortalSession } from '../me/route'

// GET /api/portal/reports — patient's lab reports
export async function GET(req: NextRequest) {
  const session = await getPortalSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reports = await db.patientReport.findMany({
    where: { patientId: session.patientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, reportNumber: true, testName: true, status: true,
      deliveryMethod: true, createdAt: true, deliveredAt: true,
      impression: true,
    },
  })

  // Only show approved/delivered reports to patients
  const visibleReports = reports.filter((r) => r.status === 'approved' || r.status === 'delivered')

  return NextResponse.json({ reports: visibleReports })
}
