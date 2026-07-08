import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// POST /api/inventory/:id/movement
// Body: { movementType: "in" | "out" | "adjust" | "expired", quantity, reason, referenceBillId? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { movementType, quantity, reason, referenceBillId, referenceExpenseBillId } = body

  if (!movementType || !quantity) {
    return NextResponse.json({ error: 'movementType and quantity required' }, { status: 400 })
  }

  const item = await db.inventoryItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const qty = parseFloat(quantity)
  // For "in", quantity is positive; for "out"/"expired", quantity is positive input but stored as negative
  let signedQty = qty
  if (movementType === 'out' || movementType === 'expired') {
    signedQty = -Math.abs(qty)
  } else if (movementType === 'in' || movementType === 'adjust') {
    signedQty = Math.abs(qty)
    if (movementType === 'adjust' && qty < 0) signedQty = qty // allow negative adjust
  }

  const newStock = item.currentStock + signedQty
  if (newStock < 0) {
    return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
  }

  // Transaction: create movement + update item stock
  const [movement, updatedItem] = await db.$transaction([
    db.inventoryMovement.create({
      data: {
        itemId: item.id,
        movementType,
        quantity: signedQty,
        reason,
        referenceBillId: referenceBillId || null,
        referenceExpenseBillId: referenceExpenseBillId || null,
        performedById: session.id,
        performedByName: session.name,
      },
    }),
    db.inventoryItem.update({
      where: { id: item.id },
      data: {
        currentStock: newStock,
        lastUpdatedById: session.id,
        lastUpdatedByName: session.name,
      },
    }),
  ])

  // Check low-stock alert
  let alert = null
  if (updatedItem.currentStock <= updatedItem.reorderLevel) {
    alert = {
      type: 'low_stock',
      message: `${updatedItem.name} is below reorder level (${updatedItem.currentStock} ${updatedItem.unit} ≤ ${updatedItem.reorderLevel} ${updatedItem.unit})`,
      itemId: updatedItem.id,
    }
  }

  return NextResponse.json({ movement, item: updatedItem, alert })
}
