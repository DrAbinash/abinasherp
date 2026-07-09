import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''
  const q = searchParams.get('q') || ''

  const where: any = {}
  if (status) where.status = status
  if (q) {
    where.OR = [
      { patientName: { contains: q, mode: 'insensitive' as const } },
      { formFId: { contains: q, mode: 'insensitive' as const } },
      { billNumber: { contains: q, mode: 'insensitive' as const } },
      { mobile: { contains: q, mode: 'insensitive' as const } },
    ]
  }

  const records = await db.formFRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ records })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  // Generate FF-YYYY-####
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const counter = await db.formFCounter.upsert({
    where: { year: yyyy },
    update: { counter: { increment: 1 } },
    create: { year: yyyy, counter: 1 },
  })
  const formFId = `FF-${yyyy}-${String(counter.counter).padStart(4, '0')}`

  const record = await db.formFRecord.create({
    data: {
      formFId,
      billId: body.billId || null,
      billNumber: body.billNumber || null,
      patientId: body.patientId || null,
      patientName: body.patientName || null,
      age: body.age ? parseInt(body.age) : null,
      childrenDetails: body.childrenDetails || null,
      husbandFatherName: body.husbandFatherName || null,
      address: body.address || null,
      mobile: body.mobile || null,
      referredBy: body.referredBy || 'Self',
      lmpWeeks: body.lmpWeeks || null,
      geneticHistory: body.geneticHistory || null,
      basisDiagnosis: body.basisDiagnosis || null,
      previousChildIssue: body.previousChildIssue || null,
      indicationOther: body.indicationOther || null,
      doctorName: body.doctorName || null,
      procedure: body.procedure || null,
      procedurePurpose: body.procedurePurpose || null,
      invasiveProcedure: body.invasiveProcedure || null,
      complication: body.complication || null,
      labTests: body.labTests || null,
      prenatalResult: body.prenatalResult || null,
      gestationalAgeWeeks: body.gestationalAgeWeeks ? parseInt(body.gestationalAgeWeeks) : null,
      gestationalAgeDays: body.gestationalAgeDays ? parseInt(body.gestationalAgeDays) : null,
      ultrasoundResult: body.ultrasoundResult || null,
      abnormality: body.abnormality || null,
      procedureDate: body.procedureDate || null,
      consentDate: body.consentDate || null,
      resultConveyed: body.resultConveyed || null,
      mtpAdvised: body.mtpAdvised || null,
      mtpDate: body.mtpDate || null,
      date: body.date || null,
      place: body.place || null,
      idCardImageUrl: body.idCardImageUrl || null,
      idCardFrontUrl: body.idCardFrontUrl || null,
      idCardBackUrl: body.idCardBackUrl || null,
      idCardExtractedName: body.idCardExtractedName || null,
      idCardExtractedAddress: body.idCardExtractedAddress || null,
      idCardVerified: !!body.idCardVerified,
      ocrRawResponse: body.ocrRawResponse || null,
      ocrConfidence: parseFloat(body.ocrConfidence || '0'),
      status: body.status || 'draft',
      createdById: session.id,
      createdByName: session.name,
    },
  })

  return NextResponse.json({ record })
}
