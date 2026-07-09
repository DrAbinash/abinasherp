import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/corporates/invoices — list all invoices
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const corporateId = searchParams.get('corporateId') || ''
  const status = searchParams.get('status') || ''

  const where: Record<string, unknown> = {}
  if (corporateId) where.corporateId = corporateId
  if (status) where.status = status

  const invoices = await db.corporateInvoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ invoices })
}

// POST /api/corporates/invoices — generate monthly invoice for a corporate
// Body: { corporateId, periodFrom, periodTo }
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { corporateId, periodFrom, periodTo } = body
  if (!corporateId || !periodFrom || !periodTo) {
    return NextResponse.json({ error: 'corporateId, periodFrom, periodTo required' }, { status: 400 })
  }

  const corporate = await db.corporate.findUnique({ where: { id: corporateId } })
  if (!corporate) return NextResponse.json({ error: 'Corporate not found' }, { status: 404 })

  // Find all bills for this corporate's patients in the period that are credit bills
  // (For now, find bills where patientId is in CorporatePatient for this corporate)
  const corporatePatients = await db.corporatePatient.findMany({
    where: { corporateId, isActive: true },
    select: { patientId: true },
  })
  const patientIds = corporatePatients.map((cp) => cp.patientId)

  const bills = await db.bill.findMany({
    where: {
      patientId: { in: patientIds },
      status: { in: ['paid', 'partial'] },
      createdAt: {
        gte: new Date(periodFrom + 'T00:00:00+05:30'),
        lte: new Date(periodTo + 'T23:59:59+05:30'),
      },
    },
  })

  if (bills.length === 0) {
    return NextResponse.json({ error: 'No bills found in this period for this corporate' }, { status: 400 })
  }

  const totalAmount = bills.reduce((s, b) => s + b.totalAmount, 0)
  const paidAmount = bills.reduce((s, b) => s + b.paidAmount, 0)

  // Generate invoice number
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const ym = `${yyyy}${mm}`
  const counter = await db.corporateInvoiceCounter.upsert({
    where: { yearMonth: ym },
    update: { counter: { increment: 1 } },
    create: { yearMonth: ym, counter: 1 },
  })
  const invoiceNumber = `INV-CORP-${ym}-${String(counter.counter).padStart(4, '0')}`

  // Due date = today + creditTermsDays
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + corporate.creditTermsDays)
  const dueDateStr = dueDate.toISOString().slice(0, 10)

  const invoice = await db.corporateInvoice.create({
    data: {
      invoiceNumber,
      corporateId,
      corporateName: corporate.name,
      periodFrom,
      periodTo,
      totalAmount,
      paidAmount,
      billCount: bills.length,
      status: totalAmount === paidAmount ? 'paid' : 'raised',
      dueDate: dueDateStr,
      billIds: JSON.stringify(bills.map((b) => b.id)),
    },
  })

  // Update corporate outstanding balance
  await db.corporate.update({
    where: { id: corporateId },
    data: { outstandingBalance: { increment: totalAmount - paidAmount } },
  })

  return NextResponse.json({ invoice, billCount: bills.length, totalAmount })
}
