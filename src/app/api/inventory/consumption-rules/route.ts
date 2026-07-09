import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/inventory/consumption-rules — list with test/item names
export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rules = await db.inventoryConsumptionRule.findMany({
    include: { item: { select: { name: true, unit: true } } },
    orderBy: { createdAt: 'desc' },
  })

  // Hydrate test names
  const testIds = Array.from(new Set(rules.map((r) => r.testId)))
  const tests = await db.test.findMany({ where: { id: { in: testIds } }, select: { id: true, name: true, code: true } })
  const testMap = new Map(tests.map((t) => [t.id, t]))

  return NextResponse.json({
    rules: rules.map((r) => ({
      ...r,
      testName: testMap.get(r.testId)?.name || 'Unknown',
      testCode: testMap.get(r.testId)?.code || '',
      itemName: r.item.name,
      itemUnit: r.item.unit,
    })),
  })
}

// POST /api/inventory/consumption-rules — single insert
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { testId, itemId, quantity } = body
  if (!testId || !itemId) return NextResponse.json({ error: 'testId and itemId required' }, { status: 400 })

  const rule = await db.inventoryConsumptionRule.create({
    data: {
      testId,
      itemId,
      quantity: parseFloat(quantity || '1'),
    },
  })
  return NextResponse.json({ rule })
}
