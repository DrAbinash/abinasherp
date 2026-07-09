import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// POST /api/inventory/:id/adjust
// Body: { newQuantity, reason? }
// Sets an absolute target (not a delta). quantity stored as (target - before).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { newQuantity, reason } = body

  const target = parseFloat(newQuantity)
  if (isNaN(target) || target < 0) {
    return NextResponse.json({ error: 'newQuantity must be ≥ 0' }, { status: 400 })
  }

  const item = await db.inventoryItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const before = item.currentStock
  const delta = target - before

  const [updatedItem, transaction] = await db.$transaction([
    db.inventoryItem.update({
      where: { id },
      data: {
        currentStock: target,
        lastUpdatedById: session.id,
        lastUpdatedByName: session.name,
      },
    }),
    db.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: 'adjustment',
        quantity: delta, // signed delta
        stockBefore: before,
        stockAfter: target,
        reason: reason || `Manual adjustment: ${before} → ${target}`,
        performedBy: session.name,
      },
    }),
  ])

  return NextResponse.json({ transaction, item: updatedItem, newStock: target })
}
