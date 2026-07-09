import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// POST /api/samples/:id/status — update sample status (workflow)
// Body: { status, reason?, notes? }
// Workflow: pending → collected → in_transit → at_lab → processing → completed | discarded | rejected
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { status, reason, notes } = body

  const validStatuses = ['pending', 'collected', 'in_transit', 'at_lab', 'processing', 'completed', 'discarded', 'rejected']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` }, { status: 400 })
  }

  const sample = await db.sample.findUnique({ where: { id } })
  if (!sample) return NextResponse.json({ error: 'Sample not found' }, { status: 404 })

  const update: Record<string, unknown> = { status, notes: notes || sample.notes }

  // Set timestamps based on status
  if (status === 'collected') {
    update.collectedAt = new Date()
    update.collectedByName = session.name
  } else if (status === 'in_transit') {
    update.dispatchedAt = new Date()
    update.dispatchedByName = session.name
  } else if (status === 'at_lab') {
    update.receivedAtLabAt = new Date()
    update.receivedByName = session.name
  } else if (status === 'processing') {
    update.processingStartedAt = new Date()
    update.processingStartedByName = session.name
  } else if (status === 'completed') {
    update.completedAt = new Date()
  } else if (status === 'discarded') {
    update.discardedAt = new Date()
    update.discardReason = reason
  } else if (status === 'rejected') {
    update.rejectedAt = new Date()
    update.rejectionReason = reason
  }

  const updated = await db.sample.update({ where: { id }, data: update })
  return NextResponse.json({ sample: updated })
}
