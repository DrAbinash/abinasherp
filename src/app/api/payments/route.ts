import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { classifyPaymentMethod } from '@/lib/auth'
import { autoVoucherForPayment } from '@/lib/seed'

// List payments
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const billId = searchParams.get('billId') || ''
  const method = searchParams.get('method') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200)

  const where: any = {}
  if (billId) where.billId = billId
  if (method) where.method = method
  if (from || to) {
    const createdAt: { gte?: Date; lte?: Date } = {}
    if (from) createdAt.gte = new Date(from + 'T00:00:00+05:30')
    if (to) createdAt.lte = new Date(to + 'T23:59:59+05:30')
    where.createdAt = createdAt
  }

  const payments = await db.payment.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { bill: { include: { patient: true } } },
  })
  return NextResponse.json({ payments })
}

// Record additional payment against an existing bill
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { billId, amount, method, reference, notes } = body
  if (!billId || !amount || amount <= 0) {
    return NextResponse.json({ error: 'billId and positive amount required' }, { status: 400 })
  }

  const bill = await db.bill.findUnique({ where: { id: billId } })
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  if (bill.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot collect on cancelled bill' }, { status: 400 })
  }

  const classified = classifyPaymentMethod(method)
  const payment = await db.payment.create({
    data: {
      billId,
      amount,
      method: classified.method,
      referenceNumber: reference || null,
      notes: notes || null,
      recordedById: session.id,
      recordedByName: session.name,
    },
  })

  await db.billAudit.create({
    data: {
      billId,
      changeType: 'extra_payment',
      performedByName: session.name,
      newValue: String(amount),
    },
  })

  const newPaid = bill.paidAmount + amount
  const newBalance = Math.max(0, bill.totalAmount - newPaid - bill.refundAmount)
  const status = newPaid >= bill.totalAmount - 0.001 ? 'paid' : (newPaid > 0 ? 'partial' : 'pending')

  const updated = await db.bill.update({
    where: { id: billId },
    data: { paidAmount: newPaid, balanceAmount: newBalance, status },
  })

  // Auto-voucher
  try {
    const voucher = await autoVoucherForPayment(billId, amount, classified.method, session.id, session.name)
    if (voucher) {
      await db.payment.update({ where: { id: payment.id }, data: { voucherId: voucher.id } })
    }
  } catch (e) {
    console.error('Auto-voucher failed:', e)
  }

  return NextResponse.json({ bill: updated, payment })
}
