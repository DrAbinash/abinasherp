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
  const report = await db.patientReport.findUnique({ where: { id } })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ report })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = {}
  const allowed = [
    'patientName', 'patientAge', 'patientGender', 'patientPhone', 'doctorName',
    'values', 'notes', 'impression', 'status',
  ]
  for (const k of allowed) {
    if (body[k] !== undefined) {
      if (k === 'values' && typeof body[k] !== 'string') update[k] = JSON.stringify(body[k])
      else if (k === 'patientAge') update[k] = body[k] ? parseInt(body[k]) : null
      else update[k] = body[k]
    }
  }

  // Status transitions
  if (body.status === 'approved') {
    update.approvedById = session.id
    update.approvedByName = session.name
    update.approvedAt = new Date()
  }
  if (body.status === 'delivered') {
    update.deliveredAt = new Date()
    update.deliveryMethod = body.deliveryMethod || 'manual'
  }

  const report = await db.patientReport.update({ where: { id }, data: update })
  return NextResponse.json({ report })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.patientReport.update({
    where: { id },
    data: { status: 'cancelled' },
  })
  return NextResponse.json({ ok: true })
}
