import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const tier = searchParams.get('tier') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')

  const where: any = {}
  if (tier) where.tier = tier
  if (q) {
    where.OR = [
      { patientName: { contains: q, mode: 'insensitive' as const } },
      { patientPhone: { contains: q, mode: 'insensitive' as const } },
      { patientId: { contains: q, mode: 'insensitive' as const } },
    ]
  }

  const [total, records] = await Promise.all([
    db.loyaltyPoint.count({ where }),
    db.loyaltyPoint.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    records,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}
