import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const update: any = {}
  const allowed = ['patientName', 'patientPhone', 'appointmentDate', 'timeSlot', 'durationMin', 'notes', 'status', 'source', 'isFasting']
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k]
  }
  if (body.durationMin !== undefined) update.durationMin = parseInt(body.durationMin)

  const appt = await db.appointment.update({ where: { id }, data: update })
  return NextResponse.json({ appointment: appt })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.appointment.update({ where: { id }, data: { status: 'cancelled' } })
  return NextResponse.json({ ok: true })
}
