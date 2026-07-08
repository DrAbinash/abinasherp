import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/doctor-ledger/:doctorId — detailed ledger with running balance
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ doctorId: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { doctorId } = await params
  const doctor = await db.doctor.findUnique({
    where: { id: doctorId },
    include: {
      commissionRules: true,
      payouts: { orderBy: { paymentDate: 'asc' } },
      orders: {
        where: { status: { not: 'cancelled' } },
        include: {
          orderTests: { include: { test: { include: { category: true } } } },
          bills: {
            where: { status: { in: ['paid', 'partial'] } },
          },
        },
      },
    },
  })
  if (!doctor) return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })

  // Build earned + paid entries
  type Entry = { date: string; type: 'earned' | 'paid'; description: string; amount: number; reference: string }
  const entries: Entry[] = []
  let earnedLifetime = 0
  let paidLifetime = 0
  let revenueLifetime = 0
  let orderCount = 0

  const clinic = await db.clinic.findFirst()
  const commissionDiscountMode = clinic?.commissionDiscountMode || 'none'

  for (const order of doctor.orders) {
    for (const bill of order.bills) {
      orderCount += 1
      let raw = 0
      for (const ot of order.orderTests) {
        if (ot.status === 'cancelled') continue
        const testCategories = ot.test.category ? [ot.test.category.name] : []
        const c = (await import('@/lib/auth')).calcTestCommission(
          ot.price, testCategories, ot.testId, doctor.commissionRules,
          { type: doctor.defaultCommissionType, value: doctor.defaultCommission },
        )
        raw += c
        revenueLifetime += ot.price
      }
      const eff = (await import('@/lib/auth')).applyDiscountDeduction(raw, bill.discount, commissionDiscountMode)
      earnedLifetime += eff
      entries.push({
        date: bill.createdAt.toISOString().slice(0, 10),
        type: 'earned',
        description: `Bill ${bill.billNumber} (commission)`,
        amount: eff,
        reference: bill.billNumber,
      })
    }
  }

  for (const p of doctor.payouts) {
    paidLifetime += p.amount
    entries.push({
      date: p.paymentDate,
      type: 'paid',
      description: `Payout — ${p.paymentMethod}${p.reference ? ' (' + p.reference + ')' : ''}`,
      amount: -p.amount,
      reference: p.id,
    })
  }

  // Sort: earned before paid on same date
  entries.sort((a, b) => {
    if (a.date === b.date) return a.type === 'earned' ? -1 : 1
    return a.date.localeCompare(b.date)
  })

  // Running balance
  let running = 0
  const withBalance = entries.map((e) => {
    running += e.amount
    return { ...e, balance: running }
  })

  return NextResponse.json({
    doctor,
    entries: withBalance,
    summary: {
      totalRevenue: revenueLifetime,
      totalEarned: earnedLifetime,
      totalPaid: paidLifetime,
      outstanding: earnedLifetime - paidLifetime,
      orderCount,
      payoutCount: doctor.payouts.length,
    },
  })
}

// POST /api/doctor-ledger/:doctorId/payouts — record payout
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctorId: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { doctorId } = await params
  const body = await req.json().catch(() => ({}))
  const { amount, paymentDate, paymentMethod, reference, periodFrom, periodTo, notes } = body

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Positive amount required' }, { status: 400 })
  }
  if (!paymentDate) {
    return NextResponse.json({ error: 'paymentDate required' }, { status: 400 })
  }
  const validMethods = ['cash', 'bank', 'upi', 'cheque', 'card', 'other']
  if (paymentMethod && !validMethods.includes(paymentMethod)) {
    return NextResponse.json({ error: 'Invalid paymentMethod' }, { status: 400 })
  }

  const payout = await db.doctorPayout.create({
    data: {
      doctorId,
      amount: parseFloat(amount),
      paymentDate,
      paymentMethod: paymentMethod || 'cash',
      reference,
      periodFrom,
      periodTo,
      notes,
      performedById: session.id,
      performedByName: session.name,
    },
  })
  return NextResponse.json({ payout })
}
