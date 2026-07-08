import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''

  const where: Record<string, unknown> = { isActive: true }
  if (q) where.name = { contains: q }
  if (category) where.category = category

  const items = await db.inventoryItem.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: { select: { transactions: true, consumptionRules: true } } },
  })

  // Hydrate preferredVendorId to supplier name
  const supplierIds = Array.from(new Set(items.map((i) => i.preferredVendorId).filter(Boolean))) as string[]
  const suppliers = await db.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } })
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]))

  const itemsWithVendor = items.map((i) => ({
    ...i,
    preferredVendorName: i.preferredVendorId ? supplierMap.get(i.preferredVendorId) : null,
    stockStatus: i.currentStock <= 0 ? 'Out of Stock' : i.currentStock <= i.minStock ? 'Low Stock' : 'In Stock',
  }))

  // Summary
  const totalStockValue = items.reduce((s, i) => s + i.currentStock * i.costPrice, 0)
  const outOfStockCount = items.filter((i) => i.currentStock <= 0).length
  const lowStockCount = items.filter((i) => i.currentStock > 0 && i.currentStock <= i.minStock).length

  return NextResponse.json({
    items: itemsWithVendor,
    summary: { totalItems: items.length, totalStockValue, outOfStockCount, lowStockCount },
  })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, unit, category, currentStock, minStock, costPrice, preferredVendorId } = body
  if (!name || !unit) return NextResponse.json({ error: 'name and unit required' }, { status: 400 })

  const counter = await db.inventoryCounter.upsert({
    where: { id: 1 },
    update: { counter: { increment: 1 } },
    create: { id: 1, counter: 1 },
  })
  const itemId = `INV-${String(counter.counter).padStart(4, '0')}`

  const initialStock = parseFloat(currentStock || '0')

  // Transactional: create item + initial stock-in transaction
  const item = await db.$transaction(async (tx) => {
    const newItem = await tx.inventoryItem.create({
      data: {
        itemId,
        name,
        unit,
        category: category || 'consumable',
        currentStock: initialStock,
        minStock: parseFloat(minStock || '0'),
        costPrice: parseFloat(costPrice || '0'),
        preferredVendorId: preferredVendorId || null,
        lastUpdatedById: session.id,
        lastUpdatedByName: session.name,
      },
    })

    if (initialStock > 0) {
      await tx.inventoryTransaction.create({
        data: {
          itemId: newItem.id,
          type: 'in',
          quantity: initialStock,
          stockBefore: 0,
          stockAfter: initialStock,
          reason: 'Initial stock',
          performedBy: session.name,
        },
      })
    }
    return newItem
  })

  return NextResponse.json({ item })
}
