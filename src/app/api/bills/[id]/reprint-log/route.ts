import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// POST /api/bills/:id/reprint-log
// Body: { reason }
// Records a reprint audit row + fires email to admin
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { reason } = body

  if (!reason || reason.trim().length < 3) {
    return NextResponse.json({ error: 'reason (≥3 chars) required' }, { status: 400 })
  }

  const bill = await db.bill.findUnique({
    where: { id },
    include: { patient: true },
  })
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })

  // Insert reprint audit row (initially newValue = "reprint", then patch to "reprint #N")
  const audit = await db.billAudit.create({
    data: {
      billId: bill.id,
      changeType: 'reprint',
      oldValue: null,
      newValue: 'reprint',
      performedByName: session.name,
      reason,
    },
  })

  // Count reprints for this bill up to and including this one (monotonic sequence)
  const reprintCount = await db.billAudit.count({
    where: {
      billId: bill.id,
      changeType: 'reprint',
      createdAt: { lte: audit.createdAt },
    },
  })

  await db.billAudit.update({
    where: { id: audit.id },
    data: { newValue: `reprint #${reprintCount}` },
  })

  // Fire-and-forget email
  try {
    const { sendBillReprintEmail } = await import('@/lib/email')
    sendBillReprintEmail({
      billNumber: bill.billNumber,
      patientName: bill.patient?.name || 'Unknown',
      changeType: 'reprint',
      oldValue: null,
      newValue: `reprint #${reprintCount}`,
      reason,
      actor: session.name,
      totalAmount: bill.totalAmount,
      reprintCount,
    }).catch((e) => console.error('Reprint email failed:', e))
  } catch (e) { /* ignore */ }

  return NextResponse.json({ success: true, reprintCount })
}
