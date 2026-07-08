import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const record = await db.formFRecord.findUnique({ where: { id } })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ record })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = {}
  const allowed = [
    'patientName', 'age', 'childrenDetails', 'husbandFatherName', 'address', 'mobile',
    'referredBy', 'lmpWeeks', 'geneticHistory', 'basisDiagnosis', 'previousChildIssue',
    'indicationOther', 'doctorName', 'procedure', 'procedurePurpose', 'invasiveProcedure',
    'complication', 'labTests', 'prenatalResult', 'gestationalAgeWeeks', 'gestationalAgeDays',
    'ultrasoundResult', 'abnormality', 'procedureDate', 'consentDate', 'resultConveyed',
    'mtpAdvised', 'mtpDate', 'date', 'place', 'idCardVerified', 'status',
    'idCardExtractedName', 'idCardExtractedAddress',
  ]
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  const record = await db.formFRecord.update({ where: { id }, data: update })
  return NextResponse.json({ record })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.formFRecord.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
