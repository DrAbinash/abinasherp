import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { autoVoucherForPayment } from '@/lib/seed'

// Refund a bill — mirrors reference workflow
// totalAmount NEVER mutated; refundAmount accumulates; balanceAmount recomputed
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { amount, method, reference, notes } = body

  const refundAmt = parseFloat(amount || '0')
  if (refundAmt <= 0) {
    return NextResponse.json({ error: 'Refund amount must be positive' }, { status: 400 })
  }

  const bill = await db.bill.findUnique({ where: { id } })
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  if (bill.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot refund a cancelled bill' }, { status: 400 })
  }
  if (refundAmt > bill.paidAmount + 0.0001) {
    return NextResponse.json({ error: 'Refund exceeds paid amount' }, { status: 400 })
  }

  // Insert negative payment row
  const payment = await db.payment.create({
    data: {
      billId: bill.id,
      amount: -refundAmt,
      method: method || 'cash',
      referenceNumber: reference || null,
      notes: notes || 'Refund',
      recordedById: session.id,
      recordedByName: session.name,
    },
  })

  // Audit
  await db.billAudit.create({
    data: {
      billId: bill.id,
      changeType: 'refund',
      performedByName: session.name,
      reason: notes || null,
      oldValue: String(bill.paidAmount),
      newValue: String(bill.paidAmount - refundAmt),
    },
  })

  const newPaidAmount = bill.paidAmount - refundAmt
  const newRefundAmount = bill.refundAmount + refundAmt
  // totalAmount NEVER mutated
  const netOwed = Math.max(0, bill.totalAmount - newRefundAmount)
  let status: string
  if (newPaidAmount >= netOwed + 0.0001) status = 'paid'
  else if (newPaidAmount > 0) status = 'partial'
  else status = 'pending'

  const updated = await db.bill.update({
    where: { id },
    data: {
      paidAmount: newPaidAmount,
      refundAmount: newRefundAmount,
      balanceAmount: Math.max(0, bill.totalAmount - newPaidAmount - newRefundAmount),
      status,
    },
  })

  // Auto-voucher (refund = payment voucher)
  try {
    const voucher = await autoVoucherForPayment(bill.id, -refundAmt, method || 'cash', session.id, session.name)
    if (voucher) {
      await db.payment.update({ where: { id: payment.id }, data: { voucherId: voucher.id } })
    }
  } catch (e) {
    console.error('Refund auto-voucher failed:', e)
  }

  // Fire-and-forget email notification (non-blocking)
  try {
    const { sendBillEditEmail } = await import('@/lib/email')
    sendBillEditEmail({
      billNumber: bill.billNumber,
      patientName: (await db.patient.findUnique({ where: { id: bill.patientId } }))?.name || 'Unknown',
      changeType: 'refund',
      oldValue: `paid=₹${bill.paidAmount.toFixed(2)}, refunded=₹${bill.refundAmount.toFixed(2)}`,
      newValue: `refund=₹${refundAmt.toFixed(2)} via ${method || 'cash'}; paid=₹${newPaidAmount.toFixed(2)}, refunded=₹${newRefundAmount.toFixed(2)}`,
      reason: `[REFUND] ${notes || 'No reason provided'}`,
      actor: session.name,
      totalAmount: bill.totalAmount,
    }).catch((e) => console.error('Refund email failed:', e))
  } catch (e) { /* ignore */ }

  return NextResponse.json({ bill: updated, payment })
}
