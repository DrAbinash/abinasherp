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
  const corporate = await db.corporate.findUnique({
    where: { id },
    include: {
      rateCards: { include: { test: { select: { name: true, code: true, price: true } } } },
      patients: { include: { patient: { select: { name: true, patientId: true, phone: true } } } },
      _count: { select: { rateCards: true, patients: true } },
    },
  })
  if (!corporate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ corporate })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = {}
  const allowed = ['name', 'type', 'contactPerson', 'phone', 'email', 'gstin', 'pan', 'address', 'city', 'state', 'pincode', 'creditTermsDays', 'creditLimit', 'isActive', 'notes']
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k]
  }

  const corporate = await db.corporate.update({ where: { id }, data: update })
  return NextResponse.json({ corporate })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  await db.corporate.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
