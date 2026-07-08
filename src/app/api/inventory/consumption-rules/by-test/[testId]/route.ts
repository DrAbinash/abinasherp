import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// PUT /api/inventory/consumption-rules/by-test/:testId
// Atomic replace: delete all rules for testId, then insert new ones (dedup by itemId — sum quantities)
// Body: [{ itemId, quantity }, ...]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { testId } = await params
  const body = await req.json().catch(() => [])
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected array of { itemId, quantity }' }, { status: 400 })
  }

  // Dedup: sum quantities if same itemId appears twice
  const dedup = new Map<string, number>()
  for (const rule of body) {
    if (!rule.itemId) continue
    const qty = parseFloat(rule.quantity || '1')
    dedup.set(rule.itemId, (dedup.get(rule.itemId) || 0) + qty)
  }

  await db.$transaction([
    db.inventoryConsumptionRule.deleteMany({ where: { testId } }),
    ...Array.from(dedup.entries()).map(([itemId, quantity]) =>
      db.inventoryConsumptionRule.create({ data: { testId, itemId, quantity } }),
    ),
  ])

  const rules = await db.inventoryConsumptionRule.findMany({ where: { testId } })
  return NextResponse.json({ rules, count: rules.length })
}

// DELETE /api/inventory/consumption-rules/by-test/:testId — clear all rules for test
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { testId } = await params
  await db.inventoryConsumptionRule.deleteMany({ where: { testId } })
  return NextResponse.json({ ok: true })
}
