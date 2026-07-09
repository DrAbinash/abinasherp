import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// POST /api/inventory/:id/stock-in
// Body: { quantity, reason?, reference?, vendorId?, invoiceNumber?, invoiceDate?, unitCost? }
// Transactional: stock update + ledger insert are atomic
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { quantity, reason, reference, vendorId, invoiceNumber, invoiceDate, unitCost } = body

  const qty = parseFloat(quantity)
  if (!qty || qty <= 0) {
    return NextResponse.json({ error: 'quantity must be positive' }, { status: 400 })
  }

  const item = await db.inventoryItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const before = item.currentStock
  const after = before + qty

  // Atomic transaction
  const [updatedItem, transaction] = await db.$transaction([
    db.inventoryItem.update({
      where: { id },
      data: {
        currentStock: after,
        lastUpdatedById: session.id,
        lastUpdatedByName: session.name,
        ...(vendorId ? { preferredVendorId: vendorId } : {}),
        ...(unitCost ? { costPrice: parseFloat(unitCost) } : {}),
      },
    }),
    db.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: 'in',
        quantity: qty,
        stockBefore: before,
        stockAfter: after,
        reason: reason || null,
        reference: reference || null,
        performedBy: session.name,
        vendorId: vendorId || null,
        invoiceNumber: invoiceNumber || null,
        invoiceDate: invoiceDate || null,
        unitCost: unitCost ? parseFloat(unitCost) : null,
      },
    }),
  ])

  return NextResponse.json({ transaction, item: updatedItem, newStock: after })
}
