import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/corporates/:id/patients — list corporate-enrolled patients
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const patients = await db.corporatePatient.findMany({
    where: { corporateId: id, isActive: true },
    include: { patient: { select: { id: true, name: true, patientId: true, phone: true, age: true, gender: true } } },
  })
  return NextResponse.json({ patients })
}

// POST /api/corporates/:id/patients — enroll patient
// Body: { patientId, employeeId?, relation? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { patientId, employeeId, relation } = body
  if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 })

  const cp = await db.corporatePatient.upsert({
    where: { corporateId_patientId: { corporateId: id, patientId } },
    update: { employeeId, relation: relation || 'self', isActive: true },
    create: { corporateId: id, patientId, employeeId, relation: relation || 'self' },
  })

  return NextResponse.json({ patient: cp })
}
