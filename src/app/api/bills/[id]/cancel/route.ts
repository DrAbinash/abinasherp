import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// Cancel a bill — mirrors reference workflow
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { reason, autoRefund, autoRefundMethod } = body

  const bill = await db.bill.findUnique({
    where: { id },
    include: { order: { include: { orderTests: true } } },
  })
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  if (bill.status === 'cancelled') {
    return NextResponse.json({ error: 'Bill already cancelled' }, { status: 400 })
  }

  // Cascade-cancel order_tests
  await db.orderTest.updateMany({
    where: { orderId: bill.orderId },
    data: {
      status: 'cancelled',
      cancelledByName: session.name,
      cancellationReason: reason || 'Bill cancelled',
    },
  })

  // Audit row
  await db.billAudit.create({
    data: {
      billId: bill.id,
      changeType: 'cancelled',
      performedByName: session.name,
      reason: reason || null,
      newValue: 'cancelled',
    },
  })

  let refundAmount = 0
  if (autoRefund && bill.paidAmount > 0) {
    refundAmount = bill.paidAmount
    // Negative payment row
    await db.payment.create({
      data: {
        billId: bill.id,
        amount: -refundAmount,
        method: autoRefundMethod || 'cash',
        notes: `Auto-refund on cancellation: ${reason || ''}`,
        recordedById: session.id,
        recordedByName: session.name,
      },
    })
    await db.billAudit.create({
      data: {
        billId: bill.id,
        changeType: 'refund',
        performedByName: session.name,
        reason: `Auto-refund on cancellation: ${reason || ''}`,
        newValue: String(-refundAmount),
      },
    })
  }

  const updated = await db.bill.update({
    where: { id },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledByName: session.name,
      cancellationReason: reason || null,
      paidAmount: autoRefund ? 0 : bill.paidAmount,
      refundAmount: bill.refundAmount + refundAmount,
      balanceAmount: 0, // Cancelled bills zeroed out
    },
    include: { patient: true, order: { include: { doctor: true } } },
  })

  // Reset order status to pending
  await db.order.update({
    where: { id: bill.orderId },
    data: { status: 'pending' },
  })

  return NextResponse.json({ bill: updated })
}
