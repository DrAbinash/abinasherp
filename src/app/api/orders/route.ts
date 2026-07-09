import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { generateOrderNumber } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || ''
  const limit = parseInt(searchParams.get('limit') || '50')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (q) {
    where.OR = [
      { orderNumber: { contains: q } },
      { patient: { name: { contains: q } } },
      { patient: { phone: { contains: q } } },
      { patient: { patientId: { contains: q } } },
    ]
  }

  const orders = await db.order.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      patient: true,
      doctor: true,
      orderTests: { include: { test: true } },
      _count: { select: { bills: true } },
    },
  })
  return NextResponse.json({ orders })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { patientId, doctorId, testIds, isVip, notes } = body
  if (!patientId || !Array.isArray(testIds) || testIds.length === 0) {
    return NextResponse.json({ error: 'patientId and testIds required' }, { status: 400 })
  }

  // Compute total from tests
  const tests = await db.test.findMany({ where: { id: { in: testIds } } })
  if (tests.length !== testIds.length) {
    return NextResponse.json({ error: 'Some tests not found' }, { status: 400 })
  }
  const total = tests.reduce((s, t) => s + t.price, 0)

  const count = await db.order.count()
  const orderNumber = generateOrderNumber(count + 1)

  const order = await db.order.create({
    data: {
      orderNumber,
      patientId,
      doctorId: doctorId || null,
      totalAmount: total,
      isVip: !!isVip,
      notes,
      createdByName: session.name,
      orderTests: {
        create: tests.map((t) => ({ testId: t.id, price: t.price })),
      },
    },
    include: {
      patient: true,
      doctor: true,
      orderTests: { include: { test: true } },
    },
  })

  return NextResponse.json({ order })
}
