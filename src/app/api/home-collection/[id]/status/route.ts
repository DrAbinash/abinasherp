import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// POST /api/home-collection/:id/status — update status (phlebotomist workflow)
// Body: { status, notes? }
// Workflow: requested → assigned → en_route → collected → sample_at_lab → completed | cancelled
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { status, notes } = body

  const validStatuses = ['requested', 'assigned', 'en_route', 'collected', 'sample_at_lab', 'completed', 'cancelled']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` }, { status: 400 })
  }

  const update: Record<string, unknown> = { status, phlebotomistNotes: notes }

  if (status === 'en_route') {
    update.phlebotomistEnRouteAt = new Date()
  } else if (status === 'collected') {
    update.phlebotomistCollectedAt = new Date()
  } else if (status === 'completed') {
    update.completedAt = new Date()
  } else if (status === 'cancelled') {
    update.cancelledAt = new Date()
  }

  const request = await db.homeCollectionRequest.update({ where: { id }, data: update })
  return NextResponse.json({ request })
}
