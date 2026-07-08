import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''
  const lowStock = searchParams.get('lowStock')

  const where: Record<string, unknown> = { isActive: true }
  if (q) where.name = { contains: q }
  if (category) where.category = category

  const items = await db.inventoryItem.findMany({
    where,
    orderBy: { name: 'asc' },
  })

  // Filter for low stock if requested
  let filtered = items
  if (lowStock === 'true') {
    filtered = items.filter((i) => i.currentStock <= i.reorderLevel)
  }

  return NextResponse.json({
    items: filtered,
    summary: {
      totalItems: items.length,
      lowStockCount: items.filter((i) => i.currentStock <= i.reorderLevel).length,
      outOfStockCount: items.filter((i) => i.currentStock <= 0).length,
      totalValue: items.reduce((s, i) => s + i.currentStock * i.costPerUnit, 0),
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, category, unit, currentStock, minStock, maxStock, reorderLevel, costPerUnit, supplierId, expiryDate, batchNumber, storageLocation, notes } = body
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const counter = await db.inventoryCounter.upsert({
    where: { id: 1 },
    update: { counter: { increment: 1 } },
    create: { id: 1, counter: 1 },
  })
  const itemId = `INV-${String(counter.counter).padStart(4, '0')}`

  const item = await db.inventoryItem.create({
    data: {
      itemId,
      name,
      category: category || 'reagent',
      unit: unit || 'unit',
      currentStock: parseFloat(currentStock || '0'),
      minStock: parseFloat(minStock || '0'),
      maxStock: parseFloat(maxStock || '0'),
      reorderLevel: parseFloat(reorderLevel || '0'),
      costPerUnit: parseFloat(costPerUnit || '0'),
      supplierId: supplierId || null,
      expiryDate,
      batchNumber,
      storageLocation,
      notes,
      lastUpdatedById: session.id,
      lastUpdatedByName: session.name,
    },
  })

  // Record initial movement if stock > 0
  if (item.currentStock > 0) {
    await db.inventoryMovement.create({
      data: {
        itemId: item.id,
        movementType: 'in',
        quantity: item.currentStock,
        reason: 'Initial stock',
        performedById: session.id,
        performedByName: session.name,
      },
    })
  }

  return NextResponse.json({ item })
}
