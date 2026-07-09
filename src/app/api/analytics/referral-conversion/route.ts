import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doctors = await db.doctor.findMany({
    where: { isActive: true },
    include: {
      orders: {
        include: {
          patient: true,
          bills: { where: { status: { not: 'cancelled' } } },
        },
      },
      payouts: { select: { amount: true, createdAt: true } },
    },
  })

  const result = doctors.map((doc) => {
    const referredPatientIds = new Set<string>()
    for (const o of doc.orders) referredPatientIds.add(o.patientId)

    const visitedPatientIds = new Set<string>()
    let revenueFromReferred = 0
    for (const o of doc.orders) {
      if (o.bills.length > 0) {
        visitedPatientIds.add(o.patientId)
        revenueFromReferred += o.bills.reduce((s, b) => s + b.paidAmount, 0)
      }
    }

    const totalReferred = referredPatientIds.size
    const totalVisited = visitedPatientIds.size
    const conversionRate = totalReferred > 0 ? (totalVisited / totalReferred) * 100 : 0
    const commissionPaid = doc.payouts.reduce((s, p) => s + p.amount, 0)

    return {
      doctorId: doc.id,
      name: doc.name,
      specialization: doc.specialization,
      hospitalAffiliation: doc.hospitalAffiliation,
      area: doc.area,
      patientsReferred: totalReferred,
      patientsVisited: totalVisited,
      conversionRate,
      revenueFromReferred,
      commissionPaid,
      totalOrders: doc.orders.length,
    }
  })

  result.sort((a, b) => b.patientsReferred - a.patientsReferred)

  const totals = {
    doctors: result.length,
    totalReferred: result.reduce((s, r) => s + r.patientsReferred, 0),
    totalVisited: result.reduce((s, r) => s + r.patientsVisited, 0),
    overallConversionRate: 0,
    totalRevenue: result.reduce((s, r) => s + r.revenueFromReferred, 0),
    totalCommission: result.reduce((s, r) => s + r.commissionPaid, 0),
  }
  totals.overallConversionRate = totals.totalReferred > 0 ? (totals.totalVisited / totals.totalReferred) * 100 : 0

  return NextResponse.json({ doctors: result, totals })
}
