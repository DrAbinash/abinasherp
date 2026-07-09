import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const type = searchParams.get('type') || ''

  const where: Record<string, unknown> = { isActive: true }
  if (q) where.name = { contains: q }
  if (type) where.type = type

  const corporates = await db.corporate.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { rateCards: true, patients: true } },
    },
  })

  return NextResponse.json({ corporates })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { name, type, contactPerson, phone, email, gstin, pan, address, city, state, pincode, creditTermsDays, creditLimit, notes } = body
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const count = await db.corporate.count()
  const corporateId = `CORP-${String(count + 1).padStart(4, '0')}`

  const corporate = await db.corporate.create({
    data: {
      corporateId,
      name,
      type: type || 'corporate',
      contactPerson, phone, email, gstin, pan,
      address, city, state, pincode,
      creditTermsDays: parseInt(creditTermsDays || '30'),
      creditLimit: parseFloat(creditLimit || '0'),
      notes,
    },
  })

  return NextResponse.json({ corporate })
}
