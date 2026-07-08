import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/inventory/low-stock — items where currentStock < minStock
export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // SQLite doesn't support cross-column comparison directly in Prisma where clause,
  // so fetch all active items and filter in JS
  const allItems = await db.inventoryItem.findMany({
    where: { isActive: true },
    orderBy: { currentStock: 'asc' },
  })
  const items = allItems.filter((i) => i.currentStock < i.minStock)
  return NextResponse.json({ items, count: items.length })
}
