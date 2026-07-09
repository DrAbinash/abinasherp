import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''

  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { specialization: { contains: q } },
        ],
      }
    : {}

  const doctors = await db.doctor.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: { select: { orders: true, commissionRules: true, payouts: true } } },
  })
  return NextResponse.json({ doctors })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, specialization, phone, email, hospitalAffiliation, address, area, registrationNumber, defaultCommissionType, defaultCommission } = body
  if (!name || !specialization) {
    return NextResponse.json({ error: 'Name and specialization required' }, { status: 400 })
  }

  const doctor = await db.doctor.create({
    data: {
      name,
      specialization,
      phone,
      email,
      hospitalAffiliation,
      address,
      area,
      registrationNumber,
      defaultCommissionType: defaultCommissionType || 'percentage',
      defaultCommission: parseFloat(defaultCommission || '0'),
    },
  })
  return NextResponse.json({ doctor })
}
