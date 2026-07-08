import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// POST /api/inventory/:id/stock-out
// Body: { quantity, reason?, reference? }
// Refuses if stock < quantity (no negative stock)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { quantity, reason, reference } = body

  const qty = parseFloat(quantity)
  if (!qty || qty <= 0) {
    return NextResponse.json({ error: 'quantity must be positive' }, { status: 400 })
  }

  const item = await db.inventoryItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  if (item.currentStock < qty) {
    return NextResponse.json({
      error: `Insufficient stock. Current: ${item.currentStock} ${item.unit}, requested: ${qty} ${item.unit}`,
    }, { status: 400 })
  }

  const before = item.currentStock
  const after = before - qty

  const [updatedItem, transaction] = await db.$transaction([
    db.inventoryItem.update({
      where: { id },
      data: {
        currentStock: after,
        lastUpdatedById: session.id,
        lastUpdatedByName: session.name,
      },
    }),
    db.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: 'out',
        quantity: -qty, // negative for out
        stockBefore: before,
        stockAfter: after,
        reason: reason || null,
        reference: reference || null,
        performedBy: session.name,
      },
    }),
  ])

  // Low-stock alert check
  let alert = null
  if (updatedItem.currentStock <= updatedItem.minStock) {
    alert = {
      type: 'low_stock',
      message: `${updatedItem.name} is below min stock (${updatedItem.currentStock} ${updatedItem.unit} ≤ ${updatedItem.minStock} ${updatedItem.unit})`,
      itemId: updatedItem.id,
    }
  }

  return NextResponse.json({ transaction, item: updatedItem, newStock: after, alert })
}
