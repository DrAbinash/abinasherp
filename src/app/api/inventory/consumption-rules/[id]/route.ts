import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// DELETE /api/inventory/consumption-rules/:id — single delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.inventoryConsumptionRule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
