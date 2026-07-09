import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || ''

  const where: Record<string, unknown> = { isActive: true }
  if (status) where.status = status
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' as const } },
      { equipmentId: { contains: q, mode: 'insensitive' as const } },
      { manufacturer: { contains: q, mode: 'insensitive' as const } },
      { serialNumber: { contains: q, mode: 'insensitive' as const } },
      { model: { contains: q, mode: 'insensitive' as const } },
    ]
  }

  const equipment = await db.equipment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { maintenanceLogs: true } } },
  })
  return NextResponse.json({ equipment })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const {
    name, model, manufacturer, serialNumber, category, location,
    purchaseDate, purchaseCost, amcVendor, amcStartDate, amcEndDate, amcContractNo,
    lastServiceDate, nextServiceDate, calibrationDate, nextCalibrationDate,
    status, notes,
  } = body

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const count = await db.equipment.count()
  const equipmentId = `EQ-${String(count + 1).padStart(4, '0')}`

  const equipment = await db.equipment.create({
    data: {
      equipmentId,
      name,
      model: model || null,
      manufacturer: manufacturer || null,
      serialNumber: serialNumber || null,
      category: category || 'general',
      location: location || null,
      purchaseDate: purchaseDate || null,
      purchaseCost: purchaseCost ? parseFloat(purchaseCost) : 0,
      amcVendor: amcVendor || null,
      amcStartDate: amcStartDate || null,
      amcEndDate: amcEndDate || null,
      amcContractNo: amcContractNo || null,
      lastServiceDate: lastServiceDate || null,
      nextServiceDate: nextServiceDate || null,
      calibrationDate: calibrationDate || null,
      nextCalibrationDate: nextCalibrationDate || null,
      status: status || 'operational',
      notes: notes || null,
    },
  })

  return NextResponse.json({ equipment })
}
