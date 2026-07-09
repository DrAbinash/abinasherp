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
  const logs = await db.equipmentMaintenance.findMany({
    where: { equipmentId: id },
    orderBy: { serviceDate: 'desc' },
  })
  return NextResponse.json({ logs })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const equipment = await db.equipment.findUnique({ where: { id } })
  if (!equipment) return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const {
    type, serviceDate, performedBy, vendorName, description, cost,
    partsReplaced, downtimeHours, nextServiceDate, status,
  } = body

  if (!type || !serviceDate || !description) {
    return NextResponse.json({ error: 'type, serviceDate, description required' }, { status: 400 })
  }

  const log = await db.equipmentMaintenance.create({
    data: {
      equipmentId: id,
      type,
      serviceDate,
      performedBy: performedBy || null,
      vendorName: vendorName || null,
      description,
      cost: cost ? parseFloat(cost) : 0,
      partsReplaced: partsReplaced || null,
      downtimeHours: downtimeHours ? parseInt(downtimeHours) : 0,
      nextServiceDate: nextServiceDate || null,
      status: status || 'completed',
    },
  })

  const eqUpdate: Record<string, unknown> = { lastServiceDate: serviceDate }
  if (nextServiceDate) eqUpdate.nextServiceDate = nextServiceDate
  if (type === 'breakdown') {
    eqUpdate.status = status === 'completed' ? 'operational' : 'under_maintenance'
  }
  await db.equipment.update({ where: { id }, data: eqUpdate })

  return NextResponse.json({ log })
}
