import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// PUT /api/bills/:id/edit
// Body: { discount?, status?, dueDate?, reason }
// Recomputes totalAmount + balanceAmount, writes audit row, fires email
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { discount, status, dueDate, reason } = body

  if (!reason || reason.trim().length < 3) {
    return NextResponse.json({ error: 'reason (≥3 chars) is required for audit trail' }, { status: 400 })
  }

  const bill = await db.bill.findUnique({
    where: { id },
    include: { patient: true, order: { include: { orderTests: true } } },
  })
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  if (bill.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot edit a cancelled bill' }, { status: 400 })
  }

  const auditEntries: Array<{ changeType: string; oldValue: string; newValue: string }> = []
  const update: any = {}

  // Discount change
  if (discount !== undefined) {
    const newDiscount = parseFloat(discount)
    if (isNaN(newDiscount) || newDiscount < 0) {
      return NextResponse.json({ error: 'discount must be ≥ 0' }, { status: 400 })
    }
    if (newDiscount > bill.subtotal) {
      return NextResponse.json({ error: 'discount cannot exceed subtotal' }, { status: 400 })
    }
    // Per-staff maxDiscount cap (non-admin)
    if (!session.isOwner && session.maxDiscount > 0) {
      const maxAllowed = (bill.subtotal * session.maxDiscount) / 100
      if (newDiscount > maxAllowed) {
        return NextResponse.json({ error: `discount exceeds your max (${session.maxDiscount}%)` }, { status: 403 })
      }
    }
    if (Math.abs(newDiscount - bill.discount) > 0.001) {
      auditEntries.push({
        changeType: 'discount',
        oldValue: `₹${bill.discount.toFixed(2)}`,
        newValue: `₹${newDiscount.toFixed(2)}`,
      })
      update.discount = newDiscount
      // Recompute totals
      update.totalAmount = bill.subtotal - newDiscount + bill.taxAmount
      update.balanceAmount = Math.max(0, (update.totalAmount as number) - bill.paidAmount - bill.refundAmount)
    }
  }

  // Status change
  if (status && status !== bill.status) {
    if (!['draft', 'pending', 'partial', 'paid'].includes(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    }
    auditEntries.push({
      changeType: 'status',
      oldValue: bill.status,
      newValue: status,
    })
    update.status = status
  }

  // Due date
  if (dueDate !== undefined) {
    update.dueDate = dueDate || null
  }

  // Advisory audit: discount > 50% of subtotal
  if (update.discount !== undefined && (update.discount as number) > bill.subtotal * 0.5) {
    auditEntries.push({
      changeType: 'discount_override_warning',
      oldValue: `subtotal=₹${bill.subtotal.toFixed(2)}`,
      newValue: `discount=₹${(update.discount as number).toFixed(2)} (${(((update.discount as number) / bill.subtotal) * 100).toFixed(1)}% — review)`,
    })
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No changes to apply' }, { status: 400 })
  }

  // Update bill
  const updated = await db.bill.update({ where: { id }, data: update })

  // Insert audit rows
  for (const entry of auditEntries) {
    await db.billAudit.create({
      data: {
        billId: bill.id,
        changeType: entry.changeType,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        performedByName: session.name,
        reason,
      },
    })
  }

  // Fire-and-forget email notification
  try {
    const { sendBillEditEmail } = await import('@/lib/email')
    // Send one email per change (or could batch — keeping one per change for clarity)
    for (const entry of auditEntries) {
      sendBillEditEmail({
        billNumber: bill.billNumber,
        patientName: bill.patient?.name || 'Unknown',
        changeType: entry.changeType,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        reason,
        actor: session.name,
        totalAmount: updated.totalAmount,
      }).catch((e) => console.error('Bill edit email failed:', e))
    }
  } catch (e) { /* ignore */ }

  return NextResponse.json({ bill: updated, auditsCreated: auditEntries.length })
}
