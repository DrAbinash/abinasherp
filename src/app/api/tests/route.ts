import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const categoryId = searchParams.get('categoryId') || ''

  const where: Record<string, unknown> = {}
  if (q) where.OR = [{ name: { contains: q } }, { code: { contains: q } }]
  if (categoryId) where.categoryId = categoryId

  const tests = await db.test.findMany({
    where,
    include: { category: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ tests })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { code, name, categoryId, price, cost, unit, referenceRange } = body
  if (!code || !name) return NextResponse.json({ error: 'Code and name required' }, { status: 400 })

  const test = await db.test.create({
    data: {
      code,
      name,
      categoryId: categoryId || null,
      price: parseFloat(price || '0'),
      cost: parseFloat(cost || '0'),
      unit,
      referenceRange,
    },
  })
  return NextResponse.json({ test })
}
