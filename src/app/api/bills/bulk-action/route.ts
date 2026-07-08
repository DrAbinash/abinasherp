import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// POST /api/bills/bulk-action
// Body: { billIds: string[], action: 'cancel' | 'print', reason?: string }
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { billIds, action, reason } = body as { billIds: string[]; action: string; reason?: string }

  if (!Array.isArray(billIds) || billIds.length === 0) {
    return NextResponse.json({ error: 'billIds required' }, { status: 400 })
  }

  if (action === 'cancel') {
    if (!session.isOwner) {
      return NextResponse.json({ error: 'Only admin/owner can bulk cancel' }, { status: 403 })
    }
    let cancelled = 0
    let failed = 0
    for (const id of billIds) {
      try {
        const bill = await db.bill.findUnique({ where: { id }, include: { order: { include: { orderTests: true } } } })
        if (!bill || bill.status === 'cancelled') { failed++; continue }

        await db.orderTest.updateMany({
          where: { orderId: bill.orderId },
          data: { status: 'cancelled', cancelledByName: session.name, cancellationReason: reason || 'Bulk cancel' },
        })

        await db.billAudit.create({
          data: {
            billId: bill.id,
            changeType: 'cancelled',
            performedByName: session.name,
            reason: reason || 'Bulk cancel',
            newValue: 'cancelled',
          },
        })

        await db.bill.update({
          where: { id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelledByName: session.name,
            cancellationReason: reason || 'Bulk cancel',
            balanceAmount: 0,
          },
        })
        cancelled++
      } catch (e) { failed++ }
    }
    return NextResponse.json({ action: 'cancel', cancelled, failed })
  }

  if (action === 'print') {
    // Return all bill data for print preview
    const bills = await db.bill.findMany({
      where: { id: { in: billIds } },
      include: {
        patient: true,
        order: { include: { doctor: true, orderTests: { include: { test: true } } } },
        payments: true,
      },
    })
    return NextResponse.json({ action: 'print', bills })
  }

  return NextResponse.json({ error: 'Invalid action. Use cancel or print.' }, { status: 400 })
}
