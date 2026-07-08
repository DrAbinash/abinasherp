import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const doctorId = searchParams.get('doctorId') || ''

  const where = doctorId ? { doctorId } : {}
  const rules = await db.commissionRule.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { doctor: true },
  })
  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { doctorId, name, type, value, scope, categories, testIds, isExclusive, isActive } = body
  if (!doctorId || !name || !value) {
    return NextResponse.json({ error: 'doctorId, name, value required' }, { status: 400 })
  }

  const rule = await db.commissionRule.create({
    data: {
      doctorId,
      name,
      type: type || 'percentage',
      value: parseFloat(value),
      scope: scope || 'all',
      categories: categories ? JSON.stringify(categories) : null,
      testIds: testIds ? JSON.stringify(testIds) : null,
      isExclusive: !!isExclusive,
      isActive: isActive !== false,
    },
    include: { doctor: true },
  })
  return NextResponse.json({ rule })
}
