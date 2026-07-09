import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { calcTestCommission, applyDiscountDeduction } from '@/lib/auth'

// Consolidated per-doctor commission report
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''

  const clinic = await db.clinic.findFirst()
  const commissionDiscountMode = clinic?.commissionDiscountMode || 'none'

  // Get all paid/completed bills in window
  const billWhere: any = { status: { in: ['paid', 'partial'] } }
  if (from || to) {
    billWhere.createdAt = {}
    if (from) billWhere.createdAt.gte = new Date(from + 'T00:00:00+05:30')
    if (to) billWhere.createdAt.lte = new Date(to + 'T23:59:59+05:30')
  }

  const bills = await db.bill.findMany({
    where: billWhere,
    include: {
      order: {
        include: {
          doctor: { include: { commissionRules: true } },
          orderTests: { include: { test: { include: { category: true } } } },
        },
      },
    },
  })

  // Group by doctor
  const byDoctor = new Map<string, {
    doctor: any
    orderCount: number
    testCount: number
    totalRevenue: number
    totalCommission: number
    totalDiscountDeducted: number
  }>()

  for (const bill of bills) {
    const doctor = bill.order.doctor
    if (!doctor) continue // walk-in

    if (!byDoctor.has(doctor.id)) {
      byDoctor.set(doctor.id, {
        doctor,
        orderCount: 0,
        testCount: 0,
        totalRevenue: 0,
        totalCommission: 0,
        totalDiscountDeducted: 0,
      })
    }
    const entry = byDoctor.get(doctor.id)!
    entry.orderCount += 1

    // Calc commission per active test
    let rawCommission = 0
    for (const ot of bill.order.orderTests) {
      if (ot.status === 'cancelled') continue
      const testCategories = ot.test.category ? [ot.test.category.name] : []
      const c = calcTestCommission(
        ot.price,
        testCategories,
        ot.testId,
        doctor.commissionRules,
        { type: doctor.defaultCommissionType, value: doctor.defaultCommission },
      )
      rawCommission += c
      entry.testCount += 1
      entry.totalRevenue += ot.price
    }

    const effectiveCommission = applyDiscountDeduction(rawCommission, bill.discount, commissionDiscountMode)
    entry.totalCommission += effectiveCommission
    entry.totalDiscountDeducted += (rawCommission - effectiveCommission)
  }

  const report = Array.from(byDoctor.values()).map((e) => ({
    doctor: {
      id: e.doctor.id,
      name: e.doctor.name,
      specialization: e.doctor.specialization,
      defaultCommission: e.doctor.defaultCommission,
      defaultCommissionType: e.doctor.defaultCommissionType,
    },
    orderCount: e.orderCount,
    testCount: e.testCount,
    totalRevenue: e.totalRevenue,
    totalCommission: e.totalCommission,
    totalDiscountDeducted: e.totalDiscountDeducted,
    commissionDiscountMode,
    effectiveRate: e.totalRevenue > 0 ? (e.totalCommission / e.totalRevenue) * 100 : 0,
  }))

  const grandTotal = {
    doctors: report.length,
    orders: report.reduce((s, r) => s + r.orderCount, 0),
    revenue: report.reduce((s, r) => s + r.totalRevenue, 0),
    commission: report.reduce((s, r) => s + r.totalCommission, 0),
    totalDiscountDeducted: report.reduce((s, r) => s + r.totalDiscountDeducted, 0),
  }

  return NextResponse.json({ report, grandTotal })
}
