import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { istDateLabel } from '@/lib/auth'

// GET /api/day-close — list closures
export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const closures = await db.dayClosure.findMany({
    orderBy: { closedAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ closures })
}

// POST /api/day-close — close the day (admin/owner)
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) {
    return NextResponse.json({ error: 'Only admin/owner can close the day' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { actualCash, actualUpi, actualCard, actualCheque, actualOther, varianceNote } = body

  // Find previous closure
  const prev = await db.dayClosure.findFirst({
    where: { status: 'closed' },
    orderBy: { coveredToTs: 'desc' },
  })
  const coveredFromTs = prev?.coveredToTs || new Date(0)
  const coveredToTs = new Date()

  // Summarize window
  const payments = await db.payment.findMany({
    where: { createdAt: { gt: coveredFromTs, lte: coveredToTs } },
    include: { bill: true },
  })
  const bills = await db.bill.findMany({
    where: { createdAt: { gt: coveredFromTs, lte: coveredToTs } },
  })
  const expenses = await db.expense.findMany({
    where: { expenseDate: istDateLabel() },
  })

  // Expected by method (only positive payments; suspense bucket for unknown)
  const expected: Record<string, number> = { cash: 0, upi: 0, card: 0, cheque: 0, other: 0 }
  for (const p of payments) {
    if (p.amount <= 0) continue
    const m = p.method
    if (m === 'cash') expected.cash += p.amount
    else if (m === 'upi') expected.upi += p.amount
    else if (m === 'card') expected.card += p.amount
    else if (m === 'cheque') expected.cheque += p.amount
    else expected.other += p.amount // includes suspense bucket
  }
  // Cash expenses reduce drawer
  for (const e of expenses) {
    if (e.paymentMode === 'cash') expected.cash -= e.amount
  }

  const totalExpected = expected.cash + expected.upi + expected.card + expected.cheque + expected.other
  const actuals = {
    cash: parseFloat(actualCash || '0'),
    upi: parseFloat(actualUpi || '0'),
    card: parseFloat(actualCard || '0'),
    cheque: parseFloat(actualCheque || '0'),
    other: parseFloat(actualOther || '0'),
  }
  const totalActual = actuals.cash + actuals.upi + actuals.card + actuals.cheque + actuals.other
  const variance = totalActual - totalExpected

  const closure = await db.dayClosure.create({
    data: {
      closureDate: istDateLabel(),
      closedAt: coveredToTs,
      closedById: session.id,
      closedByName: session.name,
      coveredFromTs,
      coveredToTs,
      expectedCash: expected.cash,
      expectedUpi: expected.upi,
      expectedCard: expected.card,
      expectedCheque: expected.cheque,
      expectedOther: expected.other,
      actualCash: actuals.cash,
      actualUpi: actuals.upi,
      actualCard: actuals.card,
      actualCheque: actuals.cheque,
      actualOther: actuals.other,
      variance,
      varianceNote: varianceNote || null,
      billsCount: bills.length,
      paymentsCount: payments.length,
      totalExpected,
      totalActual,
      totalBilled: bills.reduce((s, b) => s + b.totalAmount, 0),
      totalRefunds: payments.filter((p) => p.amount < 0).reduce((s, p) => s + Math.abs(p.amount), 0),
      totalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
      totalDue: bills.filter((b) => b.status === 'pending' || b.status === 'partial').reduce((s, b) => s + b.balanceAmount, 0),
      status: 'closed',
    },
  })

  return NextResponse.json({ closure })
}
