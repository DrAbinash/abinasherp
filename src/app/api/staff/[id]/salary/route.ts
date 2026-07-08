import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const payments = await db.staffSalaryPayment.findMany({
    where: { staffId: id },
    orderBy: { paymentDate: 'desc' },
  })
  return NextResponse.json({ payments })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { monthYear, baseAmount, bonus, deductions, daysPresent, daysAbsent, paymentDate, paymentMode, reference } = body
  if (!monthYear || !baseAmount || !paymentDate) {
    return NextResponse.json({ error: 'monthYear, baseAmount, paymentDate required' }, { status: 400 })
  }

  // FIFO advance recovery in transaction
  return await db.$transaction(async (tx) => {
    const outstandingAdvances = await tx.staffAdvance.findMany({
      where: { staffId: id, status: 'outstanding' },
      orderBy: { advanceDate: 'asc' },
    })
    const totalOutstanding = outstandingAdvances.reduce((s, a) => s + (a.amount - a.recoveredAmount), 0)
    const requested = Math.min(parseFloat(bonus || '0') > 0 ? totalOutstanding : totalOutstanding, totalOutstanding)
    let advanceDeducted = 0
    let remaining = requested

    for (const a of outstandingAdvances) {
      if (remaining <= 0) break
      const available = a.amount - a.recoveredAmount
      const applied = Math.min(available, remaining)
      await tx.staffAdvance.update({
        where: { id: a.id },
        data: {
          recoveredAmount: a.recoveredAmount + applied,
          status: a.recoveredAmount + applied >= a.amount ? 'cleared' : 'outstanding',
        },
      })
      advanceDeducted += applied
      remaining -= applied
    }

    const netAmount = parseFloat(baseAmount) + parseFloat(bonus || '0') - parseFloat(deductions || '0') - advanceDeducted

    const payment = await tx.staffSalaryPayment.create({
      data: {
        staffId: id,
        monthYear,
        baseAmount: parseFloat(baseAmount),
        bonus: parseFloat(bonus || '0'),
        deductions: parseFloat(deductions || '0'),
        advanceDeducted,
        daysPresent: daysPresent ? parseInt(daysPresent) : null,
        daysAbsent: daysAbsent ? parseInt(daysAbsent) : null,
        netAmount,
        paymentDate,
        paymentMode: paymentMode || 'cash',
        reference,
        paidById: session.id,
      },
    })
    return NextResponse.json({ payment })
  })
}
