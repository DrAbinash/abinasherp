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
  const equipment = await db.equipment.findUnique({
    where: { id },
    include: {
      maintenanceLogs: { orderBy: { serviceDate: 'desc' } },
    },
  })
  if (!equipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ equipment })
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
  const fields = [
    'name', 'model', 'manufacturer', 'serialNumber', 'category', 'location',
    'purchaseDate', 'amcVendor', 'amcStartDate', 'amcEndDate', 'amcContractNo',
    'lastServiceDate', 'nextServiceDate', 'calibrationDate', 'nextCalibrationDate',
    'status', 'notes',
  ]
  for (const f of fields) {
    if (body[f] !== undefined) update[f] = body[f]
  }
  if (body.purchaseCost !== undefined) update.purchaseCost = parseFloat(body.purchaseCost)

  const equipment = await db.equipment.update({ where: { id }, data: update })
  return NextResponse.json({ equipment })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const equipment = await db.equipment.update({
    where: { id },
    data: { isActive: false, status: 'retired' },
  })
  return NextResponse.json({ ok: true, equipment })
}
