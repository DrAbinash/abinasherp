import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''

  const where: Record<string, unknown> = { isActive: true }
  if (q) where.name = { contains: q }
  if (category) where.category = category

  const packages = await db.package.findMany({
    where,
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ packages })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, description, category, testIds, mrp, sellingPrice, durationHours, fastingRequired, instructions } = body
  if (!name || !testIds || !Array.isArray(testIds)) {
    return NextResponse.json({ error: 'name and testIds (array) required' }, { status: 400 })
  }

  const count = await db.package.count()
  const packageId = `PKG-${String(count + 1).padStart(4, '0')}`

  // Get test names for totalTests count
  const tests = await db.test.findMany({ where: { id: { in: testIds } }, select: { id: true, name: true } })

  const pkg = await db.package.create({
    data: {
      packageId,
      name,
      description,
      category: category || 'general',
      testIds: JSON.stringify(testIds),
      totalTests: tests.length,
      mrp: parseFloat(mrp || '0'),
      sellingPrice: parseFloat(sellingPrice || '0'),
      durationHours: parseInt(durationHours || '2'),
      fastingRequired: !!fastingRequired,
      instructions,
    },
  })

  return NextResponse.json({ package: pkg })
}
