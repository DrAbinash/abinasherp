import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/home-collection/:id — detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const request = await db.homeCollectionRequest.findUnique({ where: { id } })
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ request })
}

// PATCH /api/home-collection/:id — update (cancel, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const update: any = {}

  if (body.status) update.status = body.status
  if (body.cancelReason) {
    update.cancelReason = body.cancelReason
    update.cancelledAt = new Date()
    update.status = 'cancelled'
  }
  if (body.phlebotomistNotes) update.phlebotomistNotes = body.phlebotomistNotes
  if (body.paymentStatus) update.paymentStatus = body.paymentStatus

  const request = await db.homeCollectionRequest.update({ where: { id }, data: update })
  return NextResponse.json({ request })
}
