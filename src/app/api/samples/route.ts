import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { istDateLabel } from '@/lib/auth'

// GET /api/samples — list samples with filters
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''
  const billId = searchParams.get('billId') || ''
  const q = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit') || '100')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (billId) where.billId = billId
  if (q) {
    where.OR = [
      { sampleId: { contains: q } },
      { patientName: { contains: q } },
      { patientPhone: { contains: q } },
      { billNumber: { contains: q } },
    ]
  }

  const samples = await db.sample.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json({ samples })
}

// POST /api/samples — create samples for a bill (one per order_test)
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { billId, containerTypes, priority } = body

  if (!billId) return NextResponse.json({ error: 'billId required' }, { status: 400 })

  const bill = await db.bill.findUnique({
    where: { id: billId },
    include: {
      patient: true,
      order: { include: { orderTests: { include: { test: true } } } },
    },
  })
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })

  // Check if samples already exist for this bill
  const existing = await db.sample.findMany({ where: { billId } })
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Samples already exist for this bill', samples: existing }, { status: 409 })
  }

  // Generate sample IDs: S-YYYYMMDD-####
  const today = istDateLabel().replace(/-/g, '')
  const counter = await db.sampleCounter.upsert({
    where: { dateStr: today },
    update: { counter: { increment: bill.order.orderTests.length } },
    create: { dateStr: today, counter: bill.order.orderTests.length },
  })

  const samples: any[] = []
  let seq = counter.counter - bill.order.orderTests.length
  for (const ot of bill.order.orderTests) {
    if (ot.status === 'cancelled') continue
    seq++
    const sampleId = `S-${today}-${String(seq).padStart(4, '0')}`
    const sample = await db.sample.create({
      data: {
        sampleId,
        billId: bill.id,
        billNumber: bill.billNumber,
        orderId: bill.orderId,
        orderTestId: ot.id,
        patientId: bill.patientId,
        patientName: bill.patient.name,
        patientPhone: bill.patient.phone || null,
        testName: ot.test.name,
        testCode: ot.test.code,
        barcodeData: sampleId,
        status: 'pending',
        priority: priority || 'normal',
        containerType: containerTypes?.[ot.id] || null,
      },
    })
    samples.push(sample)
  }

  return NextResponse.json({ samples, count: samples.length })
}
