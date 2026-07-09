import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { generatePatientId } from '@/lib/auth'
import { withUniqueRetry } from '@/lib/sequence'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200)

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q, mode: 'insensitive' as const } },
          { patientId: { contains: q, mode: 'insensitive' as const } },
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

  const patient = await withUniqueRetry(async () => {
    const count = await db.patient.count()
    const patientId = generatePatientId(count + 1)
    return db.patient.create({
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
  })
  return NextResponse.json({ patient })
}
