import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { generatePatientId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit') || '50')

  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { patientId: { contains: q } },
        ],
      }
    : {}

  const patients = await db.patient.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ patients })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, phone, email, age, gender, address } = body
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const count = await db.patient.count()
  const patientId = generatePatientId(count + 1)

  const patient = await db.patient.create({
    data: {
      patientId,
      name,
      phone,
      email,
      age: age ? parseInt(age) : null,
      gender,
      address,
    },
  })
  return NextResponse.json({ patient })
}
