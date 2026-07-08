import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/inventory/:id/history — append-only stock ledger with vendor names
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const transactions = await db.inventoryTransaction.findMany({
    where: { itemId: id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  // Hydrate vendor names
  const vendorIds = Array.from(new Set(transactions.map((t) => t.vendorId).filter(Boolean))) as string[]
  const vendors = await db.supplier.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } })
  const vendorMap = new Map(vendors.map((v) => [v.id, v.name]))

  const history = transactions.map((t) => ({
    ...t,
    vendorName: t.vendorId ? vendorMap.get(t.vendorId) : null,
  }))

  return NextResponse.json({ history })
}
