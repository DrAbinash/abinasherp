import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { istDateLabel } from '@/lib/auth'

// My close (per-user drawer close)
export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const closures = await db.userDayClosure.findMany({
    where: { userId: session.id },
    orderBy: { closedAt: 'desc' },
    take: 30,
  })
  return NextResponse.json({ closures })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { actualCash, actualUpi, actualCard, actualCheque, actualOther, varianceNote, denominations, denominationTotal, notes } = body

  // Find previous closure for this user
  const prev = await db.userDayClosure.findFirst({
    where: { userId: session.id, drawerStatus: { in: ['closed', 'balanced', 'approved'] } },
    orderBy: { coveredToTs: 'desc' },
  })
  const coveredFromTs = prev?.coveredToTs || new Date(0)
  const coveredToTs = new Date()

  // Summarize this user's payments
  const payments = await db.payment.findMany({
    where: {
      recordedById: session.id,
      createdAt: { gt: coveredFromTs, lte: coveredToTs },
    },
  })
  const bills = await db.bill.findMany({
    where: {
      createdById: session.id,
      createdAt: { gt: coveredFromTs, lte: coveredToTs },
    },
  })
  const expenses = await db.expense.findMany({
    where: {
      approvedById: session.id,
      expenseDate: istDateLabel(),
      paymentMode: 'cash',
    },
  })

  const expected: Record<string, number> = { cash: 0, upi: 0, card: 0, cheque: 0, other: 0 }
  for (const p of payments) {
    if (p.amount <= 0) continue
    const m = p.method
    if (m === 'cash') expected.cash += p.amount
    else if (m === 'upi') expected.upi += p.amount
    else if (m === 'card') expected.card += p.amount
    else if (m === 'cheque') expected.cheque += p.amount
    else expected.other += p.amount
  }
  for (const e of expenses) expected.cash -= e.amount

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

  const closure = await db.userDayClosure.create({
    data: {
      userId: session.id,
      userName: session.name,
      closureDate: istDateLabel(),
      closedAt: coveredToTs,
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
      denominations: denominations ? JSON.stringify(denominations) : null,
      denominationTotal: parseFloat(denominationTotal || '0'),
      drawerStatus: variance === 0 ? 'balanced' : 'mismatch',
      notes: notes || null,
      billsCount: bills.length,
      paymentsCount: payments.length,
      totalExpected,
      totalActual,
    },
  })

  await db.drawerAuditLog.create({
    data: {
      userId: session.id,
      userName: session.name,
      userDayClosureId: closure.id,
      action: variance === 0 ? 'closed' : 'mismatch_detected',
      details: JSON.stringify({ variance, totalExpected, totalActual }),
    },
  })

  return NextResponse.json({ closure })
}
