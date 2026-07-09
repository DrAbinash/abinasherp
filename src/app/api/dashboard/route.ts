import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { istDateLabel } from '@/lib/auth'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = istDateLabel()
  const startOfToday = new Date(today + 'T00:00:00+05:30')
  const endOfToday = new Date(today + 'T23:59:59+05:30')

  const [billsToday, paymentsToday, expensesToday, patientsCount, doctorsCount, staffCount, billsAll, pendingBills, ordersToday] = await Promise.all([
    db.bill.findMany({ where: { createdAt: { gte: startOfToday, lte: endOfToday } } }),
    db.payment.findMany({
      where: { createdAt: { gte: startOfToday, lte: endOfToday } },
      include: { bill: true },
    }),
    db.expense.findMany({ where: { expenseDate: today } }),
    db.patient.count(),
    db.doctor.count(),
    db.staff.count(),
    db.bill.findMany({ where: { status: { not: 'cancelled' } } }),
    db.bill.findMany({ where: { status: { in: ['pending', 'partial'] } } }),
    db.order.findMany({ where: { createdAt: { gte: startOfToday, lte: endOfToday } } }),
  ])

  const totalBilledToday = billsToday.reduce((s, b) => s + b.totalAmount, 0)
  const totalCollectedToday = paymentsToday.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0)
  const totalRefundsToday = paymentsToday.filter((p) => p.amount < 0).reduce((s, p) => s + Math.abs(p.amount), 0)
  const totalExpensesToday = expensesToday.reduce((s, e) => s + e.amount, 0)
  const totalDue = pendingBills.reduce((s, b) => s + b.balanceAmount, 0)
  const totalRevenue = billsAll.reduce((s, b) => s + b.paidAmount, 0)

  // Method breakdown today
  const byMethod: Record<string, number> = {}
  for (const p of paymentsToday) {
    if (p.amount > 0) {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount
    }
  }

  // Last 7 days revenue trend
  const trend: Array<{ date: string; revenue: number; bills: number }> = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const label = istDateLabel(d)
    const s = new Date(label + 'T00:00:00+05:30')
    const e = new Date(label + 'T23:59:59+05:30')
    const dayBills = await db.bill.findMany({ where: { createdAt: { gte: s, lte: e }, status: { not: 'cancelled' } } })
    const dayPayments = await db.payment.findMany({ where: { createdAt: { gte: s, lte: e }, amount: { gt: 0 } } })
    trend.push({
      date: label,
      revenue: dayPayments.reduce((sum, p) => sum + p.amount, 0),
      bills: dayBills.length,
    })
  }

  return NextResponse.json({
    today: {
      totalBilled: totalBilledToday,
      totalCollected: totalCollectedToday,
      totalRefunds: totalRefundsToday,
      totalExpenses: totalExpensesToday,
      netCash: totalCollectedToday - totalRefundsToday - totalExpensesToday,
      billsCount: billsToday.length,
      ordersCount: ordersToday.length,
      byMethod,
    },
    totals: {
      patients: patientsCount,
      doctors: doctorsCount,
      staff: staffCount,
      totalDue,
      totalRevenue,
    },
    trend,
    recentBills: await db.bill.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { patient: true },
    }),
  })
}
