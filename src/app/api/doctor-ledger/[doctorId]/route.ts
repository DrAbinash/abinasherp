import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { calcTestCommission, applyDiscountDeduction } from '@/lib/auth'

// GET /api/doctor-ledger/[doctorId] — per-doctor commission ledger with running balance.
// Returns { doctor, summary, entries[] } consumed by the Doctor Ledger detail view.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ doctorId: string }> }) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { doctorId } = await params

  const clinic = await db.clinic.findFirst()
  const commissionDiscountMode = clinic?.commissionDiscountMode || 'none'

  const doctor = await db.doctor.findUnique({
    where: { id: doctorId },
    include: {
      commissionRules: true,
      orders: {
        where: { status: { not: 'cancelled' } },
        include: {
          orderTests: { include: { test: { include: { category: true } } } },
          bills: { where: { status: { in: ['paid', 'partial'] } } },
        },
      },
      payouts: true,
    },
  })

  if (!doctor) return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })

  type Entry = { date: Date | string; type: 'earned' | 'paid'; description: string; reference: string; amount: number; balance: number }
  const raw: Omit<Entry, 'balance'>[] = []

  let totalRevenue = 0
  let totalEarned = 0

  for (const order of doctor.orders) {
    for (const bill of order.bills) {
      let commission = 0
      let billRevenue = 0
      for (const ot of order.orderTests) {
        if (ot.status === 'cancelled') continue
        const testCategories = ot.test.category ? [ot.test.category.name] : []
        commission += calcTestCommission(
          ot.price,
          testCategories,
          ot.testId,
          doctor.commissionRules,
          { type: doctor.defaultCommissionType, value: doctor.defaultCommission },
        )
        billRevenue += ot.price
      }
      const eff = applyDiscountDeduction(commission, bill.discount, commissionDiscountMode)
      totalRevenue += billRevenue
      totalEarned += eff
      raw.push({
        date: bill.createdAt,
        type: 'earned',
        description: `Commission on ${bill.billNumber}`,
        reference: bill.billNumber,
        amount: eff,
      })
    }
  }

  let totalPaid = 0
  for (const p of doctor.payouts) {
    totalPaid += p.amount
    raw.push({
      date: p.paymentDate,
      type: 'paid',
      description: `Payout${p.paymentMethod ? ` (${p.paymentMethod})` : ''}`,
      reference: p.reference || '—',
      amount: -p.amount,
    })
  }

  // Sort chronologically and compute a running balance (outstanding owed to doctor).
  raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  let balance = 0
  const entries: Entry[] = raw.map((e) => {
    balance += e.amount
    return { ...e, balance }
  })

  return NextResponse.json({
    doctor: { id: doctor.id, name: doctor.name, specialization: doctor.specialization },
    summary: {
      totalRevenue,
      totalEarned,
      totalPaid,
      outstanding: totalEarned - totalPaid,
    },
    entries,
  })
}
