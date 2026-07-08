import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { istDateLabel } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''
  const q = searchParams.get('q') || ''
  const billId = searchParams.get('billId') || ''

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (billId) where.billId = billId
  if (q) {
    where.OR = [
      { patientName: { contains: q } },
      { patientPhone: { contains: q } },
      { reportNumber: { contains: q } },
      { testName: { contains: q } },
    ]
  }

  const reports = await db.patientReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ reports })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const {
    billId, billNumber, patientId, patientName, patientAge, patientGender,
    patientPhone, doctorName, testId, testName, templateId, values, notes, impression,
  } = body

  if (!patientName || !testName) {
    return NextResponse.json({ error: 'patientName and testName required' }, { status: 400 })
  }

  // Generate RPT-YYYYMM-####
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const ym = `${yyyy}${mm}`
  const counter = await db.patientReportCounter.upsert({
    where: { yearMonth: ym },
    update: { counter: { increment: 1 } },
    create: { yearMonth: ym, counter: 1 },
  })
  const reportNumber = `RPT-${ym}-${String(counter.counter).padStart(4, '0')}`

  const report = await db.patientReport.create({
    data: {
      reportNumber,
      billId: billId || null,
      billNumber: billNumber || null,
      patientId: patientId || null,
      patientName,
      patientAge: patientAge ? parseInt(patientAge) : null,
      patientGender: patientGender || null,
      patientPhone: patientPhone || null,
      doctorName: doctorName || null,
      testId: testId || null,
      testName,
      templateId: templateId || null,
      values: typeof values === 'string' ? values : JSON.stringify(values || {}),
      notes,
      impression,
      status: 'draft',
      reportedById: session.id,
      reportedByName: session.name,
    },
  })

  return NextResponse.json({ report })
}
