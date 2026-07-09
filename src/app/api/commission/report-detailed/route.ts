import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { calcTestCommission, applyDiscountDeduction } from '@/lib/auth'

// Detailed test-level commission rows
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const groupBy = searchParams.get('groupBy') || 'test' // test | category | order
  const doctorId = searchParams.get('doctorId') || ''

  const clinic = await db.clinic.findFirst()
  const commissionDiscountMode = clinic?.commissionDiscountMode || 'none'

  const billWhere: any = { status: { in: ['paid', 'partial'] } }
  if (from || to) {
    billWhere.createdAt = {}
    if (from) billWhere.createdAt.gte = new Date(from + 'T00:00:00+05:30')
    if (to) billWhere.createdAt.lte = new Date(to + 'T23:59:59+05:30')
  }
  if (doctorId) {
    billWhere.order = { doctorId }
  }

  const bills = await db.bill.findMany({
    where: billWhere,
    include: {
      patient: true,
      order: {
        include: {
          doctor: { include: { commissionRules: true } },
          orderTests: { include: { test: { include: { category: true } } } },
        },
      },
    },
  })

  const rows: Array<Record<string, unknown>> = []
  for (const bill of bills) {
    const doctor = bill.order.doctor
    if (!doctor) continue
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
      rows.push({
        billNumber: bill.billNumber,
        billDate: bill.createdAt,
        patientName: bill.patient.name,
        doctorName: doctor.name,
        testCode: ot.test.code,
        testName: ot.test.name,
        category: ot.test.category?.name || '',
        price: ot.price,
        commission: c,
        groupKey: groupBy === 'test' ? ot.test.name : groupBy === 'category' ? (ot.test.category?.name || 'Uncategorized') : bill.billNumber,
      })
    }
    const effective = applyDiscountDeduction(rawCommission, bill.discount, commissionDiscountMode)
    // Spread discount deduction proportionally across rows (informational)
    if (effective !== rawCommission && rawCommission > 0) {
      const ratio = effective / rawCommission
      for (const r of rows) {
        if (r.billNumber === bill.billNumber) {
          r.commission = (r.commission as number) * ratio
        }
      }
    }
  }

  // Aggregate by group
  const grouped: Record<string, { groupKey: string; doctorName: string; testCount: number; totalRevenue: number; totalCommission: number }> = {}
  for (const r of rows) {
    const k = `${r.doctorName}__${r.groupKey}`
    if (!grouped[k]) {
      grouped[k] = { groupKey: r.groupKey as string, doctorName: r.doctorName as string, testCount: 0, totalRevenue: 0, totalCommission: 0 }
    }
    grouped[k].testCount += 1
    grouped[k].totalRevenue += r.price as number
    grouped[k].totalCommission += r.commission as number
  }

  return NextResponse.json({
    rows,
    grouped: Object.values(grouped),
    grandTotal: {
      tests: rows.length,
      revenue: rows.reduce((s, r) => s + (r.price as number), 0),
      commission: rows.reduce((s, r) => s + (r.commission as number), 0),
    },
  })
}
