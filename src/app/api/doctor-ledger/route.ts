import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { calcTestCommission, applyDiscountDeduction } from '@/lib/auth'

// GET /api/doctor-ledger — summary table per doctor (earned, paid, due)
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''

  const clinic = await db.clinic.findFirst()
  const commissionDiscountMode = clinic?.commissionDiscountMode || 'none'

  // Push the date window into the DB query instead of filtering in JS.
  const billCreatedAt: { gte?: Date; lte?: Date } = {}
  if (from) billCreatedAt.gte = new Date(from + 'T00:00:00+05:30')
  if (to) billCreatedAt.lte = new Date(to + 'T23:59:59+05:30')
  const billWhere: Record<string, unknown> = { status: { in: ['paid', 'partial'] } }
  if (from || to) billWhere.createdAt = billCreatedAt

  const doctors = await db.doctor.findMany({
    include: {
      commissionRules: true,
      orders: {
        where: { status: { not: 'cancelled' } },
        include: {
          orderTests: { include: { test: { include: { category: true } } } },
          bills: {
            where: billWhere,
          },
        },
      },
      payouts: true,
    },
  })

  const summary = doctors.map((d) => {
    let earnedWindow = 0
    let earnedLifetime = 0
    let revenueWindow = 0
    let revenueLifetime = 0
    let orderCount = 0

    for (const order of d.orders) {
      for (const bill of order.bills) {
        const inWindow = (!from || bill.createdAt >= new Date(from + 'T00:00:00+05:30')) &&
                          (!to || bill.createdAt <= new Date(to + 'T23:59:59+05:30'))
        let raw = 0
        for (const ot of order.orderTests) {
          if (ot.status === 'cancelled') continue
          const testCategories = ot.test.category ? [ot.test.category.name] : []
          raw += calcTestCommission(
            ot.price,
            testCategories,
            ot.testId,
            d.commissionRules,
            { type: d.defaultCommissionType, value: d.defaultCommission },
          )
          if (inWindow) revenueWindow += ot.price
          revenueLifetime += ot.price
        }
        const eff = applyDiscountDeduction(raw, bill.discount, commissionDiscountMode)
        earnedLifetime += eff
        if (inWindow) {
          earnedWindow += eff
          orderCount += 1
        }
      }
    }

    const paidWindow = d.payouts
      .filter((p) => (!from || p.paymentDate >= from) && (!to || p.paymentDate <= to))
      .reduce((s, p) => s + p.amount, 0)
    const paidLifetime = d.payouts.reduce((s, p) => s + p.amount, 0)

    return {
      doctorId: d.id,
      doctorName: d.name,
      specialization: d.specialization,
      phone: d.phone,
      email: d.email,
      orderCount,
      revenueWindow,
      earnedWindow,
      paidWindow,
      dueWindow: earnedWindow - paidWindow,
      earnedLifetime,
      paidLifetime,
      outstanding: earnedLifetime - paidLifetime,
      payoutCount: d.payouts.length,
    }
  })

  return NextResponse.json({ summary })
}
